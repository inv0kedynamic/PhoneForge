package dev.yuxing.software.core

/**
 * 号码工坊核心逻辑 —— 与 123.py 的四个函数一一对应：
 *
 *   GET_QQW(region, prefix) → fetchSegments() 拉页面 + extractSegments() 抽 7 位号段
 *   QQW(pattern, list)      → filterSegments()
 *   HSW(pattern)            → buildSuffixes()
 *   main() 的交叉积          → crossProduct() / buildTxt() / buildVcf()
 */
object ForgeCore {

    /** 与页面里 `<a href="/prefix/(\d{7})/">` 的抓取口径一致 */
    private val SEGMENT_LINK = Regex("""/prefix/(\d{7})/""")
    private val BARE_SEGMENT = Regex("""\b(\d{7})\b""")

    /** 把含 x 的模式转成等长正则；非数字字符按字面量转义 */
    fun patternToRegex(pattern: String): Regex {
        val sb = StringBuilder()
        for (ch in pattern) {
            when {
                ch == 'x' || ch == 'X' -> sb.append("\\d")
                ch in '0'..'9' -> sb.append(ch)
                else -> sb.append(Regex.escape(ch.toString()))
            }
        }
        return Regex("^$sb$")
    }

    /** 对应 GET_QQW 的 findall：从号段页 HTML 里抽出 7 位号段，去重排序 */
    fun extractSegments(html: String): List<String> {
        val found = LinkedHashSet<String>()
        SEGMENT_LINK.findAll(html).forEach { found.add(it.groupValues[1]) }
        if (found.isEmpty()) {
            BARE_SEGMENT.findAll(html).forEach { found.add(it.groupValues[1]) }
        }
        return found.sorted()
    }

    /** 对应 HSW：0000-9999 全量生成后按模式过滤 */
    fun buildSuffixes(pattern: String): List<String> {
        if (pattern.isEmpty()) return (0..9999).map { it.toString().padStart(4, '0') }
        val re = patternToRegex(pattern)
        val out = ArrayList<String>()
        for (i in 0..9999) {
            val s = i.toString().padStart(4, '0')
            if (re.matches(s)) out.add(s)
        }
        return out
    }

    /** 对应 QQW：对号段列表按模式过滤 */
    fun filterSegments(pattern: String, segments: List<String>): List<String> {
        if (pattern.isEmpty()) return segments
        val re = patternToRegex(pattern)
        return segments.filter { re.matches(it) }
    }

    /** 交叉积，与脚本里双层 for 一致 */
    fun crossProduct(segments: List<String>, suffixes: List<String>): List<String> {
        val out = ArrayList<String>(segments.size * suffixes.size)
        for (seg in segments) for (suf in suffixes) out.add(seg + suf)
        return out
    }

    /** 对应 txt.txt：每行一个号码 */
    fun buildTxt(segments: List<String>, suffixes: List<String>): String {
        if (segments.isEmpty() || suffixes.isEmpty()) return ""
        val sb = StringBuilder(segments.size * suffixes.size * 12)
        for (seg in segments) for (suf in suffixes) sb.append(seg).append(suf).append('\n')
        return sb.toString()
    }

    /** 对应 vcf.vcf：VCARD 3.0 条目 */
    fun buildVcf(segments: List<String>, suffixes: List<String>): String {
        if (segments.isEmpty() || suffixes.isEmpty()) return ""
        val sb = StringBuilder(segments.size * suffixes.size * 130)
        for (seg in segments) {
            for (suf in suffixes) {
                val phone = seg + suf
                sb.append("BEGIN:VCARD\n")
                    .append("VERSION:3.0\n")
                    .append("N:;").append(phone).append(";;;\n")
                    .append("FN:").append(phone).append('\n')
                    .append("TEL;type=CELL;type=VOICE;type=pref:").append(phone).append('\n')
                    .append("END:VCARD\n")
            }
        }
        return sb.toString()
    }

    /** 号段页路径：/prefix/{地区}{前3位}/ */
    fun segmentPath(region: String, prefix3: String, encoded: Boolean = false): String {
        val key = region + prefix3
        val enc = if (encoded) java.net.URLEncoder.encode(key, "UTF-8") else key
        return "/prefix/$enc/"
    }
}
