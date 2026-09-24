# Getting started

[Documentation index](README.md)

## 1. Choose the runtime

| Destination                                | Extra dependency                                   | Native rebuild?         | Web / Expo Go              |
| ------------------------------------------ | -------------------------------------------------- | ----------------------- | -------------------------- |
| Console, memory, custom portable transport | None                                               | No                      | Portable code can run here |
| System OSLog/Logcat                        | `react-native-nitro-modules@~0.37.1`               | Yes                     | Unsupported                |
| FileToolkit files                          | Nitro plus `react-native-nitro-filetoolkit@^0.1.0` | Yes                     | Unsupported                |
| Injected filesystem (`/file`)              | Your backend                                       | Depends on backend      | Depends on backend         |
| Sentry/Datadog                             | Your SDK and its setup                             | Follow SDK requirements | Depends on SDK             |

Start with the [console or memory quick start](../README.md#quick-start). Add native destinations after that works. The library declares React Native >=0.83; the validated native baseline is documented in [validation](validation.md). Native dependency requirements also apply to the installed Nitro/FileToolkit version.

## 2. Own the logger at app scope

Export one root from a module and import it into features. Derive children once per stable feature/request context. Child keys override root keys; per-call attributes override child keys. Context is snapshotted, so later mutations of your original object do not update the logger.

Do not construct a logger on every render, reuse a transport instance across roots, or close a child on unmount. Closing any child closes the whole family. Flush on an explicit export/support action or as a best effort when backgrounding. Termination may happen before flushing completes.

For expensive debug attributes, guard construction:

```ts
import type { Logger, Attributes } from "react-native-nitro-loggerkit";

export function logDebugState(logger: Logger, readState: () => Attributes) {
  if (logger.isLevelEnabled("debug")) {
    logger.debug("State changed", readState());
  }
}
```

Both the root and a transport must enable debug. This check does not promise queue space. See [API defaults](api.md).

## 3. Keep native imports out of web

For a cross-platform app, use platform-specific modules like the [example](../apps/example/src/logging):

`systemTarget.ts` (native):

```ts
import { createSystemTransport } from "react-native-nitro-loggerkit/system";
export const systemTarget = createSystemTransport({ category: "App" });
```

`systemTarget.web.ts`:

```ts
import { createConsoleTransport } from "react-native-nitro-loggerkit/console";
export const systemTarget = createConsoleTransport();
```

Your shared app logger imports `./systemTarget` and uses `{ transport: systemTarget }`. Do not statically import `/system` and only guard the factory with `Platform.OS`: the native module is already loaded by that import.

## Troubleshooting

| Symptom                                            | What to check                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot resolve the package                         | Install `react-native-nitro-loggerkit`, including `kit`; the similarly named package is unrelated                                     |
| Cannot resolve Nitro / HybridObject not registered | Install the compatible Nitro peer, install pods as needed, and rebuild the native binary; restarting Metro alone is insufficient      |
| Fails in Expo Go or on web                         | Use console/memory, or use a native development build for `/system` and `/filetoolkit`                                                |
| Nothing logs                                       | Configure a transport; check both level thresholds and `getStatus().state`; closed families reject new records                        |
| Memory appears empty immediately after logging     | Await `logger.flush()` before `memory.getRecords()`                                                                                   |
| Debug messages absent                              | Root defaults to `info`; set root and destination thresholds appropriately; check OS filters too                                      |
| iOS shows `<private>`                              | Default OSLog privacy; only opt into public logging for intentionally public payloads                                                 |
| Burst loses records                                | Check `dropped`; capacity includes records in flight. Yield between bursts, reduce volume, or size the queue from measurements        |
| Transport becomes disabled                         | A write/flush/close timed out. Inspect `onDiagnostic`; underlying work may still run. Recover with a fresh root/plugin only when safe |
| File writes fail                                   | Verify an app-owned path, filename and permissions, record size, existing file size, and exclusive ownership of rotation filenames    |
| `flush()` resolves but upload is absent            | Plugin completion is not remote ingestion; inspect SDK configuration and network behavior                                             |

Diagnostics intentionally omit original exceptions and payloads. Transport rejection fails a batch without automatic retries; records may have been partially delivered. See [delivery semantics](api.md#delivery-and-lifecycle) before implementing recovery.
