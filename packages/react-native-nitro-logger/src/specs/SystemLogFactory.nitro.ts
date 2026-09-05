import type { HybridObject } from "react-native-nitro-modules";
import type { SystemLogOptions } from "./SystemLogOptions.ts";
import type { SystemLogSink } from "./SystemLogSink.nitro.ts";

export interface SystemLogFactory extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  createSink(options: SystemLogOptions): SystemLogSink;
}
