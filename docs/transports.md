# Transports

[Documentation index](README.md) · [Quick start](../README.md#quick-start)

Import factories from their dedicated entry points. Create a fresh instance for each root logger; names must be unique within that root. Per-transport `level`, `capacity`, `batchSize`, and `timeoutMs` belong in the logger's transport entry, not in factory options. See [API reference](api.md).

## Built-in factories

| Entry point    | Factory                                    | Options and defaults                                                                      |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `/console`     | `createConsoleTransport(options?)`         | `name: "console"`; calls JS console once per record                                       |
| `/memory`      | `createMemoryTransport(options?)`          | `name: "memory"`, retained `capacity: 200` (1–65,536)                                     |
| `/system`      | `createSystemTransport(options)`           | Required `category`; optional `subsystem`, `enablePublicLogging: false`, `name: "system"` |
| `/sentry`      | `createSentryTransport(client, options?)`  | `name: "sentry"`, `flushTimeoutMs: 2000`                                                  |
| `/datadog`     | `createDatadogTransport(client, options?)` | `name: "datadog"`                                                                         |
| `/filetoolkit` | `createFileToolkitTransport(options)`      | Native FileToolkit storage; file options below                                            |
| `/file`        | `createFileTransport(options)`             | File options plus required `fileSystem` adapter                                           |

All return `Transport`, except memory which returns `MemoryTransport` with `getRecords(): readonly LogRecord[]` and `clear(): void`. Await logger flush before reading memory if you need previously queued records. `clear()` removes retained history, not queued records or logger counters. The memory ring's capacity and its worker's queue capacity are separate limits.

## Native system output

Install `react-native-nitro-modules@~0.37.1`, rebuild the app, and import `/system` only on iOS/Android. Category is the iOS category and Android tag (1–128 UTF-16 code units). Optional subsystem is 1–256 code units; iOS defaults to the app bundle identifier, falling back to `NitroLogger`. Android uses the tag only.

OSLog defaults to private payloads. For synthetic demo data only, `enablePublicLogging: true` makes the rendered record visible. This option does not add privacy protection to Logcat. Use macOS Console/Xcode for iOS and `adb logcat -s App` for category `App` on Android. OS filtering and truncation still apply.

| Public level | iOS OSLog | Android Logcat                  |
| ------------ | --------- | ------------------------------- |
| trace        | debug     | verbose                         |
| debug        | debug     | debug                           |
| info         | info      | info                            |
| warn         | default   | warn                            |
| error        | error     | error                           |
| fatal        | fault     | assert (does not crash the app) |

## Sentry and Datadog

```ts
import { createLogger } from "react-native-nitro-loggerkit";
import {
  createSentryTransport,
  type SentryClient,
} from "react-native-nitro-loggerkit/sentry";
import {
  createDatadogTransport,
  type DatadogClient,
} from "react-native-nitro-loggerkit/datadog";

// Pass your initialized SDKs: Sentry namespace and Datadog DdLogs.
export function createTelemetryLogger(
  Sentry: SentryClient,
  DdLogs: DatadogClient,
) {
  return createLogger({
    transports: [
      { transport: createSentryTransport(Sentry), level: "warn" },
      {
        transport: createDatadogTransport(DdLogs),
        level: "info",
        capacity: 256,
      },
    ],
  });
}
```

Initialize your installed `@sentry/react-native` SDK with `enableLogs: true` and/or configure `@datadog/mobile-react-native` using its setup guide before creating the adapters. The function above accepts both; omit the unused destination if you only use one.

Sentry receives six native log levels. Nested attribute values become JSON strings because Sentry log attributes are scalar. Datadog maps `trace` to `debug` and `fatal` to `error`, preserving the original level in `nitro.level`. Both include `nitro.sequence` and `nitro.timestamp_ms`. Vendor SDK context may contribute additional attributes outside this logger's redaction boundary. Adapters do not initialize, close, or reconfigure global SDKs and do not capture synthetic exceptions. See [Sentry Logs](https://docs.sentry.io/platforms/react-native/logs/) and [Datadog React Native](https://docs.datadoghq.com/real_user_monitoring/application_monitoring/react_native/advanced_configuration/) for SDK setup.

## Rotating files

Install `react-native-nitro-filetoolkit` alongside LoggerKit and rebuild the native app. FileToolkit is an optional peer dependency; only importing `/filetoolkit` loads it.

```ts
import { createLogger } from "react-native-nitro-loggerkit";
import { createFileToolkitTransport } from "react-native-nitro-loggerkit/filetoolkit";

// Call this with an absolute cache directory from your app's filesystem API.
export function createFileLogger(cacheDirectory: string) {
  return createLogger({
    transports: [
      {
        transport: createFileToolkitTransport({
          directory: cacheDirectory + "/diagnostic-logs",
          filename: "uploads.log",
          maxFileBytes: 1024 * 1024,
          maxFiles: 3,
        }),
        level: "info",
      },
    ],
  });
}
```

Supply an absolute app-owned directory path or `file://` URI. The transport creates it as needed and appends readable, single-line records: ISO timestamp, severity, optional category, message, and JSON metadata. Control characters and Unicode are escaped, keeping physical lines intact and byte accounting exact. Open the files in a text viewer, or use `tail -F uploads.log` and `grep` on a Mac after copying or exposing the sandbox directory.

Rotation keeps `uploads.log`, `uploads.1.log`, and `uploads.2.log` in this example. `maxFiles` includes the active file; defaults are `current.log`, 1 MiB, and two files. Records are never split. Oversized records and unreadable or oversized existing active files fail the batch and appear in logger status. Other transports continue. Do not point multiple transports or processes at overlapping active/rotation filenames. Cache directories may be evicted by the OS.

Like Winston, file formatting is independent of storage: optionally supply `format: record => JSON.stringify(record)`. The transport adds the newline and escapes actual control characters. Thresholds, queue bounds, and failure isolation use the normal logger transport configuration. `flush()` waits for writes; it does not promise an OS-level fsync or crash durability. Apply app-specific privacy filtering before file delivery; generic key redaction does not remove sensitive text from messages.

For another filesystem backend, import `createFileTransport` and `FileSystemAdapter` from `/file`, supplying the same options plus `fileSystem`. This entry point is portable and does not load Nitro or FileToolkit. Custom transports remain ordinary injectable `Transport` objects.

## Custom transports

```ts
import type { Transport } from "react-native-nitro-loggerkit";

export function createCustomTransport(myDestination: {
  send(
    records: readonly import("react-native-nitro-loggerkit").LogRecord[],
  ): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}): Transport {
  return {
    name: "custom",
    async write(records) {
      await myDestination.send(records);
    },
    async flush() {
      await myDestination.flush();
    },
    async close() {
      await myDestination.close();
    },
  };
}
```

Only `name` and `write` are required. Use a new plugin instance for each root logger, and unique names within a root. Writes, flushes, and close calls are serial within a transport. Records and batches are immutable. A plugin may itself use Nitro; the TypeScript contract does not require a particular native implementation language or base class.

### Filesystem adapter contract

`FileSystemAdapter` is exported from `/file`. Each method can return synchronously or via a Promise:

| Method                      | Required behavior                                           |
| --------------------------- | ----------------------------------------------------------- |
| `makeDir(path)`             | Create recursively; succeed if already present              |
| `exists(path)`              | Return a boolean                                            |
| `stat(path)`                | Return `{ size }` in bytes, or `null` if missing/unreadable |
| `appendText(path, text)`    | Append UTF-8; create when missing; never truncate           |
| `move(source, destination)` | Move to the destination freed by rotation                   |
| `remove(path)`              | Delete; succeed when absent                                 |

Factory validation throws `TypeError` for an empty directory or invalid filename and `RangeError` for invalid file limits. `maxFileBytes` must be a positive safe integer; `maxFiles` is 1–100. Backend/formatter errors during writes appear in logger status and diagnostics. A failed batch can already have partially written: it is not retried.
