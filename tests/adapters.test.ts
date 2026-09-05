import { expect, test } from "bun:test";
import { createLogger } from "../packages/react-native-nitro-logger/src/index";
import {
  createSentryTransport,
  type SentryClient,
} from "../packages/react-native-nitro-logger/src/sentry";
import { createDatadogTransport } from "../packages/react-native-nitro-logger/src/datadog";

test("Sentry retains structured data as scalar attributes, uses all levels and reports unsuccessful flush", async () => {
  const calls: unknown[] = [];
  const method = (message: string, attributes?: unknown) => {
    calls.push({ message, attributes });
  };
  const client: SentryClient = {
    logger: {
      trace: method,
      debug: method,
      info: method,
      warn: method,
      error: method,
      fatal: method,
    },
    flush: async () => false,
  };
  const logger = createLogger({
    level: "trace",
    transports: [{ transport: createSentryTransport(client) }],
  });
  logger.fatal("failure", { nested: { attempt: 2 }, password: "secret" });
  const status = await logger.flush();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    message: "failure",
    attributes: { nested: '{"attempt":2}', password: "[REDACTED]" },
  });
  expect(status[0]?.failures).toBe(1);
});

test("Datadog maps unsupported severity and retains original level", async () => {
  const calls: { method: string; context: object | undefined }[] = [];
  const method =
    (name: string) => async (_message: string, context?: object) => {
      calls.push({ method: name, context });
    };
  const transport = createDatadogTransport({
    debug: method("debug"),
    info: method("info"),
    warn: method("warn"),
    error: method("error"),
  });
  const logger = createLogger({ level: "trace", transports: [{ transport }] });
  logger.trace("start");
  logger.fatal("end");
  await logger.flush();
  expect(calls.map((c) => c.method)).toEqual(["debug", "error"]);
  expect(calls[1]?.context).toMatchObject({ "nitro.level": "fatal" });
});
