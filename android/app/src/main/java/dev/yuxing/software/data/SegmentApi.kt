package dev.yuxing.software.data

import dev.yuxing.software.core.ForgeCore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.GZIPInputStream

/**
 * telphone.cn 的三条硬规矩（与 Web 版代理一致）：
 *   1. 只认 80 明文：443 是自签证书，且 /prefix/{地区}{前3位}/ 在 https 下返回 404
 *   2. 必须带 Accept-Encoding: gzip，否则 nginx 直接 403
 *      "Access Denied. Gzip compression is required."
 *   3. 号段列表在 /prefix/{地区}{前3位}/ 页面里
 */
object SegmentApi {

    private const val HOST = "telphone.cn"
    private const val UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

    data class Result(val segments: List<String>, val url: String, val status: Int)

    suspend fun fetch(region: String, prefix3: String): Result = withContext(Dispatchers.IO) {
        val path = ForgeCore.segmentPath(region, prefix3, encoded = true)
        val url = URL("http://$HOST$path")
        var conn: HttpURLConnection? = null
        try {
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 20_000
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", UA)
                setRequestProperty("Referer", "http://$HOST/")
                setRequestProperty("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
                // 站点强制要求 gzip，缺这个头直接 403
                setRequestProperty("Accept-Encoding", "gzip")
                setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                setRequestProperty("Connection", "close")
            }

            val status = conn.responseCode
            val raw = (if (status in 200..299) conn.inputStream else conn.errorStream)
                ?.use { it.readBytes() }
                ?: ByteArray(0)

            val encoding = conn.contentEncoding
            val bytes = if (encoding != null && encoding.contains("gzip", ignoreCase = true)) {
                runCatching { GZIPInputStream(raw.inputStream()).use { it.readBytes() } }
                    .getOrDefault(raw)
            } else raw

            val html = bytes.toString(Charsets.UTF_8)
            Result(ForgeCore.extractSegments(html), url.toString(), status)
        } finally {
            conn?.disconnect()
        }
    }
}
