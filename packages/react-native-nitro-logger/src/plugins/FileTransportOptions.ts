import type { LogRecord } from "../LogRecord.ts";
import type { FileSystemAdapter } from "./FileSystemAdapter.ts";

export interface FileTransportOptions {
  readonly fileSystem: FileSystemAdapter;
  /** App-owned directory path or URI. One transport must own each filename and its rotation files. */
  readonly directory: string;
  /** Maximum bytes per file. Applies to active and rotated files. Default: 1 MiB. */
  readonly maxFileBytes?: number;
  /** A single .log filename, without directory components. Default: current.log. */
  readonly filename?: string;
  /** Total retained files, including the active file. Default: 2; range: 1..100. */
  readonly maxFiles?: number;
  /** Format one record without a trailing newline. Control characters are escaped by the transport. */
  readonly format?: (record: LogRecord) => string;
  readonly name?: string;
}
