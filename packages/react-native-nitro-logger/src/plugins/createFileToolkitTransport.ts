import { FileToolkit } from "react-native-nitro-filetoolkit";
import type { Transport } from "../Transport.ts";
import type { FileToolkitTransportOptions } from "./FileToolkitTransportOptions.ts";
import { createFileTransport } from "./createFileTransport.ts";
import { createFileToolkitAdapter } from "../internal/createFileToolkitAdapter.ts";

/** Native filesystem backend; only this entry point loads FileToolkit. */
export function createFileToolkitTransport(
  options: FileToolkitTransportOptions,
): Transport {
  return createFileTransport({
    ...options,
    fileSystem: createFileToolkitAdapter(FileToolkit.getFileSystem()),
  });
}
