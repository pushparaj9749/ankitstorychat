package site.beyondredeye.ankitcutz.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import site.beyondredeye.ankitcutz.data.MediaMeta
import site.beyondredeye.ankitcutz.data.ProjectStore
import site.beyondredeye.ankitcutz.ui.editor.EditorShell
import site.beyondredeye.ankitcutz.ui.editor.EditorState
import site.beyondredeye.ankitcutz.ui.editor.EffectsStackScreen
import site.beyondredeye.ankitcutz.ui.editor.ExportSheet
import site.beyondredeye.ankitcutz.ui.projects.ProjectsScreen
import site.beyondredeye.ankitcutz.ui.theme.Tokens
import java.io.File

/**
 * Three destinations: projects, editor, effects stack. No router library — this is a
 * state machine small enough to read, and Back behaves like a phone app should.
 */
@Composable
fun AnkitCutzApp() {
    val context = LocalContext.current
    val store = remember { ProjectStore(File(context.filesDir, "projects")) }
    val scope = rememberCoroutineScope()

    var summaries by remember { mutableStateOf(store.summaries()) }
    var editor by remember { mutableStateOf<EditorState?>(null) }
    var importError by remember { mutableStateOf<String?>(null) }

    // Android Photo Picker: no storage permission, no broad access, just the file touched.
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val target = editor ?: return@rememberLauncherForActivityResult
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val media = withContext(Dispatchers.IO) { MediaMeta.probe(context, uri) }
            if (media == null) {
                importError = "That file cannot be read. Try another clip."
            } else {
                importError = null
                target.addClip(media)
            }
        }
    }

    fun launchPicker() {
        picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo))
    }

    val current = editor

    BackHandler(enabled = current != null) {
        val active = current ?: return@BackHandler
        when {
            active.exportOpen -> active.exportOpen = false
            active.addSheetOpen -> active.addSheetOpen = false
            active.effectsOpen -> active.closeEffects()
            else -> {
                summaries = store.summaries()
                editor = null
            }
        }
    }

    Surface(color = Tokens.bg, modifier = Modifier.fillMaxSize()) {
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
            when {
                current == null -> ProjectsScreen(
                    projects = summaries,
                    onNew = { editor = EditorState.create(store) },
                    onOpen = { id -> store.load(id)?.let { editor = EditorState.load(it, store) } },
                    onDelete = { id ->
                        store.delete(id)
                        summaries = store.summaries()
                    },
                )

                current.effectsOpen -> EffectsStackScreen(state = current, onClose = current::closeEffects)

                else -> {
                    EditorShell(
                        state = current,
                        onBack = {
                            summaries = store.summaries()
                            editor = null
                        },
                        onImport = ::launchPicker,
                        onExport = { current.exportOpen = true },
                    )
                    if (current.exportOpen) {
                        ExportSheet(state = current, onClose = { current.exportOpen = false })
                    }
                }
            }

            // Unreadable codec, not a crash: one line, self-clearing, above the tabs.
            val message = importError
            if (message != null) {
                LaunchedEffect(message) {
                    kotlinx.coroutines.delay(4000)
                    importError = null
                }
                Surface(
                    color = Tokens.surface3,
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = 16.dp, vertical = 72.dp),
                ) {
                    Text(
                        message,
                        color = Tokens.warning,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }
        }
    }
}
