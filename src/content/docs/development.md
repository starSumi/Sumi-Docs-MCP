---
title: Development
description: Work on the website and verify its contract with Sumi-Docs-MCP.
---

The website and MCP server are sibling npm projects with independent lockfiles.
Use Node.js 22.12 or newer for the site and Node.js 25.5 or newer for the MCP
server.

```powershell
npm ci
npm run dev
```

Human-facing content lives in `src/content/docs/`. The publishing integration
copies an explicit allowlist into `dist/_mcp/`; it never scans the repository
root. Every published English document has a Simplified Chinese counterpart and
an explicit rendered route in `astro.config.mjs`.

Run the repository gates before committing:

```powershell
npm run verify:push
npm run verify:mcp
```

`verify:push` checks formatting, tests, Astro diagnostics, the static build,
route and locale parity, and production dependencies. `verify:mcp` starts the
compiled sibling server against the built site, calls all four tools, and checks
every returned page URL.

Only reviewed Markdown and MDX may enter the site build. Do not add model
credentials, private documents, authenticated fetching, or browser-side stdio.
Those features require a separately reviewed server boundary.
