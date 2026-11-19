package site.beyondredeye.ankitcutz.ui.editor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.beyondredeye.ankitcutz.model.EffectSpec
import site.beyondredeye.ankitcutz.model.ParamType
import site.beyondredeye.ankitcutz.model.deepGlowPresets
import site.beyondredeye.ankitcutz.model.passCost
import site.beyondredeye.ankitcutz.model.schemaFor
import site.beyondredeye.ankitcutz.ui.theme.Sizes
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens
import kotlin.math.roundToInt

/**
 * Screens 19–21 (DESIGN.md §7): the effect STACK of the selected layer.
 *
 * The rule that makes this readable: one row per effect, one line of summary, and the
 * parameters appear only for the row you opened. Nothing is ever applied invisibly and
 * nothing is silently dropped — the `N passes` chip tells the truth about cost.
 */
@Composable
fun EffectsStackScreen(state: EditorState, onClose: () -> Unit) {
    val layer = state.selectedLayer

    Box(Modifier.fillMaxSize().background(Tokens.bg)) {
        Row(Modifier.fillMaxSize()) {
            LeftRail(onClose = onClose)
            Column(Modifier.fillMaxSize()) {
                StackHeader(
                    layerName = layer.name,
                    passes = state.passes,
                    budget = state.budget,
                    onClose = onClose,
                )

                if (layer.effects.isEmpty()) {
                    EmptyStack(Modifier.weight(1f)) { state.addSheetOpen = true }
                } else {
                    LazyColumn(
                        Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            start = Spacing.md.dp,
                            end = Spacing.md.dp,
                            top = Spacing.sm.dp,
                            bottom = 96.dp,
                        ),
                        verticalArrangement = Arrangement.spacedBy(Spacing.sm.dp),
                    ) {
                        items(layer.effects, key = { it.id }) { effect ->
                            val index = layer.effects.indexOf(effect)
                            EffectRow(
                                state = state,
                                effect = effect,
                                index = index,
                                lastIndex = layer.effects.lastIndex,
                                expanded = state.expandedEffectId == effect.id,
                                onToggleExpand = {
                                    state.expandedEffectId =
                                        if (state.expandedEffectId == effect.id) null else effect.id
                                },
                            )
                        }
                        item {
                            Box(Modifier.fillMaxWidth().height(8.dp))
                        }
                    }
                }
            }
        }

        AddEffectBar(
            onClick = { state.addSheetOpen = true },
            modifier = Modifier.align(Alignment.BottomCenter).padding(Spacing.lg.dp),
        )

        if (state.addSheetOpen) {
            AddEffectSheet(state = state)
        }
    }
}

/** Back · keyframe · mask · add — the rail from screen 19. */
@Composable
private fun LeftRail(onClose: () -> Unit) {
    Column(
        Modifier
            .width(52.dp)
            .fillMaxHeight()
            .background(Tokens.surface),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        IconButton(onClick = onClose) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Tokens.text)
        }
        Spacer(Modifier.height(Spacing.lg.dp))
        RailGlyph("Keyframe", active = true) { KeyframeGlyph(Tokens.primary, filled = true) }
        Spacer(Modifier.height(Spacing.lg.dp))
        RailGlyph("Mask") { MaskGlyph() }
        Spacer(Modifier.height(Spacing.lg.dp))
        IconButton(onClick = {}) {
            Icon(Icons.Filled.MoreVert, contentDescription = "More", tint = Tokens.textDim)
        }
    }
}

@Composable
private fun RailGlyph(label: String, active: Boolean = false, glyph: @Composable () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .size(38.dp)
                .background(if (active) Tokens.primaryDim else Color.Transparent, RoundedCornerShape(10.dp))
                .clickable { },
            contentAlignment = Alignment.Center,
        ) { glyph() }
        Text(label, color = if (active) Tokens.primary else Tokens.textFaint, fontSize = 9.sp)
    }
}

@Composable
private fun StackHeader(layerName: String, passes: Int, budget: Int, onClose: () -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().height(Sizes.topBar.dp).padding(end = Spacing.sm.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f).padding(start = Spacing.md.dp)) {
                Text("Effects", color = Tokens.text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    layerName,
                    color = Tokens.textFaint,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            PassChip(passes = passes, budget = budget)
            Spacer(Modifier.width(Spacing.sm.dp))
            Text(
                "Done",
                color = Tokens.primary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clickable(onClick = onClose)
                    .padding(horizontal = Spacing.sm.dp, vertical = Spacing.sm.dp),
            )
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.hairline))
    }
}

/** Truth about cost, not a decoration: cyan within budget, champagne beyond it. */
@Composable
private fun PassChip(passes: Int, budget: Int) {
    val over = passes > budget
    Row(
        Modifier
            .height(24.dp)
            .background(if (over) Color(0x1FE2BE7E) else Tokens.surface2, RoundedCornerShape(percent = 50))
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (passes == 0) "0 passes" else "$passes / $budget passes",
            color = if (over) Tokens.warning else Tokens.textDim,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun EmptyStack(modifier: Modifier = Modifier, onAdd: () -> Unit) {
    Column(
        modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier
                .size(56.dp)
                .background(Tokens.surface2, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Add, contentDescription = null, tint = Tokens.textDim)
        }
        Spacer(Modifier.height(Spacing.md.dp))
        Text("No effects yet", color = Tokens.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(Spacing.xs.dp))
        Text(
            "Effects apply to this layer only. Order is render order.",
            color = Tokens.textFaint,
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(Spacing.lg.dp))
        Text(
            "Add effect",
            color = Tokens.primary,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .background(Tokens.primaryDim, RoundedCornerShape(percent = 50))
                .clickable(onClick = onAdd)
                .padding(horizontal = 18.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun AddEffectBar(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(Tokens.surface2, RoundedCornerShape(12.dp))
            .border(1.dp, Tokens.hairline, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Filled.Add, contentDescription = null, tint = Tokens.primary, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(Spacing.sm.dp))
        Text("Add effect", color = Tokens.text, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

// ---------------------------------------------------------------------------
// One effect row (screen 19 collapsed, screen 21 expanded)
// ---------------------------------------------------------------------------

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun EffectRow(
    state: EditorState,
    effect: EffectSpec,
    index: Int,
    lastIndex: Int,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
) {
    val schema = schemaFor(effect.type)
    var menuOpen by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxWidth()
            .background(Tokens.surface, RoundedCornerShape(12.dp))
            .border(
                1.dp,
                if (expanded) Tokens.hairlineSoft else Tokens.hairline,
                RoundedCornerShape(12.dp),
            ),
    ) {
        Box {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .combinedClickable(
                        onClick = onToggleExpand,
                        onLongClick = { menuOpen = true },
                    )
                    .padding(end = Spacing.sm.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.width(38.dp), contentAlignment = Alignment.Center) {
                    Icon(
                        if (expanded) Icons.Filled.ExpandMore else Icons.Filled.ChevronRight,
                        contentDescription = if (expanded) "Collapse" else "Expand",
                        tint = Tokens.textDim,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        schema.label,
                        color = if (effect.enabled) Tokens.text else Tokens.textFaint,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        summary(effect),
                        color = Tokens.textFaint,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                PowerToggle(
                    enabled = effect.enabled,
                    onClick = { state.toggleEffect(effect.id) },
                )
                IconButton(onClick = {}) {
                    Icon(
                        if (effect.enabled) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                        contentDescription = "Preview solo",
                        tint = Tokens.textFaint,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Icon(
                    Icons.Filled.DragHandle,
                    contentDescription = "Drag to reorder",
                    tint = Tokens.textFaint,
                    modifier = Modifier.size(20.dp),
                )
            }

            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                MenuAction("Reset", true) { menuOpen = false; state.resetEffect(effect.id) }
                MenuAction("Duplicate", true) { menuOpen = false; state.duplicateEffect(effect.id) }
                MenuAction("Copy to another layer", true) {
                    menuOpen = false
                    // Week 1: the target picker lands with the layer tree.
                }
                MenuAction("Move up", index > 0) {
                    menuOpen = false
                    state.moveEffect(index, index - 1)
                }
                MenuAction("Move down", index < lastIndex) {
                    menuOpen = false
                    state.moveEffect(index, index + 1)
                }
                MenuAction("Remove", true, danger = true) { menuOpen = false; state.removeEffect(effect.id) }
            }
        }

        if (expanded) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.hairlineSoft))
            Parameters(state = state, effect = effect)
        }
    }
}

@Composable
private fun MenuAction(label: String, enabled: Boolean, danger: Boolean = false, onClick: () -> Unit) {
    DropdownMenuItem(
        text = {
            Text(
                label,
                color = when {
                    danger -> Tokens.action
                    enabled -> Tokens.text
                    else -> Tokens.textFaint
                },
                fontSize = 13.sp,
            )
        },
        enabled = enabled,
        onClick = onClick,
    )
}

@Composable
private fun PowerToggle(enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(32.dp)
            .background(if (enabled) Tokens.primaryDim else Color.Transparent, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Filled.PowerSettingsNew,
            contentDescription = if (enabled) "Turn off" else "Turn on",
            tint = if (enabled) Tokens.primary else Tokens.textFaint,
            modifier = Modifier.size(16.dp),
        )
    }
}

/** One-line summary so a collapsed stack is still readable at a glance. */
private fun summary(effect: EffectSpec): String {
    val schema = schemaFor(effect.type)
    val head = schema.params.take(2).mapNotNull { p ->
        val value = effect.params[p.key] ?: return@mapNotNull null
        when (p.type) {
            ParamType.FLOAT -> "${p.label} ${fmt(value.value)}"
            ParamType.INT -> "${p.label} ${value.value.roundToInt()}"
            ParamType.BOOL -> if (value.value > 0.5f) "${p.label} on" else "${p.label} off"
            ParamType.COLOUR, ParamType.ENUM -> "${p.label} ${value.text ?: "—"}"
        }
    }
    return (head + "${schema.passCost} pass" + (if (schema.passCost > 1) "es" else "")).joinToString("  ·  ")
}

private fun fmt(value: Float): String =
    if (value == value.roundToInt().toFloat()) value.roundToInt().toString() else String.format("%.1f", value)

// ---------------------------------------------------------------------------
// Parameters (accordion)
// ---------------------------------------------------------------------------

@Composable
private fun Parameters(state: EditorState, effect: EffectSpec) {
    val schema = schemaFor(effect.type)
    Column(Modifier.padding(horizontal = Spacing.md.dp, vertical = Spacing.sm.dp)) {
        // Presets first: they are the fastest path to a good look.
        if (effect.type == site.beyondredeye.ankitcutz.model.EffectType.DEEP_GLOW) {
            Text("PRESETS", color = Tokens.textFaint, fontSize = 9.sp, letterSpacing = 1.2.sp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp)) {
                deepGlowPresets.forEach { preset ->
                    Text(
                        preset.name,
                        color = Tokens.text,
                        fontSize = 11.sp,
                        modifier = Modifier
                            .background(Tokens.surface2, RoundedCornerShape(percent = 50))
                            .border(1.dp, Tokens.hairline, RoundedCornerShape(percent = 50))
                            .clickable { state.applyPreset(effect.id, preset) }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
            Spacer(Modifier.height(Spacing.md.dp))
        }

        schema.params.forEach { param ->
            val value = effect.params[param.key]
            when (param.type) {
                ParamType.FLOAT, ParamType.INT -> SliderRow(
                    label = param.label,
                    value = value?.value ?: param.default,
                    min = param.min,
                    max = param.max,
                    keyed = value?.keyframes?.any { kotlin.math.abs(it.timeUs - state.playheadMs * 1000) < 16_000L } == true,
                    onValue = { state.updateParam(effect.id, param.key, it) },
                    onCommit = state::commitParamEdit,
                    onKeyframe = { state.toggleKeyframe(effect.id, param.key, state.playheadMs * 1000) },
                )

                ParamType.COLOUR -> ChoiceRow(
                    label = param.label,
                    options = listOf("White", "Cyan", "Rose", "Amber", "Violet"),
                    selected = value?.text ?: param.defaultText,
                    onSelect = { },
                )

                ParamType.ENUM -> ChoiceRow(
                    label = param.label,
                    options = param.options,
                    selected = value?.text ?: param.defaultText,
                    onSelect = { },
                )

                ParamType.BOOL -> ChoiceRow(
                    label = param.label,
                    options = listOf("Off", "On"),
                    selected = if ((value?.value ?: 0f) > 0.5f) "On" else "Off",
                    onSelect = { },
                )
            }
        }

        Spacer(Modifier.height(Spacing.xs.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Long-press the row for reset, duplicate, reorder or remove.",
                color = Tokens.textFaint,
                fontSize = 10.sp,
            )
        }
    }
}

@Composable
private fun SliderRow(
    label: String,
    value: Float,
    min: Float,
    max: Float,
    keyed: Boolean,
    onValue: (Float) -> Unit,
    onCommit: () -> Unit,
    onKeyframe: () -> Unit,
) {
    Column(Modifier.padding(vertical = 2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = Tokens.textDim, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Text(
                if (max - min > 40f) fmt(value) else fmt(value),
                color = Tokens.text,
                fontSize = 11.sp,
                modifier = Modifier
                    .background(Tokens.surface2, RoundedCornerShape(6.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
            Spacer(Modifier.width(Spacing.xs.dp))
            Box(
                Modifier
                    .size(30.dp)
                    .clickable(onClick = onKeyframe),
                contentAlignment = Alignment.Center,
            ) { KeyframeGlyph(tint = if (keyed) Tokens.primary else Tokens.textFaint, filled = keyed) }
        }
        Slider(
            value = value.coerceIn(min, max),
            onValueChange = onValue,
            onValueChangeFinished = onCommit,
            valueRange = min..max,
            colors = SliderDefaults.colors(
                thumbColor = Tokens.primary,
                activeTrackColor = Tokens.primary,
                inactiveTrackColor = Tokens.surface3,
            ),
            modifier = Modifier.fillMaxWidth().height(28.dp),
        )
    }
}

@Composable
private fun ChoiceRow(
    label: String,
    options: List<String>,
    selected: String?,
    onSelect: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = Tokens.textDim, fontSize = 12.sp, modifier = Modifier.width(84.dp))
        Row(
            Modifier.weight(1f).background(Tokens.surface2, RoundedCornerShape(8.dp)).padding(2.dp),
        ) {
            options.forEach { option ->
                val active = option == selected
                Row(
                    Modifier
                        .weight(1f)
                        .height(26.dp)
                        .background(
                            if (active) Tokens.surface3 else Color.Transparent,
                            RoundedCornerShape(6.dp),
                        )
                        .clickable { onSelect(option) },
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (active) {
                        Icon(Icons.Filled.Check, contentDescription = null, tint = Tokens.primary, modifier = Modifier.size(11.dp))
                        Spacer(Modifier.width(3.dp))
                    }
                    Text(
                        option,
                        color = if (active) Tokens.text else Tokens.textFaint,
                        fontSize = 10.sp,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@Composable
fun KeyframeGlyph(tint: Color, filled: Boolean) {
    Canvas(Modifier.size(11.dp)) {
        val path = Path().apply {
            moveTo(size.width / 2f, 0f)
            lineTo(size.width, size.height / 2f)
            lineTo(size.width / 2f, size.height)
            lineTo(0f, size.height / 2f)
            close()
        }
        if (filled) drawPath(path, tint) else drawPath(path, tint, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.4f))
    }
}

@Composable
private fun MaskGlyph() {
    Canvas(Modifier.size(16.dp)) {
        drawCircle(Tokens.textDim, radius = size.minDimension / 2f, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.6f))
        drawCircle(Tokens.textDim, radius = size.minDimension / 4f, center = Offset(size.width * 0.62f, size.height * 0.38f))
    }
}
