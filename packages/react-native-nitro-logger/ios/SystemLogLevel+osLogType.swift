import os

extension SystemLogLevel {
  var osLogType: OSLogType {
    switch self {
    case .logTrace, .logDebug: return .debug
    case .logInfo: return .info
    case .logWarn: return .default
    case .logError: return .error
    case .logFatal: return .fault
    }
  }
}
