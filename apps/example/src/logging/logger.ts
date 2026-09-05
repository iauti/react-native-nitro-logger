import { createLogger } from "react-native-nitro-logger";
import { createConsoleTransport } from "react-native-nitro-logger/console";
import { createMemoryTransport } from "react-native-nitro-logger/memory";
import { systemTarget } from "./systemTarget";

export const memory = createMemoryTransport({ capacity: 100 });
const system = systemTarget();
export const systemDescription = system.description;
export const logger = createLogger({
  level: "trace",
  context: { app: "logger-lab", environment: "demo" },
  transports: [
    { transport: memory },
    { transport: createConsoleTransport(), level: "warn" },
    ...(system.transport ? [{ transport: system.transport }] : []),
  ],
});
export const checkout = logger.child({
  feature: "checkout",
  cartId: "demo-042",
});
