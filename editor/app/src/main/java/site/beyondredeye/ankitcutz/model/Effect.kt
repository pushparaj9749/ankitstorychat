package site.beyondredeye.ankitcutz.model

/**
 * Effects are data, never code-with-a-UI (PLAN.md §6.6).
 *
 * Every effect declares an [EffectSchema]: typed, ranged parameters. The inspector is
 * generated from that schema, which is why "every effect is customisable" is true by
 * construction instead of by remembering to wire a slider — and why every keyframeable
 * parameter automatically gets its diamond.
 *
 * The schema also carries its pass cost (PLAN.md §6.6 E) so the 3/5/8-pass device
 * budget stays honest instead of being discovered when a phone overheats.
 */
enum class EffectType {
    GLOW, DEEP_GLOW, BLOOM, HALATION, NEON_GLOW,
    GAUSSIAN_BLUR, MOTION_BLUR,
    CHROMATIC, RGB_SPLIT, VHS, FRAME_ECHO,
    FILM_GRAIN, HUE_SHIFT,
}

enum class EffectCategory(val label: String) {
    GLOW("Glow"),
    BLUR("Blur"),
    COLOUR("Colour"),
    DISTORT("Distort"),
    GLITCH("Glitch"),
    STYLISE("Stylise"),
    MASK("Mask"),
}

enum class ParamType { FLOAT, INT, BOOL, COLOUR, ENUM }

data class ParamSchema(
    val key: String,
    val label: String,
    val type: ParamType,
    val min: Float = 0f,
    val max: Float = 1f,
    val step: Float = 0.01f,
    val default: Float = 0f,
    val defaultText: String? = null,
    val options: List<String> = emptyList(),
    val keyframeable: Boolean = true,
)

data class EffectSchema(
    val id: String,
    val type: EffectType,
    val category: EffectCategory,
    val label: String,
    val params: List<ParamSchema>,
) {
    fun param(key: String): ParamSchema? = params.firstOrNull { it.key == key }
}

/** Weighted GPU passes at full quality (PLAN.md §6.6 E). */
val EffectSchema.passCost: Int
    get() = when (type) {
        EffectType.DEEP_GLOW -> 5
        EffectType.GLOW, EffectType.NEON_GLOW, EffectType.BLOOM, EffectType.HALATION,
        EffectType.GAUSSIAN_BLUR, EffectType.MOTION_BLUR -> 3
        EffectType.FRAME_ECHO -> 2
        else -> 1
    }

data class ParamValue(
    val value: Float = 0f,
    val text: String? = null,
    val keyframes: List<Keyframe> = emptyList(),
) {
    companion object {
        fun initial(schema: ParamSchema): ParamValue = ParamValue(
            value = schema.default,
            text = schema.defaultText ?: schema.options.firstOrNull(),
        )
    }
}

data class Keyframe(val timeUs: Long, val value: Float)

private var effectSeq = 0

data class EffectSpec(
    val id: String = "fx-${++effectSeq}",
    val type: EffectType,
    val enabled: Boolean = true,
    val params: Map<String, ParamValue> = emptyMap(),
) {
    val passCost: Int get() = schemaFor(type).passCost

    /** Filled from schema defaults, so a freshly added effect already looks right. */
    fun withDefaults(): EffectSpec = if (params.isEmpty()) {
        copy(params = schemaFor(type).params.associate { it.key to ParamValue.initial(it) })
    } else {
        this
    }
}

/**
 * Effect catalogue. Only effects whose shader exists are listed — no placeholders that
 * look real but do nothing. Grows one shader at a time (PLAN.md §6.6, delivery order).
 */
val allSchemas: List<EffectSchema> = listOf(
    EffectSchema(
        "deep_glow", EffectType.DEEP_GLOW, EffectCategory.GLOW, "Deep Glow",
        listOf(
            f("radius", "Radius", 0f, 200f, 40f),
            f("intensity", "Intensity", 0f, 3f, 1.2f),
            f("threshold", "Threshold", 0f, 1f, 0.35f),
            f("softness", "Softness", 0f, 1f, 0.5f),
            f("spread", "Spread", 0f, 2f, 1f),
            c("tint", "Tint"),
            e("quality", "Quality", listOf("Fast", "Balanced", "High"), "Balanced", keyframeable = false),
        ),
    ),
    EffectSchema(
        "glow", EffectType.GLOW, EffectCategory.GLOW, "Glow",
        listOf(
            f("radius", "Radius", 0f, 150f, 24f),
            f("intensity", "Intensity", 0f, 2f, 0.8f),
            c("tint", "Tint"),
        ),
    ),
    EffectSchema(
        "bloom", EffectType.BLOOM, EffectCategory.GLOW, "Bloom",
        listOf(
            f("radius", "Radius", 0f, 120f, 30f),
            f("intensity", "Intensity", 0f, 2f, 0.9f),
        ),
    ),
    EffectSchema(
        "halation", EffectType.HALATION, EffectCategory.GLOW, "Halation",
        listOf(
            f("radius", "Radius", 0f, 80f, 18f),
            f("intensity", "Intensity", 0f, 2f, 0.6f),
            c("tint", "Tint"),
        ),
    ),
    EffectSchema(
        "gaussian_blur", EffectType.GAUSSIAN_BLUR, EffectCategory.BLUR, "Gaussian Blur",
        listOf(
            f("radius", "Radius", 0f, 100f, 8f),
            f("quality", "Quality", 1f, 5f, 3f),
        ),
    ),
    EffectSchema(
        "motion_blur", EffectType.MOTION_BLUR, EffectCategory.BLUR, "Motion Blur",
        listOf(
            f("angle", "Angle", 0f, 360f, 0f),
            f("distance", "Distance", 0f, 100f, 12f),
        ),
    ),
    EffectSchema(
        "chromatic", EffectType.CHROMATIC, EffectCategory.GLITCH, "Chromatic Aberration",
        listOf(
            f("amount", "Amount", 0f, 20f, 3f),
            f("angle", "Angle", 0f, 360f, 0f),
        ),
    ),
    EffectSchema(
        "rgb_split", EffectType.RGB_SPLIT, EffectCategory.GLITCH, "RGB Split",
        listOf(
            f("amount", "Amount", 0f, 40f, 6f),
            f("animate", "Animate", 0f, 1f, 1f),
        ),
    ),
    EffectSchema(
        "vhs", EffectType.VHS, EffectCategory.GLITCH, "VHS",
        listOf(
            f("wobble", "Wobble", 0f, 1f, 0.4f),
            f("noise", "Noise", 0f, 1f, 0.3f),
            f("bleed", "Colour bleed", 0f, 1f, 0.5f),
        ),
    ),
    EffectSchema(
        "film_grain", EffectType.FILM_GRAIN, EffectCategory.STYLISE, "Film Grain",
        listOf(
            f("amount", "Amount", 0f, 1f, 0.25f),
            f("size", "Size", 1f, 4f, 1.5f),
        ),
    ),
    EffectSchema(
        "hue_shift", EffectType.HUE_SHIFT, EffectCategory.COLOUR, "Hue Shift",
        listOf(f("hue", "Hue", -180f, 180f, 0f)),
    ),
    EffectSchema(
        "frame_echo", EffectType.FRAME_ECHO, EffectCategory.GLITCH, "Frame Echo",
        listOf(
            f("frames", "Frames", 1f, 8f, 3f),
            f("opacity", "Opacity", 0f, 1f, 0.5f),
        ),
    ),
)

private fun f(key: String, label: String, min: Float, max: Float, default: Float) =
    ParamSchema(key, label, ParamType.FLOAT, min, max, (max - min) / 100f, default)

private fun c(key: String, label: String) =
    ParamSchema(key, label, ParamType.COLOUR, defaultText = "White")

private fun e(
    key: String,
    label: String,
    options: List<String>,
    default: String,
    keyframeable: Boolean = true,
) = ParamSchema(
    key, label, ParamType.ENUM,
    defaultText = default, options = options, keyframeable = keyframeable,
)

fun schemaFor(type: EffectType): EffectSchema = allSchemas.first { it.type == type }

fun schemasIn(category: EffectCategory): List<EffectSchema> =
    allSchemas.filter { it.category == category }

/** Presets are saved parameter sets, never a single magic number. */
data class EffectPreset(val name: String, val values: Map<String, Float>)

val deepGlowPresets = listOf(
    EffectPreset("Soft", mapOf("radius" to 22f, "intensity" to 0.6f, "threshold" to 0.5f)),
    EffectPreset("Dreamy", mapOf("radius" to 40f, "intensity" to 1.2f, "threshold" to 0.35f, "softness" to 0.6f)),
    EffectPreset("Neon", mapOf("radius" to 18f, "intensity" to 1.8f, "threshold" to 0.2f)),
    EffectPreset("Trailer", mapOf("radius" to 70f, "intensity" to 1.5f, "threshold" to 0.45f)),
)
