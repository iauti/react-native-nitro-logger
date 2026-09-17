import { describe, expect, it } from "react-native-harness";
import { createLogger, type LogLevel } from "react-native-nitro-loggerkit";
import { createMemoryTransport } from "react-native-nitro-loggerkit/memory";
import { createSystemTransport } from "react-native-nitro-loggerkit/system";

describe("Nitro system transport", () => {
  it("creates a native handle and writes all severities in ordered batches", async () => {
    const memory = createMemoryTransport();
    const logger = createLogger({
      level: "trace",
      transports: [
        {
          transport: createSystemTransport({
            category: "NitroLoggerHarness",
            enablePublicLogging: true,
          }),
          batchSize: 2,
        },
        { transport: memory },
      ],
    });
    const levels: LogLevel[] = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ];
    for (const level of levels)
      logger.log(level, `nitro-runtime-${level}`, {
        token: "must-be-redacted",
        error: new Error("demo"),
      });
    const status = await logger.close();
    expect(status[0]!.delivered).toBe(6);
    expect(status[0]!.failures).toBe(0);
    expect(status[0]!.state).toBe("closed");
    expect(memory.getRecords().map((r) => r.level)).toEqual(levels);
    expect(memory.getRecords()[0]!.attributes.token).toBe("[REDACTED]");
  });

  it("validates category and subsystem in native factory implementations", () => {
    expect(() => createSystemTransport({ category: "" })).toThrow();
    expect(() =>
      createSystemTransport({ category: "x".repeat(129) }),
    ).toThrow();
    expect(() =>
      createSystemTransport({ category: "valid", subsystem: "" }),
    ).toThrow();
  });

  it("supports independent configured handles and Unicode payloads", async () => {
    const logger = createLogger({
      transports: [
        { transport: createSystemTransport({ name: "one", category: "One" }) },
        {
          transport: createSystemTransport({
            name: "two",
            category: "Two",
            subsystem: "com.example.test",
          }),
        },
      ],
    });
    logger.info("Unicode 🚀".repeat(350), { nested: { password: "hidden" } });
    const statuses = await logger.close();
    expect(statuses.map((status) => status.delivered)).toEqual([1, 1]);
    expect(statuses.map((status) => status.failures)).toEqual([0, 0]);
  });
});
