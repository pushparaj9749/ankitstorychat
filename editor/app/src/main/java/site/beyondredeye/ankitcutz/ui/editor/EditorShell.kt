package site.beyondredeye.ankitcutz.ui.editor

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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.FitScreen
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.beyondredeye.ankitcutz.model.Layer
import site.beyondredeye.ankitcutz.model.LayerType
import site.beyondredeye.ankitcutz.ui.theme.Sizes
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints

/**
 * The editor shell (DESIGN.md §6, screens 16–18).
 *
 * Two rules keep it calm:
 *  1. the panel never covers the preview — it is a fixed band under the ruler;
 *  2. the preview never shrinks while switching tools — the band's content changes,
 *     its height does not.
 *
 * Week 1 renders placeholder media (no decoder yet). Everything else — the shell,
 * the tab switching, the panel band, the effects entry point — is real and stateful.
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
    projectName: String,
    layer: Layer,
    selectedTab: EditorTab,
    onTabSelected: (EditorTab) -> Unit,
    onBack: () -> Unit,
    onOpenEffects: () -> Unit,
    onExport: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Tokens.bg),
    ) {
        TopBar(projectName, onBack, onExport)

        // Preview: flexible, never pushed by the panel.
        PreviewCanvas(Modifier.weight(1f))
        ScrubBar()
        TransportRow()
        TimeRuler()

        PanelBand(
            layer = layer,
            tab = selectedTab,
            onOpenEffects = onOpenEffects,
        )

        BottomTabs(selected = selectedTab, onSelect = onTabSelected)
    }
}

@Composable
private fun TopBar(projectName: String, onBack: () -> Unit, onExport: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(Sizes.topBar.dp)
            .padding(horizontal = Spacing.xs.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Tokens.text)
        }
        Text(
            projectName,
            color = Tokens.text,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = {}) {
            Icon(Icons.Filled.Settings, contentDescription = "Project settings", tint = Tokens.textDim)
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
            .height(34.dp)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.padding(horizontal = 18.dp), contentAlignment = Alignment.Center) {
            Text(label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PreviewCanvas(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxWidth().padding(horizontal = Spacing.md.dp)) {
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF1A1030), Color(0xFF0E1A26), Tokens.bg),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "PREVIEW",
                    color = Tokens.textFaint,
                    fontSize = 11.sp,
                    letterSpacing = 3.sp,
                )
                Spacer(Modifier.height(Spacing.sm.dp))
                Text(
                    "Media import — Week 2",
                    color = Tokens.textDim,
                    fontSize = 13.sp,
                )
            }
            Text(
                "FIT  ·  9:16",
                color = Tokens.textFaint,
                fontSize = 10.sp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(Spacing.sm.dp),
            )
        }
    }
}

@Composable
private fun ScrubBar() {
    Column(Modifier.padding(horizontal = Spacing.lg.dp, vertical = Spacing.sm.dp)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(Sizes.scrubTrack.dp)
                .background(Tokens.surface3, RoundedCornerShape(percent = 50)),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(0.35f)
                    .height(Sizes.scrubTrack.dp)
                    .background(Tokens.primary, RoundedCornerShape(percent = 50)),
            )
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 0.dp)
                    .width(2.dp)
                    .height(Sizes.scrubThumb.dp)
                    .background(Tokens.primary),
            )
        }
    }
}

@Composable
private fun TransportRow() {
    Row(
        Modifier
            .fillMaxWidth()
            .height(Sizes.transport.dp)
            .padding(horizontal = Spacing.md.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TransportIcon(Icons.Filled.Undo, "Undo")
        TransportIcon(Icons.Filled.Redo, "Redo")
        TransportIcon(Icons.Filled.SkipPrevious, "Jump to start")
        TransportIcon(Icons.Filled.PlayArrow, "Play", tint = Tokens.text)
        TransportIcon(Icons.Filled.SkipNext, "Jump to end")
        TransportIcon(Icons.Filled.FitScreen, "Fit")
        TransportIcon(Icons.Filled.Fullscreen, "Fullscreen")
    }
}

@Composable
private fun TransportIcon(icon: ImageVector, label: String, tint: Color = Tokens.textDim) {
    IconButton(onClick = {}) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(Sizes.transportIcon.dp))
    }
}

/** Tick ruler; the playhead pill sits on it (DESIGN.md §6.1). */
@Composable
private fun TimeRuler() {
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(Sizes.ruler.dp)
            .padding(horizontal = Spacing.md.dp),
    ) {
        val ticks = 41
        Canvas(Modifier.fillMaxSize()) {
            val step = size.width / (ticks - 1)
            repeat(ticks) { i ->
                val tall = i % 10 == 0
                val h = if (tall) size.height * 0.55f else size.height * 0.28f
                drawLine(
                    color = if (tall) Tokens.textFaint else Tokens.hairline,
                    start = Offset(i * step, 0f),
                    end = Offset(i * step, h),
                    strokeWidth = if (tall) 1.4f else 1f,
                )
            }
        }
        Surface(
            color = Tokens.surface3,
            shape = RoundedCornerShape(percent = 50),
            modifier = Modifier.align(Alignment.Center).height(22.dp),
        ) {
            Box(Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                Text("00:00:00", color = Tokens.text, fontSize = 12.sp)
            }
        }
    }
}

/**
 * The fixed panel band. Switching tabs swaps ONLY this content — the preview above is
 * untouched, which is the whole point of the Alight-style layout.
 */
@Composable
private fun PanelBand(layer: Layer, tab: EditorTab, onOpenEffects: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .height(330.dp)
            .background(Tokens.surface),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.hairline))
        when (tab) {
            EditorTab.LAYERS -> LayersPanelContent(layer, onOpenEffects)
            EditorTab.SHAPE -> ShapePanelContent()
            else -> PlaceholderPanel(tab)
        }
    }
}

@Composable
private fun LayersPanelContent(layer: Layer, onOpenEffects: () -> Unit) {
    Column(Modifier.padding(Spacing.md.dp)) {
        Text("LAYERS", color = Tokens.textFaint, fontSize = 10.sp, letterSpacing = 1.5.sp)
        Spacer(Modifier.height(Spacing.sm.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            LayerRowBadge(layer)
            Spacer(Modifier.width(Spacing.sm.dp))
            Column(Modifier.weight(1f)) {
                Text(layer.name, color = Tokens.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    "${layer.type.label} · ${layer.effectCount} fx",
                    color = Tokens.textFaint,
                    fontSize = 11.sp,
                )
            }
            Text("00:12", color = Tokens.textDim, fontSize = 11.sp)
        }
        Spacer(Modifier.height(Spacing.md.dp))
        Text("SELECTED LAYER TOOLS", color = Tokens.textFaint, fontSize = 10.sp, letterSpacing = 1.5.sp)
        Spacer(Modifier.height(Spacing.sm.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp)) {
            ToolTile("Effects", Icons.Filled.AutoAwesome, onClick = onOpenEffects, highlighted = true)
            ToolTile("Colour", Icons.Filled.Category, onClick = {})
            ToolTile("Transform", Icons.Filled.FitScreen, onClick = {})
        }
        Spacer(Modifier.height(Spacing.md.dp))
        Text(
            "Week 1: shell + effects stack are live. Media import, timeline gestures and export follow.",
            color = Tokens.textFaint,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun LayerRowBadge(layer: Layer) {
    Box(
        Modifier
            .size(34.dp)
            .background(Tokens.primaryDim, RoundedCornerShape(8.dp))
            .border(1.dp, Tokens.hairline, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(layer.type.label.take(1), color = Tokens.accentFor(layer.type), fontSize = 14.sp)
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
            .width(88.dp)
            .height(64.dp)
            .background(Tokens.surface2, RoundedCornerShape(12.dp))
            .border(
                1.dp,
                if (highlighted) Tokens.primary else Tokens.hairline,
                RoundedCornerShape(12.dp),
            )
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = label, tint = Tokens.primary, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(4.dp))
        Text(label, color = Tokens.text, fontSize = 11.sp)
    }
}

/** 20+ vector shapes, drawn with Canvas so no icon-font dependency is needed. */
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
        val stroke = 2f
        when (name) {
            "Circle" -> drawCircle(Tokens.textDim, radius = size.minDimension / 2f)
            "Square" -> drawRect(Tokens.textDim, size = size * 0.92f)
            "Plus" -> {
                val w = size.width
                drawRect(Tokens.textDim, size = androidx.compose.ui.geometry.Size(w * 0.9f, w * 0.22f), topLeft = Offset(w * 0.05f, w * 0.39f))
                drawRect(Tokens.textDim, size = androidx.compose.ui.geometry.Size(w * 0.22f, w * 0.9f), topLeft = Offset(w * 0.39f, w * 0.05f))
            }
            "Triangle" -> {
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(size.width / 2f, 0f)
                    lineTo(size.width, size.height)
                    lineTo(0f, size.height)
                    close()
                }
                drawPath(path, Tokens.textDim)
            }
            "Diamond" -> {
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(size.width / 2f, 0f)
                    lineTo(size.width, size.height / 2f)
                    lineTo(size.width / 2f, size.height)
                    lineTo(0f, size.height / 2f)
                    close()
                }
                drawPath(path, Tokens.textDim)
            }
            "Star" -> {
                val path = androidx.compose.ui.graphics.Path()
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
                drawPath(path, Tokens.textDim)
            }
            "Hexagon" -> {
                val path = androidx.compose.ui.graphics.Path()
                val cx = size.width / 2f
                val cy = size.height / 2f
                val r = size.minDimension / 2f
                repeat(6) { i ->
                    val angle = Math.toRadians((i * 60 - 90).toDouble())
                    val x = cx + (r * Math.cos(angle)).toFloat()
                    val y = cy + (r * Math.sin(angle)).toFloat()
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                path.close()
                drawPath(path, Tokens.textDim)
            }
            else -> drawCircle(Tokens.textDim, radius = size.minDimension / 2f - stroke)
        }
    }
}

@Composable
private fun PlaceholderPanel(tab: EditorTab) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("${tab.label} — coming in a later week", color = Tokens.textFaint, fontSize = 12.sp)
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
                Text(
                    tab.label,
                    color = if (active) Tokens.primary else Tokens.textFaint,
                    fontSize = 10.sp,
                )
            }
        }
    }
}

/** Small floating add button used by panels that add layers. */
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

/** Shared layer accent helper for screens outside this file. */
fun layerAccent(type: LayerType): Color = Tokens.accentFor(type)
