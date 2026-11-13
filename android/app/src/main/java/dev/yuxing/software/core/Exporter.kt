package dev.yuxing.software.core

import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.ContextCompat

/**
 * 导出落盘：Android 10+ 走 MediaStore 写进「下载」目录，
 * 低版本退回应用私有外部目录（无需存储权限）。
 * 文件名与脚本一致：txt.txt / vcf.vcf
 */
object Exporter {

    data class Saved(val displayName: String, val location: String)

    fun save(context: Context, fileName: String, mime: String, content: String): Saved {
        val bytes = content.toByteArray(Charsets.UTF_8)

        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            val values = android.content.ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: error("无法在下载目录创建文件")
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("写入失败")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            Saved(fileName, "下载/$fileName")
        } else {
            val dir = ContextCompat.getExternalFilesDirs(context, null)
                .filterNotNull()
                .firstOrNull()
                ?: context.filesDir
            val target = java.io.File(dir, fileName)
            target.writeBytes(bytes)
            Saved(fileName, target.absolutePath)
        }
    }
}
