# Sumi Docs Web

Human-facing documentation for Sumi-Docs-MCP, built with Astro and Starlight.
The site also publishes the strict raw-document manifest consumed by the MCP
server's remote source mode. The checked-in product, operations, development,
and release handbook is the showcase corpus: an MCP client can answer project
questions from the same reviewed source people browse.

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

For a local two-project demonstration, build this site, serve `dist/`, then
launch Sumi-Docs-MCP with the local `/_mcp/` URL as its source and the site root
as `--base-url`. The cross-project command below automates that full round trip.

When the sibling MCP checkout is built, exercise the complete boundary locally:

```powershell
npm run verify:mcp
```

## Deployment candidates

Production candidates require an explicit public HTTPS origin:

```powershell
$env:SITE_URL = "https://docs.example.com"
npm run verify:release
```

The manual `Site candidate` workflow builds an immutable static archive for a
specific commit, records its checksum, and attaches GitHub provenance. It does
not deploy the site. See [docs/deployment.md](docs/deployment.md) for the human
acceptance and rollback procedure.

## Architecture

The site is intentionally a separate project from Sumi-Docs-MCP. They share a
versioned publishing contract, not runtime source packages. See
[ADR-0001](https://github.com/starSumi/Sumi-Docs-MCP/blob/main/docs/decisions/0001-astro-starlight-dual-surface.md)
and
[ADR-0002](https://github.com/starSumi/Sumi-Docs-MCP/blob/main/docs/decisions/0002-polyrepo-and-package-manager.md).
[ADR-0003](https://github.com/starSumi/Sumi-Docs-MCP/blob/main/docs/decisions/0003-localized-content-projection.md)
keeps manifest v1 path-only and defines the compatibility boundary for a future
structured locale projection.

## Project policy

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[CHANGELOG.md](CHANGELOG.md), [docs/README.md](docs/README.md), and
[LICENSE](LICENSE).
