package com.margelo.nitro.nitrologger

import android.util.Log
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Keep
@DoNotStrip
class HybridSystemLogSink(
    private val tag: String,
) : HybridSystemLogSinkSpec() {
    override fun write(entries: Array<SystemLogEntry>): Promise<Unit> {
        require(entries.size <= 256) { "Batch exceeds 256 entries" }
        return Promise.async {
            withContext(Dispatchers.IO) {
                for (entry in entries) {
                    // 700 Unicode code points fit well below Logcat's byte limit, including supplementary characters.
                    val payload = entry.payload.take(32768)
                    var start = 0
                    while (start < payload.length) {
                        val count = minOf(700, payload.codePointCount(start, payload.length))
                        val end = payload.offsetByCodePoints(start, count)
                        Log.println(entry.level.priority(), tag, payload.substring(start, end))
                        start = end
                    }
                }
            }
        }
    }
}
