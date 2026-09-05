import type { Transport } from "../Transport.ts";
import type { DatadogClient } from "./DatadogClient.ts";

export function createDatadogTransport(
  client: DatadogClient,
  options: { readonly name?: string } = {},
): Transport {
  return {
    name: options.name ?? "datadog",
    async write(records) {
      for (const record of records) {
        const method =
          record.level === "trace"
            ? "debug"
            : record.level === "fatal"
              ? "error"
              : record.level;
        await client[method](record.message, {
          ...record.attributes,
          "nitro.level": record.level,
          "nitro.sequence": record.sequence,
          "nitro.timestamp_ms": record.timestampMs,
        });
      }
    },
    // DdLogs exposes no upload barrier. Completion means handed to the SDK only.
  };
}
