package site.beyondredeye.ankitcutz.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import site.beyondredeye.ankitcutz.model.Clip
import site.beyondredeye.ankitcutz.model.EffectStack
import site.beyondredeye.ankitcutz.model.EffectType
import site.beyondredeye.ankitcutz.model.Layer
import site.beyondredeye.ankitcutz.model.LayerType
import site.beyondredeye.ankitcutz.model.Project
import site.beyondredeye.ankitcutz.model.randomId

/**
 * Saving is the one feature where a bug costs the user their work, so the round trip,
 * the corruption guard and the sort order are all tested. JVM-only: real files, no
 * Robolectric, no emulator.
 */
class ProjectStoreTest {

    @get:Rule
    val temp = TemporaryFolder()

    private fun store() = ProjectStore(temp.newFolder("projects"))

    private fun project(name: String = "Demo") = Project(
        id = randomId(),
        name = name,
        layers = listOf(
            Layer(
                name = "Clip 01",
                type = LayerType.VIDEO,
                clips = listOf(
                    Clip(
                        uri = "content://media/1",
                        name = "IMG_0001.mp4",
                        isVideo = true,
                        sourceDurationMs = 12_000,
                        sourceEndMs = 12_000,
                    ),
                ),
                effects = EffectStack.add(emptyList(), EffectType.DEEP_GLOW),
            ),
        ),
    )

    @Test
    fun `save then load returns the same project`() {
        val store = store()
        val saved = store.save(project())
        val loaded = store.load(saved.id)

        assertNotNull(loaded)
        assertEquals(saved.name, loaded!!.name)
        assertEquals(saved.layers.size, loaded.layers.size)
        assertEquals(saved.layers.first().clips.first().uri, loaded.layers.first().clips.first().uri)
        assertEquals(
            saved.layers.first().effects.first().type,
            loaded.layers.first().effects.first().type,
        )
    }

    @Test
    fun `every effect parameter and keyframe survives the round trip`() {
        val store = store()
        val base = project()
        val withKeys = base.copy(
            layers = listOf(
                base.layers.first().let { layer ->
                    val keyed = EffectStack.toggleKeyframe(
                        layer.effects,
                        layer.effects.first().id,
                        "radius",
                        500_000,
                    )
                    layer.copy(effects = keyed)
                },
            ),
        )
        val saved = store.save(withKeys)
        val loaded = store.load(saved.id)!!

        val param = loaded.layers.first().effects.first().params.getValue("radius")
        assertEquals(500_000L, param.keyframes.single().timeUs)
        assertEquals(
            withKeys.layers.first().effects.first().params.getValue("radius").value,
            param.value,
            0.001f,
        )
    }

    @Test
    fun `save stamps updatedAt and keeps createdAt`() {
        val store = store()
        val saved = store.save(project())

        assertTrue(saved.updatedAt > 0)
        assertEquals(saved.createdAt, store.load(saved.id)!!.createdAt)
    }

    @Test
    fun `a corrupt file is skipped instead of crashing the projects screen`() {
        val store = store()
        val good = store.save(project("Good"))
        store.fileFor("broken").writeText("{ not json")

        val summaries = store.summaries()
        assertEquals(1, summaries.size)
        assertEquals(good.id, summaries.single().id)
        assertNull(store.load("broken"))
    }

    @Test
    fun `summaries come back newest first`() {
        val store = store()
        val first = store.save(project("First"))
        Thread.sleep(5)
        val second = store.save(project("Second"))

        assertEquals(listOf(second.id, first.id), store.summaries().map { it.id })
    }

    @Test
    fun `summary counts match the project contents`() {
        val store = store()
        store.save(project())

        val summary = store.summaries().single()
        assertEquals(1, summary.clipCount)
        assertEquals(1, summary.effectCount)
        assertEquals(12_000L, summary.durationMs)
        assertEquals("9:16", summary.aspectLabel)
    }

    @Test
    fun `delete removes the file and the row`() {
        val store = store()
        val saved = store.save(project())

        assertTrue(store.delete(saved.id))
        assertFalse(store.fileFor(saved.id).exists())
        assertTrue(store.summaries().isEmpty())
    }

    @Test
    fun `duplicate copies content under a new id and leaves the original alone`() {
        val store = store()
        val original = store.save(project("Cut"))

        val copy = store.duplicate(original)
        assertEquals(2, store.summaries().size)
        assertTrue(copy.id != original.id)
        assertEquals("Cut copy", copy.name)
        assertEquals(
            original.layers.first().clips.first().uri,
            store.load(copy.id)!!.layers.first().clips.first().uri,
        )
    }

    @Test
    fun `unknown json fields from a newer build are ignored`() {
        val store = store()
        val saved = store.save(project())
        val file = store.fileFor(saved.id)
        file.writeText(file.readText().replaceFirst("{", "{\n  \"futureField\": 42,"))

        assertNotNull(store.load(saved.id))
    }

    @Test
    fun `loading a project that never existed returns null`() {
        assertNull(store().load("nope"))
    }
}
