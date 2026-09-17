# Releasing

This follows [VisionCamera's release script](https://github.com/margelo/react-native-vision-camera/blob/91bae1f08d549b50444ee16661dc4f4375cba0b6/scripts/release.sh) and [Margelo's Nitro release guidance](https://github.com/margelo/react-native-skills/blob/main/skills/build-nitro-modules/references/release-it-publishing.md).

## Usage

From a clean, up-to-date `main` checkout with green CI:

```sh
npm login
gh auth login
bun run check
bun run package:check
bun release 0.1.0
```

`bun release` supports release-it's interactive version selection. An explicit version keeps the package and root selections consistent. All arguments pass through unchanged, including `--ci`, `--dry-run`, and prerelease options.

The script resolves GitHub credentials from `GITHUB_TOKEN`, `GH_TOKEN`, or the authenticated `gh` CLI, runs each package's `bun release`, then root `release-it`. It does not implement its own argument parsing, version selection, or authentication policy for npm.

## Ownership

- The package owns npm publication (`git: false`, GitHub release disabled). Its `before:init` hook checks types; `after:bump` builds; prepack regenerates native bindings and builds the npm artifact.
- The root owns the release commit, tag, and GitHub release, with npm publishing disabled. `requireCleanWorkingDir: false` permits the package-stage version changes.
- `@release-it/bumper` synchronizes package/example versions. `@release-it/conventional-changelog` generates release notes from commits; there is no manually maintained changelog.
- Root hooks build/regenerate and refresh `bun.lock` before committing. Generated native example folders are ignored, so there is no tracked Podfile.lock to update.

Bun 1.3.14 retains stale workspace version metadata after version-only manifest changes. The tested hook updates just those JSONC literals after Bun runs, preserving dependency pins. Hook failures stop the release.

## Verification

```sh
bun release 0.1.0 --ci --dry-run
bun run release:test
```

If npm is not authenticated, use `--npm.skipChecks` **only with `--dry-run`**. Dry runs skip version mutations and therefore pack the current manifest version; they do not prove publishing permission.

The isolated rehearsal performs real version bumps, prepack, clean-consumer tarball installation/import/redaction, package/example synchronization, lockfile refresh, commits, and pushes to a disposable local bare Git remote. It also verifies rejected-push recovery and duplicate-version refusal. npm publication and GitHub release creation are disabled. CI runs this rehearsal; `RELEASE_TEST_KEEP=1` retains its fixture for diagnosis.

## Partial release recovery

After npm succeeds, never republish the same version. Verify `npm view react-native-nitro-loggerkit@0.1.0 version`, retain local changes, and run only the root stage:

- Root manifest still has the old version: `bun run release-it 0.1.0 --ci`.
- Root manifest and local commit/tag already exist: `bun run release-it --no-increment --ci`.

Root release-it never publishes npm. If a GitHub release already exists, inspect it before retrying.

## First release status

The chosen npm name is `react-native-nitro-loggerkit`; the original `react-native-nitro-logger` belongs to another author. Publication is pending npm authentication (last check: 401 on September 17, 2026). Proposed first version: 0.1.0.
