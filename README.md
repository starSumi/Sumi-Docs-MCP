# Sumi Docs

English | [简体中文](README.zh-CN.md)

Sumi Docs publishes one reviewed documentation corpus for two consumers:

- people browse an Astro and Starlight website;
- agents query the same corpus through a read-only MCP server.

This repository is private and under active development. It is not yet a public
release.

## Prerequisites

- Node.js 25.5.0 or newer
- pnpm 10.26.0 through Corepack or the version declared in `packageManager`
- a trusted checkout when loading repository-provided agent host configuration

## First Run

```powershell
pnpm install --frozen-lockfile
pnpm run build
node packages/mcp/dist/index.js doctor --json
```

Doctor reports project-relative paths or external-source placeholders by
default. Add `--show-paths` only for local diagnosis; do not attach that output
to public issues or build artifacts.

The checked-in `sumi-docs.config.json` selects root `docs/` and the example
OpenAPI document. Start the human site with:

```powershell
pnpm --filter @sumi-os/docs-web dev
```

Open `http://127.0.0.1:4321`. Codex, Claude Code, and VS Code project adapters
are described in [Agent host integration](docs/agent-hosts.md). They expose the
four MCP tools without requiring the optional maintainer Skill.

## Workspace

```text
apps/web/                   Astro/Starlight site and corpus publisher
packages/mcp/               stdio MCP server and CLI
packages/corpus-contract/   manifest schemas and conformance fixtures
docs/                       product handbook and default corpus
```

| Mode                     | Command                                 | Purpose                                        |
| ------------------------ | --------------------------------------- | ---------------------------------------------- |
| Web development          | `pnpm --filter @sumi-os/docs-web dev`   | Local browser site with reload                 |
| MCP development          | `pnpm --filter @sumi-os/docs-mcp dev`   | TypeScript server against its example corpus   |
| Production build         | `pnpm run build`                        | Build contract, MCP, and static site           |
| Compiled MCP             | `node packages/mcp/dist/index.js serve` | Serve the discovered project corpus over stdio |
| Validation               | `pnpm run verify`                       | Package quality, tests, and dependency gates   |
| Cross-product validation | `pnpm run verify:integration`           | Exercise the generated Web corpus through MCP  |

There are no required runtime secrets or application environment variables.
`SITE_URL` is required only for a release-site candidate. Generated output,
local state, logs, caches, and `.env` files remain ignored.

Package-specific instructions remain in each workspace. Active architecture
decisions live under `packages/mcp/docs/decisions/`; the root handbook presents
their user-facing consequences without duplicating the decision records.

No tag, package publish, visibility change, or public release is allowed before
the documented human acceptance gate.
