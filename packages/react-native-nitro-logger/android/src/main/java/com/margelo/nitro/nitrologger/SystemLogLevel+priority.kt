package com.margelo.nitro.nitrologger

import android.util.Log

internal fun SystemLogLevel.priority(): Int =
    when (this) {
        SystemLogLevel.LOG_TRACE -> Log.VERBOSE
        SystemLogLevel.LOG_DEBUG -> Log.DEBUG
        SystemLogLevel.LOG_INFO -> Log.INFO
        SystemLogLevel.LOG_WARN -> Log.WARN
        SystemLogLevel.LOG_ERROR -> Log.ERROR
        SystemLogLevel.LOG_FATAL -> Log.ASSERT
    }
