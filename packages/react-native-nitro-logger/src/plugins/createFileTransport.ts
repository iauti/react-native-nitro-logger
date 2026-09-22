import type { Transport } from "../Transport.ts";
import type { FileTransportOptions } from "./FileTransportOptions.ts";
import { formatFileRecord } from "../internal/formatFileRecord.ts";

/** Portable rotating .log files. Inject into one logger; its worker serializes batches. */
export function createFileTransport(options: FileTransportOptions): Transport {
  const { fileSystem: fs } = options;
  const maxBytes = options.maxFileBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxFileBytes must be a positive safe integer");
  }
  if (typeof options.directory !== "string" || !options.directory.trim()) {
    throw new TypeError("directory must be a non-empty filesystem path or URI");
  }
  const directory = options.directory.replace(/\/+$/, "");
  const filename = options.filename ?? "current.log";
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*\.log$/.test(filename)) {
    throw new TypeError(
      "filename must be a .log basename using letters, numbers, dots, underscores or hyphens",
    );
  }
  const maxFiles = options.maxFiles ?? 2;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) {
    throw new RangeError("maxFiles must be an integer from 1 to 100");
  }
  const current = `${directory}/${filename}`;
  const pathAt = (index: number) =>
    index === 0
      ? current
      : `${directory}/${filename.slice(0, -4)}.${index}.log`;
  const format = options.format ?? formatFileRecord;
  return {
    name: options.name ?? "file",
    async write(records) {
      const lines = records.map((record) => {
        const line = format(record);
        if (typeof line !== "string")
          throw new TypeError("format must return a string");
        return (
          line.replace(
            /[\u0000-\u001f\u007f-\uffff]/g,
            (character) =>
              `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
          ) + "\n"
        );
      });
      if (!lines.length) return;
      if (lines.some((line) => line.length > maxBytes)) {
        throw new RangeError("Log record exceeds maxFileBytes");
      }
      await fs.makeDir(options.directory);
      const existing = await fs.exists(current);
      const stat = existing ? await fs.stat(current) : null;
      if (existing && !stat) throw new Error("Cannot inspect log file size");
      let size = stat?.size ?? 0;
      if (!Number.isSafeInteger(size) || size < 0 || size > maxBytes) {
        throw new RangeError(
          "Existing log file size is invalid or exceeds maxFileBytes",
        );
      }
      let batch = "";
      for (const line of lines) {
        if (size + batch.length + line.length > maxBytes) {
          if (batch) {
            await fs.appendText(current, batch);
            size += batch.length;
          }
          batch = "";
          await fs.remove(pathAt(maxFiles - 1));
          for (let index = maxFiles - 2; index >= 0; index--) {
            if (await fs.exists(pathAt(index)))
              await fs.move(pathAt(index), pathAt(index + 1));
          }
          size = 0;
        }
        batch += line;
      }
      if (batch) await fs.appendText(current, batch);
    },
  };
}
