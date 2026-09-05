/** Prefix wire enum cases to avoid native preprocessor macros such as DEBUG. */
export type SystemLogLevel =
  | "log-trace"
  | "log-debug"
  | "log-info"
  | "log-warn"
  | "log-error"
  | "log-fatal";
