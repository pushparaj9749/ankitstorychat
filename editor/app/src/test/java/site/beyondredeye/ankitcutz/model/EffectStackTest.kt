package site.beyondredeye.ankitcutz.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The stack is where "effects never work" bugs hide, and it is pure Kotlin, so it is
 * tested without an emulator. Each test names the promise it protects.
 */
class EffectStackTest {

    private fun glow() = EffectStack.add(emptyList(), EffectType.DEEP_GLOW)
    private fun blur() = EffectStack.add(emptyList(), EffectType.GAUSSIAN_BLUR)

    // --- adding ------------------------------------------------------------

    @Test
    fun `added effect arrives with every parameter filled in`() {
        val stack = EffectStack.add(emptyList(), EffectType.DEEP_GLOW)
        val effect = stack.single()
        val schema = schemaFor(EffectType.DEEP_GLOW)

        assertEquals(schema.params.size, effect.params.size)
        schema.params.forEach { param ->
            assertTrue("missing ${param.key}", effect.params.containsKey(param.key))
        }
    }

    @Test
    fun `defaults line up with the schema, not with zero`() {
        val effect = glow().single()
        val radius = effect.params.getValue("radius")
        assertEquals(schemaFor(EffectType.DEEP_GLOW).param("radius")!!.default, radius.value, 0.001f)
        assertNotEquals(0f, radius.value)
    }

    @Test
    fun `addAt inserts at the requested index and clamps out-of-range input`() {
        val stack = blur() + glow()
        val inserted = EffectStack.addAt(stack, EffectType.FILM_GRAIN, 1)
        assertEquals(EffectType.FILM_GRAIN, inserted[1].type)

        val clamped = EffectStack.addAt(stack, EffectType.VHS, 99)
        assertEquals(EffectType.VHS, clamped.last().type)

        val below = EffectStack.addAt(stack, EffectType.VHS, -4)
        assertEquals(EffectType.VHS, below.first().type)
    }

    @Test
    fun `order is render order, so a new effect goes on top of the stack end`() {
        val stack = EffectStack.add(glow(), EffectType.VHS)
        assertEquals(EffectType.DEEP_GLOW, stack.first().type)
        assertEquals(EffectType.VHS, stack.last().type)
    }

    // --- removing / duplicating -------------------------------------------

    @Test
    fun `remove only drops the requested effect`() {
        val stack = glow() + blur()
        val removed = EffectStack.remove(stack, stack.first().id)
        assertEquals(1, removed.size)
        assertEquals(EffectType.GAUSSIAN_BLUR, removed.single().type)
    }

    @Test
    fun `remove of an unknown id is a no-op`() {
        val stack = glow()
        assertEquals(stack, EffectStack.remove(stack, "nope"))
    }

    @Test
    fun `duplicate lands directly under the original and gets a new id`() {
        val stack = glow() + blur()
        val copy = EffectStack.duplicate(stack, stack.first().id)

        assertEquals(3, copy.size)
        assertEquals(EffectType.DEEP_GLOW, copy[1].type)
        assertNotEquals(copy[0].id, copy[1].id)
        assertEquals(copy[0].params, copy[1].params)
    }

    // --- toggling / moving -------------------------------------------------

    @Test
    fun `toggle flips one effect and leaves the rest alone`() {
        val stack = glow() + blur()
        val toggled = EffectStack.toggle(stack, stack.first().id)

        assertFalse(toggled.first().enabled)
        assertTrue(toggled.last().enabled)
    }

    @Test
    fun `move swaps neighbours and clamps the target`() {
        val stack = glow() + EffectStack.add(emptyList(), EffectType.FILM_GRAIN)
        val moved = EffectStack.move(stack, 0, 1)
        assertEquals(EffectType.FILM_GRAIN, moved.first().type)
        assertEquals(EffectType.DEEP_GLOW, moved.last().type)

        val pushed = EffectStack.move(stack, 0, 10)
        assertEquals(EffectType.DEEP_GLOW, pushed.last().type)
    }

    @Test
    fun `move with an invalid source keeps the stack untouched`() {
        val stack = glow()
        assertEquals(stack, EffectStack.move(stack, 7, 0))
    }

    // --- parameters --------------------------------------------------------

    @Test
    fun `updateParam changes only the targeted key of the targeted effect`() {
        val stack = glow() + blur()
        val updated = EffectStack.updateParam(stack, stack.first().id, "radius", 88f)

        assertEquals(88f, updated.first().params.getValue("radius").value, 0.001f)
        assertEquals(stack.first().params.getValue("intensity"), updated.first().params.getValue("intensity"))
        assertEquals(stack.last(), updated.last())
    }

    @Test
    fun `updateParam preserves keyframes, so motion is not wiped by a nudge`() {
        val stack = glow()
        val id = stack.first().id
        val keyed = EffectStack.toggleKeyframe(stack, id, "radius", 0L)
        val updated = EffectStack.updateParam(keyed, id, "radius", 12f)

        assertEquals(1, updated.first().params.getValue("radius").keyframes.size)
        assertEquals(12f, updated.first().params.getValue("radius").value, 0.001f)
    }

    @Test
    fun `preset applies in one step and leaves unrelated keys alone`() {
        val stack = glow()
        val id = stack.first().id
        val preset = deepGlowPresets.first { it.name == "Neon" }
        val applied = EffectStack.applyPreset(stack, id, preset)

        preset.values.forEach { (key, value) ->
            assertEquals("$key", value, applied.first().params.getValue(key).value, 0.001f)
        }
        assertEquals(
            stack.first().params.getValue("softness"),
            applied.first().params.getValue("softness"),
        )
    }

    @Test
    fun `every shipped preset only mentions keys the schema actually has`() {
        val schema = schemaFor(EffectType.DEEP_GLOW)
        deepGlowPresets.forEach { preset ->
            preset.values.keys.forEach { key ->
                assertTrue("${preset.name} references unknown key $key", schema.param(key) != null)
            }
        }
    }

    // --- keyframes ---------------------------------------------------------

    @Test
    fun `first keyframe records the current value at that time`() {
        val stack = glow()
        val id = stack.first().id
        val keyed = EffectStack.toggleKeyframe(stack, id, "radius", 500_000L)

        val frame = keyed.first().params.getValue("radius").keyframes.single()
        assertEquals(500_000L, frame.timeUs)
        assertEquals(stack.first().params.getValue("radius").value, frame.value, 0.001f)
    }

    @Test
    fun `pressing the diamond again removes the key at that time`() {
        val stack = glow()
        val id = stack.first().id
        val on = EffectStack.toggleKeyframe(stack, id, "radius", 0L)
        val off = EffectStack.toggleKeyframe(on, id, "radius", 0L)

        assertTrue(off.first().params.getValue("radius").keyframes.isEmpty())
    }

    @Test
    fun `keyframes stay sorted no matter what order they were added`() {
        val stack = glow()
        val id = stack.first().id
        val keyed = EffectStack
            .toggleKeyframe(stack, id, "radius", 2_000_000L)
            .let { EffectStack.toggleKeyframe(it, id, "radius", 0L) }
            .let { EffectStack.toggleKeyframe(it, id, "radius", 1_000_000L) }

        val times = keyed.first().params.getValue("radius").keyframes.map { it.timeUs }
        assertEquals(listOf(0L, 1_000_000L, 2_000_000L), times)
    }

    // --- cost / budget -----------------------------------------------------

    @Test
    fun `pass cost follows the schema weight`() {
        assertEquals(5, schemaFor(EffectType.DEEP_GLOW).passCost)
        assertEquals(3, schemaFor(EffectType.GAUSSIAN_BLUR).passCost)
        assertEquals(2, schemaFor(EffectType.FRAME_ECHO).passCost)
        assertEquals(1, schemaFor(EffectType.VHS).passCost)
    }

    @Test
    fun `disabled effects cost nothing, because they are not rendered`() {
        val stack = glow() + blur()
        assertEquals(8, EffectStack.totalPasses(stack))

        val off = EffectStack.toggle(stack, stack.first().id)
        assertEquals(3, EffectStack.totalPasses(off))
    }

    @Test
    fun `device budget is honest about cheap phones`() {
        assertEquals(3, EffectStack.budgetFor(3))
        assertEquals(5, EffectStack.budgetFor(4))
        assertEquals(5, EffectStack.budgetFor(6))
        assertEquals(8, EffectStack.budgetFor(8))
        assertEquals(8, EffectStack.budgetFor(12))
    }
}
