/** Filesystem operations used by the portable file transport. Paths are passed through unchanged. */
export interface FileSystemAdapter {
  /** Create the directory recursively; succeed if it already exists. */
  makeDir(path: string): void | Promise<void>;
  exists(path: string): boolean | Promise<boolean>;
  /** Byte size, or null when missing/unreadable. */
  stat(
    path: string,
  ):
    | { readonly size: number }
    | null
    | Promise<{ readonly size: number } | null>;
  /** Append UTF-8 text, creating a missing file without truncating existing content. */
  appendText(path: string, text: string): void | Promise<void>;
  /** Move a file; the destination will have been removed first. */
  move(source: string, destination: string): void | Promise<void>;
  /** Delete a file; succeed if it is already absent. */
  remove(path: string): void | Promise<void>;
}
