import type { LogRecord } from "./LogRecord.ts";

/** A plugin instance belongs to one root logger. Batches are ordered and immutable. */
export interface Transport {
  readonly name: string;
  write(records: readonly LogRecord[]): void | Promise<void>;
  /** Flush SDK buffers if supported. Does not imply server ingestion. */
  flush?(): void | Promise<void>;
  /** Release resources owned by this instance, never an app-owned global SDK. */
  close?(): void | Promise<void>;
}
