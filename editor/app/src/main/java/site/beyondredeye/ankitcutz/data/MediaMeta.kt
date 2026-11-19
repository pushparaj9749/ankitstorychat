package site.beyondredeye.ankitcutz.data

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns

/**
 * What the picker told us about a file, before it becomes a Clip.
 * Duration is read once and stored, so trims can be restored without re-probing.
 */
data class PickedMedia(
    val uri: String,
    val name: String,
    val isVideo: Boolean,
    val durationMs: Long,
)

object MediaMeta {

    /** Images are given 3 s by default — enough to be visible, easy to trim. */
    const val IMAGE_DURATION_MS = 3_000L

    fun probe(context: Context, uri: Uri): PickedMedia? {
        val resolver = context.contentResolver
        val type = resolver.getType(uri).orEmpty()
        val isVideo = type.startsWith("video")
        val name = displayName(context, uri) ?: "Clip"

        val duration = when {
            isVideo -> videoDurationMs(context, uri) ?: 0L
            else -> IMAGE_DURATION_MS
        }
        if (duration <= 0L) return null

        // The picker grants temporary access; keep it across restarts when the provider allows.
        runCatching {
            resolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        return PickedMedia(uri.toString(), name, isVideo, duration)
    }

    private fun displayName(context: Context, uri: Uri): String? =
        runCatching {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst()) cursor.getString(0) else null
                }
        }.getOrNull()

    private fun videoDurationMs(context: Context, uri: Uri): Long? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, uri)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
        } catch (_: Exception) {
            null
        } finally {
            runCatching { retriever.release() }
        }
    }
}
