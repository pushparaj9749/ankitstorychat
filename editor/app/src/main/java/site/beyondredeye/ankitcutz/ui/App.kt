package site.beyondredeye.ankitcutz.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import site.beyondredeye.ankitcutz.ui.editor.EditorShell
import site.beyondredeye.ankitcutz.ui.editor.EditorState
import site.beyondredeye.ankitcutz.ui.editor.EditorTab
import site.beyondredeye.ankitcutz.ui.editor.EffectsStackScreen
import site.beyondredeye.ankitcutz.ui.theme.Tokens

/**
 * Week-1 app: one project, the editor shell, and the effects stack.
 *
 * There is no router library on purpose — two destinations do not justify one, and the
 * effects screen is a full-screen overlay rather than a new task, which is what makes
 * Back behave the way a phone editor should.
 */
@Composable
fun AnkitCutzApp() {
    val state = remember { EditorState.demo() }

    BackHandler(enabled = state.effectsOpen || state.addSheetOpen) {
        if (state.addSheetOpen) state.addSheetOpen = false else state.closeEffects()
    }

    Surface(color = Tokens.bg, modifier = Modifier.fillMaxSize()) {
        if (state.effectsOpen) {
            EffectsStackScreen(state = state, onClose = state::closeEffects)
        } else {
            EditorShell(
                projectName = "Untitled · 9:16",
                layer = state.selectedLayer,
                selectedTab = state.tab,
                onTabSelected = { tab: EditorTab -> state.selectTab(tab) },
                onBack = {},
                onOpenEffects = state::openEffects,
                onExport = {},
            )
        }
    }
}
