import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  stat,
  appendFile,
  rename,
  rm,
  readFile,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFileTransport,
  type FileSystemAdapter,
} from "../packages/react-native-nitro-logger/src/file";
import {
  createLogger,
  type LogRecord,
} from "../packages/react-native-nitro-logger/src/index";
import { createMemoryTransport } from "../packages/react-native-nitro-logger/src/memory";

const fs: FileSystemAdapter = {
  makeDir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  exists: async (path) => {
    try {
      await stat(path);
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw e;
    }
  },
  stat: async (path) => {
    try {
      return await stat(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
  appendText: (path, text) => appendFile(path, text, "utf8"),
  move: rename,
  remove: (path) => rm(path, { force: true }),
};
const record = (sequence: number): LogRecord => ({
  sequence,
  timestampMs: 1,
  level: "info",
  message: "upload.started",
  attributes: { category: "UPLOAD" },
});
const fields = (text: string) =>
  text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line.slice(line.indexOf("{"))));
async function withDirectory(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "loggerkit-file-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("file export works without Nitro and writes readable single-line records safely", async () => {
  await withDirectory(async (directory) => {
    const transport = createFileTransport({ fileSystem: fs, directory });
    await transport.write([
      {
        ...record(1),
        message: "first\nforged ERROR\r\u001b 🗝",
        attributes: { category: "App\nspoof", text: "é" },
      },
    ]);
    const text = await readFile(join(directory, "current.log"), "utf8");
    expect(
      text.startsWith("1970-01-01T00:00:00.001Z INFO [App\\nspoof] first\\n"),
    ).toBe(true);
    expect(text.trim().split("\n")).toHaveLength(1);
    expect(fields(text)[0].attributes.text).toBe("é");
    expect(Buffer.byteLength(text)).toBe(text.length);
  });
});

test("rotates complete records, retains two bounded files and resumes existing files", async () => {
  await withDirectory(async (directory) => {
    const current = join(directory, "current.log");
    await createFileTransport({ fileSystem: fs, directory }).write([record(1)]);
    const maxFileBytes = (await stat(current)).size * 2;
    const transport = createFileTransport({
      fileSystem: fs,
      directory: directory + "/",
      maxFileBytes,
    });
    await transport.write([record(2), record(3), record(4), record(5)]);
    expect((await readdir(directory)).sort()).toEqual([
      "current.1.log",
      "current.log",
    ]);
    expect(
      fields(await readFile(join(directory, "current.1.log"), "utf8")).map(
        (r) => r.sequence,
      ),
    ).toEqual([3, 4]);
    expect(
      fields(await readFile(current, "utf8")).map((r) => r.sequence),
    ).toEqual([5]);
    for (const name of await readdir(directory))
      expect((await stat(join(directory, name))).size).toBeLessThanOrEqual(
        maxFileBytes,
      );
    await rm(directory, { recursive: true });
    await transport.write([record(6)]);
    expect(fields(await readFile(current, "utf8"))[0].sequence).toBe(6);
  });
});

test("rotates a non-exact buffered batch", async () => {
  await withDirectory(async (directory) => {
    await createFileTransport({ fileSystem: fs, directory }).write([record(1)]);
    const maxFileBytes =
      (await stat(join(directory, "current.log"))).size * 2 + 1;
    await fs.remove(join(directory, "current.log"));
    await createFileTransport({
      fileSystem: fs,
      directory,
      maxFileBytes,
    }).write([record(1), record(2), record(3)]);
    expect(
      fields(await readFile(join(directory, "current.1.log"), "utf8")).map(
        (r) => r.sequence,
      ),
    ).toEqual([1, 2]);
    expect(
      fields(await readFile(join(directory, "current.log"), "utf8"))[0]
        .sequence,
    ).toBe(3);
  });
});

test("rejects invalid options and oversized records before writing", async () => {
  expect(() => createFileTransport({ fileSystem: fs, directory: "" })).toThrow(
    TypeError,
  );
  for (const maxFileBytes of [0, -1, NaN, Infinity, 1.5])
    expect(() =>
      createFileTransport({ fileSystem: fs, directory: "/logs", maxFileBytes }),
    ).toThrow(RangeError);
  await withDirectory(async (directory) => {
    const transport = createFileTransport({
      fileSystem: fs,
      directory,
      maxFileBytes: 1,
    });
    await transport.write([]);
    await expect(transport.write([record(1)])).rejects.toThrow("maxFileBytes");
    expect(await readdir(directory)).toEqual([]);
  });
});

test("does not append when existing size cannot be read or exceeds the limit", async () => {
  await withDirectory(async (directory) => {
    await appendFile(join(directory, "current.log"), "existing");
    const unreadable = createFileTransport({
      fileSystem: { ...fs, stat: () => null },
      directory,
    });
    await expect(unreadable.write([record(1)])).rejects.toThrow("inspect");
    const oversized = createFileTransport({
      fileSystem: { ...fs, stat: () => ({ size: 2000 }) },
      directory,
      maxFileBytes: 1000,
    });
    await expect(oversized.write([record(1)])).rejects.toThrow("Existing");
    expect(await readFile(join(directory, "current.log"), "utf8")).toBe(
      "existing",
    );
  });
});

test("injected filesystem failures are isolated from other destinations", async () => {
  await withDirectory(async (directory) => {
    const memory = createMemoryTransport();
    const file = createFileTransport({
      fileSystem: {
        ...fs,
        appendText: () => {
          throw new Error("disk full");
        },
      },
      directory,
    });
    const logger = createLogger({
      transports: [{ transport: file }, { transport: memory }],
    });
    logger.info("one");
    const status = await logger.flush();
    expect(status.find((s) => s.name === "file")?.failures).toBe(1);
    expect(memory.getRecords()).toHaveLength(1);
    await logger.close();
  });
});

test("custom filenames, formatting and retention keep destinations independent", async () => {
  await withDirectory(async (directory) => {
    const transport = createFileTransport({
      fileSystem: fs,
      directory,
      filename: "uploads.log",
      maxFiles: 3,
      maxFileBytes: 2,
      format: (r) => String(r.sequence),
    });
    await transport.write([record(1), record(2), record(3), record(4)]);
    expect(await readFile(join(directory, "uploads.log"), "utf8")).toBe("4\n");
    expect(await readFile(join(directory, "uploads.1.log"), "utf8")).toBe(
      "3\n",
    );
    expect(await readFile(join(directory, "uploads.2.log"), "utf8")).toBe(
      "2\n",
    );
    await createFileTransport({
      fileSystem: fs,
      directory,
      filename: "errors.log",
      maxFiles: 1,
      maxFileBytes: 2,
      format: (r) => String(r.sequence),
    }).write([record(5), record(6)]);
    expect(await readFile(join(directory, "errors.log"), "utf8")).toBe("6\n");
    expect(await readdir(directory)).toHaveLength(4);
  });
});

test("rejects path traversal and invalid retention", () => {
  for (const filename of ["../a.log", "/a.log", "a/b.log", "a.txt", ""]) {
    expect(() =>
      createFileTransport({ fileSystem: fs, directory: "/logs", filename }),
    ).toThrow(TypeError);
  }
  for (const maxFiles of [0, -1, 1.5, 101, NaN]) {
    expect(() =>
      createFileTransport({ fileSystem: fs, directory: "/logs", maxFiles }),
    ).toThrow(RangeError);
  }
});
