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

## Project Skills and direct MCP use

Codex discovers the reviewed `$sumi-docs-use`, `$sumi-docs-pr`, and
`$sumi-docs-audit` workflows from `.agents/skills/` when their task descriptions
apply. Claude Code can read the same canonical files through the repository
instructions. They cover setup, pull-request preparation, and read-only
repository or release auditing; none is required for ordinary documentation
queries.

## Direct MCP use

The host configuration is sufficient. An agent can call `list_docs`, search by
keyword, fetch an exact listed path, and inspect OpenAPI without loading a
Skill. MCP initialization instructions describe that workflow and its
read-only, snapshot-based limits.

For product usage, architecture, operations, and stable decisions, agents
should query this reviewed projection before scanning documentation files.
Implementation work still uses source and tests as the current authority. The
MCP server limits its own four-tool surface; it does not grant, revoke, or
replace the agent host's filesystem permissions or sandbox.

The agent host is the MCP client. For a remote deployment, a host with
Streamable HTTP support connects to the service URL such as
`https://mcp.example.com/mcp` instead of launching a local process. The tool
names, strict schemas, initialization instructions, and corpus identity remain
the same.

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
