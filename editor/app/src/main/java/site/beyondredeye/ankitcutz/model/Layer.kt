package site.beyondredeye.ankitcutz.model

import kotlinx.serialization.Serializable
import java.util.UUID

/**
 * The layer model — the foundation the whole editor rests on (PLAN.md §6.6).
 *
 * Effects are NOT clip features: every layer type carries the same [EffectStack],
 * mask slot and blend mode. Text and stickers are rasterised to a texture, which is
 * why glow/blur/glitch look identical on a title and on footage.
 *
 * Everything here is immutable: an edit produces a new value, which is what makes
 * undo/redo free and preview == export possible.
 */
enum class LayerType(val label: String) {
    VIDEO("Video"),
    IMAGE("Image"),
    TEXT("Text"),
    AUDIO("Audio"),
    SHAPE("Shape"),
    ADJUSTMENT("Adjustment"),
    GROUP("Group"),
}

@Serializable
data class Layer(
    val id: String = newId(),
    val name: String,
    val type: LayerType,
    val visible: Boolean = true,
    val locked: Boolean = false,
    val muted: Boolean = false,
    val effects: List<EffectSpec> = emptyList(),
    val clips: List<Clip> = emptyList(),
    val children: List<Layer> = emptyList(),
) {
    /** True when this layer (or any child) has at least one effect. */
    val effectCount: Int
        get() = effects.size + children.sumOf { it.effectCount }

    val hasKeyframes: Boolean
        get() = effects.any { it.params.values.any { p -> p.keyframes.isNotEmpty() } }

    fun withEffects(block: (List<EffectSpec>) -> List<EffectSpec>): Layer =
        copy(effects = block(effects))

    fun findEffect(effectId: String): EffectSpec? = effects.firstOrNull { it.id == effectId }
}

fun newId(): String = UUID.randomUUID().toString().take(8)
