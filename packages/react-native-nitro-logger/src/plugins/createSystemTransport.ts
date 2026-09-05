import { NitroModules } from "react-native-nitro-modules";
import type { SystemLogFactory } from "../specs/SystemLogFactory.nitro.ts";
import type { SystemLogOptions } from "../specs/SystemLogOptions.ts";
import type { Transport } from "../Transport.ts";

export function createSystemTransport(
  options: SystemLogOptions & { readonly name?: string },
): Transport {
  // Only the optional system entry point imports Nitro. Creating a transport creates its native handle.
  const factory =
    NitroModules.createHybridObject<SystemLogFactory>("SystemLogFactory");
  const sink = factory.createSink(options);
  return {
    name: options.name ?? "system",
    async write(records) {
      await sink.write(
        records.map((record) => ({
          level: `log-${record.level}`,
          payload: JSON.stringify(record),
        })),
      );
    },
    close() {
      sink.dispose();
    },
  };
}
