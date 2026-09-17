# Changelog

## 0.1.0 — initial release

- Structured logging with child context, recursive key redaction, and processors.
- Independent bounded transport queues, ordered flush, and shared close lifecycle.
- Nitro OSLog/Logcat transport and optional console, memory, Sentry Logs, and Datadog adapters.
- Expo Router playground, native Harness coverage, and cross-platform CI.

Native transport requires Nitro 0.37.1 (less than 0.38.0) and React Native 0.83 or newer. Portable logging does not load Nitro. OS logs are best effort, not durable storage.
