import type { LogAttributes } from "./Attributes.ts";
import type { LogLevel } from "./LogLevel.ts";

export interface LogRecord {
  readonly sequence: number;
  readonly timestampMs: number;
  readonly level: LogLevel;
  readonly message: string;
  readonly attributes: LogAttributes;
}
