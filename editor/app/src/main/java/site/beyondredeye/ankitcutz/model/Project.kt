package site.beyondredeye.ankitcutz.model

import kotlinx.serialization.Serializable
import java.util.UUID

/**
 * A project is the whole edit: layers, their clips, their effect stacks.
 *
 * Saved as JSON (data/ProjectStore) because it is small, diffable, survives schema changes
 * with `ignoreUnknownKeys`, and can be inspected when something looks wrong. Media stays
 * where it is — we store the `content://` URI, never a copy.
 */
@Serializable
data class Project(
    val id: String = randomId(),
    val name: String,
    val width: Int = 1080,
    val height: Int = 1920,
    val layers: List<Layer> = listOf(Layer(name = "Clip 01", type = LayerType.VIDEO)),
    /** Epoch millis; the projects list sorts on this. */
    val updatedAt: Long = 0L,
    val createdAt: Long = 0L,
) {
    val aspectLabel: String
        get() = when {
            width == height -> "1:1"
            width > height -> "16:9"
            else -> "9:16"
        }

    val totalDurationMs: Long
        get() = layers.maxOfOrNull { Timeline.durationOf(it.clips) } ?: 0L

    val videoLayer: Layer?
        get() = layers.firstOrNull { it.type == LayerType.VIDEO }

    val clipCount: Int get() = layers.sumOf { it.clips.size }

    val effectCount: Int get() = layers.sumOf { it.effectCount }

    fun layer(id: String): Layer? = layers.firstOrNull { it.id == id }

    fun replaceLayer(updated: Layer): Project =
        copy(layers = layers.map { if (it.id == updated.id) updated else it })

    fun touch(now: Long = System.currentTimeMillis()): Project =
        copy(updatedAt = now, createdAt = if (createdAt == 0L) now else createdAt)
}

/** Lightweight row for the projects screen; no need to load full stacks. */
data class ProjectSummary(
    val id: String,
    val name: String,
    val aspectLabel: String,
    val clipCount: Int,
    val effectCount: Int,
    val durationMs: Long,
    val updatedAt: Long,
)

/**
 * One clip on a layer's track.
 *
 * [sourceStartMs]..[sourceEndMs] is the trim inside the original file;
 * [timelineStartMs] is where it sits on the timeline. Gaps are legal (black), overlaps are
 * not created by the editor — [Timeline.add] always appends.
 */
@Serializable
data class Clip(
    val id: String = randomId(),
    val uri: String,
    val name: String,
    val isVideo: Boolean,
    /** Full length of the source file, so trims can be undone without re-probing. */
    val sourceDurationMs: Long,
    val sourceStartMs: Long = 0L,
    val sourceEndMs: Long = sourceDurationMs,
    val timelineStartMs: Long = 0L,
) {
    val durationMs: Long get() = (sourceEndMs - sourceStartMs).coerceAtLeast(1L)
    val timelineEndMs: Long get() = timelineStartMs + durationMs

    /** Where in the source file the timeline's playhead sits. */
    fun sourceTimeAt(timelineMs: Long): Long =
        sourceStartMs + (timelineMs - timelineStartMs).coerceIn(0L, durationMs)
}

fun randomId(): String = UUID.randomUUID().toString().replace("-", "").take(10)
