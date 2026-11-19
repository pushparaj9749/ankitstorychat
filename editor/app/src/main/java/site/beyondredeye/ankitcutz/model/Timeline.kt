package site.beyondredeye.ankitcutz.model

/**
 * Timeline math, pure and unit-tested (PLAN.md §9). No Android, no Compose:
 * trim/split/move bugs are the ones that silently ruin an export, so they live here
 * where they can be tested in milliseconds instead of on a phone.
 */
object Timeline {

    /** Shortest clip we allow: one frame at 30 fps would be 33 ms, but 100 ms is sane. */
    const val MIN_CLIP_MS = 100L

    fun durationOf(clips: List<Clip>): Long = clips.maxOfOrNull { it.timelineEndMs } ?: 0L

    /** Clip covering [timeMs]; gaps return null so the preview can show black. */
    fun clipAt(clips: List<Clip>, timeMs: Long): Clip? =
        clips.firstOrNull { timeMs >= it.timelineStartMs && timeMs < it.timelineEndMs }

    /** Appends at the end of the last clip, so imports never overwrite each other. */
    fun add(clips: List<Clip>, clip: Clip): List<Clip> {
        val start = durationOf(clips)
        return clips + clip.copy(timelineStartMs = start)
    }

    fun remove(clips: List<Clip>, id: String): List<Clip> {
        val remaining = clips.filterNot { it.id == id }
        // Removing a clip closes the gap instead of leaving a hole nobody can see.
        return reflow(remaining)
    }

    /** Re-flows clips back-to-back in list order; keeps the timeline gapless. */
    fun reflow(clips: List<Clip>): List<Clip> {
        var cursor = 0L
        return clips.map { clip ->
            val next = clip.copy(timelineStartMs = cursor)
            cursor += next.durationMs
            next
        }
    }

    fun move(clips: List<Clip>, from: Int, to: Int): List<Clip> {
        if (from !in clips.indices) return clips
        val list = clips.toMutableList()
        val item = list.removeAt(from)
        list.add(to.coerceIn(0, list.size), item)
        return reflow(list)
    }

    /**
     * Trims the in/out of a clip. The head trim also shifts later clips so the sequence
     * stays gapless — that is what users expect when they pull a clip's left edge.
     */
    fun trim(clips: List<Clip>, id: String, newStartMs: Long, newEndMs: Long): List<Clip> {
        val index = clips.indexOfFirst { it.id == id }
        if (index < 0) return clips

        val clip = clips[index]
        val start = newStartMs.coerceIn(0L, clip.sourceDurationMs - MIN_CLIP_MS)
        val end = newEndMs.coerceIn(start + MIN_CLIP_MS, clip.sourceDurationMs)
        if (start == clip.sourceStartMs && end == clip.sourceEndMs) return clips

        val trimmed = clips.toMutableList()
        trimmed[index] = clip.copy(sourceStartMs = start, sourceEndMs = end)
        return reflow(trimmed)
    }

    /**
     * Splits at an absolute timeline position. Returns the list unchanged when the point
     * is not strictly inside the clip (a zero-length half is never created).
     */
    fun split(clips: List<Clip>, id: String, atTimelineMs: Long): List<Clip> {
        val index = clips.indexOfFirst { it.id == id }
        if (index < 0) return clips

        val clip = clips[index]
        if (atTimelineMs <= clip.timelineStartMs + MIN_CLIP_MS) return clips
        if (atTimelineMs >= clip.timelineEndMs - MIN_CLIP_MS) return clips

        val cutInSource = clip.sourceStartMs + (atTimelineMs - clip.timelineStartMs)
        val left = clip.copy(sourceEndMs = cutInSource)
        val right = clip.copy(
            id = randomId(),
            sourceStartMs = cutInSource,
            timelineStartMs = atTimelineMs,
            name = clip.name,
        )
        val next = clips.toMutableList().apply {
            set(index, left)
            add(index + 1, right)
        }
        return reflow(next)
    }

    /** Clip whose row should be highlighted for a playhead position. */
    fun indexOfClipAt(clips: List<Clip>, timeMs: Long): Int =
        clips.indexOfFirst { timeMs >= it.timelineStartMs && timeMs < it.timelineEndMs }
}
