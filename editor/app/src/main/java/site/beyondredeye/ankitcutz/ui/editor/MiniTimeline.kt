package site.beyondredeye.ankitcutz.ui.editor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.beyondredeye.ankitcutz.model.Clip
import site.beyondredeye.ankitcutz.ui.theme.Sizes
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens

/**
 * The timeline strip (DESIGN.md §6.1): clip blocks scaled to real duration, a playhead you
 * can scrub by dragging anywhere on it, and a timecode chip.
 *
 * Block widths are proportional, so a 12 s clip is visibly twice a 6 s one, and gaps stay
 * empty because they are empty.
 */
@Composable
fun MiniTimeline(
    clips: List<Clip>,
    durationMs: Long,
    playheadMs: Long,
    onSeek: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val total = if (durationMs <= 0L) 1L else durationMs

    BoxWithConstraints(modifier.fillMaxWidth().height(52.dp).background(Tokens.bg)) {
        val widthPx = with(density) { maxWidth.toPx() }
        val padPx = with(density) { Spacing.md.dp.toPx() }
        val trackWidth = (widthPx - padPx * 2).coerceAtLeast(1f)

        Canvas(
            Modifier
                .fillMaxSize()
                .pointerInput(total, trackWidth) {
                    detectTapGestures { offset ->
                        val x = (offset.x - padPx).coerceIn(0f, trackWidth)
                        onSeek((x / trackWidth * total).toLong())
                    }
                }
                .pointerInput(total, trackWidth) {
                    detectHorizontalDragGestures { change, _ ->
                        val x = (change.position.x - padPx).coerceIn(0f, trackWidth)
                        onSeek((x / trackWidth * total).toLong())
                    }
                },
        ) {
            val top = size.height * 0.30f
            val trackHeight = size.height * 0.44f

            drawRoundRect(
                color = Tokens.surface2,
                topLeft = Offset(padPx, top),
                size = Size(trackWidth, trackHeight),
                cornerRadius = CornerRadius(6f, 6f),
            )

            clips.forEach { clip ->
                val left = padPx + trackWidth * (clip.timelineStartMs.toFloat() / total)
                val right = padPx + trackWidth * (clip.timelineEndMs.toFloat() / total)
                val blockWidth = (right - left).coerceAtLeast(2f)
                val selected = playheadMs in clip.timelineStartMs until clip.timelineEndMs
                drawRoundRect(
                    color = if (selected) Tokens.primary else Tokens.primaryDim,
                    topLeft = Offset(left, top),
                    size = Size(blockWidth, trackHeight),
                    cornerRadius = CornerRadius(6f, 6f),
                )
                drawLine(
                    color = Tokens.bg,
                    start = Offset(left, top),
                    end = Offset(left, top + trackHeight),
                    strokeWidth = 2f,
                )
            }

            val playheadX = padPx + trackWidth * (playheadMs.toFloat() / total)
            drawLine(
                color = Tokens.text,
                start = Offset(playheadX, size.height * 0.16f),
                end = Offset(playheadX, size.height * 0.90f),
                strokeWidth = 2.5f,
            )
            drawCircle(
                color = Tokens.text,
                radius = 4f,
                center = Offset(playheadX, size.height * 0.16f),
            )
        }
    }
}

@Composable
fun TimecodeRow(playheadMs: Long, durationMs: Long, modifier: Modifier = Modifier) {
    Text(
        "${timecode(playheadMs)}  /  ${timecode(durationMs)}",
        color = Tokens.textFaint,
        fontSize = 10.sp,
        modifier = modifier.padding(horizontal = Spacing.md.dp),
    )
}

fun timecode(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    val frames = (ms % 1000) * 30 / 1000
    return "%02d:%02d:%02d".format(minutes, seconds, frames)
}

/** Fixed 76 dp layer column from screen 17 — the rail that never scrolls sideways. */
@Composable
fun LayerRailColumn(layerName: String, clipCount: Int, modifier: Modifier = Modifier) {
    Box(
        modifier
            .width(Sizes.layerColumn.dp)
            .fillMaxHeight()
            .background(Tokens.surface2),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            if (clipCount == 0) layerName else "$layerName\n$clipCount clip${if (clipCount > 1) "s" else ""}",
            color = Tokens.textDim,
            fontSize = 10.sp,
            lineHeight = 14.sp,
        )
    }
}

/** Empty-track affordance; the only thing a new project shows on the timeline. */
@Composable
fun EmptyTrackHint(onImport: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(44.dp)
            .padding(horizontal = Spacing.md.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "＋  Import a video or photo",
            color = Tokens.primary,
            fontSize = 11.sp,
            modifier = Modifier
                .background(Tokens.surface2, RoundedCornerShape(8.dp))
                .clickable(onClick = onImport)
                .padding(horizontal = 12.dp, vertical = 7.dp),
        )
    }
}
