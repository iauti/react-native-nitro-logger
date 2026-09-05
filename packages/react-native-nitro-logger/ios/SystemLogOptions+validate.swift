import Foundation

extension SystemLogOptions {
  func validate() throws {
    guard !category.isEmpty, category.utf16.count <= 128 else {
      throw NSError(
        domain: "NitroLogger", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "category must contain 1–128 UTF-16 code units"])
    }
    if let subsystem, subsystem.isEmpty || subsystem.utf16.count > 256 {
      throw NSError(
        domain: "NitroLogger", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "subsystem must contain 1–256 UTF-16 code units"])
    }
  }
}
