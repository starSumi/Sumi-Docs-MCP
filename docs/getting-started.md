---
title: Getting started
description: Run Sumi-Docs-MCP against this repository, another local corpus, or a published corpus.
---

Sumi-Docs-MCP exposes documentation through four read-only tools: list, search,
fetch, and OpenAPI lookup. It communicates with MCP clients over stdio.

## This repository

Install and build from the workspace root:

```powershell
pnpm install --frozen-lockfile
pnpm run build
node packages/mcp/dist/index.js doctor --json
node packages/mcp/dist/index.js serve
```

The tracked project config selects root `docs/`. The process then waits for
JSON-RPC input from an MCP client. See [Agent host integration](../agent-hosts/)
for the checked-in Codex, Claude Code, and VS Code adapters.

To serve another local Markdown or MDX corpus, pass its directory explicitly:

```powershell
node packages/mcp/dist/index.js serve ./product-docs --openapi ./product-docs/openapi.json
```

Opening the executable directly only prints help and exits; that is expected
CLI behavior.

## Published corpus

After a site is deployed, use its machine projection as the source and the site
root for links that people can open:

```powershell
node packages/mcp/dist/index.js serve https://docs.example.com/_mcp/ --base-url https://docs.example.com/
```

Remote mode still uses stdio for MCP traffic. HTTPS is used only to download the
bounded, read-only documentation snapshot. It does not crawl the site.

## Client configuration

Configure an MCP client to launch `node` or the standalone executable with the
same `serve` arguments. Prefer the host's project-root variable or the npm
workspace launcher over a machine-specific absolute path.
