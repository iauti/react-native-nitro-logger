import type { LogLevel } from "../LogLevel.ts";

/** Structural subset of Sentry's app-initialized logger. Enable Logs in Sentry.init. */
export interface SentryClient {
  readonly logger: Readonly<
    Record<
      LogLevel,
      (
        message: string,
        attributes?: Record<string, string | number | boolean>,
      ) => void
    >
  >;
  flush(timeoutMs?: number): PromiseLike<boolean>;
}
