---
title: Development
description: Work on the website and verify its contract with Sumi-Docs-MCP.
---

The product uses one pnpm workspace and one root `pnpm-lock.yaml`. Use Node.js
25.5 or newer.
Run installation and cross-product commands from the workspace root.

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sumi-os/docs-web dev
```

Human-facing content lives in the workspace root `docs/`. The reviewed catalog
at `apps/web/src/content-catalog.ts` explicitly binds every stable document ID
and locale to its source, rendered route, and navigation position. Starlight
navigation, manifest v1, the route map, and immutable manifest v2 all derive
from that catalog.

Run the repository gates before committing:

```powershell
pnpm run verify
pnpm run verify:integration
```

`verify` checks formatting, tests, Astro diagnostics, the static build,
route and locale parity, immutable digests, and production dependencies.
`verify:integration` starts the compiled MCP workspace package against the built site,
calls its tools, and checks every returned page URL.

Only reviewed Markdown and MDX may enter the site build. Do not add model
credentials, private documents, authenticated fetching, or browser-side stdio.
Those features require a separately reviewed server boundary.
