package site.beyondredeye.ankitcutz

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.Modifier
import site.beyondredeye.ankitcutz.ui.AnkitCutzApp
import site.beyondredeye.ankitcutz.ui.theme.AnkitCutzTheme
import site.beyondredeye.ankitcutz.ui.theme.Tokens

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AnkitCutzTheme {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(Tokens.bg)
                        .statusBarsPadding()
                        .navigationBarsPadding(),
                ) {
                    AnkitCutzApp()
                }
            }
        }
    }
}
