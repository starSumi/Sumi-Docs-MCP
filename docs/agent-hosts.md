---
title: Agent host integration
description: Connect Codex, Claude Code, and VS Code without making a Skill mandatory.
---

# Agent host integration

Build once after cloning the repository:

```powershell
pnpm install --frozen-lockfile
pnpm run build
node packages/mcp/dist/index.js doctor --json
```

The repository then exposes the same stdio server through each host's native,
reviewable project configuration.

| Host        | Project configuration | Trust behavior                                                 |
| ----------- | --------------------- | -------------------------------------------------------------- |
| Codex       | `.codex/config.toml`  | Project configuration is applied only for a trusted project.   |
| Claude Code | `.mcp.json`           | Project-scoped servers require approval before use.            |
| VS Code     | `.vscode/mcp.json`    | The editor asks before starting workspace-defined MCP servers. |

Open the repository root as the workspace. Codex uses the pnpm workspace
launcher so the command also works when a session starts in a nested directory.
Claude Code and VS Code use their documented project-root variables to launch
the compiled entry without a package-manager stdout wrapper.

After changing configuration or rebuilding the MCP package, restart the MCP
server in the host. The server keeps one process-local, read-only corpus
snapshot and does not live reload.

## No-Skill fallback

The host configuration is sufficient. An agent can call `list_docs`, search by
keyword, fetch an exact listed path, and inspect OpenAPI without loading a
Skill. MCP initialization instructions describe that workflow and its
read-only, snapshot-based limits.

The optional `$sumi-docs-maintain` Skill is only a maintenance router. It helps
an agent decide which package and validation gates own a repository change. It
is not a protocol dependency and does not write documentation through MCP.

## Defaults and navigation

With no CLI source, `sumi-docs.config.json` selects root `docs/`. Without that
file, discovery falls back to the nearest trusted Git project root's `docs/`
directory. Outside Git it never walks upward, so the parent `.sumi` workspace
container cannot be mistaken for product state.

MCP has no presentation navigation: `list_docs` returns every Markdown or MDX
path in deterministic order. The website uses the reviewed catalog for labels,
order, locale pairs, and routes. A new root documentation file intentionally
breaks the Web omissions gate until it is registered in both locales.
