import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../", import.meta.url));
const temp = mkdtempSync(path.join(tmpdir(), "loggerkit-release-test-"));
const repo = path.join(temp, "repo");
const remote = path.join(temp, "remote.git");
const run = (command, args, cwd = repo) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1", GIT_TERMINAL_PROMPT: "0" },
  });
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
try {
  mkdirSync(repo);
  const files = run(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    source,
  )
    .split("\0")
    .filter(Boolean);
  for (const file of new Set(files)) {
    if (!existsSync(path.join(source, file))) continue;
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    cpSync(path.join(source, file), path.join(repo, file));
  }
  // Reuse tool binaries read-only; all manifests, generated output and Git writes stay in the fixture.
  symlinkSync(
    path.join(source, "node_modules"),
    path.join(repo, "node_modules"),
  );
  const packageDir = path.join(repo, "packages/react-native-nitro-logger");
  symlinkSync(
    path.join(source, "packages/react-native-nitro-logger/node_modules"),
    path.join(packageDir, "node_modules"),
  );
  run("git", ["init", "--bare", "--initial-branch=main", remote]);
  run("git", ["init", "--initial-branch=main"]);
  run("git", ["config", "user.name", "Release flow test"]);
  run("git", ["config", "user.email", "release-test@example.invalid"]);
  run("git", ["add", "."]);
  run("git", ["commit", "-m", "feat: release fixture"]);
  run("git", ["remote", "add", "origin", remote]);
  run("git", ["push", "-u", "origin", "main"]);

  const releaseIt = path.join(
    source,
    "node_modules/release-it/bin/release-it.js",
  );
  const [major, minor] = json(
    path.join(packageDir, "package.json"),
  ).version.split(".");
  const version = `${major}.${Number(minor) + 1}.0`;
  // Real version bump; only the external npm publication is disabled.
  run(
    process.execPath,
    [releaseIt, version, "--ci", "--no-npm.publish"],
    packageDir,
  );
  assert.equal(json(path.join(packageDir, "package.json")).version, version);
  run("npm", ["run", "prepack"], packageDir);
  const pack = JSON.parse(
    run("npm", ["pack", "--json", "--ignore-scripts"], packageDir),
  )[0];
  assert.equal(pack.name, "react-native-nitro-loggerkit");
  assert.equal(pack.version, version);
  for (const file of [
    "lib/index.js",
    "lib/system.js",
    "lib/index.d.ts",
    "NitroLogger.podspec",
    "nitrogen/generated/android/NitroLogger+autolinking.gradle",
  ]) {
    assert(
      pack.files.some((entry) => entry.path === file),
      `Missing artifact: ${file}`,
    );
  }
  const consumer = path.join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--offline",
      path.join(packageDir, pack.filename),
    ],
    consumer,
  );
  run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import { createLogger } from 'react-native-nitro-loggerkit';
    import { createMemoryTransport } from 'react-native-nitro-loggerkit/memory';
    const memory = createMemoryTransport();
    const logger = createLogger({ transports: [{ transport: memory }] });
    logger.info('Installed tarball works', { token: 'secret' });
    await logger.close();
    assert.equal(memory.getRecords()[0].attributes.token, '[REDACTED]');
  `,
    ],
    consumer,
  );

  const rejectPush = path.join(remote, "hooks/pre-receive");
  writeFileSync(rejectPush, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  assert.throws(() =>
    run(process.execPath, [releaseIt, version, "--ci", "--no-github.release"]),
  );
  // npm's artifact/version must survive a failure after the root commit/tag.
  assert.equal(json(path.join(packageDir, "package.json")).version, version);
  rmSync(rejectPush);
  run(process.execPath, [
    releaseIt,
    "--no-increment",
    "--ci",
    "--no-github.release",
  ]);
  assert.equal(json(path.join(repo, "package.json")).version, version);
  assert.equal(
    json(path.join(repo, "apps/example/package.json")).version,
    version,
  );
  const lock = JSON.parse(
    run("bun", [
      "-e",
      'console.log(JSON.stringify(Bun.JSONC.parse(await Bun.file("bun.lock").text())))',
    ]),
  );
  assert.equal(
    lock.workspaces["packages/react-native-nitro-logger"].version,
    version,
  );
  assert.equal(run("git", ["status", "--porcelain"]).trim(), "");
  assert.equal(
    run("git", ["rev-parse", "HEAD"]).trim(),
    run("git", ["rev-parse", `v${version}^{}`], remote).trim(),
  );
  // Verify repeat publication is refused before another version/tag can be created.
  assert.throws(() =>
    run(
      process.execPath,
      [releaseIt, version, "--ci", "--no-npm.publish"],
      packageDir,
    ),
  );
  console.log(
    "Release rehearsal passed: version bump, prepack, tarball contents, lockfile refresh, release commit, local push/tag, installed consumer, rejected-push recovery, and duplicate-version refusal. No external publication.",
  );
} catch (error) {
  process.stderr.write(error.stdout ?? "");
  process.stderr.write(error.stderr ?? "");
  throw error;
} finally {
  if (process.env.RELEASE_TEST_KEEP) console.log(temp);
  else rmSync(temp, { recursive: true, force: true });
}
