# Architecture

The public logger is an intentionally higher-level TypeScript API. Nitro is an internal implementation detail of the system transport. This boundary lets native OS logging and existing vendor SDKs participate in the same pipeline without requiring vendors to inherit a native base class or duplicate their SDK initialization.

## Decisions

Winston provides the useful ideas: independent transports, per-transport levels, and child context. Node streams, mutable shared records, global registries, and Node polyfills are unnecessary here.

Three designs were considered: a native-only engine (excellent for native producers, awkward for JS SDKs and processors), a JS-only logger (portable but misses direct OS logging), and a TypeScript composition layer with Nitro transport handles. We choose the third. Native-origin logging and worklet runtime sharing are outside this first version's contract.

## Data flow

Level gate → context snapshot → synchronous processors → bounded normalization and key redaction → immutable record → independent bounded transport queues → asynchronous batches.

Every transport owns its queue. Capacity includes in-flight records. Overflow drops the newest record for that transport and increments its counter. An asynchronously waiting transport does not hold up another worker. Synchronous plugin work still shares the JS thread and can delay all workers. A write exception fails that batch; no automatic retry risks duplicate telemetry. A timed-out operation disables the transport, because its underlying operation may still be running and cannot safely overlap subsequent calls.

Flush inserts an ordered barrier after previously accepted records, waits for writes, and calls the optional SDK flush method. It is not a remote delivery acknowledgement. Close rejects further records across the entire child family, drains, and invokes transport cleanup once. Child loggers share lifecycle and transport ownership. Create distinct transport instances for distinct roots; injected vendor SDKs remain owned by the app.

## Privacy and resource bounds

Default sensitive keys are redacted recursively, case-insensitively. Custom keys extend these defaults. Redaction follows processors so newly introduced fields are covered. Message strings and embedded secrets in arbitrary text cannot be inferred; callers must avoid putting secrets in messages. Accessors are never evaluated. Cycles, errors, non-JSON values, huge strings, deep trees, and broad trees receive bounded snapshots. Plugins receive frozen records.

Native batches are bounded by the JS worker, with defensive native limits too. Swift owns a serial DispatchQueue; Kotlin performs stateless writes on the coroutine IO dispatcher. The worker permits one native batch at a time per handle. OSLog privacy defaults to private for the complete rendered payload. Logcat has no equivalent privacy protection.

## Plugins

The transport interface is structural and accepts async batches, with optional flush and close methods. Console, bounded memory, system (OSLog/Logcat), Sentry Logs, and Datadog Logs implement the same contract. Each is a separate import entry point. Vendor adapters accept app-initialized SDK objects; there are no automatic global SDK changes, credentials, network uploads, or vendor dependencies in the core.

System handles own category/subsystem configuration. Platform mapping is explicit: trace/debug → OSLog debug, info → info, warn → default, error → error, fatal → fault. Android maps to verbose/debug/info/warn/error/assert without crashing the application.

## Validation

Behavior tests cover ordering, thresholds, context snapshots, redaction, failure isolation, overflow, timeout quarantine, flush barriers, close semantics, processor failures, and adapters. Generate native bindings with pinned Nitrogen, typecheck package and Expo example, verify package contents, and compile native platforms when local toolchains permit. Native OS retention and remote ingestion are external behaviors and must not be inferred from a successful flush.

## Native wire enum

The internal system enum uses `log-debug` and other prefixed values. Nitrogen uppercases literal union cases, and an unprefixed `debug` produces a C++ `DEBUG` macro collision in Xcode debug builds. The public level union remains unchanged; the explicitly internal transport boundary handles this mapping. No generated-code patch or global preprocessor override is needed.

## Performance review

See [measured portable costs and queue alternatives](performance.md). Native batching does not move core snapshots, processors, or JSON serialization off the JS thread.
