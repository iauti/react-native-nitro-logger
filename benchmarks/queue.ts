import assert from "node:assert/strict";

// Isolated data-structure experiment, not a proposed worker implementation.
// Setup is excluded. Entries stay referenced in `entries` for both strategies.
// Does not model writes, snapshots, concurrent admission, or lifecycle barriers.
const median = (values: number[]) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
for (const capacity of [512, 8192, 65536]) {
  const entries = Array.from({ length: capacity }, (_, id) => ({ id }));
  const shiftTimes: number[] = [];
  const ringTimes: number[] = [];
  function sample(ring: boolean) {
    const queue: ({ id: number } | undefined)[] = [...entries];
    let head = 0;
    let count = capacity;
    let sum = 0;
    const start = performance.now();
    if (ring) {
      while (count > 0) {
        const entry = queue[head]!;
        queue[head] = undefined;
        head = (head + 1) % capacity;
        count--;
        sum += entry.id;
      }
    } else {
      while (queue.length) sum += queue.shift()!.id;
    }
    const elapsed = performance.now() - start;
    assert.equal(sum, (capacity * (capacity - 1)) / 2);
    return elapsed;
  }
  for (let i = 0; i < 3; i++) {
    sample(false);
    sample(true);
  }
  for (let i = 0; i < 15; i++) {
    // Alternate order to reduce consistent first-run bias.
    if (i % 2) {
      ringTimes.push(sample(true));
      shiftTimes.push(sample(false));
    } else {
      shiftTimes.push(sample(false));
      ringTimes.push(sample(true));
    }
  }
  console.log(
    JSON.stringify({
      capacity,
      shiftDrainMs: +median(shiftTimes).toFixed(4),
      ringDrainMs: +median(ringTimes).toFixed(4),
    }),
  );
}
