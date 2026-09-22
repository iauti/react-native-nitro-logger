import { expect, test } from "bun:test";
import { createFileToolkitAdapter } from "../packages/react-native-nitro-logger/src/internal/createFileToolkitAdapter";

test("FileToolkit adapter appends UTF-8 and preserves URI encoding", async () => {
  const calls: unknown[] = [];
  const fs = {
    fromUri: (uri: string) => ({ origin: "uri", uri }),
    createDirectory: async (options: unknown) => {
      calls.push(options);
    },
    stat: async () => ({ kind: "file", byteCount: 42n }),
    writeText: async (options: unknown) => {
      calls.push(options);
    },
    move: async (options: unknown) => {
      calls.push(options);
    },
    remove: async (options: unknown) => {
      calls.push(options);
    },
  } as unknown as Parameters<typeof createFileToolkitAdapter>[0];
  const adapter = createFileToolkitAdapter(fs);
  await adapter.makeDir("/logs/app logs");
  await adapter.appendText("/logs/app logs/a.log", "hello\n");
  expect(await adapter.stat("/logs/a.log")).toEqual({ size: 42 });
  expect(await adapter.exists("/logs/a.log")).toBe(true);
  await adapter.move("file:///logs/app%20logs/a.log", "/logs/b.log");
  await adapter.remove("/logs/b.log");
  expect(calls).toEqual([
    {
      location: { origin: "uri", uri: "file:///logs/app%20logs" },
      createParentDirectories: true,
    },
    {
      destination: { origin: "uri", uri: "file:///logs/app%20logs/a.log" },
      text: "hello\n",
      encoding: "utf-8",
      mode: "append",
      atomicity: "none",
      createParentDirectories: true,
    },
    {
      source: { origin: "uri", uri: "file:///logs/app%20logs/a.log" },
      destination: { origin: "uri", uri: "file:///logs/b.log" },
      collision: "replace",
      atomicity: "preferred",
    },
    {
      location: { origin: "uri", uri: "file:///logs/b.log" },
      recursive: false,
      missing: "ignore",
    },
  ]);
});

test("FileToolkit adapter distinguishes missing files, directories, and unsafe sizes", async () => {
  let info: unknown;
  const adapter = createFileToolkitAdapter({
    fromUri: (uri: string) => ({ origin: "uri", uri }),
    stat: async () => info,
  } as unknown as Parameters<typeof createFileToolkitAdapter>[0]);
  expect(await adapter.exists("/logs/a.log")).toBe(false);
  expect(await adapter.stat("/logs/a.log")).toBeNull();
  info = { kind: "directory" };
  await expect(adapter.stat("/logs/a.log")).rejects.toThrow("readable file");
  info = { kind: "file", byteCount: 9007199254740992n };
  await expect(adapter.stat("/logs/a.log")).rejects.toThrow("safe integer");
});
