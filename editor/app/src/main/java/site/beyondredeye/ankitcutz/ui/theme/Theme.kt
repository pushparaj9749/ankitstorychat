package site.beyondredeye.ankitcutz.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Dark-only for v1 (DESIGN.md §3 rule 7). A light theme is a later decision, not a
 * Week-1 one, and half a light theme is worse than none.
 *
 * Type scale from DESIGN.md §1: 28 / 22 / 17 / 15 / 13 / 11.
 * Inter ships with the app from Phase 3; until then the platform sans is used, so no
 * missing-font fallback surprises appear in the first build.
 */
private val AnkitCutzColors = darkColorScheme(
    primary = Tokens.primary,
    onPrimary = Tokens.bg,
    secondary = Tokens.secondary,
    onSecondary = Tokens.text,
    tertiary = Tokens.action,
    background = Tokens.bg,
    onBackground = Tokens.text,
    surface = Tokens.surface,
    onSurface = Tokens.text,
    surfaceVariant = Tokens.surface2,
    onSurfaceVariant = Tokens.textDim,
    outline = Tokens.hairline,
    error = Tokens.action,
)

private val AnkitCutzType = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.4).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = (-0.3).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 22.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 21.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.2.sp,
    ),
)

@Composable
fun AnkitCutzTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AnkitCutzColors,
        typography = AnkitCutzType,
        content = content,
    )
}
