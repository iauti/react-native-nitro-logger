export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export const levels = Object.freeze({
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
} as const);
