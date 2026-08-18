---
title: Architecture
description: Separate the human presentation plane from the read-only MCP data plane.
---

The website, MCP server, and corpus contract are independently owned packages
in one pnpm workspace. Web and MCP have separate build and release lifecycles;
only schemas, canonicalization, and conformance helpers are shared.

The human surface keeps English at the root for stable existing links and
serves a complete Simplified Chinese translation at `/zh-cn/`. Starlight's
language selector switches between equivalent pages, while its theme selector
supports light, dark, and automatic system preference. These presentation
features do not change the MCP manifest or stdio protocol.

Manifest v1 represents Chinese machine documents with explicit
paths such as `zh-cn/getting-started.md`. MCP clients can fetch that exact path,
but v1 does not expose locale metadata, negotiation, or fallback. Manifest v2
is published in parallel with stable document IDs, explicit locale and route,
content digests, navigation data, source provenance, and an immutable revision.

```text
reviewed docs/ + content catalog + OpenAPI
        |
        +-- Astro + Starlight -> rendered pages and Pagefind
        |
        +-- publishing integration -> v1 + immutable v2 snapshot
                                              |
                                              v
                                      Sumi-Docs-MCP over stdio
```

## Ownership

The website owns rendering, navigation, accessibility, browser search, and the
published corpus projection. The corpus-contract package owns pure manifest
validation and canonicalization. Sumi-Docs-MCP owns bounded acquisition,
non-executing document parsing, public tools, input validation, and stdio
transport.

## Workspace boundary

The workspace makes producer and consumer contract changes atomic without
combining their trust models. Web never imports the MCP parser or transport,
and MCP never executes Astro or trusted MDX. The reviewed content catalog is the
only source for site navigation and projection membership.

## MDX trust boundary

Only reviewed MDX may enter the website build because Astro can execute trusted
component expressions while rendering. Sumi-Docs-MCP treats published MDX as
documentation data and does not evaluate JSX or JavaScript.
