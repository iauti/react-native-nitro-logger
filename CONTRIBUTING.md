# Contributing

Use Bun and the pinned lockfile. Run `bun install --frozen-lockfile`, `bun run check`, and `bun run package:check` before proposing a change. Format TypeScript with `bun run format`. Use `swift format` for handwritten Swift and ktlint for handwritten Kotlin. Generated code is excluded from formatting.

Change `.nitro.ts` specs and run `bun run specs` to regenerate native bindings. Commit generated files. Never patch generated Swift/Kotlin/C++ directly. Keep optional SDK imports out of the package root. Test failure, ordering, privacy, and lifecycle behavior whenever a change affects those contracts.

The example uses Expo's generated native projects. Run `bun run example ios` or `bun run example android`. Native build outputs and generated app projects are ignored; library native implementations and Nitrogen output are committed. CI verifies portable behavior, package contents, generated-code reproducibility, and both native builds.

Use focused branches and PRs; squash releases onto `main`. No Git hooks are installed. Publishing is a deliberate maintainer action: verify the intended repository metadata, npm name availability, versions, and native device behavior before the first release. Nothing in this repository publishes automatically.

Documentation starts in the root README; detailed guides live in `docs/`. After editing the README, run `bun run docs:sync` to update the npm README with repository URLs. `bun run docs:check` verifies that copy, local file links, and TypeScript examples against the source API; it is included in `bun run check`. Native and vendor SDK examples are typechecked against the library contracts, not executed against real devices/services. Keep platform-specific examples in separate code blocks.

Run `bun run benchmark` for portable JS pipeline measurements and `bun run benchmark:queue` for the isolated queue experiment. These are diagnostic benchmarks, not device performance guarantees or timing assertions in CI. Record runtime, hardware, payload, accepted/dropped counts, and build mode with results. See [performance review](docs/performance.md).
