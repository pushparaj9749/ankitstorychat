package site.beyondredeye.ankitcutz.ui.editor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import site.beyondredeye.ankitcutz.data.PickedMedia
import site.beyondredeye.ankitcutz.data.ProjectStore
import site.beyondredeye.ankitcutz.model.Clip
import site.beyondredeye.ankitcutz.model.EffectPreset
import site.beyondredeye.ankitcutz.model.EffectSpec
import site.beyondredeye.ankitcutz.model.EffectStack
import site.beyondredeye.ankitcutz.model.EffectType
import site.beyondredeye.ankitcutz.model.Layer
import site.beyondredeye.ankitcutz.model.Project
import site.beyondredeye.ankitcutz.model.Timeline
import site.beyondredeye.ankitcutz.model.allSchemas
import site.beyondredeye.ankitcutz.model.randomId
import site.beyondredeye.ankitcutz.model.schemaFor

/**
 * Editor state: one project, one playhead, one selected layer.
 *
 * Rules kept here rather than in composables:
 *  - every mutation is one undo step (slider drags coalesce into one, see [commitParamEdit]);
 *  - every mutation autosaves, because a phone editor that loses work is worse than slow;
 *  - the model stays immutable, so undo is just "keep the previous Project".
 */
class EditorState(
    initial: Project,
    private val store: ProjectStore? = null,
) {
    var project: Project by mutableStateOf(initial)
        private set

    var selectedLayerId: String by mutableStateOf(initial.layers.first().id)
    var selectedClipId: String? by mutableStateOf(initial.videoLayer?.clips?.firstOrNull()?.id)

    var tab: EditorTab by mutableStateOf(EditorTab.LAYERS)
    var effectsOpen: Boolean by mutableStateOf(false)
        private set
    var addSheetOpen: Boolean by mutableStateOf(false)
    var exportOpen: Boolean by mutableStateOf(false)
    var expandedEffectId: String? by mutableStateOf(null)
    var query: String by mutableStateOf("")
    var category: String? by mutableStateOf(null)
    var recentlyUsed: List<EffectType> by mutableStateOf(emptyList())
        private set

    var playheadMs: Long by mutableStateOf(0L)
        private set

    /** Bumped only on explicit seeks, so the player never fights its own progress ticks. */
    var seekNonce: Int by mutableStateOf(0)
        private set

    var isPlaying: Boolean by mutableStateOf(false)

    private val undoStack = ArrayDeque<Project>()
    private val redoStack = ArrayDeque<Project>()
    private var pendingUndo: Project? = null

    val selectedLayer: Layer
        get() = project.layer(selectedLayerId) ?: project.layers.first()

    val selectedClip: Clip?
        get() {
            val clips = selectedLayer.clips
            return clips.firstOrNull { it.id == selectedClipId } ?: Timeline.clipAt(clips, playheadMs) ?: clips.firstOrNull()
        }

    val clips: List<Clip> get() = selectedLayer.clips
    val durationMs: Long get() = project.totalDurationMs

    val canUndo: Boolean get() = undoStack.isNotEmpty()
    val canRedo: Boolean get() = redoStack.isNotEmpty()

    val passes: Int get() = EffectStack.totalPasses(selectedLayer.effects)
    val budget: Int = EffectStack.budgetFor(deviceRamGb = deviceRamGb())

    // ---- project level -----------------------------------------------------

    private fun mutate(block: (Project) -> Project) {
        flushPendingUndo()
        pushUndo(project)
        apply(block(project))
    }

    private fun apply(next: Project) {
        project = next
        autosave()
    }

    private fun autosave() {
        store?.let { runCatching { project = it.save(project) } }
    }

    private fun pushUndo(snapshot: Project) {
        undoStack.addLast(snapshot)
        if (undoStack.size > 80) undoStack.removeFirst()
        redoStack.clear()
    }

    private fun flushPendingUndo() {
        pendingUndo?.let { pushUndo(it); pendingUndo = null }
    }

    fun rename(name: String) = mutate { it.copy(name = name) }

    // ---- media -------------------------------------------------------------

    /** Adds the picked file to the selected video layer, appended after existing clips. */
    fun addClip(media: PickedMedia) {
        val clip = Clip(
            uri = media.uri,
            name = media.name,
            isVideo = media.isVideo,
            sourceDurationMs = media.durationMs,
            sourceEndMs = media.durationMs,
        )
        val layer = selectedLayer
        mutate { proj ->
            proj.replaceLayer(layer.copy(clips = Timeline.add(layer.clips, clip)))
        }
        selectedClipId = clip.id
        seekTo(layer.clips.lastOrNull()?.timelineEndMs ?: 0L)
    }

    fun addLayer(type: site.beyondredeye.ankitcutz.model.LayerType, name: String) {
        val layer = Layer(name = name, type = type)
        mutate { it.copy(layers = it.layers + layer) }
        selectedLayerId = layer.id
    }

    fun selectLayer(id: String) {
        selectedLayerId = id
        selectedClipId = project.layer(id)?.clips?.firstOrNull()?.id
    }

    fun selectClip(id: String) {
        selectedClipId = id
        val clip = clips.firstOrNull { it.id == id } ?: return
        seekTo(clip.timelineStartMs)
    }

    fun removeClip(id: String) = mutateLayerClips { Timeline.remove(it, id) }

    fun splitAtPlayhead() {
        val clip = Timeline.clipAt(clips, playheadMs) ?: return
        mutateLayerClips { Timeline.split(it, clip.id, playheadMs) }
    }

    fun moveClip(from: Int, to: Int) = mutateLayerClips { Timeline.move(it, from, to) }

    fun trim(clipId: String, newStartMs: Long, newEndMs: Long) =
        mutateLayerClips { Timeline.trim(it, clipId, newStartMs, newEndMs) }

    private fun mutateLayerClips(block: (List<Clip>) -> List<Clip>) {
        val layer = selectedLayer
        mutate { proj -> proj.replaceLayer(layer.copy(clips = block(layer.clips))) }
    }

    // ---- transport ---------------------------------------------------------

    fun seekTo(ms: Long) {
        playheadMs = ms.coerceIn(0L, maxOf(durationMs, 0L))
        seekNonce++
    }

    fun seekBy(deltaMs: Long) = seekTo(playheadMs + deltaMs)

    fun togglePlay() {
        if (isPlaying) isPlaying = false else {
            if (playheadMs >= durationMs - 50) seekTo(0)
            isPlaying = true
        }
    }

    /** Player progress tick: the playhead follows playback, it does not drive it. */
    fun onPlayerTick(ms: Long) {
        if (!isPlaying) return
        playheadMs = ms.coerceIn(0L, maxOf(durationMs, 0L))
        if (ms >= durationMs) isPlaying = false
    }

    // ---- navigation --------------------------------------------------------

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

    // ---- effects (each call = one undo entry) ------------------------------

    private fun editEffects(block: (List<EffectSpec>) -> List<EffectSpec>) {
        val layer = selectedLayer
        mutate { proj -> proj.replaceLayer(layer.copy(effects = block(layer.effects))) }
    }

    fun addEffect(type: EffectType, atIndex: Int? = null) {
        editEffects { current ->
            if (atIndex == null) EffectStack.add(current, type) else EffectStack.addAt(current, type, atIndex)
        }
        recentlyUsed = (listOf(type) + recentlyUsed.filterNot { it == type }).take(6)
        expandedEffectId = selectedLayer.effects.lastOrNull()?.id
        addSheetOpen = false
        query = ""
        category = null
    }

    fun removeEffect(id: String) {
        editEffects { EffectStack.remove(it, id) }
        if (expandedEffectId == id) expandedEffectId = selectedLayer.effects.lastOrNull()?.id
    }

    fun duplicateEffect(id: String) = editEffects { EffectStack.duplicate(it, id) }
    fun toggleEffect(id: String) = editEffects { EffectStack.toggle(it, id) }
    fun moveEffect(from: Int, to: Int) = editEffects { EffectStack.move(it, from, to) }

    /**
     * Slider drags fire dozens of times a second; recording each frame would bury the
     * user's real actions in the undo stack, so live changes coalesce into ONE entry.
     */
    fun updateParam(effectId: String, key: String, value: Float) {
        if (pendingUndo == null) pendingUndo = project
        val layer = selectedLayer
        apply(
            project.replaceLayer(
                layer.copy(effects = EffectStack.updateParam(layer.effects, effectId, key, value)),
            ),
        )
    }

    fun commitParamEdit() = flushPendingUndo()

    fun toggleKeyframe(effectId: String, key: String, timeUs: Long) {
        flushPendingUndo()
        editEffects { EffectStack.toggleKeyframe(it, effectId, key, timeUs) }
    }

    fun applyPreset(effectId: String, preset: EffectPreset) {
        editEffects { EffectStack.applyPreset(it, effectId, preset) }
    }

    fun resetEffect(effectId: String) {
        val effect = selectedLayer.findEffect(effectId) ?: return
        val fresh = EffectSpec(id = effect.id, type = effect.type, enabled = effect.enabled).withDefaults()
        editEffects { current -> current.map { if (it.id == effectId) fresh else it } }
    }

    /** Take this whole stack to another layer — our differentiator, one tap. */
    fun copyStackTo(layerId: String) {
        val stack = selectedLayer.effects
        val target = project.layer(layerId) ?: return
        mutate { proj -> proj.replaceLayer(target.copy(effects = stack)) }
    }

    // ---- history -----------------------------------------------------------

    fun undo() {
        flushPendingUndo()
        val previous = undoStack.removeLastOrNull() ?: return
        redoStack.addLast(project)
        apply(previous)
    }

    fun redo() {
        flushPendingUndo()
        val next = redoStack.removeLastOrNull() ?: return
        undoStack.addLast(project)
        apply(next)
    }

    companion object {
        fun create(store: ProjectStore, name: String = "Untitled"): EditorState {
            val project = store.save(Project(id = randomId(), name = name))
            return EditorState(project, store)
        }

        fun load(project: Project, store: ProjectStore) = EditorState(project, store)

        /** RAM-based pass budget; a cheap device is told the truth, not hidden. */
        private fun deviceRamGb(): Int {
            val runtime = Runtime.getRuntime()
            val maxHeapMb = runtime.maxMemory() / (1024 * 1024)
            // Heap size is a coarse proxy; clamp to the three budget tiers.
            return when {
                maxHeapMb >= 400 -> 8
                maxHeapMb >= 200 -> 4
                else -> 3
            }
        }
    }
}

/** Category chip labels in the order shown in the add-effect sheet. */
val effectCategories: List<String> = listOf("Glow", "Blur", "Colour", "Distort", "Glitch", "Stylise", "Mask")

/**
 * Search across effect name + category, so "glow" finds Deep Glow and "glitch" finds
 * Chromatic Aberration without the user knowing our taxonomy.
 */
fun searchEffects(query: String, categoryLabel: String?): List<EffectType> {
    val q = query.trim().lowercase()
    return allSchemas.asSequence()
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
