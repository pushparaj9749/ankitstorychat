package site.beyondredeye.ankitcutz.ui.editor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.FitScreen
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.beyondredeye.ankitcutz.model.Clip
import site.beyondredeye.ankitcutz.model.LayerType
import site.beyondredeye.ankitcutz.ui.theme.Sizes
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens

/**
 * The editor shell (DESIGN.md §6, screens 16–18).
 *
 * Two rules keep it calm:
 *  1. the panel never covers the preview — it is a fixed band under the timeline;
 *  2. the preview never shrinks while switching tools — the band's content changes,
 *     its height does not.
 */
enum class EditorTab(val label: String, val icon: ImageVector) {
    SHAPE("Shape", Icons.Filled.Category),
    MEDIA("Media", Icons.Filled.PhotoLibrary),
    AUDIO("Audio", Icons.Filled.MusicNote),
    LAYERS("Layers", Icons.Filled.Layers),
    TEMPLATES("Templates", Icons.Filled.AutoAwesome),
}

@Composable
fun EditorShell(
    state: EditorState,
    onBack: () -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Tokens.bg),
    ) {
        TopBar(
            projectName = state.project.name,
            canUndo = state.canUndo,
            canRedo = state.canRedo,
            onBack = onBack,
            onUndo = state::undo,
            onRedo = state::redo,
            onExport = onExport,
        )

        PreviewStage(
            clip = state.selectedClip,
            isPlaying = state.isPlaying,
            seekNonce = state.seekNonce,
            playheadMs = state.playheadMs,
            onTick = state::onPlayerTick,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = Spacing.md.dp),
        )

        Spacer(Modifier.height(Spacing.sm.dp))
        MiniTimeline(
            clips = state.clips,
            durationMs = state.durationMs,
            playheadMs = state.playheadMs,
            onSeek = state::seekTo,
        )
        TimecodeRow(playheadMs = state.playheadMs, durationMs = state.durationMs)

        TransportRow(
            isPlaying = state.isPlaying,
            onTogglePlay = state::togglePlay,
            onStart = { state.seekTo(0) },
            onEnd = { state.seekTo(state.durationMs) },
            onSplit = state::splitAtPlayhead,
            canSplit = state.durationMs > 0,
        )

        PanelBand(state = state, onImport = onImport)
        BottomTabs(selected = state.tab, onSelect = state::selectTab)
    }
}

@Composable
private fun TopBar(
    projectName: String,
    canUndo: Boolean,
    canRedo: Boolean,
    onBack: () -> Unit,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    onExport: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(Sizes.topBar.dp)
            .padding(horizontal = Spacing.xs.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Projects", tint = Tokens.text)
        }
        Text(
            projectName,
            color = Tokens.text,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onUndo, enabled = canUndo) {
            Icon(
                Icons.Filled.Undo,
                contentDescription = "Undo",
                tint = if (canUndo) Tokens.text else Tokens.textFaint,
            )
        }
        IconButton(onClick = onRedo, enabled = canRedo) {
            Icon(
                Icons.Filled.Redo,
                contentDescription = "Redo",
                tint = if (canRedo) Tokens.text else Tokens.textFaint,
            )
        }
        ActionPill(label = "Export", onClick = onExport)
        Spacer(Modifier.width(Spacing.sm.dp))
    }
}

/** The only rose pill in the app: rose means "this commits something". */
@Composable
fun ActionPill(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        color = Tokens.action,
        shape = RoundedCornerShape(percent = 50),
        modifier = modifier
            .height(32.dp)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
            Text(label, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun TransportRow(
    isPlaying: Boolean,
    onTogglePlay: () -> Unit,
    onStart: () -> Unit,
    onEnd: () -> Unit,
    onSplit: () -> Unit,
    canSplit: Boolean,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(Sizes.transport.dp)
            .padding(horizontal = Spacing.md.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TransportIcon(Icons.Filled.SkipPrevious, "Jump to start", onClick = onStart)
        TransportIcon(Icons.Filled.ContentCut, "Split at playhead", tint = if (canSplit) Tokens.textDim else Tokens.textFaint, onClick = onSplit)
        Box(
            Modifier
                .size(40.dp)
                .background(Tokens.primaryDim, CircleShape)
                .clickable(onClick = onTogglePlay),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (isPlaying) "Pause" else "Play",
                tint = Tokens.primary,
                modifier = Modifier.size(24.dp),
            )
        }
        TransportIcon(Icons.Filled.SkipNext, "Jump to end", onClick = onEnd)
        TransportIcon(Icons.Filled.FitScreen, "Fit", onClick = {})
        TransportIcon(Icons.Filled.Fullscreen, "Fullscreen", onClick = {})
    }
}

@Composable
private fun TransportIcon(icon: ImageVector, label: String, tint: Color = Tokens.textDim, onClick: () -> Unit = {}) {
    IconButton(onClick = onClick) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(Sizes.transportIcon.dp))
    }
}

/** The fixed panel band: switching tabs swaps only this content. */
@Composable
private fun PanelBand(state: EditorState, onImport: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .height(300.dp)
            .background(Tokens.surface),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.hairline))
        when (state.tab) {
            EditorTab.LAYERS -> LayersPanelContent(state, onImport)
            EditorTab.SHAPE -> ShapePanelContent()
            EditorTab.MEDIA -> MediaPanelContent(state, onImport)
            else -> PlaceholderPanel(state.tab)
        }
    }
}

@Composable
private fun LayersPanelContent(state: EditorState, onImport: () -> Unit) {
    val layer = state.selectedLayer
    Column(Modifier.padding(Spacing.md.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("LAYERS", color = Tokens.textFaint, fontSize = 10.sp, letterSpacing = 1.5.sp, modifier = Modifier.weight(1f))
            Text(
                "＋ Add",
                color = Tokens.primary,
                fontSize = 11.sp,
                modifier = Modifier
                    .background(Tokens.primaryDim, RoundedCornerShape(percent = 50))
                    .clickable(onClick = onImport)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
        Spacer(Modifier.height(Spacing.sm.dp))

        layer.clips.forEach { clip ->
            ClipRow(
                clip = clip,
                selected = clip.id == state.selectedClip?.id,
                onClick = { state.selectClip(clip.id) },
                onDelete = { state.removeClip(clip.id) },
            )
            Spacer(Modifier.height(Spacing.xs.dp))
        }
        if (layer.clips.isEmpty()) {
            EmptyTrackHint(onImport = onImport)
        }

        Spacer(Modifier.height(Spacing.sm.dp))
        Text("TOOLS", color = Tokens.textFaint, fontSize = 10.sp, letterSpacing = 1.5.sp)
        Spacer(Modifier.height(Spacing.sm.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp)) {
            ToolTile(
                label = "Effects · ${layer.effects.size}",
                icon = Icons.Filled.AutoAwesome,
                onClick = state::openEffects,
                highlighted = true,
            )
            ToolTile(
                label = "Split",
                icon = Icons.Filled.ContentCut,
                onClick = state::splitAtPlayhead,
            )
            ToolTile(
                label = "Export",
                icon = Icons.Filled.Fullscreen,
                onClick = { state.exportOpen = true },
            )
        }
    }
}

@Composable
private fun ClipRow(clip: Clip, selected: Boolean, onClick: () -> Unit, onDelete: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(40.dp)
            .background(if (selected) Tokens.surface3 else Tokens.surface2, RoundedCornerShape(8.dp))
            .border(1.dp, if (selected) Tokens.primary else Tokens.hairline, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.sm.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(width = 26.dp, height = 26.dp)
                .background(if (selected) Tokens.primary else Tokens.primaryDim, RoundedCornerShape(6.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(if (clip.isVideo) "▶" else "▣", color = if (selected) Tokens.bg else Tokens.primary, fontSize = 10.sp)
        }
        Spacer(Modifier.width(Spacing.sm.dp))
        Column(Modifier.weight(1f)) {
            Text(clip.name, color = Tokens.text, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                "${timecode(clip.timelineStartMs)}  ·  ${fmtSeconds(clip.durationMs)}",
                color = Tokens.textFaint,
                fontSize = 9.sp,
            )
        }
        Text(
            "✕",
            color = Tokens.textFaint,
            fontSize = 12.sp,
            modifier = Modifier
                .clickable(onClick = onDelete)
                .padding(horizontal = 6.dp, vertical = 4.dp),
        )
    }
}

private fun fmtSeconds(ms: Long): String {
    val s = ms / 1000.0
    return if (s < 10) String.format("%.1fs", s) else "${ms / 1000}s"
}

@Composable
private fun MediaPanelContent(state: EditorState, onImport: () -> Unit) {
    Column(Modifier.padding(Spacing.md.dp)) {
        Text("MEDIA", color = Tokens.textFaint, fontSize = 10.sp, letterSpacing = 1.5.sp)
        Spacer(Modifier.height(Spacing.sm.dp))
        Text(
            "Imported clips stay on your phone. Nothing is uploaded, ever.",
            color = Tokens.textDim,
            fontSize = 11.sp,
        )
        Spacer(Modifier.height(Spacing.md.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp)) {
            ToolTile("Import video", Icons.Filled.PhotoLibrary, onClick = onImport, highlighted = true)
            ToolTile("Add audio", Icons.Filled.MusicNote, onClick = {})
        }
        Spacer(Modifier.height(Spacing.md.dp))
        Text(
            "${state.project.clipCount} clip(s) · ${timecode(state.durationMs)} on the timeline",
            color = Tokens.textFaint,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun ToolTile(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    highlighted: Boolean = false,
) {
    Column(
        Modifier
            .width(92.dp)
            .height(62.dp)
            .background(Tokens.surface2, RoundedCornerShape(12.dp))
            .border(1.dp, if (highlighted) Tokens.primary else Tokens.hairline, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = label, tint = if (highlighted) Tokens.primary else Tokens.textDim, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(4.dp))
        Text(label, color = Tokens.text, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun ShapePanelContent() {
    Column(Modifier.padding(Spacing.md.dp)) {
        Text("SHAPE", color = Tokens.textFaint, fontSize = 10.sp, letterSpacing = 1.5.sp)
        Spacer(Modifier.height(Spacing.sm.dp))
        val shapes = listOf("Circle", "Square", "Plus", "Crescent", "Triangle", "Diamond", "Star", "Hexagon")
        shapes.chunked(4).forEach { rowShapes ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp)) {
                rowShapes.forEach { shape ->
                    Box(
                        Modifier
                            .size(width = 72.dp, height = 64.dp)
                            .background(Tokens.surface2, RoundedCornerShape(12.dp))
                            .clickable { },
                        contentAlignment = Alignment.Center,
                    ) {
                        ShapeGlyph(shape)
                    }
                }
            }
            Spacer(Modifier.height(Spacing.sm.dp))
        }
    }
}

@Composable
private fun ShapeGlyph(name: String) {
    Canvas(Modifier.size(28.dp)) {
        when (name) {
            "Circle" -> drawCircle(Tokens.textDim, radius = size.minDimension / 2f)
            "Square" -> drawRect(Tokens.textDim, size = size * 0.92f)
            "Plus" -> {
                val w = size.width
                drawRect(Tokens.textDim, size = androidx.compose.ui.geometry.Size(w * 0.9f, w * 0.22f), topLeft = Offset(w * 0.05f, w * 0.39f))
                drawRect(Tokens.textDim, size = androidx.compose.ui.geometry.Size(w * 0.22f, w * 0.9f), topLeft = Offset(w * 0.39f, w * 0.05f))
            }
            "Triangle" -> drawPath(
                Path().apply {
                    moveTo(size.width / 2f, 0f); lineTo(size.width, size.height); lineTo(0f, size.height); close()
                },
                Tokens.textDim,
            )
            "Diamond" -> drawPath(
                Path().apply {
                    moveTo(size.width / 2f, 0f); lineTo(size.width, size.height / 2f)
                    lineTo(size.width / 2f, size.height); lineTo(0f, size.height / 2f); close()
                },
                Tokens.textDim,
            )
            "Star" -> drawPath(starPath(), Tokens.textDim)
            "Hexagon" -> drawPath(polygonPath(6), Tokens.textDim)
            else -> drawCircle(Tokens.textDim, radius = size.minDimension / 2f - 2f)
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.starPath(): Path {
    val path = Path()
    val cx = size.width / 2f
    val cy = size.height / 2f
    val outer = size.minDimension / 2f
    val inner = outer * 0.45f
    repeat(10) { i ->
        val angle = Math.toRadians((i * 36 - 90).toDouble())
        val r = if (i % 2 == 0) outer else inner
        val x = cx + (r * Math.cos(angle)).toFloat()
        val y = cy + (r * Math.sin(angle)).toFloat()
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    path.close()
    return path
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.polygonPath(sides: Int): Path {
    val path = Path()
    val cx = size.width / 2f
    val cy = size.height / 2f
    val r = size.minDimension / 2f
    repeat(sides) { i ->
        val angle = Math.toRadians((i * 360.0 / sides - 90).toDouble())
        val x = cx + (r * Math.cos(angle)).toFloat()
        val y = cy + (r * Math.sin(angle)).toFloat()
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    path.close()
    return path
}

@Composable
private fun PlaceholderPanel(tab: EditorTab) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("${tab.label} — later milestone", color = Tokens.textFaint, fontSize = 12.sp)
    }
}

@Composable
private fun BottomTabs(selected: EditorTab, onSelect: (EditorTab) -> Unit) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.hairline))
    Row(
        Modifier
            .fillMaxWidth()
            .height(Sizes.bottomTabs.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        EditorTab.entries.forEach { tab ->
            val active = tab == selected
            Column(
                Modifier
                    .weight(1f)
                    .clickable { onSelect(tab) },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(
                    tab.icon,
                    contentDescription = tab.label,
                    tint = if (active) Tokens.primary else Tokens.textFaint,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.height(3.dp))
                Text(tab.label, color = if (active) Tokens.primary else Tokens.textFaint, fontSize = 10.sp)
            }
        }
    }
}

@Composable
fun AddFab(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        color = Tokens.primary,
        shape = CircleShape,
        modifier = modifier.size(Sizes.fab.dp).clickable(onClick = onClick),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Add, contentDescription = "Add", tint = Tokens.bg)
        }
    }
}

fun layerAccent(type: LayerType): Color = Tokens.accentFor(type)
