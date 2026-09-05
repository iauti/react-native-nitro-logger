# Contributing

Use Bun and the pinned lockfile. Run `bun install --frozen-lockfile`, `bun run check`, and `bun run package:check` before proposing a change. Format TypeScript with `bun run format`. Use `swift format` for handwritten Swift and ktlint for handwritten Kotlin. Generated code is excluded from formatting.

Change `.nitro.ts` specs and run `bun run specs` to regenerate native bindings. Commit generated files. Never patch generated Swift/Kotlin/C++ directly. Keep optional SDK imports out of the package root. Test failure, ordering, privacy, and lifecycle behavior whenever a change affects those contracts.

The example uses Expo's generated native projects. Run `bun run example ios` or `bun run example android`. Native build outputs and generated app projects are ignored; library native implementations and Nitrogen output are committed. CI verifies portable behavior, package contents, generated-code reproducibility, and both native builds.

Use focused branches and PRs; squash releases onto `main`. No Git hooks are installed. Publishing is a deliberate maintainer action: verify the intended repository metadata, npm name availability, versions, and native device behavior before the first release. Nothing in this repository publishes automatically.
