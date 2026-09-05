import { describe, expect, test } from "bun:test";
import { createLogger } from "../packages/react-native-nitro-logger/src/index";
import type {
  Diagnostic,
  LogRecord,
  Transport,
} from "../packages/react-native-nitro-logger/src/index";
import { createMemoryTransport } from "../packages/react-native-nitro-logger/src/memory";

describe("logger pipeline", () => {
  test("processors cannot replace ordering, timestamp or severity", async () => {
    const memory = createMemoryTransport();
    const logger = createLogger({
      transports: [{ transport: memory }],
      processors: [
        (record) => ({
          ...record,
          timestampMs: 0,
          sequence: 999,
          level: "fatal",
          message: "transformed",
        }),
      ],
    });
    logger.info("original");
    await logger.flush();
    const record = memory.getRecords()[0]!;
    expect(record.sequence).toBe(1);
    expect(record.timestampMs).toBeGreaterThan(0);
    expect(record.level).toBe("info");
    expect(record.message).toBe("transformed");
  });

  test("redacts common camelCase credential keys", async () => {
    const memory = createMemoryTransport();
    const logger = createLogger({ transports: [{ transport: memory }] });
    logger.info("safe", {
      accessToken: "a",
      refreshToken: "b",
      clientSecret: "c",
    });
    await logger.flush();
    expect(memory.getRecords()[0]?.attributes).toEqual({
      accessToken: "[REDACTED]",
      refreshToken: "[REDACTED]",
      clientSecret: "[REDACTED]",
    });
  });

  test("filters before processing, with independent transport levels", async () => {
    const all = createMemoryTransport({ name: "all" });
    const errors = createMemoryTransport({ name: "errors" });
    let processed = 0;
    const logger = createLogger({
      level: "debug",
      processors: [
        (record) => {
          processed++;
          return record;
        },
      ],
      transports: [{ transport: all }, { transport: errors, level: "error" }],
    });
    expect(logger.trace("skip")).toBe(false);
    logger.info("hello");
    logger.error("bad");
    await logger.flush();
    expect(processed).toBe(2);
    expect(all.getRecords().map((r) => r.message)).toEqual(["hello", "bad"]);
    expect(errors.getRecords().map((r) => r.message)).toEqual(["bad"]);
  });

  test("snapshots child context and retains errors without executing getters", async () => {
    const memory = createMemoryTransport();
    const context = { route: "checkout", nested: { id: 1 } };
    const logger = createLogger({
      context,
      transports: [{ transport: memory }],
    });
    context.nested.id = 9;
    const child = logger.child({ route: "payment" });
    let calls = 0;
    const attributes = {
      error: new Error("offline"),
      get dangerous() {
        calls++;
        throw new Error();
      },
    };
    child.error("request failed", attributes);
    logger.info("root");
    await logger.flush();
    expect(calls).toBe(0);
    expect(memory.getRecords()[0]?.attributes).toMatchObject({
      route: "payment",
      nested: { id: 1 },
      error: { message: "offline" },
      dangerous: "[accessor]",
    });
    expect(memory.getRecords()[1]?.attributes.route).toBe("checkout");
  });

  test("redacts recursively after processors, freezes payload, and supports cycles", async () => {
    const memory = createMemoryTransport();
    const cycle: Record<string, unknown> = { Password: "secret" };
    cycle.self = cycle;
    const logger = createLogger({
      redactKeys: ["email"],
      processors: [
        (r) => ({ ...r, attributes: { ...r.attributes, token: "new-secret" } }),
      ],
      transports: [{ transport: memory }],
    });
    logger.info("safe", { nested: [cycle], email: "private" });
    await logger.flush();
    const record = memory.getRecords()[0]!;
    expect(JSON.stringify(record)).not.toContain("secret");
    expect(record.attributes).toMatchObject({
      token: "[REDACTED]",
      email: "[REDACTED]",
      nested: [{ Password: "[REDACTED]", self: "[circular]" }],
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.attributes.nested)).toBe(true);
  });

  test("contains processor failure and diagnostic recursion without leaking error payload", async () => {
    const diagnostics: Diagnostic[] = [];
    const memory = createMemoryTransport();
    const logger = createLogger({
      processors: [
        () => {
          throw new Error("password=secret");
        },
      ],
      transports: [{ transport: memory }],
      onDiagnostic: (event) => {
        diagnostics.push(event);
        expect(logger.info("recursive")).toBe(false);
        throw new Error("ignored");
      },
    });
    expect(logger.info("message")).toBe(false);
    await logger.flush();
    expect(memory.getRecords()).toHaveLength(0);
    expect(diagnostics).toEqual([
      { source: "logger", operation: "processor", reason: "failed" },
    ]);
  });

  test("bounds retained attributes and text", async () => {
    const memory = createMemoryTransport();
    const logger = createLogger({ transports: [{ transport: memory }] });
    const wide = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [String(i), "x".repeat(10000)]),
    );
    logger.info("m".repeat(50000), wide);
    await logger.flush();
    expect(JSON.stringify(memory.getRecords()[0]).length).toBeLessThan(25000);
  });

  test("prototype keys remain ordinary data", async () => {
    const memory = createMemoryTransport();
    const logger = createLogger({ transports: [{ transport: memory }] });
    logger.info("safe", JSON.parse('{"__proto__":{"polluted":true}}'));
    await logger.flush();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(memory.getRecords()[0]?.attributes.__proto__).toEqual({
      polluted: true,
    });
  });
});

describe("transport ownership", () => {
  test("batches preserve order and flush is a barrier", async () => {
    const events: string[] = [];
    const transport: Transport = {
      name: "sink",
      write: (records) => {
        events.push(records.map((r) => r.message).join(","));
      },
      flush: () => {
        events.push("flush");
      },
    };
    const logger = createLogger({ transports: [{ transport, batchSize: 2 }] });
    logger.info("1");
    logger.info("2");
    logger.info("3");
    const barrier = logger.flush();
    logger.info("4");
    await barrier;
    await logger.flush();
    expect(events).toEqual(["1,2", "3", "flush", "4", "flush"]);
  });

  test("slow transport overflow is independent and includes in-flight records", async () => {
    let release!: () => void;
    let started!: () => void;
    const didStart = new Promise<void>((r) => {
      started = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const fast = createMemoryTransport();
    const slow: Transport = {
      name: "slow",
      write: async () => {
        started();
        await gate;
      },
    };
    const logger = createLogger({
      transports: [{ transport: slow, capacity: 1 }, { transport: fast }],
    });
    logger.info("1");
    await didStart;
    logger.info("2");
    expect(logger.getStatus()[0]).toMatchObject({ pending: 1, dropped: 1 });
    release();
    await logger.flush();
    expect(fast.getRecords()).toHaveLength(2);
  });

  test("write errors do not stop other transports or future batches", async () => {
    let count = 0;
    const fast = createMemoryTransport();
    const logger = createLogger({
      transports: [
        {
          transport: {
            name: "flaky",
            write() {
              if (++count === 1) throw new Error();
            },
          },
          batchSize: 1,
        },
        { transport: fast },
      ],
    });
    logger.info("1");
    logger.info("2");
    const status = await logger.flush();
    expect(status[0]).toMatchObject({
      failed: 1,
      delivered: 1,
      failures: 1,
      pending: 0,
    });
    expect(fast.getRecords()).toHaveLength(2);
  });

  test("timeout quarantines a transport; no overlapping writes or cleanup", async () => {
    let writes = 0;
    let closes = 0;
    const logger = createLogger({
      transports: [
        {
          transport: {
            name: "hung",
            write() {
              writes++;
              return new Promise(() => {});
            },
            close() {
              closes++;
            },
          },
          batchSize: 1,
          timeoutMs: 10,
        },
      ],
    });
    logger.info("1");
    logger.info("2");
    const status = await logger.close();
    expect(status[0]).toMatchObject({
      state: "disabled",
      failed: 1,
      dropped: 1,
      pending: 0,
    });
    expect(writes).toBe(1);
    expect(closes).toBe(0);
  });

  test("close is idempotent and shared by children, including pending writes", async () => {
    const records: LogRecord[] = [];
    let closes = 0;
    const logger = createLogger({
      transports: [
        {
          transport: {
            name: "test",
            write(batch) {
              records.push(...batch);
            },
            close() {
              closes++;
            },
          },
        },
      ],
    });
    const child = logger.child({ feature: "checkout" });
    child.info("before");
    const first = child.close();
    expect(logger.close()).toBe(first);
    expect(logger.info("after")).toBe(false);
    await first;
    expect(closes).toBe(1);
    expect(records).toHaveLength(1);
    expect(logger.getStatus()[0]?.state).toBe("closed");
  });

  test("memory transport uses bounded oldest-first snapshots", async () => {
    const memory = createMemoryTransport({ capacity: 2 });
    const logger = createLogger({ transports: [{ transport: memory }] });
    for (let i = 0; i < 5; i++) logger.info(String(i));
    await logger.flush();
    expect(memory.getRecords().map((r) => r.message)).toEqual(["3", "4"]);
    memory.clear();
    expect(memory.getRecords()).toHaveLength(0);
    logger.info("5");
    await logger.flush();
    expect(memory.getRecords()[0]?.message).toBe("5");
  });

  test("rejects invalid configuration", () => {
    const memory = createMemoryTransport();
    expect(() =>
      createLogger({ transports: [{ transport: memory, capacity: 0 }] }),
    ).toThrow();
    expect(() =>
      createLogger({
        transports: [{ transport: memory }, { transport: memory }],
      }),
    ).toThrow();
  });
});
