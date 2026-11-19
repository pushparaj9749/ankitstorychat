package site.beyondredeye.ankitcutz.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Timeline edits are the ones that silently ruin an export (a 40 ms hole, a clip that
 * jumps), so every rule here is pinned down by a test.
 */
class TimelineTest {

    private fun clip(name: String, durationMs: Long, id: String = name) = Clip(
        id = id,
        uri = "content://test/$name",
        name = name,
        isVideo = true,
        sourceDurationMs = durationMs,
        sourceEndMs = durationMs,
    )

    @Test
    fun `add appends after the previous clip instead of overlapping`() {
        val timeline = Timeline.add(Timeline.add(emptyList(), clip("a", 1_000)), clip("b", 2_000))
        assertEquals(0L, timeline[0].timelineStartMs)
        assertEquals(1_000L, timeline[1].timelineStartMs)
        assertEquals(3_000L, Timeline.durationOf(timeline))
    }

    @Test
    fun `clipAt ignores gaps and the exact end boundary`() {
        val timeline = Timeline.add(emptyList(), clip("a", 1_000))
        assertNotNull(Timeline.clipAt(timeline, 0))
        assertNotNull(Timeline.clipAt(timeline, 999))
        assertNull(Timeline.clipAt(timeline, 1_000))
    }

    @Test
    fun `remove closes the gap so export never contains a black hole`() {
        val timeline = listOf(clip("a", 1_000), clip("b", 1_000), clip("c", 1_000))
        val reflowed = Timeline.reflow(timeline)
        val removed = Timeline.remove(reflowed, "b")

        assertEquals(2, removed.size)
        assertEquals(0L, removed[0].timelineStartMs)
        assertEquals(1_000L, removed[1].timelineStartMs)
        assertEquals(2_000L, Timeline.durationOf(removed))
    }

    @Test
    fun `move reorders and keeps the sequence gapless`() {
        val timeline = Timeline.reflow(listOf(clip("a", 1_000), clip("b", 2_000), clip("c", 3_000)))
        val moved = Timeline.move(timeline, 2, 0)

        assertEquals(listOf("c", "a", "b"), moved.map { it.name })
        assertEquals(0L, moved[0].timelineStartMs)
        assertEquals(3_000L, moved[1].timelineStartMs)
        assertEquals(4_000L, moved[2].timelineStartMs)
    }

    @Test
    fun `trim keeps a minimum length and never exceeds the source`() {
        val timeline = Timeline.reflow(listOf(clip("a", 5_000)))
        val id = timeline[0].id

        val trimmedHead = Timeline.trim(timeline, id, 1_000, 4_000)
        assertEquals(1_000L, trimmedHead[0].sourceStartMs)
        assertEquals(4_000L, trimmedHead[0].sourceEndMs)
        assertEquals(3_000L, trimmedHead[0].durationMs)

        val collapsed = Timeline.trim(timeline, id, 2_000, 2_000)
        assertTrue(collapsed[0].durationMs >= Timeline.MIN_CLIP_MS)

        val oversized = Timeline.trim(timeline, id, 0, 99_000)
        assertEquals(5_000L, oversized[0].sourceEndMs)
    }

    @Test
    fun `trimming the head shifts later clips so nothing overlaps`() {
        val timeline = Timeline.reflow(listOf(clip("a", 4_000), clip("b", 2_000)))
        val trimmed = Timeline.trim(timeline, timeline[0].id, 1_000, 4_000)

        assertEquals(3_000L, Timeline.durationOf(listOf(trimmed[0])))
        assertEquals(3_000L, trimmed[1].timelineStartMs)
    }

    @Test
    fun `split produces two halves that add up to the original`() {
        val timeline = Timeline.reflow(listOf(clip("a", 6_000)))
        val split = Timeline.split(timeline, timeline[0].id, 2_500)

        assertEquals(2, split.size)
        assertEquals(2_500L, split[0].durationMs)
        assertEquals(3_500L, split[1].durationMs)
        assertEquals(6_000L, Timeline.durationOf(split))
        assertEquals(2_500L, split[1].sourceStartMs)
    }

    @Test
    fun `split at an edge is refused instead of creating an empty clip`() {
        val timeline = Timeline.reflow(listOf(clip("a", 6_000)))
        val id = timeline[0].id

        assertEquals(timeline, Timeline.split(timeline, id, 0))
        assertEquals(timeline, Timeline.split(timeline, id, 6_000))
        assertEquals(timeline, Timeline.split(timeline, id, 50))
        assertEquals(timeline, Timeline.split(timeline, id, 5_950))
    }

    @Test
    fun `split of an unknown clip is a no-op`() {
        val timeline = Timeline.reflow(listOf(clip("a", 6_000)))
        assertEquals(timeline, Timeline.split(timeline, "missing", 1_000))
    }

    @Test
    fun `source time follows the playhead inside the trimmed range`() {
        val trimmed = Clip(
            uri = "content://test/a",
            name = "a",
            isVideo = true,
            sourceDurationMs = 10_000,
            sourceStartMs = 3_000,
            sourceEndMs = 8_000,
            timelineStartMs = 0,
        )
        assertEquals(3_000L, trimmed.sourceTimeAt(0))
        assertEquals(5_500L, trimmed.sourceTimeAt(2_500))
        assertEquals(8_000L, trimmed.sourceTimeAt(99_000))
    }
}
