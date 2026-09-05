import type { HybridObject } from "react-native-nitro-modules";
import type { SystemLogEntry } from "./SystemLogEntry.ts";

export interface SystemLogSink extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  write(entries: SystemLogEntry[]): Promise<void>;
}
