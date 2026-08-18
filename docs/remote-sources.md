---
title: Remote sources
description: Publish a bounded manifest for read-only remote documentation.
---

Remote mode downloads an immutable documentation snapshot from a strict manifest.
It does not crawl a website and does not add an HTTP MCP transport.

## Manifest

This site generates `_mcp/sumi-docs-manifest.json` during every production build:

```json
{
  "version": 1,
  "documents": ["getting-started.md", "configuration.md"],
  "openapi": "openapi.json"
}
```

Document paths are restricted relative Markdown or MDX paths. OpenAPI is an
optional restricted relative JSON path. Unknown fields, duplicates, redirects,
oversized responses, and cross-origin paths are rejected by Sumi-Docs-MCP.

The same build also emits `_mcp/v2/current.json` and immutable, digest-addressed
snapshots. Prefer the exact v2 locator when integrity verification is required:

```powershell
node packages/mcp/dist/index.js serve http://127.0.0.1:4321/_mcp/v2/current.json --base-url http://127.0.0.1:4321/
```

The MCP loader verifies the canonical manifest, revision, byte counts, and
SHA-256 digests. Directory and v1 manifest URLs remain supported for backward
compatibility.

## Human routes

The adjacent `_mcp/sumi-docs-routes.json` maps each corpus path to a rendered
page. It is a deployment verification artifact, not part of the MCP manifest
protocol. The build fails when a mapped page or raw source is missing.

## Local exercise

Build and preview this site, then use the local machine projection:

```powershell
pnpm run build
pnpm run preview
node dist/index.js serve http://127.0.0.1:4321/_mcp/ --base-url http://127.0.0.1:4321/
```

Loopback HTTP is accepted for development. Production remote sources require
HTTPS and do not support credentials, cookies, redirects, query strings, or
fragments.
