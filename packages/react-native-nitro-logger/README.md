# Nitro Logger

Composable structured logging for React Native, with Nitro-powered OSLog and Logcat.

One logger, child context, and independent transport plugins. The core has no Node polyfills or vendor SDK dependencies. This is a new, unpublished library; the repository URL in package metadata is the intended release location.

```ts
import { createLogger } from "react-native-nitro-loggerkit";
import { createSystemTransport } from "react-native-nitro-loggerkit/system";

const logger = createLogger({
  level: "info",
  context: { app: "shop" },
  transports: [{ transport: createSystemTransport({ category: "App" }) }],
});

const checkout = logger.child({ feature: "checkout" });
checkout.info("Payment started", { amount: 42, currency: "EUR" });
checkout.error("Payment failed", { error: new Error("Network timeout") });
const status = await logger.flush();
```

## Run locally

```sh
bun install
bun run check
bun run example ios       # builds an iOS development app
bun run example android   # builds an Android development app
bun run example web       # core + console + memory preview
bun run example harness --harnessRunner ios # after installing the native app
```

The [Expo Router playground](../../apps/example) includes child context, redaction, errors, a 1,000-record burst, counters, and a failure-isolation demo. It follows FileToolkit's `packages/` + `apps/example` layout and uses Expo SDK 57, React Native 0.86.3, and Nitro 0.37.1. Native system logging requires a development build; Expo Go cannot load this module. Web supports the core and portable plugins. Do not import `/system` on web.

After publication, install `react-native-nitro-loggerkit` alongside `react-native-nitro-modules`, then rebuild the native app. Until then, use this workspace or a locally packed tarball. The declared React Native range starts at 0.83; validation targets 0.86.3, not every release in the range. Use Xcode 16.4+ and the Android toolchain selected by your React Native app; this example was built with Xcode 26.6.

## Choose transports

| Import     | Factory                  | Behavior                                              |
| ---------- | ------------------------ | ----------------------------------------------------- |
| `/system`  | `createSystemTransport`  | OSLog on iOS; Logcat on Android, through Nitro        |
| `/console` | `createConsoleTransport` | Standard JS console methods                           |
| `/memory`  | `createMemoryTransport`  | Bounded ring buffer with `getRecords()` and `clear()` |
| `/sentry`  | `createSentryTransport`  | Sentry Logs using your initialized SDK                |
| `/datadog` | `createDatadogTransport` | Datadog Logs using your initialized SDK               |

Factories return structural `Transport` objects. Plugin entry points isolate dependencies; importing the core does not initialize Nitro or an SDK. OSLog and Logcat share `/system` because each is the platform's system log destination, with the same lifecycle.

```ts
import * as Sentry from "@sentry/react-native";
import { DdLogs } from "@datadog/mobile-react-native";
import { createLogger } from "react-native-nitro-loggerkit";
import { createSentryTransport } from "react-native-nitro-loggerkit/sentry";
import { createDatadogTransport } from "react-native-nitro-loggerkit/datadog";

// Initialize both SDKs in your app first. Sentry requires enableLogs: true.
const logger = createLogger({
  transports: [
    { transport: createSentryTransport(Sentry), level: "warn" },
    { transport: createDatadogTransport(DdLogs), level: "info", capacity: 256 },
  ],
});
```

Sentry receives six native log levels. Nested attribute values become JSON strings because Sentry log attributes are scalar. Datadog maps `trace` to `debug` and `fatal` to `error`, preserving the original level in `nitro.level`. Both include `nitro.sequence` and `nitro.timestamp_ms`. Vendor SDK context may contribute additional attributes outside this logger's redaction boundary. Adapters do not initialize, close, or reconfigure global SDKs and do not capture synthetic exceptions. See [Sentry Logs](https://docs.sentry.io/platforms/react-native/logs/) and [Datadog React Native](https://docs.datadoghq.com/real_user_monitoring/application_monitoring/react_native/advanced_configuration/) for SDK setup.

## Write a plugin

```ts
import type { Transport } from "react-native-nitro-loggerkit";

const transport: Transport = {
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
```

Only `name` and `write` are required. Use a new plugin instance for each root logger, and unique names within a root. Writes, flushes, and close calls are serial within a transport. Records and batches are immutable. A plugin may itself use Nitro; the TypeScript contract does not require a particular native implementation language or base class.

## Delivery contract

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

## Architecture and development

Read the [design decisions](../../docs/architecture.md), [validation notes](../../docs/validation.md), and [contributing guide](../../CONTRIBUTING.md). The design takes transport composition from [Winston](https://github.com/winstonjs/winston) and follows [Margelo's Nitro guidance](https://github.com/margelo/react-native-skills/tree/main/skills/build-nitro-modules). FileToolkit informed the monorepo/example layout; `react-native-nitro-logs` informed category/subsystem behavior. No performance superiority is claimed without device benchmarks.

The TypeScript logger is the public composition API. The two internal HybridObjects are a default-constructible factory and configured native sink. Nitrogen output is committed and shipped; regenerate it with `bun run specs`, never edit generated bindings. See [the source](src).
