package site.beyondredeye.ankitcutz.ui.editor

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import site.beyondredeye.ankitcutz.model.Clip
import site.beyondredeye.ankitcutz.ui.theme.Tokens
import androidx.compose.material3.Text

/**
 * The real preview: ExoPlayer for video, a decoded bitmap for stills.
 *
 * Truthfulness rule: what you see here is the same source file that [Exporter] trims, so
 * "preview == export" starts being true from this milestone for geometry and timing.
 * GPU effects are not composited yet — the badge says "effects pending renderer" instead
 * of pretending the stack is applied.
 */
@Composable
fun PreviewStage(
    clip: Clip?,
    isPlaying: Boolean,
    seekNonce: Int,
    playheadMs: Long,
    onTick: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.background(Color.Black), contentAlignment = Alignment.Center) {
        when {
            clip == null -> EmptyStage()
            clip.isVideo -> VideoStage(clip, isPlaying, seekNonce, playheadMs, onTick)
            else -> ImageStage(clip)
        }
    }
}

@Composable
private fun EmptyStage() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("NO MEDIA", color = Tokens.textFaint, fontSize = 11.sp, letterSpacing = 3.sp)
        Text(
            "Add a clip to start",
            color = Tokens.textDim,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}

@Composable
private fun VideoStage(
    clip: Clip,
    isPlaying: Boolean,
    seekNonce: Int,
    playheadMs: Long,
    onTick: (Long) -> Unit,
) {
    val context = LocalContext.current
    val player = remember {
        ExoPlayer.Builder(context).build().apply { repeatMode = Player.REPEAT_MODE_OFF }
    }

    DisposableEffect(Unit) {
        onDispose { player.release() }
    }

    // New clip: reset the decoder, land on the clip's own in-point.
    LaunchedEffect(clip.id) {
        player.setMediaItem(MediaItem.fromUri(Uri.parse(clip.uri)))
        player.prepare()
        player.seekTo(clip.sourceStartMs)
    }

    LaunchedEffect(seekNonce) {
        player.seekTo(clip.sourceTimeAt(playheadMs))
    }

    LaunchedEffect(isPlaying) {
        if (isPlaying) player.play() else player.pause()
    }

    // Progress ticks: the player drives the playhead while playing, never the reverse.
    LaunchedEffect(isPlaying, clip.id) {
        while (isPlaying) {
            onTick(clip.timelineStartMs + (player.currentPosition - clip.sourceStartMs))
            if (player.currentPosition >= clip.sourceEndMs) {
                player.pause()
                onTick(clip.timelineEndMs)
                break
            }
            delay(80)
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                setShutterBackgroundColor(android.graphics.Color.BLACK)
                this.player = player
            }
        },
        onRelease = { view -> view.player = null },
    )
}

@Composable
private fun ImageStage(clip: Clip) {
    val context = LocalContext.current
    val bitmap by produceState<android.graphics.Bitmap?>(null, clip.uri) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                context.contentResolver.openInputStream(Uri.parse(clip.uri))?.use {
                    BitmapFactory.decodeStream(it)
                }
            }.getOrNull()
        }
    }

    val image = bitmap
    if (image != null) {
        Image(
            bitmap = image.asImageBitmap(),
            contentDescription = clip.name,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize(),
        )
    } else {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Loading image…", color = Tokens.textFaint, fontSize = 12.sp, fontWeight = FontWeight.Normal)
        }
    }
}
