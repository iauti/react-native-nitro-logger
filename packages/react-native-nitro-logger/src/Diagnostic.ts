export interface Diagnostic {
  readonly source: string;
  readonly operation: "write" | "flush" | "close" | "processor" | "snapshot";
  /** Deliberately excludes the original exception and log payload. */
  readonly reason: "failed" | "timeout";
}
