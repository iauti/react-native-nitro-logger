package com.margelo.nitro.nitrologger

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridSystemLogFactory : HybridSystemLogFactorySpec() {
    override fun createSink(options: SystemLogOptions): HybridSystemLogSinkSpec {
        options.validate()
        return HybridSystemLogSink(options.category)
    }
}
