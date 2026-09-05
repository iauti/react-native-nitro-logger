import Foundation
import NitroModules
import os

final class HybridSystemLogSink: HybridSystemLogSinkSpec {
  private let queue = DispatchQueue(label: "com.nitrologger.system", qos: .utility)
  private let logger: os.Logger
  private let enablePublicLogging: Bool

  init(options: SystemLogOptions) {
    logger = os.Logger(
      subsystem: options.subsystem ?? Bundle.main.bundleIdentifier ?? "NitroLogger",
      category: options.category)
    enablePublicLogging = options.enablePublicLogging ?? false
    super.init()
  }

  func write(entries: [SystemLogEntry]) throws -> Promise<Void> {
    guard entries.count <= 256 else {
      throw NSError(
        domain: "NitroLogger", code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Batch exceeds 256 entries"])
    }
    return Promise.parallel(queue) {
      for entry in entries {
        // OS logging has implementation-specific payload limits. Truncate defensively.
        let payload = String(entry.payload.prefix(32768))
        if self.enablePublicLogging {
          self.logger.log(level: entry.level.osLogType, "\(payload, privacy: .public)")
        } else {
          self.logger.log(level: entry.level.osLogType, "\(payload, privacy: .private)")
        }
      }
    }
  }
}
