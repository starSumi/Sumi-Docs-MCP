# Sumi Docs Web

Human-facing documentation for Sumi-Docs-MCP, built with Astro and Starlight.
The site also publishes the strict raw-document manifest consumed by the MCP
server's remote source mode.

English is served from the root path. Simplified Chinese is available under
`/zh-cn/`, with Starlight's language selector connecting equivalent pages.
The built-in theme selector supports light, dark, and automatic system modes;
code blocks follow the selected site theme.

## Development

Requires Node.js 22.12.0 or newer and npm 11.

```powershell
npm ci
npm run dev
```

The local site starts at `http://localhost:4321/` by default.

Development does not require environment variables. A production deployment
sets `SITE_URL` to its public HTTPS origin so canonical links and the sitemap do
not use the loopback default. Start from `.env.example`; do not commit secrets or
machine-specific `.env` files.

## Verification

```powershell
npm test
npm run build
npm run verify:push
```

`npm run build` type-checks the site, builds static output, and verifies the
published manifest, raw corpus, OpenAPI document, route map, and rendered URLs.

The generated machine entry point is:

```text
dist/_mcp/sumi-docs-manifest.json
```

Point Sumi-Docs-MCP at the deployed `_mcp/` URL and use the site root as
`--base-url`.

When the sibling MCP checkout is built, exercise the complete boundary locally:

```powershell
npm run verify:mcp
```

## Architecture

The site is intentionally a separate project from Sumi-Docs-MCP. They share a
versioned publishing contract, not runtime source packages. See ADR-0001 and
ADR-0002 in the Sumi-Docs-MCP project. ADR-0003 keeps manifest v1 path-only and
defines the compatibility boundary for a future structured locale projection.
