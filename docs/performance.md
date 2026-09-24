# Performance review

[Documentation index](README.md)

Reviewed September 22, 2026. Findings below combine source inspection and a local portable benchmark. There is no measured claim that LoggerKit is faster than another logger. Native devices, Hermes, OS logging, disk, and remote SDK ingestion have not been benchmarked in this review.

## Reproduce

From the repository after `bun install --frozen-lockfile`:

```sh
bun run benchmark
bun run benchmark:queue
```

[Logger benchmark](../benchmarks/logger.ts) uses 8,192 attempts per sample, two warmups, seven measured samples, and reports medians. Attributes are prepared outside the timed loop; a no-op destination counts completed records. Enqueue time measures synchronous log calls; total time includes draining and flush, but excludes logger creation/close. It asserts acceptance, delivery, pending, failure, and drop counts, so discarding records cannot masquerade as throughput.

The nested payload contains 16 objects with an ID, price, and redacted token. The processor case adds an identity-like transform. Saturation uses capacity 512; the other admitted scenarios use 8,192 so all attempts fit. This is a burst benchmark, not sustained production traffic. GC and runtime warmup affect results; timings are observations, not CI pass/fail thresholds.

Local baseline: Apple M3 Max, macOS arm64, Bun 1.3.14:

| Scenario              | Enqueue µs / attempt | Total ms | Accepted | Dropped |
| --------------------- | -------------------: | -------: | -------: | ------: |
| Filtered nested       |                0.053 |    0.443 |        0 |       0 |
| Empty attributes      |                0.604 |    6.719 |    8,192 |       0 |
| Small attributes      |                1.182 |   11.132 |    8,192 |       0 |
| Nested attributes     |               25.167 |  207.935 |    8,192 |       0 |
| Nested + processor    |               25.530 |  210.485 |    8,192 |       0 |
| Nested, saturated     |               24.730 |  202.775 |      512 |   7,680 |
| Empty, batch size 1   |                0.842 |   12.019 |    8,192 |       0 |
| Empty, batch size 256 |                0.754 |    7.419 |    8,192 |       0 |

Enqueue values include allocation/GC variation and must not be treated as precise isolated per-function timings. Batch-size comparisons are most relevant to total drain cost. Filtered attempts are neither delivered nor counted as transport drops.

## Findings and priorities

| Priority               | Source evidence                                                                                                                                                                                       | Impact and next step                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                   | [createLogger](../packages/react-native-nitro-logger/src/createLogger.ts) snapshots per-call attributes, the merged context, and the final processed record—even with no processors                   | Multiple synchronous walks/allocations. Nested payloads dominate this benchmark. Profile a no-processor fast path before changing it; preserve redaction, bounds, freezing, and snapshot isolation                     |
| High under overload    | `isLevelEnabled` checks state/levels, not queue space; capacity is checked only in worker enqueue after normalization                                                                                 | Saturated calls still pay nearly the entire nested-record cost. An admission optimization must preserve per-transport dropped counts, processor semantics, and partial acceptance by other destinations                |
| Medium at large queues | [TransportWorker](../packages/react-native-nitro-logger/src/internal/TransportWorker.ts) removes each record/barrier using `Array.shift()`                                                            | Consider a head-index queue or ring buffer; measure on Hermes. Default queues are small, so do not extrapolate the largest-queue gain to normal traffic                                                                |
| Workload-dependent     | Worker creates Promise races and timeout timers per operation, including optional no-op lifecycle operations                                                                                          | Larger batches amortize this overhead. Benchmark real destinations before specializing synchronous transports; timeout and ordering behavior must remain intact                                                        |
| Workload-dependent     | [System transport](../packages/react-native-nitro-logger/src/plugins/createSystemTransport.ts) JSON-stringifies each record on JS before the native batch call                                        | Native writes run off-thread, but serialization and binding conversion still cost JS time. Measure large attributes and multiple destinations                                                                          |
| Workload-dependent     | [File transport](../packages/react-native-nitro-logger/src/plugins/createFileTransport.ts) runs makeDir/exists/stat per batch, escapes non-ASCII code units, and checks/moves rotation files serially | Small batches increase filesystem calls; escaping expands Unicode text; rotation scales with retained files. Measure real storage before caching metadata, which changes recovery behavior after external file changes |
| Workload-dependent     | [Datadog adapter](../packages/react-native-nitro-logger/src/plugins/createDatadogTransport.ts) awaits each SDK call sequentially                                                                      | Batch latency accumulates per-record SDK latency. Do not introduce uncontrolled parallelism without checking SDK ordering/limits                                                                                       |
| Workload-dependent     | [Android sink](../packages/react-native-nitro-logger/android/src/main/java/com/margelo/nitro/nitrologger/HybridSystemLogSink.kt) counts code points in the remaining suffix for every chunk           | Long Unicode payloads repeatedly scan text. A single forward scan is a candidate optimization; verify surrogate handling, truncation, and Logcat chunk limits                                                          |

These are review findings, not production-code changes. Snapshotting protects privacy and isolates caller mutations; removing it indiscriminately would change the contract.

## Would a circular buffer improve the queue?

Likely at high occupancy. A ring advances a head index and clears consumed slots, avoiding front removal. A head-index array with occasional compaction is another simple option. Engine implementations of `shift()` vary, so a theoretical complexity argument alone is insufficient.

The [queue experiment](../benchmarks/queue.ts) excludes allocation/setup, drains the same referenced objects, alternates measurement order, and checks a checksum. Three warmups and 15 samples per size on the same Bun runtime produced:

| Entries | Array shift drain ms | Ring drain ms |
| ------: | -------------------: | ------------: |
|     512 |               0.0533 |        0.0490 |
|   8,192 |               0.2036 |        0.0642 |
|  65,536 |               1.3799 |        0.2565 |

The smallest timings are noisy. This experiment does not model asynchronous writes, wraparound under concurrent admission, lifecycle barriers, or memory use. It is evidence to investigate, not a measured speedup for the whole logger. The nested burst spends about 208 ms overall, mostly before draining; queue changes alone will not remove that cost.

A production replacement must preserve:

- FIFO records and ordered flush/close barriers, including barriers between partially filled batches.
- Record capacity including in-flight batches; do not release capacity merely on dequeue.
- Barriers even when the record capacity is full. Barriers currently do not count toward capacity, so a fixed array sized to `capacity` is not a drop-in replacement.
- Timeout quarantine: discard queued records, resolve queued barriers, and avoid overlapping the timed-out operation.
- Clearing consumed references, wraparound, and admission during an awaited write.

Concurrent `flush()` calls currently add unbounded barrier entries even though record retention is bounded. Avoid calling flush for every record; a ring alone would not address this separate resource-bound gap. A future implementation could coalesce equivalent barriers only if their ordering semantics are retained.

## Tune an app today

Keep attributes compact; avoid logging entire state trees or creating children per record. Guard expensive debug payload construction with `isLevelEnabled()`. Keep processors synchronous and cheap. Avoid console output in hot production paths. Batch transport work and yield between large producer bursts; a single synchronous burst prevents the worker microtask from draining until it returns.

Start with the defaults and observe `pending`, `dropped`, `failed`, and `failures`. Raising capacity retains more records and tolerates longer bursts; it does not increase destination throughput. Avoid flushing after each call because barriers split batches. Larger batches trade throughput against per-operation latency and payload size; all workers cap batch size at 256. A slow synchronous custom transport or processor can block all JS activity despite independent queues; timeouts cannot preempt it.

Before shipping a performance change, run release builds on representative iOS and Android devices with Hermes, without an attached debugger. Measure log-call p50/p95/p99, JS frame delays, peak retained memory, drain duration, and counter totals for filtered, steady, burst, and overloaded workloads. Test empty/small/nested/error/Unicode payloads, each real destination, slow/rejecting transports, file rotation, and multiple destinations. Compare equivalent retention and privacy settings across alternatives. Retain existing ordering, redaction, overflow, timeout, and lifecycle tests.
