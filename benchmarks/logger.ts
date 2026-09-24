import assert from "node:assert/strict";
import { cpus } from "node:os";
import { createLogger } from "../packages/react-native-nitro-logger/src/createLogger.ts";
import type { Attributes } from "../packages/react-native-nitro-logger/src/Attributes.ts";

// Portable JS baseline only: no native calls, disk, console writes, or network.
const attempts = 8192;
const nested: Attributes = {
  route: "checkout",
  items: Array.from({ length: 16 }, (_, id) => ({
    id,
    price: 42,
    token: "secret",
  })),
};
const scenarios = [
  { name: "filtered nested", attributes: nested, filtered: true },
  { name: "empty", attributes: {} },
  { name: "small", attributes: { id: 42, route: "checkout" } },
  { name: "nested", attributes: nested },
  { name: "nested + processor", attributes: nested, processor: true },
  { name: "nested saturated", attributes: nested, capacity: 512 },
  { name: "empty batch=1", attributes: {}, batchSize: 1 },
  { name: "empty batch=256", attributes: {}, batchSize: 256 },
] as const;

type Scenario = {
  name: string;
  attributes: Attributes;
  filtered?: boolean;
  processor?: boolean;
  capacity?: number;
  batchSize?: number;
};
async function run(scenario: Scenario) {
  let written = 0;
  const logger = createLogger({
    level: scenario.filtered ? "error" : "info",
    processors: scenario.processor ? [(record) => ({ ...record })] : [],
    transports: [
      {
        transport: {
          name: "noop",
          write(records) {
            written += records.length;
          },
        },
        capacity: scenario.capacity ?? attempts,
        batchSize: scenario.batchSize ?? 32,
      },
    ],
  });
  let accepted = 0;
  const start = performance.now();
  for (let i = 0; i < attempts; i++) {
    if (logger.info("Benchmark", scenario.attributes)) accepted++;
  }
  const enqueueMs = performance.now() - start;
  const [status] = await logger.flush();
  const totalMs = performance.now() - start;
  assert(status);
  assert.equal(status.pending, 0);
  assert.equal(status.failed, 0);
  assert.equal(status.failures, 0);
  assert.equal(status.delivered, accepted);
  assert.equal(written, accepted);
  assert.equal(
    accepted,
    scenario.filtered ? 0 : Math.min(attempts, scenario.capacity ?? attempts),
  );
  assert.equal(status.dropped, scenario.filtered ? 0 : attempts - accepted);
  await logger.close();
  return { enqueueMs, totalMs, accepted, dropped: status.dropped };
}
const median = (values: number[]) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
console.log(
  JSON.stringify({
    runtime: process.versions.bun,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    attempts,
    samples: 7,
    warmups: 2,
  }),
);
for (const scenario of scenarios) {
  for (let i = 0; i < 2; i++) await run(scenario);
  const results = [];
  for (let i = 0; i < 7; i++) results.push(await run(scenario));
  console.log(
    JSON.stringify({
      scenario: scenario.name,
      enqueueUsPerAttempt: +(
        (median(results.map((r) => r.enqueueMs)) * 1000) /
        attempts
      ).toFixed(3),
      totalMs: +median(results.map((r) => r.totalMs)).toFixed(3),
      accepted: results[0]!.accepted,
      dropped: results[0]!.dropped,
    }),
  );
}
