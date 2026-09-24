# API reference

[Documentation index](README.md) · [Transport factories](transports.md)

Import `createLogger`, `levels`, and public types from `react-native-nitro-loggerkit`. The root does not load Nitro or vendor SDKs. `levels` maps `trace`, `debug`, `info`, `warn`, `error`, `fatal` to ascending numeric priorities.

## createLogger(options: LoggerOptions): Logger

| Option                                      | Default  | Meaning                                                                        |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `transports: readonly TransportOptions[]`   | Required | Destinations; an empty array accepts no logs                                   |
| `level: LogLevel`                           | `"info"` | Minimum root severity; cannot be changed after construction                    |
| `context: Attributes`                       | `{}`     | Snapshot shared by records and children                                        |
| `processors`                                | `[]`     | Ordered synchronous `(record: LogRecord) => LogRecord \| undefined` transforms |
| `redactKeys: readonly string[]`             | `[]`     | Extend built-in sensitive key names                                            |
| `onDiagnostic: (event: Diagnostic) => void` | None     | Independent failure observer; exceptions are contained                         |

`TransportOptions` wraps the factory result:

| Option                 | Default   | Valid values                                     |
| ---------------------- | --------- | ------------------------------------------------ |
| `transport: Transport` | Required  | Nonempty name, unique in this root               |
| `level: LogLevel`      | `"trace"` | Root threshold also applies                      |
| `capacity: number`     | `512`     | Integer 1–65,536, including in-flight records    |
| `batchSize: number`    | `32`      | Integer 1–256                                    |
| `timeoutMs: number`    | `5000`    | Integer 1–60,000 per write/flush/close operation |

Construction throws `TypeError` for invalid levels or duplicate/empty names and `RangeError` for invalid numeric worker limits. Native/factory creation can throw before `createLogger` is called. Transport write errors are contained and reported through status/diagnostics.

## Logger methods

| Method                                                    | Result and behavior                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `log(level, message, attributes?)`                        | `boolean`: accepted by at least one queue                                                    |
| `trace/debug/info/warn/error/fatal(message, attributes?)` | Same boolean result; fixed severity                                                          |
| `isLevelEnabled(level)`                                   | `boolean`: root/transport thresholds and active state; **does not check remaining capacity** |
| `child(context: Attributes)`                              | `Logger`: snapshot of merged context, shared queues/lifecycle                                |
| `getStatus()`                                             | `readonly TransportStatus[]`: immediate counters without waiting                             |
| `flush()`                                                 | `Promise<readonly TransportStatus[]>`: ordered barrier described below                       |
| `close()`                                                 | Same promise type; idempotent for the whole family                                           |

`message` is a string; attributes use `Readonly<Record<string, unknown>>`. Pass errors as `{ error }`, not as the message. There are no printf-style or variadic overloads.

`LogRecord` has `sequence: number`, `timestampMs: number` (Unix milliseconds), `level: LogLevel`, `message: string`, and `attributes: LogAttributes`. Normalized attribute values are JSON-compatible scalars, arrays, and objects. Records and nested snapshots are frozen. Sequences increase across the family but may have gaps after processor drops or queue rejection.

`TransportStatus` contains `name`, `state` (`active`, `disabled`, `closed`), `pending` (queued plus in flight), `delivered` (write completed), `dropped` (queue rejection/discard), `failed` (records in failed batches), and `failures` (failed operations). Threshold filtering and processor drops are not counted as transport drops.

`Diagnostic` contains `source`, `operation` (`write`, `flush`, `close`, `processor`, `snapshot`), and `reason` (`failed`, `timeout`). It excludes original errors and payloads.

## Delivery and lifecycle

`trace < debug < info < warn < error < fatal`. The root defaults to `info`, transports to `trace`. `isLevelEnabled()` checks thresholds and transport availability, letting callers skip expensive attribute construction. Log methods return queue acceptance by at least one transport; they do not acknowledge delivery.

Each transport defaults to 512 outstanding records, batches of 32, and a 5,000 ms operation timeout. Capacity includes records being written. Overflow drops the newest record for that destination. The system transport accepts up to 256 records per batch. These bounds constrain retained records; plugins remain responsible for their own internal resource usage.

Failures are isolated. A rejected batch increments `failed`; it is not retried because partial delivery may already have happened. A timeout disables that transport and drops its queued records, preventing overlap with an underlying call that might still be running. JS timeouts require the JS event loop to progress; they cannot interrupt synchronous plugin code. Timeout does not cancel a remote request. Create a fresh root/plugin when it is safe to recover.

`getStatus()` exposes `pending`, `delivered`, `dropped`, `failed`, and operation `failures` per transport. Counters are cumulative for the logger lifetime. `delivered` means the plugin completed its write. Diagnostics contain the source, operation, and reason, without raw errors or payloads. Route `onDiagnostic` to an independent handler; recursive logging through the same family is suppressed.

`flush()` is an ordered barrier for earlier accepted records, followed by each plugin's optional flush. Logs accepted later may still be pending in the result. Sentry flush failure is reported; Datadog exposes no upload barrier here. OSLog/Logcat completion means the write calls returned, not that the OS persisted every byte.

`close()` is idempotent, stops admission across all children, drains, then releases plugin resources. A disabled plugin is not closed because its timed-out operation may still be using those resources. A child shares root ownership: closing a child closes the entire family. Do not close the app logger when unmounting a feature. On backgrounding, `flush()` is best effort; process termination can still lose logs. This library is not a durable audit log or a crash handler.

## Context, processors, and privacy

Child context overrides parent keys; per-record attributes override child keys. Inputs are snapshotted at creation/log time. Errors retain their own message, stack, cause, and enumerable fields. Getters and `toJSON()` are never invoked. Cycles and unsupported values get markers. Snapshots limit depth to 6, nodes to 256, keys/array items to 64 per container, strings to 4,096 characters, and total attribute text to roughly 16 KiB plus markers. Messages are limited to 4,096 UTF-16 code units. Proxies and custom processors remain trusted caller code.

Processors run synchronously in order and return a new record or `undefined` to drop. They may transform message and attributes; level, sequence, and timestamp stay owned by the logger. Exceptions drop the record and report a diagnostic. Do not perform I/O inside a processor.

Sensitive keys are redacted case-insensitively at every depth: `password`, `passwd`, `secret`, `token`, `access_token`, `refresh_token`, `accessToken`, `refreshToken`, `clientSecret`, `client_secret`, `authorization`, `cookie`, `set-cookie`, `apikey`, and `api_key`. `redactKeys` extends this set. Redaction runs again after processors. It does not detect secrets embedded in message text, error stacks, arbitrary strings, or SDK-added global context.

OSLog defaults to a private payload. Opt into `enablePublicLogging: true` only for intentionally public content; the sample does so for its demo records. Logcat has no equivalent privacy mechanism. Category/tag is required (1–128 UTF-16 code units), subsystem is optional (1–256). OS logging can truncate/filter entries; Android splits long payloads into Unicode-aware chunks. These logs are for diagnostics, not lossless JSON storage.
