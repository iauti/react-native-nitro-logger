# Nitro LoggerKit

Structured logging for React Native: child context, redaction, bounded queues, and independent destinations. Send the same records to OSLog/Logcat through Nitro, console, memory, rotating files, Sentry, or Datadog.

The npm package is **`react-native-nitro-loggerkit`**. `react-native-nitro-logger` is a different project. The portable core does not load Nitro or vendor SDKs.

## Quick start

In an existing React Native app:

```sh
npm install react-native-nitro-loggerkit
```

Create one logger in an app-owned module, such as `src/logger.ts`:

```ts
import { createLogger } from "react-native-nitro-loggerkit";
import { createConsoleTransport } from "react-native-nitro-loggerkit/console";

export const logger = createLogger({
  level: "info",
  context: { app: "shop" },
  transports: [{ transport: createConsoleTransport() }],
});

const checkout = logger.child({ feature: "checkout" });
checkout.info("Payment started", { amount: 42, currency: "EUR" });
checkout.error("Payment failed", { error: new Error("Network timeout") });
```

You should see `Payment started` and `Payment failed` in the JavaScript console, with their attributes. Console delivery is deferred; `await logger.flush()` waits for earlier accepted records. No transport is enabled automatically. `debug()` and `trace()` are filtered at the default `info` level.

For a deterministic check without console output:

```ts
import { createLogger } from "react-native-nitro-loggerkit";
import { createMemoryTransport } from "react-native-nitro-loggerkit/memory";

const memory = createMemoryTransport();
const logger = createLogger({ transports: [{ transport: memory }] });
logger.info("Ready", { token: "example-secret" });
await logger.flush();
console.log(memory.getRecords()[0]?.attributes.token); // "[REDACTED]"
await logger.close(); // Only close when the entire logger family is finished.
```

## Add native OS logging

Install the compatible Nitro peer and rebuild your native app:

```sh
npm install react-native-nitro-modules@~0.37.1
```

- **Expo:** use a development build (`npx expo run:ios` or `npx expo run:android`). Expo Go cannot load the native transport.
- **Bare React Native:** install iOS pods (`cd ios && bundle exec pod install` when your app uses Bundler), then rebuild with your app's usual iOS/Android command.
- **Web:** use portable transports and keep `/system` and `/filetoolkit` imports out of the web dependency graph. See [platform setup](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/getting-started.md).

```ts
import { createLogger } from "react-native-nitro-loggerkit";
import { createSystemTransport } from "react-native-nitro-loggerkit/system";

export const logger = createLogger({
  transports: [{ transport: createSystemTransport({ category: "App" }) }],
});
logger.info("App started");
```

Read output in macOS Console/Xcode for iOS, or `adb logcat -s App` for Android. iOS payloads are private by default and may appear as `<private>`; [system transport options](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/transports.md#native-system-output) explain visibility.

The declared React Native minimum is 0.83. The example targets React Native 0.86.3, Expo 57, and Nitro 0.37.1; this is not a claim that every version in the peer range has been tested. See [validation](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/validation.md).

## Choose a destination

| Import suffix  | Factory                      | Use it for                                          |
| -------------- | ---------------------------- | --------------------------------------------------- |
| `/console`     | `createConsoleTransport`     | JS console during development                       |
| `/memory`      | `createMemoryTransport`      | Recent records for tests or an in-app viewer        |
| `/system`      | `createSystemTransport`      | Native OSLog and Logcat                             |
| `/filetoolkit` | `createFileToolkitTransport` | Rotating app-owned files using optional FileToolkit |
| `/file`        | `createFileTransport`        | Rotating files using your filesystem adapter        |
| `/sentry`      | `createSentryTransport`      | Your initialized Sentry Logs SDK                    |
| `/datadog`     | `createDatadogTransport`     | Your initialized Datadog Logs SDK                   |

[Transport setup and examples](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/transports.md) cover dependencies, options, file rotation, SDK mappings, and custom plugins. [Alternatives](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/alternatives.md) compares other approaches by use case; no cross-library speed advantage is claimed.

## Understand delivery

- Log methods return queue acceptance, not successful delivery. Each destination defaults to 512 outstanding records and batches of 32; overflow drops the newest record for that destination.
- Inspect `getStatus()` for dropped/failed records. `flush()` waits for earlier records and supported plugin flush operations, but does not guarantee disk durability or server ingestion.
- `close()` closes the root and every child. Do not call it when unmounting a feature that shares the app logger.
- Key redaction covers nested attributes, not secrets embedded in messages or arbitrary strings. OSLog privacy does not apply to Logcat or files.
- Snapshotting and processors run synchronously on the JS thread. Deferred transport writes do not make the whole call free. See [performance findings and benchmarks](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/performance.md).

## Documentation

Start with the [documentation index](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/README.md), then choose:

- [Getting started and troubleshooting](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/getting-started.md)
- [API, defaults, errors, and delivery guarantees](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/api.md)
- [Transports and file logging](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/transports.md)
- [Alternatives and tradeoffs](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/alternatives.md)
- [Performance review and reproduction](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/performance.md)
- [Architecture](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/architecture.md), [validation](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/validation.md), and [release workflow](https://github.com/iauti/react-native-nitro-logger/blob/main/docs/releases.md)

## Run this repository

Use the pinned Bun version in `package.json` (1.3.14). Native runs need the matching React Native/Expo platform toolchain; iOS requires macOS and Xcode.

```sh
git clone https://github.com/iauti/react-native-nitro-logger.git
cd react-native-nitro-logger
bun install --frozen-lockfile
bun run check
bun run example web     # portable playground
# Or build a native development app:
bun run example ios
# bun run example android
```

The example demonstrates context, redaction, errors, bursts, counters, and transport failure isolation. See [contributing](https://github.com/iauti/react-native-nitro-logger/blob/main/CONTRIBUTING.md) for code generation, packaging, and native runtime checks. MIT licensed; see [LICENSE](https://github.com/iauti/react-native-nitro-logger/blob/main/LICENSE).
