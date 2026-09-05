import type { Attributes } from "./Attributes.ts";
import type { Diagnostic } from "./Diagnostic.ts";
import type { LogLevel } from "./LogLevel.ts";
import type { LogRecord } from "./LogRecord.ts";
import type { TransportOptions } from "./TransportOptions.ts";

export interface LoggerOptions {
  readonly transports: readonly TransportOptions[];
  readonly level?: LogLevel;
  readonly context?: Attributes;
  /** Synchronous, ordered transforms. Return undefined to drop. Throwing drops the record. */
  readonly processors?: readonly ((
    record: LogRecord,
  ) => LogRecord | undefined)[];
  /** Case-insensitive key names, at any depth; extends built-in sensitive keys. */
  readonly redactKeys?: readonly string[];
  /** Must not log through the same logger. Exceptions are contained. */
  readonly onDiagnostic?: (diagnostic: Diagnostic) => void;
}
