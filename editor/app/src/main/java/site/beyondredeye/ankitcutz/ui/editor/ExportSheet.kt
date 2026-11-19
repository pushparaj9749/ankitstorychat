package site.beyondredeye.ankitcutz.ui.editor

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import site.beyondredeye.ankitcutz.data.Exporter
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens
import java.io.File

private sealed interface ExportPhase {
    data object Idle : ExportPhase
    data class Running(val progress: Float) : ExportPhase
    data class Done(val file: File) : ExportPhase
    data class Failed(val message: String) : ExportPhase
}

/**
 * Export sheet: one clip, in/out points, H.264 MP4 via Media3 Transformer.
 *
 * The sheet refuses to lie: while the GPU renderer is missing, effect stacks are not
 * baked into the file and the copy says so instead of producing a silent surprise.
 */
@Composable
fun ExportSheet(state: EditorState, onClose: () -> Unit) {
    val context = LocalContext.current
    val clip = state.selectedClip
    var phase: ExportPhase by remember { mutableStateOf(ExportPhase.Idle) }

    val exporter = remember { Exporter(context) }
    DisposableEffect(Unit) { onDispose { exporter.cancel() } }

    Box(Modifier.fillMaxSize().background(Color(0xE6000000))) {
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Tokens.surface, RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                .padding(Spacing.lg.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Export", color = Tokens.text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                IconButton(onClick = { exporter.cancel(); onClose() }) {
                    Icon(Icons.Filled.Close, contentDescription = "Close", tint = Tokens.textDim)
                }
            }

            when (val current = phase) {
                is ExportPhase.Idle -> IdleContent(
                    clipName = clip?.name,
                    durationMs = clip?.durationMs ?: 0L,
                    effectCount = state.selectedLayer.effects.size,
                    onExport = {
                        if (clip == null) return@IdleContent
                        phase = ExportPhase.Running(0f)
                        exporter.export(
                            clip = clip,
                            onProgress = { phase = ExportPhase.Running(it) },
                            onSuccess = { file -> phase = ExportPhase.Done(file) },
                            onError = { message -> phase = ExportPhase.Failed(message) },
                        )
                    },
                )

                is ExportPhase.Running -> RunningContent(current.progress)

                is ExportPhase.Done -> DoneContent(
                    file = current.file,
                    onShare = { shareFile(context, current.file) },
                    onAgain = { phase = ExportPhase.Idle },
                )

                is ExportPhase.Failed -> FailedContent(
                    message = current.message,
                    onRetry = { phase = ExportPhase.Idle },
                )
            }
            Spacer(Modifier.height(Spacing.sm.dp))
        }
    }
}

@Composable
private fun IdleContent(
    clipName: String?,
    durationMs: Long,
    effectCount: Int,
    onExport: () -> Unit,
) {
    Column {
        Text(
            clipName?.let { "“$it” · ${timecode(durationMs)}" } ?: "Add a clip first",
            color = Tokens.textDim,
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(Spacing.md.dp))
        InfoRow("Format", "MP4 · H.264 + AAC")
        InfoRow("Resolution", "Source resolution (no upscale)")
        InfoRow("Effects", if (effectCount == 0) "None on this layer" else "$effectCount in stack — renderer pending, not baked yet")
        Spacer(Modifier.height(Spacing.md.dp))
        Text(
            "The clip is written to app storage; use Share to send it anywhere.",
            color = Tokens.textFaint,
            fontSize = 10.sp,
        )
        Spacer(Modifier.height(Spacing.lg.dp))
        ExportButton(enabled = clipName != null, label = "Export MP4", onClick = onExport)
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(label, color = Tokens.textFaint, fontSize = 11.sp, modifier = Modifier.weight(1f))
        Text(value, color = Tokens.textDim, fontSize = 11.sp, textAlign = TextAlign.End)
    }
}

@Composable
private fun RunningContent(progress: Float) {
    Column {
        Text("Exporting…", color = Tokens.text, fontSize = 13.sp)
        Spacer(Modifier.height(Spacing.sm.dp))
        LinearProgressIndicator(
            progress = { progress },
            color = Tokens.primary,
            trackColor = Tokens.surface3,
            modifier = Modifier.fillMaxWidth().height(6.dp),
        )
        Spacer(Modifier.height(Spacing.sm.dp))
        Text(
            "${(progress * 100).toInt()}% · transcoding on device, no upload",
            color = Tokens.textFaint,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun DoneContent(file: File, onShare: () -> Unit, onAgain: () -> Unit) {
    Column {
        Text("Export complete", color = Tokens.primary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(Spacing.xs.dp))
        Text(file.name, color = Tokens.textDim, fontSize = 11.sp, maxLines = 1)
        Text(
            "${(file.length() / 1024 / 1024)} MB · ${file.parent}",
            color = Tokens.textFaint,
            fontSize = 10.sp,
        )
        Spacer(Modifier.height(Spacing.lg.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp)) {
            ExportButton(enabled = true, label = "Share", onClick = onShare, modifier = Modifier.weight(1f))
            GhostButton(label = "Export again", onClick = onAgain, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun FailedContent(message: String, onRetry: () -> Unit) {
    Column {
        Text("Export failed", color = Tokens.action, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(Spacing.xs.dp))
        Text(message, color = Tokens.textDim, fontSize = 11.sp)
        Spacer(Modifier.height(Spacing.lg.dp))
        GhostButton(label = "Try again", onClick = onRetry, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ExportButton(
    enabled: Boolean,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .fillMaxWidth()
            .height(46.dp)
            .background(if (enabled) Tokens.action else Tokens.surface3, RoundedCornerShape(10.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (enabled) Color.White else Tokens.textFaint, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun GhostButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .height(46.dp)
            .background(Tokens.surface2, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Tokens.text, fontSize = 13.sp)
    }
}

private fun shareFile(context: android.content.Context, file: File) {
    runCatching {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share export"))
    }
}
