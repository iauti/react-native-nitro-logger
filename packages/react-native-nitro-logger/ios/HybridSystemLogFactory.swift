import NitroModules

final class HybridSystemLogFactory: HybridSystemLogFactorySpec {
  func createSink(options: SystemLogOptions) throws -> any HybridSystemLogSinkSpec {
    try options.validate()
    return HybridSystemLogSink(options: options)
  }
}
