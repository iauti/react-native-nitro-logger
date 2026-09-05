import type { Diagnostic } from "../Diagnostic.ts";
import { levels, type LogLevel } from "../LogLevel.ts";
import type { LogRecord } from "../LogRecord.ts";
import type { TransportOptions } from "../TransportOptions.ts";
import type { TransportStatus } from "../TransportStatus.ts";

type Barrier = {
  kind: "flush" | "close";
  resolve: (status: TransportStatus) => void;
};
type Entry = LogRecord | Barrier;
const timeout = Symbol("transport timeout");

export class TransportWorker {
  private readonly queue: Entry[] = [];
  private running = false;
  private state: TransportStatus["state"] = "active";
  private pending = 0;
  private delivered = 0;
  private dropped = 0;
  private failed = 0;
  private failures = 0;
  private readonly capacity: number;
  private readonly batchSize: number;
  private readonly timeoutMs: number;
  private readonly threshold: number;

  constructor(
    private readonly options: TransportOptions,
    private readonly report: (event: Diagnostic) => void,
  ) {
    this.capacity = options.capacity ?? 512;
    this.batchSize = options.batchSize ?? 32;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.threshold = levels[options.level ?? "trace"];
    for (const [name, value, max] of [
      ["capacity", this.capacity, 65536],
      ["batchSize", this.batchSize, 256],
      ["timeoutMs", this.timeoutMs, 60000],
    ] as const) {
      if (!Number.isInteger(value) || value < 1 || value > max)
        throw new RangeError(`${name} must be an integer from 1 to ${max}`);
    }
    if (this.threshold === undefined)
      throw new TypeError("Invalid transport level");
  }

  enabled(level: LogLevel): boolean {
    return this.state === "active" && levels[level] >= this.threshold;
  }

  enqueue(record: LogRecord): boolean {
    if (levels[record.level] < this.threshold) return false;
    if (this.state !== "active" || this.pending >= this.capacity) {
      this.dropped++;
      return false;
    }
    this.pending++;
    this.queue.push(record);
    this.start();
    return true;
  }

  barrier(kind: Barrier["kind"]): Promise<TransportStatus> {
    if (this.state !== "active") return Promise.resolve(this.status());
    return new Promise((resolve) => {
      this.queue.push({ kind, resolve });
      this.start();
    });
  }

  status(): TransportStatus {
    return Object.freeze({
      name: this.options.transport.name,
      state: this.state,
      pending: this.pending,
      delivered: this.delivered,
      dropped: this.dropped,
      failed: this.failed,
      failures: this.failures,
    });
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    queueMicrotask(() => {
      void this.drain();
    });
  }

  private async invoke(
    operation: "write" | "flush" | "close",
    action: () => void | Promise<void>,
  ): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(action),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(timeout), this.timeoutMs);
        }),
      ]);
      return true;
    } catch (error) {
      this.failures++;
      if (error === timeout) this.state = "disabled";
      this.report({
        source: this.options.transport.name,
        operation,
        reason: error === timeout ? "timeout" : "failed",
      });
      return false;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      if ("kind" in entry) {
        if (this.state === "active") {
          await this.invoke("flush", () => this.options.transport.flush?.());
          if (entry.kind === "close" && this.state === "active") {
            await this.invoke("close", () => this.options.transport.close?.());
            if (this.state === "active") this.state = "closed";
          }
        }
        entry.resolve(this.status());
        continue;
      }
      if (this.state !== "active") {
        this.pending--;
        this.dropped++;
        continue;
      }
      const batch = [entry];
      while (
        batch.length < this.batchSize &&
        this.queue[0] &&
        !("kind" in this.queue[0])
      )
        batch.push(this.queue.shift() as LogRecord);
      const success = await this.invoke("write", () =>
        this.options.transport.write(Object.freeze(batch)),
      );
      this.pending -= batch.length;
      if (success) this.delivered += batch.length;
      else this.failed += batch.length;
    }
    this.running = false;
  }
}
