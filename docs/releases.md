# Releasing

The root coordinates one publishable package. Package release-it owns npm publishing; root release-it owns the version commit, tag, and GitHub release. Run from a clean `main` checkout after merging release preparation:

```sh
npm login
bun release 0.1.0
```

Requires npm access to the final package name and GitHub push/release access. `GITHUB_TOKEN` may be provided by the environment; otherwise the script obtains it from the authenticated GitHub CLI without printing it. npm may require an OTP or browser authorization.

The workflow checks generated bindings, behavior tests, types, formatting, and package contents before publishing. CI must also be green for native Android and iOS. Review CHANGELOG.md before each release. Native example folders are generated and ignored; no Podfile.lock is tracked. Bun's workspace lockfile is refreshed after the package version changes and included in the root release commit.

## Verify before publishing

```sh
bun release 0.1.0 --dry-run
bun run release:test
```

The dry run executes npm's publish dry run and previews Git/GitHub operations. It skips npm authentication checks and allows a feature branch; it cannot prove permission to publish. Version mutations are skipped by release-it, so its npm dry run packs the current manifest version.

The isolated rehearsal performs real version bumps, prepack, tarball installation into an empty consumer, lockfile refresh, release commits, and pushes to a disposable local bare Git remote. It tests recovery from a rejected push and rejection of duplicate versions. npm publication and GitHub release creation are disabled. CI runs this rehearsal. Temporary files are removed automatically (`RELEASE_TEST_KEEP=1` retains them for diagnosis).

Bun 1.3.14 retains stale workspace metadata for version-only changes, even with `--force`. The hook runs Bun, then updates just workspace version literals in its JSONC lockfile; dependency pins remain unchanged.

## Recover a partial release

If npm publishing succeeds but the GitHub stage fails, **do not republish**. Verify `npm view react-native-nitro-loggerkit@0.1.0 version`. Retain local changes and use authenticated GitHub access:

- If root `package.json` is still on the old version: `bun run release-it 0.1.0 --ci`.
- If root `package.json` was bumped and a local release commit/tag exists: `bun run release-it --no-increment --ci`.

Root release-it never publishes npm. The second command resumes the Git push/release without incrementing again. If a GitHub release already exists, inspect it before retrying rather than recreating it. npm publication is immutable.

## First-release blockers

The chosen package name is `react-native-nitro-loggerkit`; `react-native-nitro-logger` belongs to another author. The local npm session returned 401 on September 17, 2026; authenticate with `npm login`. Version 0.1.0 is proposed, not yet published.
