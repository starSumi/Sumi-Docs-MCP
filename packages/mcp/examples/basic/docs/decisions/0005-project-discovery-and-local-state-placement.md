# ADR-0005: Discover project documentation without owning `.sumi`

- Status: Accepted
- Date: 2026-08-17
- Owners: Sumi Docs maintainers

## Context

Requiring `serve <docs-source>` is explicit but makes the normal repository
case unnecessarily hard to install. Most repositories already use `docs/`, and
agent hosts need one deterministic way to start the server from a checkout.

The parent of the current repositories is also named `.sumi`. Reusing that name
for project configuration, caches, or cursors would make a workspace container
look like product-owned state and could cause an upward search to select or
modify the wrong directory.

## Decision

Use `docs/` as the convention fallback and `sumi-docs.config.json` as the
tracked project contract. `serve` accepts an optional documentation source.
Resolve it in this order:

1. an explicit CLI source;
2. the `source` in an explicitly selected `--config` file;
3. the `source` in the nearest `sumi-docs.config.json` found from the current
   directory up to and including the nearest Git worktree root;
4. `<project-root>/docs`, where project root is that Git root, or the current
   directory when no Git boundary is present.

When no Git boundary exists, implicit discovery does not walk above the current
directory. Every local path in the config is resolved relative to the config
file and must remain inside that project root. An explicit CLI path remains
valid outside the project root because the operator selected it directly.

The version 1 configuration is a strict JSON object with these optional fields:

```json
{
  "version": 1,
  "source": "docs",
  "openapi": "openapi.json",
  "baseUrl": "https://docs.example.com/"
}
```

Unknown fields are rejected. Command-line options override the corresponding
config value. A missing, unreadable, or empty resolved source is an error; the
server must not silently start with an empty corpus or search another checkout.

Do not create or write a project `.sumi/` directory. The following ownership
split applies:

- tracked contract: `sumi-docs.config.json`;
- optional tracked publication metadata: explicitly named Sumi Docs files,
  never a generic workspace directory;
- rebuildable project output: ignored `artifacts/` or site `dist/`;
- mutable machine state: the platform user-data directory, overridable with
  `SUMI_DOCS_STATE_HOME`.

Codex, Claude Code, and VS Code keep their standard host-owned directories and
configuration files. Sumi Docs must not repurpose `.agents/`, `.claude/`,
`.codex/`, `.vscode/`, or a parent `.sumi/` as its database or cache.

## Consequences

The common `sumi-docs-mcp serve` command works from a repository root with a
`docs/` directory. Nested invocations can find one project contract without
escaping the nearest worktree. Explicit paths and remote manifest URLs remain
backward compatible.

Discovery depends on a well-defined process working directory. Host examples
must set that directory or use an explicit config. Repositories with another
documentation root add the tracked config instead of relying on heuristics.

## Validation and rollback

Tests cover precedence, nested directories, Git worktree files and directories,
no-Git behavior, missing sources, containment, unknown fields, Windows paths,
and the parent `.sumi` collision. Rollback is to require the explicit source
again; explicit invocations do not depend on this convention.
