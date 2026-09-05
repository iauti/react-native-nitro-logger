import type { LogRecord } from "../LogRecord.ts";
import type { Transport } from "../Transport.ts";

export interface MemoryTransport extends Transport {
  /** An immutable snapshot ordered oldest to newest. */
  getRecords(): readonly LogRecord[];
  clear(): void;
}
