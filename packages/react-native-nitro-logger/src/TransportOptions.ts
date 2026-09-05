import type { LogLevel } from "./LogLevel.ts";
import type { Transport } from "./Transport.ts";

export interface TransportOptions {
  readonly transport: Transport;
  /** Defaults to trace; the logger's threshold is also applied. */
  readonly level?: LogLevel;
  /** Includes in-flight records. Drop newest on overflow. Default 512. */
  readonly capacity?: number;
  /** Default 32, maximum 256. */
  readonly batchSize?: number;
  /** Maximum duration per write/flush/close. Timeout disables this transport. Default 5000. */
  readonly timeoutMs?: number;
}
