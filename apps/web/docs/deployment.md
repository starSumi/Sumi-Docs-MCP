# Deployment

The site is a static Astro build. This repository prepares immutable deployment
candidates but does not select or configure a hosting provider.

## Prerequisites

- Restore or configure the repository's authoritative GitHub remote.
- Protect the default branch and require both `CI` operating-system jobs.
- Enable private vulnerability reporting or publish a private security contact.
- Select the public HTTPS origin. Subpath deployment is not supported by the
  current Astro configuration.
- Configure the hosting environment separately from local `.env` files.

## Build a candidate

Run the manual `Site candidate` workflow from the exact commit under test. Enter
the full 40-character commit SHA and the public HTTPS origin. The workflow
rejects a SHA that differs from its dispatch ref, installs the committed
lockfile, validates `SITE_URL`, runs the full release suite, and packages `dist/`
as a tar archive retained for 14 days.

The workflow emits:

- `sumi-docs-web-<commit>.tar.gz`;
- a SHA-256 checksum for that archive; and
- GitHub artifact provenance for both files.

It does not deploy or modify repository contents.

## Human acceptance

Download and verify the candidate from the workflow run. Extract it into a
temporary directory and serve that directory through the intended hosting or a
local static server. Check at minimum:

- English and Simplified Chinese navigation and equivalent-page switching;
- light, dark, and automatic theme modes on desktop and mobile;
- canonical URLs and the sitemap use the intended public origin;
- every route in `_mcp/sumi-docs-routes.json` resolves;
- `_mcp/sumi-docs-manifest.json`, raw documents, and OpenAPI JSON are public;
- Sumi-Docs-MCP passes `npm run verify:mcp` against the candidate.

Record the accepted commit SHA, workflow run ID, origin, checksum, tester, and
acceptance time. Do not promote a locally rebuilt directory in place of the
accepted candidate.

## Promotion and rollback

Configure the chosen host to publish the accepted archive, or to reproduce the
same commit, lockfile, Node version, and `SITE_URL` when direct artifact
promotion is unavailable. Verify the deployed URLs before changing DNS or
announcing availability.

Keep the previously accepted archive and its deployment identifier. Roll back
by restoring that immutable artifact or deployment, then verify the root,
localized routes, and machine projection. Content-contract changes that break
the current MCP manifest require their own ADR and coordinated rollback plan.
