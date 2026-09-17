#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -lt 1 || $# -gt 2 || ( $# -eq 2 && "$2" != --dry-run ) ]]; then
  echo "Usage: bun release <version> [--dry-run]" >&2
  exit 1
fi
if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Provide an explicit semver version." >&2
  exit 1
fi
dry_run=false
if [[ "${2:-}" == --dry-run ]]; then dry_run=true; fi
if ! $dry_run; then
  if [[ -n "$(git status --porcelain)" || "$(git branch --show-current)" != main ]]; then
    echo "Release from a clean main checkout after merging release preparation." >&2
    exit 1
  fi
  npm whoami >/dev/null
fi
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  GITHUB_TOKEN="$(gh auth token)"
  export GITHUB_TOKEN
fi
bun run check:generated
bun run check
bun run package:check
if $dry_run; then
  echo "Dry run: npm authentication checks skipped; actual publication still requires npm login."
  (cd packages/react-native-nitro-logger && bun run release "$1" --ci --dry-run --npm.skipChecks)
  bun run release-it "$1" --ci --dry-run --no-git.requireBranch --no-git.requireUpstream
else
  # Check Git/GitHub access before the irreversible npm publication.
  bun run release-it "$1" --ci --dry-run
  (cd packages/react-native-nitro-logger && bun run release "$1" --ci)
  bun run release-it "$1" --ci
fi
