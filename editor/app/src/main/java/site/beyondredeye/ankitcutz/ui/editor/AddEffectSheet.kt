package site.beyondredeye.ankitcutz.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.beyondredeye.ankitcutz.model.EffectType
import site.beyondredeye.ankitcutz.model.schemaFor
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens

/**
 * Screen 20: the Add-effect picker.
 *
 * Behaviours that matter, in order of how much they save the user:
 *  1. typing filters instantly, and matching the CATEGORY is a hit too;
 *  2. adding closes the sheet, appends the effect, expands its own row and scrolls to it;
 *  3. categories are chips, not a dropdown — one tap, not two.
 *
 * Week 1 has no decoder yet, so thumbnails are category-tinted placeholders. They are
 * already the frame the real preview will draw into (one cache, one size), so this is
 * layout-complete, not fake scaffolding that must be rebuilt later.
 */
@Composable
fun AddEffectSheet(state: EditorState) {
    val results = searchEffects(state.query, state.category)

    Box(Modifier.fillMaxSize()) {
        // Scrim: tapping outside dismisses without losing the stack.
        Box(
            Modifier
                .fillMaxSize()
                .background(Color(0xCC000000))
                .clickable { state.addSheetOpen = false },
        )

        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .heightIn(min = 420.dp, max = 620.dp)
                .background(Tokens.surface, RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                .padding(bottom = Spacing.sm.dp),
        ) {
            // Grab handle + title
            Box(Modifier.fillMaxWidth().padding(top = Spacing.sm.dp), contentAlignment = Alignment.Center) {
                Box(
                    Modifier
                        .size(width = 36.dp, height = 4.dp)
                        .background(Tokens.surface3, RoundedCornerShape(percent = 50)),
                )
            }
            Row(
                Modifier.fillMaxWidth().padding(start = Spacing.lg.dp, end = Spacing.sm.dp, top = Spacing.sm.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Add effect", color = Tokens.text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                IconButton(onClick = { state.addSheetOpen = false }) {
                    Icon(Icons.Filled.Close, contentDescription = "Close", tint = Tokens.textDim, modifier = Modifier.size(18.dp))
                }
            }

            SearchField(
                query = state.query,
                onQuery = { state.query = it },
                modifier = Modifier.padding(horizontal = Spacing.lg.dp, vertical = Spacing.sm.dp),
            )

            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.lg.dp),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm.dp),
            ) {
                CategoryChip("All", state.category == null) { state.category = null }
                effectCategories.forEach { label ->
                    CategoryChip(label, state.category == label) {
                        state.category = if (state.category == label) null else label
                    }
                }
            }

            Spacer(Modifier.height(Spacing.sm.dp))

            if (results.isEmpty()) {
                Box(Modifier.fillMaxWidth().height(140.dp), contentAlignment = Alignment.Center) {
                    Text("No effect matches \"${state.query}\"", color = Tokens.textFaint, fontSize = 12.sp)
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxWidth().heightIn(max = 380.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        start = Spacing.lg.dp,
                        end = Spacing.lg.dp,
                        bottom = Spacing.lg.dp,
                    ),
                ) {
                    if (state.recentlyUsed.isNotEmpty() && state.query.isBlank() && state.category == null) {
                        item {
                            SectionLabel("RECENTLY USED")
                        }
                        items(state.recentlyUsed) { type ->
                            EffectPickRow(type, onAdd = { state.addEffect(type) }, trailing = "Recent")
                        }
                        item { SectionLabel("ALL EFFECTS") }
                    }
                    items(results) { type ->
                        EffectPickRow(type, onAdd = { state.addEffect(type) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = Tokens.textFaint,
        fontSize = 9.sp,
        letterSpacing = 1.4.sp,
        modifier = Modifier.padding(top = Spacing.md.dp, bottom = Spacing.xs.dp),
    )
}

@Composable
private fun SearchField(query: String, onQuery: (String) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .height(40.dp)
            .background(Tokens.surface2, RoundedCornerShape(10.dp))
            .border(1.dp, Tokens.hairline, RoundedCornerShape(10.dp))
            .padding(horizontal = Spacing.md.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Search, contentDescription = null, tint = Tokens.textFaint, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(Spacing.sm.dp))
        Box(Modifier.weight(1f)) {
            if (query.isEmpty()) {
                Text("Search effects", color = Tokens.textFaint, fontSize = 13.sp)
            }
            BasicTextField(
                value = query,
                onValueChange = onQuery,
                singleLine = true,
                textStyle = TextStyle(color = Tokens.text, fontSize = 13.sp),
                cursorBrush = SolidColor(Tokens.primary),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun CategoryChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val bg = if (selected) Tokens.primaryDim else Tokens.surface2
    val fg = if (selected) Tokens.primary else Tokens.textDim
    val stroke = if (selected) Tokens.primary else Tokens.hairline
    Text(
        label,
        color = fg,
        fontSize = 11.sp,
        modifier = Modifier
            .height(28.dp)
            .background(bg, RoundedCornerShape(percent = 50))
            .border(1.dp, stroke, RoundedCornerShape(percent = 50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

@Composable
private fun EffectPickRow(type: EffectType, onAdd: () -> Unit, trailing: String? = null) {
    val schema = schemaFor(type)
    Row(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clickable(onClick = onAdd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(40.dp)
                .background(Brush.linearGradient(thumbnailColors(schema.category.label)), RoundedCornerShape(9.dp)),
        )
        Spacer(Modifier.width(Spacing.md.dp))
        Column(Modifier.weight(1f)) {
            Text(schema.label, color = Tokens.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Text(
                "${schema.category.label} · ${schema.params.size} params" + (trailing?.let { " · $it" } ?: ""),
                color = Tokens.textFaint,
                fontSize = 10.sp,
            )
        }
        Box(
            Modifier
                .size(28.dp)
                .background(Tokens.surface2, RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Add, contentDescription = "Add ${schema.label}", tint = Tokens.primary, modifier = Modifier.size(16.dp))
        }
    }
}

private fun thumbnailColors(category: String): List<Color> = when (category) {
    "Glow" -> listOf(Color(0xFF2A1436), Color(0xFF6D3B8F))
    "Blur" -> listOf(Color(0xFF15202E), Color(0xFF3C5670))
    "Colour" -> listOf(Color(0xFF2B1A10), Color(0xFF8A5A2B))
    "Distort" -> listOf(Color(0xFF10241F), Color(0xFF2F6E5C))
    "Glitch" -> listOf(Color(0xFF1A1030), Color(0xFF9B2C6B))
    "Stylise" -> listOf(Color(0xFF1E1B12), Color(0xFF7A6A35))
    else -> listOf(Tokens.surface2, Tokens.surface3)
}
