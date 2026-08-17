# ADR-0010: Keep Node.js until a Rust spike passes a parity gate

- Status: Accepted
- Date: 2026-08-17
- Owners: Sumi Docs maintainers

## Context

The Node.js SEA has historically missed the 100 ms cold-start hard limit. That
is a release blocker, not proof that Markdown parsing or the entire product must
move to Rust. Corpus parsing is already delayed until the first content call, so
the remaining cost may be process, SDK, module loading, bundling, or measurement
overhead.

Rust has an official MCP SDK with stdio support, but changing runtimes risks
different Markdown, MDX, frontmatter, Unicode, error, and packaging behavior.

## Decision

Keep the supported implementation on Node.js while measuring the current HEAD.
Run at least 30 starts for plain compiled Node, the bundle, and SEA, and record
runtime, machine, executable hash, min, median, p95, and max. Profile SDK and
module import cost before changing public behavior.

An isolated Rust spike may implement the same transport and corpus contracts. It
must use the official Rust MCP SDK and pass the shared golden corpus, manifest
v1/v2, tool-schema, error-shape, path-security, Unicode, and statelessness
conformance suites.

Promote Rust only when all conditions hold:

- optimized Node p95 remains above 100 ms on two representative Windows
  machines;
- Rust p95 is at most 75 ms or at least 40 percent faster;
- protocol, corpus, security, and result-shape parity are complete;
- Windows build, signing, SBOM, provenance, rollback, and a maintenance owner
  are established.

Rust does not replace Astro, solve publication races, or own the reconciliation
control plane. A spike is not a release artifact and cannot silently replace the
Node binary.

## Validation and rollback

Benchmark scripts must fail closed, avoid pipelines that hide exit codes, and
retain raw measurements. A runtime switch requires a superseding ADR and a
dual-run acceptance period. Until then, deleting the spike has no product
impact.
