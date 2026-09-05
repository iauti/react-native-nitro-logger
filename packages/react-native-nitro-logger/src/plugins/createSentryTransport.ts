import type { Transport } from "../Transport.ts";
import type { SentryClient } from "./SentryClient.ts";

/** Uses Sentry Logs, not synthetic exceptions. SDK initialization remains app-owned. */
export function createSentryTransport(
  client: SentryClient,
  options: { readonly name?: string; readonly flushTimeoutMs?: number } = {},
): Transport {
  return {
    name: options.name ?? "sentry",
    write(records) {
      for (const record of records) {
        const attributes: Record<string, string | number | boolean> =
          Object.create(null);
        for (const [key, value] of Object.entries(record.attributes)) {
          attributes[key] =
            value !== null && typeof value !== "object"
              ? value
              : JSON.stringify(value);
        }
        attributes["nitro.sequence"] = record.sequence;
        attributes["nitro.timestamp_ms"] = record.timestampMs;
        client.logger[record.level](record.message, attributes);
      }
    },
    async flush() {
      if (!(await client.flush(options.flushTimeoutMs ?? 2000)))
        throw new Error("Sentry flush did not complete");
    },
  };
}
