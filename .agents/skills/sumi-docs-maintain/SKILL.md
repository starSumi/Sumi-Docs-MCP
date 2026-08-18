---
name: sumi-docs-maintain
description: Maintain the Sumi Docs monorepo after product, protocol, content, build, or release-policy changes. Use when reconciling the reviewed docs corpus, catalog, MCP projection, operational handoff, or release evidence. Do not use merely to query documentation; the MCP tools are the no-Skill fallback.
---

# Sumi Docs Maintainer

Keep the human website and machine-readable corpus aligned without moving
workflow state into the read-only MCP server.

## Start From Current Evidence

1. Read the root and nearest `AGENTS.md` files.
2. Inspect `git status --short --branch`, the current commit, and current checks.
3. Inspect live Git, CI, and candidate artifacts; do not rely on a checked-in
   current-state snapshot.
4. Run `node packages/mcp/dist/index.js doctor --json` after the workspace build.
   Paths are project-relative or redacted by default. Use `--show-paths` only
   for local diagnosis, and never attach that output to a public report.

## Route The Change

- Put reviewed user and maintainer content in root `docs/`.
- Register every English and Simplified Chinese variant in
  `apps/web/src/content-catalog.ts`.
- Keep parser, indexing, source acquisition, and MCP protocol behavior in
  `packages/mcp/`.
- Keep schemas, canonicalization, and conformance fixtures in
  `packages/corpus-contract/`.
- Keep client adapters thin. Do not duplicate MCP behavior in this Skill.
- Keep cursor, watcher, lease, retry, cache, checkpoint, and database state
  outside the repository and outside the parent `.sumi` workspace container.

## Reconcile Documentation

Update both locales when external behavior changes. Preserve manifest v1 while
evolving v2 in parallel. Let the strict catalog omissions check fail rather
than silently publishing an unregistered page. Do not let an agent edit source
documentation through MCP; MCP remains read-only.

When an external collaborator or user edits the repository, compare the new
Git commit and immutable corpus revision with the last accepted revision. A
future write-capable controller must use a single logical publisher and
compare-and-swap promotion. Do not approximate this with an in-process MCP
session cache.

## Verify And Stop

Run the narrow package test first, then from the workspace root:

```powershell
pnpm run verify
pnpm run verify:integration
pnpm run smoke:mcp
pnpm run pack:mcp
```

For executable changes, also run SEA smoke and the documented cold-start
benchmark. Record a failed performance or signing gate as failed. Never create
a public release, tag, visibility change, or package publish before explicit
human acceptance.
