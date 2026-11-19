package site.beyondredeye.ankitcutz.ui.editor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import site.beyondredeye.ankitcutz.model.EffectPreset
import site.beyondredeye.ankitcutz.model.EffectSpec
import site.beyondredeye.ankitcutz.model.EffectStack
import site.beyondredeye.ankitcutz.model.EffectType
import site.beyondredeye.ankitcutz.model.Layer
import site.beyondredeye.ankitcutz.model.LayerType
import site.beyondredeye.ankitcutz.model.schemaFor

/**
 * Week-1 editor state.
 *
 * Deliberately plain Kotlin + Compose snapshot state instead of a ViewModel/DI stack:
 * the model already is the source of truth, and this holds only what a screen needs.
 * Undo is a list of previous layer snapshots because the model is immutable — the
 * same trick that keeps preview == export (PLAN.md §6.6).
 */
class EditorState(seed: List<Layer>) {

    var layers: SnapshotStateList<Layer> = seed.toMutableStateList()
        private set

    var selectedLayerId: String by mutableStateOf(seed.first().id)
        private set

    var tab: EditorTab by mutableStateOf(EditorTab.LAYERS)
    var effectsOpen: Boolean by mutableStateOf(false)
        private set
    var addSheetOpen: Boolean by mutableStateOf(false)
    var expandedEffectId: String? by mutableStateOf(null)
    var query: String by mutableStateOf("")
    var category: String? by mutableStateOf(null)

    /** Recently used drives the top of the Add-effect sheet (screen 20). */
    var recentlyUsed: List<EffectType> by mutableStateOf(emptyList())
        private set

    private val undoStack = ArrayDeque<List<Layer>>()
    private val redoStack = ArrayDeque<List<Layer>>()

    val selectedLayer: Layer
        get() = layers.firstOrNull { it.id == selectedLayerId } ?: layers.first()

    val canUndo: Boolean get() = undoStack.isNotEmpty()
    val canRedo: Boolean get() = redoStack.isNotEmpty()

    val passes: Int get() = EffectStack.totalPasses(selectedLayer.effects)
    val budget: Int = EffectStack.budgetFor(deviceRamGb = 8)

    // ---- navigation -------------------------------------------------------

    fun selectTab(next: EditorTab) {
        tab = next
        effectsOpen = false
    }

    fun openEffects() {
        effectsOpen = true
        expandedEffectId = selectedLayer.effects.lastOrNull()?.id
    }

    fun closeEffects() {
        effectsOpen = false
        addSheetOpen = false
    }

    // ---- edits (each one = one undo entry) --------------------------------

    /**
     * Slider drags fire dozens of times per second. Recording each frame would bury the
     * user's real actions in the undo stack, so live param changes coalesce into ONE
     * entry that is committed when the drag ends ([commitParamEdit]).
     */
    private var pendingUndo: List<Layer>? = null

    private fun pushUndo(snapshot: List<Layer>) {
        undoStack.addLast(snapshot)
        if (undoStack.size > 60) undoStack.removeFirst()
        redoStack.clear()
    }

    private fun flushPendingUndo() {
        pendingUndo?.let { pushUndo(it); pendingUndo = null }
    }

    private fun edit(block: (List<EffectSpec>) -> List<EffectSpec>) {
        flushPendingUndo()
        val layer = selectedLayer
        pushUndo(layers.toList())
        replaceLayer(layer.copy(effects = block(layer.effects)))
    }

    private fun replaceLayer(updated: Layer) {
        val index = layers.indexOfFirst { it.id == updated.id }
        if (index >= 0) layers[index] = updated
    }

    fun addEffect(type: EffectType, atIndex: Int? = null) {
        edit { current ->
            if (atIndex == null) EffectStack.add(current, type)
            else EffectStack.addAt(current, type, atIndex)
        }
        recentlyUsed = (listOf(type) + recentlyUsed.filterNot { it == type }).take(6)
        expandedEffectId = selectedLayer.effects.lastOrNull()?.id
        addSheetOpen = false
        query = ""
        category = null
    }

    fun removeEffect(id: String) { edit { EffectStack.remove(it, id) }; closeIfGone(id) }
    fun duplicateEffect(id: String) { edit { EffectStack.duplicate(it, id) } }
    fun toggleEffect(id: String) = edit { EffectStack.toggle(it, id) }
    fun moveEffect(from: Int, to: Int) = edit { EffectStack.move(it, from, to) }

    fun updateParam(effectId: String, key: String, value: Float) {
        if (pendingUndo == null) pendingUndo = layers.toList()
        val layer = selectedLayer
        replaceLayer(
            layer.copy(effects = EffectStack.updateParam(layer.effects, effectId, key, value)),
        )
    }

    /** Called on slider release; the whole drag becomes one undo step. */
    fun commitParamEdit() = flushPendingUndo()

    fun toggleKeyframe(effectId: String, key: String, timeUs: Long) {
        flushPendingUndo()
        edit { EffectStack.toggleKeyframe(it, effectId, key, timeUs) }
    }

    fun applyPreset(effectId: String, preset: EffectPreset) =
        edit { EffectStack.applyPreset(it, effectId, preset) }

    fun resetEffect(effectId: String) {
        val effect = selectedLayer.findEffect(effectId) ?: return
        val fresh = EffectSpec(
            id = effect.id,
            type = effect.type,
            enabled = effect.enabled,
        ).withDefaults()
        edit { current -> current.map { if (it.id == effectId) fresh else it } }
    }

    /** The 4 differentiator: take this whole stack and drop it on another layer. */
    fun copyStackTo(layerId: String) {
        val stack = selectedLayer.effects
        val target = layers.firstOrNull { it.id == layerId } ?: return
        undoStack.addLast(layers.toList())
        replaceLayer(target.copy(effects = stack))
    }

    private fun closeIfGone(id: String) {
        if (selectedLayer.findEffect(id) == null && expandedEffectId == id) {
            expandedEffectId = selectedLayer.effects.lastOrNull()?.id
        }
    }

    // ---- history ----------------------------------------------------------

    fun undo() {
        flushPendingUndo()
        val previous = undoStack.removeLastOrNull() ?: return
        redoStack.addLast(layers.toList())
        applySnapshot(previous)
    }

    fun redo() {
        val next = redoStack.removeLastOrNull() ?: return
        undoStack.addLast(layers.toList())
        applySnapshot(next)
    }

    private fun applySnapshot(snapshot: List<Layer>) {
        layers.clear()
        layers.addAll(snapshot)
        if (layers.none { it.id == selectedLayerId }) selectedLayerId = layers.first().id
    }

    companion object {
        /** A seed project so the shell has something real to point at. */
        fun demo(): EditorState = EditorState(
            listOf(
                Layer(name = "Clip 01", type = LayerType.VIDEO),
                Layer(name = "Title", type = LayerType.TEXT),
                Layer(name = "Music", type = LayerType.AUDIO),
            ),
        )
    }
}

/** Category chip labels in the order shown in screen 20. */
val effectCategories: List<String> = listOf("Glow", "Blur", "Colour", "Distort", "Glitch", "Stylise", "Mask")

/**
 * Search across effect name + category, so "glow" finds Deep Glow and "glitch" finds
 * Chromatic Aberration without the user knowing our taxonomy.
 */
fun searchEffects(query: String, categoryLabel: String?): List<EffectType> {
    val q = query.trim().lowercase()
    return site.beyondredeye.ankitcutz.model.allSchemas
        .asSequence()
        .filter { categoryLabel == null || it.category.label == categoryLabel }
        .filter {
            q.isEmpty() ||
                it.label.lowercase().contains(q) ||
                it.category.label.lowercase().contains(q)
        }
        .map { it.type }
        .toList()
}

fun schemaLabel(type: EffectType): String = schemaFor(type).label
