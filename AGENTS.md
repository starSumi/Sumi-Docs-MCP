# Sumi Docs Workspace Instructions

## Product contract

This workspace owns the Sumi Docs product. It contains a read-only MCP server,
an Astro/Starlight website, and a versioned corpus contract. Source visibility
does not authorize a tag, package, deployment, binary release, or archival of
predecessor repositories.

## Ownership

- `packages/mcp/`: headless, stateless, read-only MCP data plane.
- `apps/web/`: trusted content rendering and corpus publication.
- `packages/corpus-contract/`: pure schemas, canonicalization, fixtures, and
  conformance helpers. No transport, filesystem, Astro, or parser behavior.
- `docs/`: reviewed product documentation and default self-hosted corpus.
- `.codex/`, `.mcp.json`, `.vscode/`: thin project MCP adapters only.

Nested `AGENTS.md` files continue to govern package-specific security and
validation. The root contract wins for workspace topology and cross-package
commands.

## Invariants

- Preserve manifest v1 at its existing URL and shape while v2 is introduced in
  parallel.
- Web and MCP keep different MDX trust models; do not share their parsers.
- MCP requests never depend on client identity, session history, or mutable
  workflow state.
- Mutable controller state never lives in `.sumi/`, the repository, or an agent
  host configuration directory.
- Generated projection has one logical publisher. Consumers verify immutable
  revisions and never observe a partially promoted snapshot.
- Do not answer a Sumi Docs status question from a stale report when current
  source, tests, GitHub checks, or a status probe is available.

## Commands

Use Node.js 25.5.0 or newer and install from the workspace root:

```powershell
pnpm install --frozen-lockfile
pnpm run verify
pnpm run verify:integration
```

Run package-local commands with `pnpm --filter <name> <script>`. Stage
exact paths only. Keep predecessor repositories private and intact until their
recovery role is deliberately retired.
