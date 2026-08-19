# Deployment

The site is a static Astro build. The root `Documentation site` workflow deploys
the latest verified `main` commit to GitHub Pages. The separate `Acceptance
candidate` workflow prepares immutable review artifacts without deploying them.

## Prerequisites

- Configure the repository's authoritative GitHub remote.
- Protect the default branch and require both `CI` operating-system jobs.
- Enable private vulnerability reporting.
- Enable GitHub Pages with GitHub Actions as its source.
- Keep the `github-pages` environment restricted to the protected `main`
  branch.
- Configure the hosting environment separately from local `.env` files.

## GitHub Pages deployment

For this repository, `SITE_URL` is the HTTPS origin and `BASE_PATH` is the
project path:

```text
SITE_URL=https://starsumi.github.io
BASE_PATH=/Sumi-Docs-MCP/
```

The workflow obtains both values from `actions/configure-pages`, verifies the
site and MCP projection under that exact prefix, and uploads only
`apps/web/dist`. A freshness check immediately before upload prevents a
superseded `main` commit from becoming the deployment artifact. The deploy job
holds Pages and OIDC authority but does not check out or execute repository
code.

## Build a candidate

Run the root manual `Acceptance candidate` workflow from the exact latest
`main` commit under test. Enter the full 40-character commit SHA and the public
HTTPS origin and deployment base path. The workflow rejects a SHA that differs
from its dispatch ref or current `main`, installs the committed lockfile,
validates `SITE_URL` and `BASE_PATH`, runs the full product suite, and packages
the Web and MCP outputs for 14 days.

The workflow emits:

- `sumi-docs-web-<commit>.zip` and `sumi-docs-mcp-<commit>.zip`;
- SHA-256 checksums and raw cold-start evidence; and
- protected GitHub provenance only when the repository and the root
  `candidate-attestation` environment enforce that boundary.

It does not deploy or modify repository contents. A skipped attestation remains
an open release gate.

## Human acceptance

Download and verify the candidate from the workflow run. Extract it into a
temporary directory and serve that directory through the intended hosting or a
local static server. Check at minimum:

- English and Simplified Chinese navigation and equivalent-page switching;
- light, dark, and automatic theme modes on desktop and mobile;
- canonical URLs and the sitemap use the intended public origin;
- every route in `_mcp/sumi-docs-routes.json` resolves;
- `_mcp/sumi-docs-manifest.json`, raw documents, and OpenAPI JSON are public;
- `_mcp/v2/current.json` verifies the referenced immutable manifest bytes and
  every document digest under its snapshot;
- Sumi-Docs-MCP passes `pnpm run verify:mcp` against the candidate.

Record the accepted commit SHA, workflow run ID, origin, checksum, tester, and
acceptance time. Do not promote a locally rebuilt directory in place of the
accepted candidate.

## Promotion and rollback

For GitHub Pages, roll forward by merging a verified change to `main`; the Pages
workflow rebuilds that exact commit. For another host, publish the accepted
archive or reproduce the same commit, lockfile, Node version, `SITE_URL`, and
`BASE_PATH`. Verify the deployed URLs before changing DNS or announcing
availability.

Keep the previously accepted archive and its deployment identifier. Do not
mutate a deployed snapshot directory or promote a build whose source-drift gate
failed. Roll back
by restoring that immutable artifact or deployment, then verify the root,
localized routes, and machine projection. Content-contract changes that break
the current MCP manifest require their own ADR and coordinated rollback plan.
