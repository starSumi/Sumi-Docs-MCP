---
title: Getting started
description: Run Sumi-Docs-MCP against local documentation or this published corpus.
---

Sumi-Docs-MCP exposes documentation through four read-only tools: list, search,
fetch, and OpenAPI lookup. It communicates with MCP clients over stdio.

## Local corpus

Build the MCP server, then point it at a Markdown or MDX directory:

```powershell
npm run build
node dist/index.js serve C:\docs\product --openapi C:\docs\product\openapi.json
```

The process waits for JSON-RPC input from an MCP client. Opening the executable
directly only prints help and exits; that is expected CLI behavior.

## Published corpus

After this site is deployed, use the machine projection as the source and the
site root for links that people can open:

```powershell
node dist/index.js serve https://docs.example.com/_mcp/ --base-url https://docs.example.com/
```

Remote mode still uses stdio for MCP traffic. HTTPS is used only to download the
read-only documentation snapshot.

## Client configuration

Configure the MCP client to launch `node` or the standalone executable with the
same `serve` arguments. Always use absolute paths for local files because GUI
clients may start processes from an unrelated working directory.
