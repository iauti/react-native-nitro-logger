import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = new URL('../packages/react-native-nitro-logger/nitrogen/', import.meta.url);
function snapshot(folder) {
  return readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), folder);
    return entry.isDirectory() ? snapshot(url) : [[url.href, createHash('sha256').update(readFileSync(url)).digest('hex')]];
  });
}
const before = snapshot(root);
execFileSync('bun', ['run', 'specs'], { cwd: new URL('../', import.meta.url), stdio: 'inherit' });
assert.deepEqual(snapshot(root), before, 'Nitrogen output is stale. Run bun run specs and commit all generated changes.');
console.log('Nitrogen output is reproducible.');
