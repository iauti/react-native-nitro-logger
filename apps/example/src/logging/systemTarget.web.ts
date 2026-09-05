import type { Transport } from "react-native-nitro-logger";

export function systemTarget(): { transport?: Transport; description: string } {
  return {
    description:
      "Web preview · memory and console only. Use a native development build for OSLog/Logcat.",
  };
}
