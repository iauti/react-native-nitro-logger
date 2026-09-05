import type { Transport } from "../Transport.ts";

export function createConsoleTransport(
  options: { readonly name?: string } = {},
): Transport {
  return {
    name: options.name ?? "console",
    write(records) {
      for (const record of records) {
        const method =
          record.level === "fatal"
            ? "error"
            : record.level === "trace"
              ? "debug"
              : record.level;
        console[method](record.message, record.attributes);
      }
    },
  };
}
