package site.beyondredeye.ankitcutz.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * AnkitCutz design tokens — see editor/design/DESIGN.md §1.
 *
 * Rules:
 *  - `action` (rose) means "this commits something" (Export / Apply / Done). Nothing else.
 *  - `primary` (cyan) means selected / playing / keyed.
 *  - `secondary` (violet) marks text layers, `audio` marks audio.
 *  - No shadows anywhere: surfaces separate by hairline + one shade lighter.
 */
object Tokens {
    val bg = Color(0xFF0B0C10)
    val surface = Color(0xFF12141A)
    val surface2 = Color(0xFF191C24)
    val surface3 = Color(0xFF21242E)

    val hairline = Color(0x14FFFFFF)      // white 8%
    val hairlineSoft = Color(0x0DFFFFFF)  // white 5%

    val text = Color(0xFFF2F4F8)
    val textDim = Color(0xFF9AA1AE)
    val textFaint = Color(0xFF5F6674)

    val primary = Color(0xFF22D3EE)       // electric cyan
    val primaryDim = Color(0x2422D3EE)    // cyan 14%
    val secondary = Color(0xFF8B5CF6)     // violet (text layers)
    val audio = Color(0xFF3B82F6)         // blue (waveforms)
    val action = Color(0xFFF0567E)        // rose — the ONLY action colour
    val warning = Color(0xFFE2BE7E)       // champagne (limits, estimates)

    /** Layer type accent, used by the timeline, layer rows and pills. */
    fun accentFor(type: LayerType): Color = when (type) {
        LayerType.VIDEO, LayerType.IMAGE -> primary
        LayerType.TEXT -> secondary
        LayerType.AUDIO -> audio
        LayerType.SHAPE, LayerType.ADJUSTMENT, LayerType.GROUP -> textDim
    }
}

/** Four-dp grid, as documented. */
object Spacing {
    const val xs = 4
    const val sm = 8
    const val md = 12
    const val lg = 16
    const val xl = 20
    const val xxl = 28
}

/**
 * Layout targets from DESIGN.md §6.6/§7.6 — kept here so every screen uses the
 * same numbers instead of hardcoding its own.
 */
object Sizes {
    const val topBar = 48
    const val transport = 48
    const val transportIcon = 22
    const val ruler = 28
    const val bottomTabs = 56
    const val layerColumn = 76
    const val clipRowVideo = 44
    const val clipRowAudio = 36
    const val trimHandleVisible = 24
    const val trimHandleTouch = 32
    const val fab = 56
    const val scrubTrack = 6
    const val scrubThumb = 18
}
