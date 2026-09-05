package com.margelo.nitro.nitrologger

internal fun SystemLogOptions.validate() {
    require(category.isNotEmpty() && category.length <= 128) { "category must contain 1–128 UTF-16 code units" }
    val subsystem = subsystem
    require(subsystem == null || (subsystem.isNotEmpty() && subsystem.length <= 256)) { "subsystem must contain 1–256 UTF-16 code units" }
}
