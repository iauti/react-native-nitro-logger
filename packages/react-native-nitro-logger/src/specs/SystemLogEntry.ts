import type { SystemLogLevel } from "./SystemLogLevel.ts";

/** Internal wire record. JSON is an already-redacted representation of the full record. */
export interface SystemLogEntry {
  level: SystemLogLevel;
  payload: string;
}
