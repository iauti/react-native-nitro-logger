#!/bin/bash
set -e

ensure_github_token() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then return; fi
  if [ -n "${GH_TOKEN:-}" ]; then
    export GITHUB_TOKEN="$GH_TOKEN"
    return
  fi
  if command -v gh >/dev/null 2>&1; then
    local token
    token="$(gh auth token 2>/dev/null || true)"
    if [ -n "$token" ]; then
      export GITHUB_TOKEN="$token"
      return
    fi
  fi
  echo "error: Run 'gh auth login' or set GITHUB_TOKEN before releasing." >&2
  exit 1
}

ensure_github_token

for pkg in packages/*; do
  [ -d "$pkg" ] || continue
  (cd "$pkg" && bun release "$@")
done

bun run release-it "$@"
