---
title: Architecture
description: Separate the human presentation plane from the read-only MCP data plane.
---

The website and MCP server are sibling projects with independent dependencies,
Git history, and release pipelines.

The human surface keeps English at the root for stable existing links and
serves a complete Simplified Chinese translation at `/zh-cn/`. Starlight's
language selector switches between equivalent pages, while its theme selector
supports light, dark, and automatic system preference. These presentation
features do not change the MCP manifest or stdio protocol.

The current manifest v1 represents Chinese machine documents with explicit
paths such as `zh-cn/getting-started.md`. MCP clients can fetch that exact path,
but the protocol does not yet expose locale metadata, negotiation, or fallback.
ADR-0003 keeps v1 stable and defines a versioned migration path for those
machine-facing capabilities.

```text
reviewed Markdown / MDX / OpenAPI
        |
        +-- Astro + Starlight -> rendered pages and Pagefind
        |
        +-- publishing integration -> raw corpus + strict manifest
                                      |
                                      v
                              Sumi-Docs-MCP over stdio
```

## Ownership

The website owns rendering, navigation, accessibility, browser search, and the
published corpus projection. Sumi-Docs-MCP owns bounded acquisition, non-executing
document parsing, four public tools, input validation, and stdio transport.

## Why there is no workspace

The projects do not share runtime packages or an atomic release requirement.
Their integration surface is a versioned data contract that can be tested over
HTTP. A pnpm workspace or task runner would add migration and release machinery
without removing a demonstrated bottleneck.

## MDX trust boundary

Only reviewed MDX may enter the website build because Astro can execute trusted
component expressions while rendering. Sumi-Docs-MCP treats published MDX as
documentation data and does not evaluate JSX or JavaScript.
