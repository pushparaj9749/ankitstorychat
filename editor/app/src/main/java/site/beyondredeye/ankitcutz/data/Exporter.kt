package site.beyondredeye.ankitcutz.data

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import androidx.media3.common.ClippingConfiguration
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import site.beyondredeye.ankitcutz.model.Clip
import java.io.File

/**
 * Trim export via Media3 Transformer (Apache-2.0). No FFmpeg, no GPL, no native blobs
 * beyond what ExoPlayer already ships (PLAN.md §6.8).
 *
 * This is the honest "M3 first export" in miniature: one clip, in/out points, H.264 MP4.
 * The GPU effect pipeline and multi-clip composition come with the renderer; the UI says
 * so rather than silently ignoring the effect stack.
 */
class Exporter(private val context: Context) {

    private val main = Handler(Looper.getMainLooper())
    private var transformer: Transformer? = null
    private var progressTask: Runnable? = null

    val outputDir: File
        get() = File(context.getExternalFilesDir(Environment.DIRECTORY_MOVIES) ?: context.filesDir, "AnkitCutz")

    fun export(
        clip: Clip,
        onProgress: (Float) -> Unit,
        onSuccess: (File) -> Unit,
        onError: (String) -> Unit,
    ) {
        cancel()
        val dir = outputDir.also { if (!it.exists()) it.mkdirs() }
        val output = File(dir, "AnkitCutz_${System.currentTimeMillis()}.mp4")

        val item = EditedMediaItem.Builder(MediaItem.fromUri(Uri.parse(clip.uri)))
            .setClippingConfiguration(
                ClippingConfiguration.Builder()
                    .setStartPositionMs(clip.sourceStartMs)
                    .setEndPositionMs(clip.sourceEndMs)
                    .build(),
            )
            .build()

        val built = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .addListener(object : Transformer.Listener {
                override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                    stopPolling()
                    onSuccess(output)
                }

                override fun onError(
                    composition: Composition,
                    exportResult: ExportResult,
                    exportException: ExportException,
                ) {
                    stopPolling()
                    onError(exportException.message ?: "Export failed (${exportException.errorCode})")
                }
            })
            .build()

        transformer = built
        runCatching { built.start(item, output.absolutePath) }
            .onFailure {
                stopPolling()
                onError(it.message ?: "Could not start export")
                return
            }

        val holder = ProgressHolder()
        val poll = object : Runnable {
            override fun run() {
                val state = transformer?.getProgress(holder) ?: return
                if (state == Transformer.PROGRESS_STATE_AVAILABLE) onProgress(holder.progress.coerceIn(0, 100) / 100f)
                main.postDelayed(this, 400)
            }
        }
        progressTask = poll
        main.postDelayed(poll, 400)
    }

    fun cancel() {
        stopPolling()
        transformer?.cancel()
        transformer = null
    }

    private fun stopPolling() {
        progressTask?.let { main.removeCallbacks(it) }
        progressTask = null
    }
}
