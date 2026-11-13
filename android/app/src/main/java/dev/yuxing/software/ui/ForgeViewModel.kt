package dev.yuxing.software.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.yuxing.software.core.ForgeCore
import dev.yuxing.software.data.SegmentApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ForgeUiState(
    val pattern: String = "13xxxxxxxxx",
    val region: String = "北京",
    val segments: List<String> = emptyList(),
    val fetchedUrl: String = "",
    val loading: Boolean = false,
    val message: String = "",
    val messageIsError: Boolean = false,
    val messageSeq: Long = 0L,
    val manualOpen: Boolean = false,
    val manualText: String = "",
) {
    val patternValid: Boolean get() = isValidPattern(pattern)

    val prefix3: String get() = pattern.take(3)
    val mid4: String get() = pattern.drop(3).take(4)
    val tail: String get() = pattern.drop(7)

    /** 前 7 位里含 x 时才需要过滤号段，与原脚本 QQW 调用条件一致 */
    val segmentPattern: String
        get() = pattern.take(7).let { if (it.contains('x') || it.contains('X')) it else "" }

    val suffixes: List<String>
        get() = if (!patternValid) emptyList() else ForgeCore.buildSuffixes(tail)

    val matchedSegments: List<String>
        get() = if (segments.isEmpty()) emptyList()
        else ForgeCore.filterSegments(segmentPattern, segments)

    val total: Int get() = matchedSegments.size * suffixes.size

    companion object {
        fun isValidPattern(p: String): Boolean {
            val clean = p.replace(Regex("[\\s\\u3000-]"), "")
            if (clean.isEmpty()) return false
            if (!Regex("^[0-9xX]+$").matches(clean)) return false
            // x 只允许是连续一段或多段，数字与 x 都合法，但不接受其它字符
            return true
        }
    }
}

class ForgeViewModel : ViewModel() {

    private val _state = MutableStateFlow(ForgeUiState())
    val state: StateFlow<ForgeUiState> = _state.asStateFlow()

    fun onPatternChange(v: String) = _state.update { it.copy(pattern = v) }
    fun onRegionChange(v: String) = _state.update { it.copy(region = v.trim()) }
    fun toggleManual() = _state.update { it.copy(manualOpen = !it.manualOpen) }
    fun onManualChange(v: String) = _state.update { it.copy(manualText = v) }

    fun reset() = _state.update {
        ForgeUiState()
    }

    private fun toast(text: String, error: Boolean = false) = _state.update {
        it.copy(message = text, messageIsError = error, messageSeq = it.messageSeq + 1)
    }

    fun fetch() {
        val s = _state.value
        if (!s.patternValid) {
            toast("模式串格式不对：只允许数字与 x", true)
            return
        }
        if (s.prefix3.isEmpty()) {
            toast("前 3 位不能为空", true)
            return
        }
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            runCatching { SegmentApi.fetch(s.region, s.prefix3) }
                .onSuccess { r ->
                    _state.update {
                        it.copy(loading = false, segments = r.segments, fetchedUrl = r.url)
                    }
                    if (r.segments.isEmpty()) {
                        toast("页面返回 ${r.status}，没解析到 7 位号段，可换地区或手动粘贴", true)
                    } else {
                        toast("抓到 ${r.segments.size} 个号段")
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, segments = emptyList()) }
                    toast("抓取失败：${e.message ?: e.javaClass.simpleName}", true)
                }
        }
    }

    fun applyManual() {
        val text = _state.value.manualText
        val fromHtml = ForgeCore.extractSegments(text)
        if (fromHtml.isNotEmpty()) {
            _state.update {
                it.copy(
                    segments = fromHtml,
                    fetchedUrl = "手动粘贴",
                    manualOpen = false,
                )
            }
            toast("从粘贴内容解析到 ${fromHtml.size} 个号段")
            return
        }
        val lines = text
            .split(Regex("[\\s,;]+"))
            .map { it.trim() }
            .filter { Regex("^\\d{7}$").matches(it) }
            .distinct()
            .sorted()
        if (lines.isNotEmpty()) {
            _state.update {
                it.copy(segments = lines, fetchedUrl = "手动粘贴", manualOpen = false)
            }
            toast("识别到 ${lines.size} 个 7 位号段")
            return
        }
        toast("粘贴内容里没找到 7 位号段", true)
    }
}
