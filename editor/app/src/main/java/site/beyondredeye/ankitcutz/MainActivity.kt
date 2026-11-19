package site.beyondredeye.ankitcutz

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import site.beyondredeye.ankitcutz.ui.AnkitCutzApp
import site.beyondredeye.ankitcutz.ui.theme.AnkitCutzTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Edge-to-edge with dark bars: the preview is the only bright surface on screen.
        enableEdgeToEdge()
        setContent {
            AnkitCutzTheme {
                AnkitCutzApp()
            }
        }
    }
}
