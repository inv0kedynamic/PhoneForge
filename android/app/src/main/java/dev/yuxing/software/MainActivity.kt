package dev.yuxing.software

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.isSystemInDarkTheme
import dev.yuxing.software.ui.ForgeScreen
import dev.yuxing.software.ui.theme.PhoneForgeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            // null = 跟随系统；false = 浅色；true = 深色
            var darkOverride by remember { mutableStateOf<Boolean?>(null) }
            val systemDark = isSystemInDarkTheme()
            val dark = darkOverride ?: systemDark

            PhoneForgeTheme(darkTheme = dark) {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ForgeScreen(
                        darkOverride = darkOverride,
                        onToggleTheme = {
                            darkOverride = when (darkOverride) {
                                null -> false
                                false -> true
                                else -> null
                            }
                        },
                    )
                }
            }
        }
    }
}
