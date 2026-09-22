import type { FileTransportOptions } from "./FileTransportOptions.ts";
import type { createFileToolkitTransport } from "./createFileToolkitTransport.ts";

/** Native file settings for {@linkcode createFileToolkitTransport}. */
export type FileToolkitTransportOptions = Omit<
  FileTransportOptions,
  "fileSystem"
>;
