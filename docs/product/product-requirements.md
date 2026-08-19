---
title: Product requirements
description: Product scope, user outcomes, non-goals, and release acceptance for Sumi Docs.
---

# Product requirements

This document defines the product requirements for Sumi Docs. Design decisions
belong in ADRs; delivery evidence belongs in checkpoints and CI.

## Product promise

One reviewed documentation corpus serves people through an Astro and Starlight
site and agents through a read-only MCP server. A document accepted at one Git
commit must have a deterministic identity, locale, route, digest, and machine
projection. Neither consumer may silently observe a partially published corpus.

## Users and core outcomes

| User            | Required outcome                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Reader          | Browse complete, accessible English and Simplified Chinese documentation with stable navigation and theme support.                       |
| Agent           | Discover, search, and fetch the same reviewed corpus through strict MCP tools without requiring a Skill.                                 |
| Project adopter | Start from a repository `docs/` directory or an explicit configuration without product state colliding with `.sumi` or host directories. |
| Maintainer      | Change source, contract, Web projection, and MCP consumer atomically and reproduce every candidate from a commit.                        |
| Release owner   | Review immutable evidence and explicitly accept or reject a candidate before product promotion.                                          |

## Required scope

- pnpm workspace containing the Web application, MCP package, and corpus
  contract package;
- deterministic bilingual catalog and immutable manifest v2 alongside the
  unchanged manifest v1 contract;
- local directory and bounded HTTPS manifest sources;
- native Codex, Claude Code, and VS Code project adapters;
- one repository-level Oxlint policy for JavaScript and TypeScript static
  analysis, with TypeScript compiler checks kept as an independent gate;
- strict path containment, input validation, sanitized diagnostics, digest
  verification, and least-privilege CI;
- executable examples, package previews, cross-product tests, rollback, and
  human acceptance evidence.

## Non-goals for the first public release

- editing documentation through MCP;
- client, conversation, or session state in the MCP process;
- authenticated crawling, arbitrary website crawling, or an HTTP framework;
- automatic translation, semantic search, or autonomous release approval;
- an embedded controller database, background reconciliation service, Rust
  runtime replacement, Bazel, or Nix without their accepted architecture gates.

## Quality bars

Correctness and compatibility take precedence over throughput. Manifest v1
must remain compatible, v2 must be canonical and tamper-evident, and failures
must preserve the last accepted revision. Security gates cover paths, secrets,
dependency provenance, workflow permissions, and package boundaries.

Cold-start acceptance follows ADR-0011. A release run interleaves 100 starts of
the product, an empty official-SDK server, and a raw SEA measurement baseline.
The product must have zero errors and timeouts, median at most 200 ms, p95 at
most 350 ms, median no more than 35 ms and 1.30 times above the SDK baseline,
and p95 no more than 75 ms above it. P99 and maximum are diagnostic. Signing and
public-release privacy are also blocking unless the owner records an explicit
exception.

## Release definition

A release candidate is one clean commit whose package, integration, security,
host-adapter, provenance, Web, executable, and performance evidence is bound to
that commit. Public visibility, tags, packages, deployments, and Releases are
separate promotion actions and require CP6 human acceptance.

See [Checkpoint protocol](../operations/checkpoints.md),
[Release readiness](../operations/release-readiness.md), and
[Evaluation matrix](../operations/evaluation-matrix.md).
