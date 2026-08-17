---
title: Configuration
description: Separate document sources, public page URLs, and transport settings.
---

The CLI is configured with arguments, not environment variables:

```text
sumi-docs-mcp serve <docs-source> [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
```

## Source and page URL

`<docs-source>` selects what the machine reads. It may be a local directory or
a remote HTTPS manifest/base URL.

`--base-url` selects what a person opens when an MCP result contains a URL. It
does not host content and it does not change the MCP transport. Markdown
extensions are removed, and a final `index.md` or `index.mdx` maps to its
directory page.

## Development and distribution

| Mode                  | Entry point                       | Purpose                                           |
| --------------------- | --------------------------------- | ------------------------------------------------- |
| Source development    | `npm run dev`                     | Work on TypeScript against the checked-in example |
| Node distribution     | `node dist/index.js`              | Run the compiled package                          |
| Standalone executable | `artifacts/bin/sumi-docs-mcp.exe` | Run without an external Node installation         |

There are no required application environment variables. Source changes require
a process restart because each server keeps one read-only corpus snapshot.
