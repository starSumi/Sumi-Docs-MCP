# ADR-0011: Calibrate cold-start performance against the supported SDK

- Status: Accepted
- Date: 2026-08-19
- Owners: Sumi Docs maintainers
- Amends: ADR-0010 performance criteria

## Context

Cold start is measured from spawning a new process to receiving the first
MCP 2026 `tools/list` response. The former policy required every observed
sample to complete in less than 100 ms. Profiling on Windows showed that this
threshold could be exceeded by a minimal Node.js SEA and by an empty server
using the supported MCP SDK before Sumi Docs business code ran. A sample maximum
also overweights host scheduling and security-scanner noise.

The release gate must still detect regressions. It must distinguish runtime and
SDK cost from product-owned startup cost, retain raw observations, and fail on
protocol errors or timeouts.

## Decision

The benchmark starts three freshly built SEA subjects in random interleaved
order on the same host:

1. `raw-sea`, a benchmark-only minimal JSON-RPC measurement baseline;
2. `sdk-empty`, an empty server built with the supported public MCP SDK API;
3. `sumi-product`, the release candidate executable.

Each subject runs 100 times for release evidence. The report records the host,
runtime, executable digests, ordering, timeout, every observation, errors,
timeouts, median, p95, p99, and maximum. Product results are also reported as a
delta and ratio relative to `sdk-empty`.

The Windows cold-process v1 policy passes only when:

- all three subjects have zero errors and zero timeouts;
- product median is at most 200 ms;
- product p95 is at most 350 ms;
- product median is no more than 35 ms and 1.30 times the SDK median;
- product p95 is no more than 75 ms above the SDK p95.

P99 and maximum remain diagnostic values. Less than 100 ms remains a stretch
target for a future native implementation; it is not a blocking Node.js v0.1
threshold.

The manually dispatched acceptance-candidate workflow runs the policy and
preserves the JSON report. Release acceptance retains that run from a physical
Windows 11 x64 reference host. Results from unlike hosts are not combined into
one percentile set.

## Consequences

This policy does not weaken protocol, correctness, security, packaging, or
artifact gates. The raw responder is not product code and cannot replace the
official SDK. Unsupported SDK subpaths and hand-written protocol servers remain
out of scope.

ADR-0010 continues to govern any runtime migration. A Rust implementation must
pass its full parity, packaging, provenance, rollback, and ownership gates; a
benchmark advantage alone is insufficient and does not block the Node.js v0.1
release.

## Validation and rollback

Policy calculations are covered by deterministic unit tests. Candidate builds
compile all three subjects with the same Node.js SEA settings, record executable,
source, configuration, and installed SDK entry digests, run the interleaved
benchmark without shell pipelines, upload the raw report, and fail closed before
acceptance.

If the policy or probe implementation is defective, revert the benchmark and
this ADR together. Do not change MCP behavior or substitute an unreviewed
transport implementation as a performance rollback.
