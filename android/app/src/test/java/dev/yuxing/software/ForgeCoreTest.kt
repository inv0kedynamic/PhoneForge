package dev.yuxing.software

import dev.yuxing.software.core.ForgeCore
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 与 123.py 的等价性断言：
 *   QQW / HSW / 交叉积 / txt / vcf 四段逻辑逐条对齐。
 */
class ForgeCoreTest {

    @Test
    fun patternToRegex_matchesXAsDigit() {
        val re = ForgeCore.patternToRegex("133xxx")
        assertEquals(true, re.matches("133001"))
        assertEquals(true, re.matches("133999"))
        assertEquals(false, re.matches("13300"))
        assertEquals(false, re.matches("143001"))
    }

    @Test
    fun buildSuffixes_tailXx33_gives100() {
        val suf = ForgeCore.buildSuffixes("xx33")
        assertEquals(100, suf.size)
        assertEquals("0033", suf.first())
        assertEquals("9933", suf.last())
        assertEquals(true, suf.all { it.endsWith("33") })
    }

    @Test
    fun buildSuffixes_allX_gives10000() {
        assertEquals(10000, ForgeCore.buildSuffixes("xxxx").size)
    }

    @Test
    fun buildSuffixes_empty_returnsAll() {
        assertEquals(10000, ForgeCore.buildSuffixes("").size)
    }

    @Test
    fun filterSegments_onlyWhenSegmentPatternPresent() {
        val segs = listOf("1330010", "1330101", "1330011", "1339999")
        // 前 7 位无 x → 与脚本一致，直接返回全部
        assertEquals(segs.size, ForgeCore.filterSegments("", segs).size)
        // 1330xxx → 10 开头的那批
        val filtered = ForgeCore.filterSegments("1330xxx", segs)
        assertEquals(listOf("1330010", "1330101", "1330011"), filtered)
    }

    @Test
    fun crossProduct_matchesNestedLoop() {
        val nums = ForgeCore.crossProduct(listOf("1330010", "1330011"), listOf("0033", "9933"))
        assertEquals(listOf("13300100033", "13300109933", "13300110033", "13300119933"), nums)
    }

    @Test
    fun buildTxt_oneNumberPerLine() {
        val txt = ForgeCore.buildTxt(listOf("1330010"), listOf("0033", "9933"))
        assertEquals("13300100033\n13300109933\n", txt)
    }

    @Test
    fun buildVcf_matchesScriptTemplate() {
        val vcf = ForgeCore.buildVcf(listOf("1330010"), listOf("0033"))
        val expected = buildString {
            append("BEGIN:VCARD\n")
            append("VERSION:3.0\n")
            append("N:;13300100033;;;\n")
            append("FN:13300100033\n")
            append("TEL;type=CELL;type=VOICE;type=pref:13300100033\n")
            append("END:VCARD\n")
        }
        assertEquals(expected, vcf)
    }

    @Test
    fun extractSegments_fromHtmlAnchors() {
        val html = """
            <a href="/prefix/1330010/">1330010</a>
            <a href="/prefix/1330011/">1330011</a>
            <a href="/prefix/133/">133</a>
        """.trimIndent()
        assertEquals(listOf("1330010", "1330011"), ForgeCore.extractSegments(html))
    }

    @Test
    fun extractSegments_dedupesAndSorts() {
        val html = "/prefix/1330101/ /prefix/1330010/ /prefix/1330101/"
        assertEquals(listOf("1330010", "1330101"), ForgeCore.extractSegments(html))
    }

    @Test
    fun segmentPath_encodesChinese() {
        assertEquals("/prefix/%E5%8C%97%E4%BA%AC133/", ForgeCore.segmentPath("北京", "133", encoded = true))
    }
}
