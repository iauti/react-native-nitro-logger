import { createSystemTransport } from "react-native-nitro-logger/system";
import type { Transport } from "react-native-nitro-logger";

export function systemTarget(): { transport?: Transport; description: string } {
  try {
    return {
      transport: createSystemTransport({
        category: "LoggerLab",
        subsystem: "com.iauti.nitrologger.example",
        enablePublicLogging: true,
      }),
      description: "Native system transport ready · public demo payloads",
    };
  } catch (error) {
    return {
      description: `Native transport unavailable: ${String(error)}. Build with expo run:ios or expo run:android.`,
    };
  }
}
