# ADR-0009: Keep reconciliation state outside the MCP data plane

- Status: Accepted
- Date: 2026-08-17
- Owners: Sumi Docs maintainers
- Extends: [ADR-0006](0006-immutable-content-projection.md)

## Context

Source files can change while agents, humans, CI, and publishers work at
different times. A Skill cannot guarantee that every writer announces a change,
and a filesystem watcher cannot establish authorship. Putting mutable workflow
state in the MCP server would make responses depend on sessions and undermine
its read-only, stateless contract.

Reliable reconciliation separates ordered append-only evidence from rebuildable
query projections and records explicit lifecycle acknowledgements. Sumi Docs
uses that separation without adopting a conversation or session-state schema.

## Decision

Use these sources of truth, in order:

1. reviewed source and Git provenance;
2. a sealed immutable corpus manifest and its content digests;
3. a mutable locator that selects the accepted revision;
4. rebuildable operational projections and client-held cursors.

The MCP process reads one accepted corpus revision and exposes it to many
consumers. It does not own writer leases, edit attribution, merge resolution,
agent memory, or publication checkpoints.

The initial implementation uses deterministic `doctor` and status probes plus
the immutable manifest. It does not require a database. If continuous watching,
queued reconciliation, or crash recovery is later implemented, it belongs in a
separate local controller with:

- an append-only change-event log;
- one logical writer lease with owner, expiry, and fencing token;
- SQLite in WAL mode as a rebuildable index of components, checkpoints,
  publication attempts, and consumer-independent health;
- explicit `flush`, `checkpoint`, and `shutdown` acknowledgements;
- idempotent replay and compare-and-set promotion of a complete deployment
  artifact through the hosting provider's generation or ETag contract.

The default machine-state root is the platform user data directory under a
product-specific `SumiDocs` name. `SUMI_DOCS_STATE_HOME` may override it. The
controller must reject a root that resolves to a repository, a parent `.sumi`,
or an agent host configuration directory. Project source contains no live WAL,
lease, cache, or database files.

Controller components use an explicit lifecycle contract:

```text
component = id + requires + provides + scope + start + dispose
state = pending | starting | active | failed | stopping | disposed
```

Watchers, publishers, reconcilers, and caches must register reversible cleanup.
A dynamic plugin container is not justified for the four-tool MCP server.

Source changes move operational status to `SOURCE_CHANGED`; they do not stop an
already verified snapshot. A successful reconcile validates and atomically
promotes the next revision. Conflicts are reported with both revisions and
require a declared policy; last-writer-wins is not the default.

## Durable maintenance records

Tracked maintainer ownership, release policy, architecture decisions, and the
human handoff belong in repository documentation. Current CI health belongs in
GitHub checks and issues. Transient PID, watcher, queue, cursor, and local retry
state belongs in the external control-plane directory. A committed timestamp is
not treated as live health merely because it is recent.

## Validation and rollback

Status tests cover clean, changed, invalid, stale, and failed-refresh states.
Any future controller must pass single-writer fencing, crash/replay, duplicate
event, out-of-order observation, process death, lock timeout, database rebuild,
and two-consumer tests. Removing the controller leaves source, sealed manifests,
and stateless MCP consumption intact.
