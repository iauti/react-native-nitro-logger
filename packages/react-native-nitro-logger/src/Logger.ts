import type { Attributes } from "./Attributes.ts";
import type { LogLevel } from "./LogLevel.ts";
import type { TransportStatus } from "./TransportStatus.ts";

/** Each method returns whether at least one queue accepted the record, not delivery status. */
export interface Logger {
  log(level: LogLevel, message: string, attributes?: Attributes): boolean;
  trace(message: string, attributes?: Attributes): boolean;
  debug(message: string, attributes?: Attributes): boolean;
  info(message: string, attributes?: Attributes): boolean;
  warn(message: string, attributes?: Attributes): boolean;
  error(message: string, attributes?: Attributes): boolean;
  fatal(message: string, attributes?: Attributes): boolean;
  isLevelEnabled(level: LogLevel): boolean;
  /** Child context overrides parent keys. Lifecycle and transports are shared. */
  child(context: Attributes): Logger;
  /** Ordered barrier for records accepted before this call. */
  flush(): Promise<readonly TransportStatus[]>;
  /** Idempotent across the entire child family. Further log calls return false. */
  close(): Promise<readonly TransportStatus[]>;
  getStatus(): readonly TransportStatus[];
}
