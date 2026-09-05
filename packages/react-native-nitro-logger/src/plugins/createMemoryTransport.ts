import type { LogRecord } from "../LogRecord.ts";
import type { MemoryTransport } from "./MemoryTransport.ts";

export function createMemoryTransport(
  options: { readonly name?: string; readonly capacity?: number } = {},
): MemoryTransport {
  const capacity = options.capacity ?? 200;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 65536)
    throw new RangeError("Memory capacity must be an integer from 1 to 65536");
  const ring = new Array<LogRecord>(capacity);
  let count = 0;
  let cursor = 0;
  return {
    name: options.name ?? "memory",
    write(records) {
      for (const record of records) {
        ring[cursor] = record;
        cursor = (cursor + 1) % capacity;
        count = Math.min(count + 1, capacity);
      }
    },
    getRecords() {
      return Object.freeze(
        Array.from(
          { length: count },
          (_, index) => ring[(cursor - count + index + capacity) % capacity]!,
        ),
      );
    },
    clear() {
      ring.length = 0;
      count = 0;
      cursor = 0;
    },
  };
}
