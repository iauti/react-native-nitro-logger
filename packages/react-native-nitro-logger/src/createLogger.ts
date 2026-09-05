import type { Attributes, LogAttributes } from "./Attributes.ts";
import type { Diagnostic } from "./Diagnostic.ts";
import type { Logger } from "./Logger.ts";
import type { LoggerOptions } from "./LoggerOptions.ts";
import { levels, type LogLevel } from "./LogLevel.ts";
import type { LogRecord } from "./LogRecord.ts";
import type { TransportStatus } from "./TransportStatus.ts";
import { snapshot, sensitiveKeys } from "./internal/snapshot.ts";
import { TransportWorker } from "./internal/TransportWorker.ts";

/** Create one application-owned logger; pass it to features or derive children. */
export function createLogger(options: LoggerOptions): Logger {
  const threshold = levels[options.level ?? "info"];
  if (threshold === undefined) throw new TypeError("Invalid logger level");
  const keys = sensitiveKeys(options.redactKeys ?? []);
  const processors = [...(options.processors ?? [])];
  const diagnostic = options.onDiagnostic;
  let reporting = false;
  let processing = false;
  const report = (event: Diagnostic) => {
    if (reporting) return;
    reporting = true;
    try {
      diagnostic?.(Object.freeze(event));
    } catch {
      /* Diagnostics cannot break application logging. */
    } finally {
      reporting = false;
    }
  };
  const names = new Set<string>();
  const workers = options.transports.map((entry) => {
    if (!entry.transport.name || names.has(entry.transport.name))
      throw new TypeError("Transport names must be nonempty and unique");
    names.add(entry.transport.name);
    return new TransportWorker({ ...entry }, report);
  });
  let closed = false;
  let closeResult: Promise<readonly TransportStatus[]> | undefined;
  let sequence = 0;
  const status = () => Object.freeze(workers.map((worker) => worker.status()));
  const flush = () =>
    closeResult ??
    Promise.all(workers.map((worker) => worker.barrier("flush")));
  const close = () => {
    if (!closeResult) {
      closed = true;
      closeResult = Promise.all(
        workers.map((worker) => worker.barrier("close")),
      );
    }
    return closeResult;
  };
  function make(context: LogAttributes): Logger {
    const enabled = (level: LogLevel) =>
      !closed &&
      !reporting &&
      !processing &&
      levels[level] >= threshold &&
      workers.some((worker) => worker.enabled(level));
    const log = (
      level: LogLevel,
      message: string,
      attributes: Attributes = {},
    ): boolean => {
      if (!enabled(level)) return false;
      let record: LogRecord | undefined;
      try {
        record = Object.freeze({
          sequence: ++sequence,
          timestampMs: Date.now(),
          level,
          message: message.slice(0, 4096),
          attributes: snapshot(
            { ...context, ...snapshot(attributes, keys) },
            keys,
          ),
        });
      } catch {
        report({ source: "logger", operation: "snapshot", reason: "failed" });
        return false;
      }
      const timestampMs = record.timestampMs;
      const recordSequence = record.sequence;
      processing = true;
      try {
        for (const processor of processors) {
          record = processor(record);
          if (record === undefined) return false;
        }
        // Keep ordering, timestamp, and severity authoritative. Processors may change payload only.
        record = Object.freeze({
          sequence: recordSequence,
          timestampMs,
          level,
          message: record.message.slice(0, 4096),
          attributes: snapshot(record.attributes, keys),
        });
      } catch {
        report({ source: "logger", operation: "processor", reason: "failed" });
        return false;
      } finally {
        processing = false;
      }
      if (closed) return false;
      let accepted = false;
      for (const worker of workers) {
        if (worker.enqueue(record)) accepted = true;
      }
      return accepted;
    };
    return Object.freeze({
      log,
      isLevelEnabled: enabled,
      trace: (message: string, attributes?: Attributes) =>
        log("trace", message, attributes),
      debug: (message: string, attributes?: Attributes) =>
        log("debug", message, attributes),
      info: (message: string, attributes?: Attributes) =>
        log("info", message, attributes),
      warn: (message: string, attributes?: Attributes) =>
        log("warn", message, attributes),
      error: (message: string, attributes?: Attributes) =>
        log("error", message, attributes),
      fatal: (message: string, attributes?: Attributes) =>
        log("fatal", message, attributes),
      child: (attributes: Attributes) =>
        make(snapshot({ ...context, ...snapshot(attributes, keys) }, keys)),
      flush,
      close,
      getStatus: status,
    });
  }
  return make(snapshot(options.context ?? {}, keys));
}
