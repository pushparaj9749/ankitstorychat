package site.beyondredeye.ankitcutz.model

/**
 * Pure stack operations — the only place effects are added, toggled, reordered or
 * removed. Keeping them pure (no Compose, no Android) is what lets them be unit-tested
 * without an emulator, and what makes undo a matter of keeping the previous list.
 *
 * ORDER MATTERS: `effects` is applied top → bottom, so index 0 renders first and each
 * later effect receives the previous result.
 */
object EffectStack {

    fun add(effects: List<EffectSpec>, type: EffectType): List<EffectSpec> =
        effects + EffectSpec(type = type).withDefaults()

    fun addAt(effects: List<EffectSpec>, type: EffectType, index: Int): List<EffectSpec> {
        val next = EffectSpec(type = type).withDefaults()
        val safe = index.coerceIn(0, effects.size)
        return effects.toMutableList().apply { add(safe, next) }
    }

    fun remove(effects: List<EffectSpec>, id: String): List<EffectSpec> =
        effects.filterNot { it.id == id }

    /** Duplicate lands directly under the original, like every NLE. */
    fun duplicate(effects: List<EffectSpec>, id: String): List<EffectSpec> {
        val index = effects.indexOfFirst { it.id == id }
        if (index < 0) return effects
        val copy = effects[index].copy(id = "fx-${System.nanoTime()}")
        return effects.toMutableList().apply { add(index + 1, copy) }
    }

    fun toggle(effects: List<EffectSpec>, id: String): List<EffectSpec> =
        effects.map { if (it.id == id) it.copy(enabled = !it.enabled) else it }

    fun move(effects: List<EffectSpec>, from: Int, to: Int): List<EffectSpec> {
        if (from !in effects.indices) return effects
        val target = to.coerceIn(0, effects.lastIndex)
        if (from == target) return effects
        val list = effects.toMutableList()
        val item = list.removeAt(from)
        list.add(target, item)
        return list
    }

    fun updateParam(
        effects: List<EffectSpec>,
        id: String,
        key: String,
        value: Float,
    ): List<EffectSpec> = effects.map { effect ->
        if (effect.id != id) return@map effect
        val current = effect.params[key] ?: return@map effect
        effect.copy(params = effect.params + (key to current.copy(value = value)))
    }

    /**
     * Diamond behaviour in the inspector: pressing it at a time where a key already
     * exists removes that key; otherwise it records the current value at that time.
     * First key captures the whole parameter, so nothing "snaps" on the second one.
     */
    fun toggleKeyframe(
        effects: List<EffectSpec>,
        id: String,
        key: String,
        timeUs: Long,
    ): List<EffectSpec> = effects.map { effect ->
        if (effect.id != id) return@map effect
        val param = effect.params[key] ?: return@map effect
        val existing = param.keyframes.indexOfFirst { it.timeUs == timeUs }
        val keys = if (existing >= 0) {
            param.keyframes.filterIndexed { index, _ -> index != existing }
        } else {
            (param.keyframes + Keyframe(timeUs, param.value)).sortedBy { it.timeUs }
        }
        effect.copy(params = effect.params + (key to param.copy(keyframes = keys)))
    }

    /** One undo entry per preset tap, not one per slider it touches. */
    fun applyPreset(effects: List<EffectSpec>, id: String, preset: EffectPreset): List<EffectSpec> =
        effects.map { effect ->
            if (effect.id != id) return@map effect
            val updated = effect.params.mapValues { (key, param) ->
                preset.values[key]?.let { param.copy(value = it) } ?: param
            }
            effect.copy(params = updated)
        }

    /** Total weighted passes — drives the merge/warning chip in the stack UI. */
    fun totalPasses(effects: List<EffectSpec>): Int =
        effects.filter { it.enabled }.sumOf { it.passCost }

    /**
     * Device budget from PLAN.md §6.6 E. Above it the renderer downsamples the preview
     * proxy and offers "fast quality" — effects are never silently dropped.
     */
    fun budgetFor(deviceRamGb: Int): Int = when {
        deviceRamGb >= 8 -> 8
        deviceRamGb >= 4 -> 5
        else -> 3
    }
}
