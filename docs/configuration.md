---
title: Configuration
description: Configure source discovery, public page URLs, runtime modes, and state placement.
---

The CLI accepts explicit arguments and a strict tracked project config:

```text
sumi-docs-mcp serve [docs-source] [--config <path>] [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
sumi-docs-mcp doctor [docs-source] [--config <path>] [--json] [--show-paths]
```

Resolution order is explicit CLI source, explicit `--config`, the nearest
`sumi-docs.config.json` within the current Git boundary, then the trusted project
root `docs/`. In a directory without Git, discovery does not walk upward.

When an explicit CLI source selects a remote manifest, a configured local
`openapi` path belongs to the replaced local source and is ignored. An explicit
CLI `--openapi` remains invalid in remote mode; declare it in the manifest.

## Source and page URL

`docs-source` selects what the machine reads. It may be a local directory or a
remote HTTPS manifest/base URL.

`--base-url` selects what a person opens when an MCP result contains a URL. It
does not host content and does not change the MCP transport. Markdown extensions
are removed, and a final `index.md` or `index.mdx` maps to its directory page.

## Development and distribution

| Mode                   | Entry point                                    | Purpose                                           |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------- |
| MCP source development | `pnpm --filter @sumi-os/docs-mcp dev`          | Work on TypeScript against the checked-in example |
| Web source development | `pnpm --filter @sumi-os/docs-web dev`          | Serve the local Starlight site with reload        |
| Node distribution      | `node packages/mcp/dist/index.js`              | Run the compiled package from this workspace      |
| Standalone executable  | `packages/mcp/artifacts/bin/sumi-docs-mcp.exe` | Run without an external Node installation         |

There are no required application environment variables. `SITE_URL` belongs to
the Web release build, not MCP runtime configuration. Source changes require a
process restart because each server keeps one read-only corpus snapshot.

`doctor` reports project-relative paths and explicit external placeholders by
default. `--show-paths` reveals resolved local paths for interactive diagnosis
only; credentials and stack traces remain redacted. The flag is rejected by
`serve`.

## State placement

Do not create a product `.sumi/` directory. The parent folder may already be an
operator workspace container. Tracked defaults belong in
`sumi-docs.config.json`; future mutable cursor, cache, lease, checkpoint, or
database state belongs in the platform user-data directory outside the repo.
