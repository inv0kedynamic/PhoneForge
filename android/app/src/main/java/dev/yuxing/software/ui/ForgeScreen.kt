package dev.yuxing.software.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SettingsBrightness
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.yuxing.software.core.Exporter
import dev.yuxing.software.core.ForgeCore
import kotlinx.coroutines.launch

private val REGION_PRESETS = listOf(
    "北京", "上海", "广东", "江苏", "浙江", "四川", "山东", "河南",
    "湖北", "陕西", "天津", "重庆", "福建", "湖南", "安徽", "辽宁",
)

private const val PREVIEW_LIMIT = 200

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForgeScreen(
    darkOverride: Boolean? = null,
    onToggleTheme: () -> Unit = {},
    vm: ForgeViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current

    var scrolled by remember { mutableStateOf(false) }

    LaunchedEffect(state.messageSeq) {
        if (state.message.isNotEmpty()) {
            snackbar.showSnackbar(state.message)
        }
    }

    val suffixes = remember(state.pattern, state.patternValid) { state.suffixes }
    val matched = remember(state.segments, state.segmentPattern) { state.matchedSegments }
    val total = matched.size * suffixes.size
    val preview = remember(matched, suffixes) {
        if (matched.isEmpty() || suffixes.isEmpty()) emptyList()
        else ForgeCore.crossProduct(matched.take(PREVIEW_LIMIT), suffixes)
            .take(PREVIEW_LIMIT)
    }

    Scaffold(
        snackbarHost = {
            SnackbarHost(snackbar) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = if (state.messageIsError)
                        MaterialTheme.colorScheme.errorContainer
                    else MaterialTheme.colorScheme.inverseSurface,
                    contentColor = if (state.messageIsError)
                        MaterialTheme.colorScheme.onErrorContainer
                    else MaterialTheme.colorScheme.inverseOnSurface,
                )
            }
        },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("号码工坊", style = MaterialTheme.typography.titleLarge)
                        Text(
                            "号段解析 · 模式补全 · txt / vcf 导出",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    Box(
                        modifier = Modifier
                            .padding(start = 8.dp)
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "号",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onToggleTheme) {
                        Icon(
                            when (darkOverride) {
                                null -> Icons.Filled.SettingsBrightness
                                false -> Icons.Filled.LightMode
                                else -> Icons.Filled.DarkMode
                            },
                            contentDescription = "切换主题",
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = if (scrolled)
                        MaterialTheme.colorScheme.surfaceContainer
                    else MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { inner ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(inner),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // 1. 模式
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                    ),
                ) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("号码模式", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.width(8.dp))
                            Surface(
                                shape = RoundedCornerShape(percent = 50),
                                color = MaterialTheme.colorScheme.secondaryContainer,
                            ) {
                                Text(
                                    "x = 任意数字",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                )
                            }
                        }
                        Text(
                            "例：133xxxxxx33 → 前 3 位固定，中间 4–6 位任意，后 3 位固定。",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        OutlinedTextField(
                            value = state.pattern,
                            onValueChange = vm::onPatternChange,
                            label = { Text("模式串") },
                            singleLine = true,
                            isError = !state.patternValid,
                            supportingText = {
                                Text(
                                    if (state.patternValid)
                                        "前 3 位 ${state.prefix3.ifEmpty { "—" }} · 中段 ${state.mid4.ifEmpty { "（空）" }} · 后段 ${state.tail.ifEmpty { "（空）" }}"
                                    else "只允许数字与 x"
                                )
                            },
                            keyboardOptions = KeyboardOptions(
                                capitalization = KeyboardCapitalization.None,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = state.region,
                            onValueChange = vm::onRegionChange,
                            label = { Text("地区（号段页路径里的省份名）") },
                            singleLine = true,
                            supportingText = {
                                Text(
                                    if (state.prefix3.isNotEmpty())
                                        "将请求 telphone.cn/prefix/${state.region}${state.prefix3}/"
                                    else "填好模式串前 3 位后自动拼出请求地址"
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        RegionChips(state.region, vm::onRegionChange)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = vm::fetch, enabled = !state.loading) {
                                Icon(Icons.Filled.Search, null, Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(if (state.loading) "抓取中…" else "抓取号段")
                            }
                            OutlinedButton(onClick = vm::toggleManual) {
                                Text(if (state.manualOpen) "收起手动输入" else "手动粘贴号段")
                            }
                            Spacer(Modifier.weight(1f))
                            TextButton(onClick = vm::reset) { Text("重置") }
                        }
                        AnimatedVisibility(visible = state.loading) {
                            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        }
                        AnimatedVisibility(visible = state.manualOpen) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                HorizontalDivider()
                                OutlinedTextField(
                                    value = state.manualText,
                                    onValueChange = vm::onManualChange,
                                    label = { Text("粘贴号段页 HTML，或 7 位号段列表") },
                                    minLines = 4,
                                    textStyle = MaterialTheme.typography.bodySmall.copy(
                                        fontFamily = FontFamily.Monospace,
                                    ),
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                FilledTonalButton(onClick = vm::applyManual) {
                                    Text("从粘贴内容解析")
                                }
                            }
                        }
                    }
                }
            }

            // 2. 概览
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                    ),
                ) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("结果概览", style = MaterialTheme.typography.titleMedium)
                            if (state.fetchedUrl.isNotEmpty()) {
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    state.fetchedUrl.replace("http://telphone.cn", "")
                                        .take(34),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                )
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            StatTile("抓到的号段", state.segments.size.toString(), Modifier.weight(1f))
                            StatTile("命中号段", matched.size.toString(), Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            StatTile("后段组合", suffixes.size.toString(), Modifier.weight(1f))
                            StatTile(
                                "号码总数",
                                total.toString(),
                                Modifier.weight(1f),
                                accent = true,
                            )
                        }
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        val txt = ForgeCore.buildTxt(matched, suffixes)
                                        if (txt.isEmpty()) return@launch
                                        runCatching {
                                            Exporter.save(context, "txt.txt", "text/plain", txt)
                                        }.onSuccess {
                                            snackbar.showSnackbar("已导出 ${it.location}")
                                        }.onFailure {
                                            snackbar.showSnackbar("导出失败：${it.message}")
                                        }
                                    }
                                },
                                enabled = total > 0,
                            ) {
                                Icon(Icons.Filled.Description, null, Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("导出 txt.txt")
                            }
                            ElevatedButton(
                                onClick = {
                                    scope.launch {
                                        val vcf = ForgeCore.buildVcf(matched, suffixes)
                                        if (vcf.isEmpty()) return@launch
                                        runCatching {
                                            Exporter.save(context, "vcf.vcf", "text/vcard", vcf)
                                        }.onSuccess {
                                            snackbar.showSnackbar("已导出 ${it.location}")
                                        }.onFailure {
                                            snackbar.showSnackbar("导出失败：${it.message}")
                                        }
                                    }
                                },
                                enabled = total > 0,
                            ) {
                                Icon(Icons.Filled.Person, null, Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("导出 vcf.vcf")
                            }
                            Spacer(Modifier.weight(1f))
                            IconButton(
                                onClick = {
                                    clipboard.setText(AnnotatedString(matched.joinToString("\n")))
                                    scope.launch {
                                        snackbar.showSnackbar("已复制 ${matched.size} 个号段")
                                    }
                                },
                                enabled = matched.isNotEmpty(),
                            ) {
                                Icon(Icons.Filled.ContentCopy, "复制号段", Modifier.size(20.dp))
                            }
                        }
                    }
                }
            }

            // 3. 命中号段
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                    ),
                ) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("命中号段", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                matched.size.toString(),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (matched.isEmpty()) {
                            Text(
                                "还没有命中号段。先抓取号段，或把手里的号段粘进来。",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 16.dp),
                            )
                        } else {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 180.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.surfaceContainer),
                            ) {
                                LazyColumn(contentPadding = PaddingValues(8.dp)) {
                                    itemsIndexed(matched.take(160)) { _, seg ->
                                        Text(
                                            seg,
                                            style = MaterialTheme.typography.labelLarge.copy(
                                                fontFamily = FontFamily.Monospace,
                                            ),
                                            modifier = Modifier.padding(vertical = 2.dp, horizontal = 4.dp),
                                        )
                                    }
                                    if (matched.size > 160) {
                                        item {
                                            Text(
                                                "+${matched.size - 160} 更多…",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.padding(4.dp),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 4. 预览
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                    ),
                ) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("号码预览", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "前 ${minOf(PREVIEW_LIMIT, total)} / $total",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (preview.isEmpty()) {
                            Text(
                                "导出前这里会显示生成的号码。",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 16.dp),
                            )
                        } else {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 320.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.surfaceContainer),
                            ) {
                                LazyColumn(contentPadding = PaddingValues(vertical = 6.dp)) {
                                    itemsIndexed(preview) { i, num ->
                                        Row(
                                            Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 16.dp, vertical = 4.dp),
                                        ) {
                                            Text(
                                                "${i + 1}",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.width(44.dp),
                                            )
                                            Text(
                                                num,
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    fontFamily = FontFamily.Monospace,
                                                ),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        Text(
                            "导出行为与脚本一致：txt.txt 每行一个号码；vcf.vcf 为 VCARD 3.0 条目。",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RegionChips(selected: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val rows = REGION_PRESETS.chunked(4)
        for (row in rows) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (r in row) {
                    val active = r == selected
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (active) MaterialTheme.colorScheme.secondaryContainer
                        else MaterialTheme.colorScheme.surfaceContainer,
                        border = if (active) null else androidx.compose.foundation.BorderStroke(
                            1.dp,
                            MaterialTheme.colorScheme.outlineVariant,
                        ),
                        onClick = { onSelect(r) },
                    ) {
                        Text(
                            r,
                            style = MaterialTheme.typography.labelMedium,
                            color = if (active) MaterialTheme.colorScheme.onSecondaryContainer
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    accent: Boolean = false,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = if (accent) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surfaceContainer,
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Medium,
                color = if (accent) MaterialTheme.colorScheme.onPrimaryContainer
                else MaterialTheme.colorScheme.onSurface,
            )
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = if (accent) MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f)
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
