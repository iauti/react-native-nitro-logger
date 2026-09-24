# Validation

Validated locally on September 5, 2026, using Expo 57.0.20, React Native 0.86.3, Nitro/Nitrogen 0.37.1, and Bun 1.3.14.

| Check                   | Result                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable behavior tests | 17 passed; filtering, context, snapshots, redaction, processors, batching, overflow, timeouts, failures, flush, close, and vendor adapter mappings |
| TypeScript              | Library, Expo example, and portable tests pass                                                                                                     |
| Nitrogen                | Both HybridObjects generate; output reproducibility verified                                                                                       |
| Android native build    | `:app:assembleDebug` succeeds for arm64-v8a, including Kotlin/JNI/C++                                                                              |
| iOS native build        | Debug arm64 simulator build succeeds with Xcode 26.6                                                                                               |
| iOS runtime             | 3 Harness tests pass on iPhone 16 Pro / iOS 18.5, using Hermes and real native HybridObjects                                                       |
| Web example             | Expo export succeeds; redaction and failure-isolation interactions verified in the browser                                                         |
| npm contents            | Required ESM, declarations, native implementations, generated bindings, and licenses verified; portable ESM import succeeds in Node                |
| Formatting              | Prettier, swift-format, and ktlint pass for handwritten source                                                                                     |

The iOS runtime suite exercises all six severity levels, native factory validation, Unicode payloads, independent native handles, and close. It verifies successful calls through the native API; it does not assert OS retention of every payload byte. Android was compiled but not run on a device/emulator in this session. Sentry and Datadog adapters were tested with structural SDK test doubles; no credentials or remote telemetry were used. No performance benchmark or release claim is implied.

## Reproduce

```sh
bun install --frozen-lockfile
bun run check
bun run check:generated
bun run package:check
bun run example ios
bun run example harness --harnessRunner ios
```

For another installed iOS simulator, set `HARNESS_IOS_DEVICE` and `HARNESS_IOS_VERSION`. CI chooses an available iPhone simulator. Android Harness configuration is included for `NitroLogger_API_36`; install the example first and use `--harnessRunner android`.

## Integration findings

- Nitrogen uppercases string union cases. The public `debug` value would generate `DEBUG`, colliding with Xcode's preprocessor macro. Internal prefixed wire levels solve this without patching generated output.
- Native Metro resolution needs explicit `.ts` source imports. TypeScript's `rewriteRelativeImportExtensions` emits `.js` imports for the published ESM build. This supports both source and compiled entry points.
- Harness and Expo expand entry URLs against different roots. A test-only Metro resolver redirects Expo's expanded Router entry to the Harness runtime. Normal Expo startup keeps its default configuration.
- Bun's isolated dependency layout requires explicit test-tool dependencies for Metro, the Babel transforms/runtime, and the Harness runtime; no dependencies are patched or rewritten.
- Local Watchman cannot load its installed `libfmt` version. Harness uses Node filesystem watching through its supported setting, and Jest has `watchman: false`. The global Watchman installation was not modified.
- An initial dual-architecture iOS build exhausted disk space. Task-created build intermediates were removed and arm64 was built successfully. Intel simulator builds remain unverified.

The GitHub Check workflow passed for main commit e5863b5 (portable, Android, and iOS jobs). On September 17, 2026, local library/example/test TypeScript checks, 17 portable tests, codegen, and formatting passed again. That earlier validation predates the release notes in [releases](releases.md); the install name is `react-native-nitro-loggerkit`, and the similar `react-native-nitro-logger` belongs to another author. See [release preparation](releases.md).

## Release flow rehearsal (September 17, 2026)

`bun release 0.1.0 --ci --dry-run --npm.skipChecks` completed both package npm dry-run and root Git/GitHub preview. npm authentication was deliberately skipped for the dry run; live publication remains blocked by the local npm session returning 401.

`bun run release:test` passed real version bumps, prepack, required artifact contents, clean-consumer installation/import/redaction, workspace lockfile synchronization, Git commit/tag/local push, recovery from a rejected push, and duplicate-version refusal. It uses a disposable repository and local bare remote; no npm package or GitHub release was published. CI now runs this rehearsal.

## Documentation and performance review (September 22, 2026)

The library, example, and portable test TypeScript checks pass; all 27 portable tests pass (including file transports). `bun run docs:check` compiles all nine TypeScript examples across the README/guides, checks local file-link targets, and verifies the npm README stays synchronized. Examples requiring native modules or vendor SDKs are not device/remote integration tests. Link checking does not validate remote URLs or Markdown anchors.

Portable pipeline and isolated queue benchmarks ran on macOS arm64 / Apple M3 Max / Bun 1.3.14 with asserted record accounting. See [performance results and limitations](performance.md). This review did not repeat native builds or claim new device performance validation.
