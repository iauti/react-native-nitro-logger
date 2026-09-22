import type { FileSystem } from "react-native-nitro-filetoolkit";
import type { FileSystemAdapter } from "../plugins/FileSystemAdapter.ts";

export function createFileToolkitAdapter(fs: FileSystem): FileSystemAdapter {
  const location = (path: string) => {
    if (!path.startsWith("/") && !path.startsWith("file:///"))
      throw new TypeError(
        "FileToolkit requires an absolute path or local file:// URI",
      );
    return fs.fromUri(
      path.startsWith("file://")
        ? path
        : `file://${path.split("/").map(encodeURIComponent).join("/")}`,
    );
  };
  return {
    async makeDir(path) {
      await fs.createDirectory({
        location: location(path),
        createParentDirectories: true,
      });
    },
    async exists(path) {
      return (await fs.stat(location(path))) !== undefined;
    },
    async stat(path) {
      const info = await fs.stat(location(path));
      if (!info) return null;
      if (info.kind !== "file" || info.byteCount === undefined)
        throw new Error("Log destination is not a readable file");
      const size = Number(info.byteCount);
      if (!Number.isSafeInteger(size))
        throw new RangeError("Log file size exceeds safe integer range");
      return { size };
    },
    async appendText(path, text) {
      await fs.writeText({
        destination: location(path),
        text,
        encoding: "utf-8",
        mode: "append",
        atomicity: "none",
        createParentDirectories: true,
      });
    },
    async move(source, destination) {
      await fs.move({
        source: location(source),
        destination: location(destination),
        collision: "replace",
        atomicity: "preferred",
      });
    },
    async remove(path) {
      await fs.remove({
        location: location(path),
        recursive: false,
        missing: "ignore",
      });
    },
  };
}
