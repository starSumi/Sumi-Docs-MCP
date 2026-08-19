---
title: Maintainer handoff
description: Reconstruct current state safely at the start of a maintenance session.
---

# Maintainer handoff

Use this sequence at the start of a new maintenance session:

1. Read root and nearest nested `AGENTS.md` files.
2. Run `git status --short --branch` and inspect the current branch and remote.
3. Read active ADRs, then inspect live Git, CI, and candidate artifacts. Do not
   rely on a checked-in current-state snapshot.
4. Use Node.js 25.5.0 or newer and run the narrowest failing gate first.
5. Inspect the immutable corpus revision and GitHub checks before trusting local
   generated files or a prior report.
6. Preserve unrelated work and stage exact paths only.
7. Treat local passing output as provisional until it is rerun for one clean
   candidate commit and read back from the origin CI run.

Then read the [product requirements](../../product/product-requirements/),
[checkpoint protocol](../checkpoints/), [release checklist](../release-readiness/),
and [evaluation matrix](../evaluation-matrix/). These define the route; live Git
and CI evidence determines the current state.

## State placement

Tracked source owns decisions, schemas, fixtures, maintainer policy, and this
handoff. GitHub owns review and CI evidence. Immutable manifests own consumer
revision identity. Machine-local watcher, lease, cache, retry, cursor, process,
and SQLite state belongs outside the repository under the Sumi Docs user-data
root. Never create product state in the parent `.sumi` workspace container.

## Stop conditions

Do not release when any required gate is red, the candidate commit is ambiguous,
the source tree is dirty, provenance cannot be reproduced, the executable is
unsigned without an explicit accepted exception, or human acceptance is absent.
