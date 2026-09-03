---
title: Releasing
description: Build, review, promote, and roll back an immutable site candidate.
---

Source publication and product release are separate events. A commit may be
public while the deployed site, tag, or GitHub Release does not exist. npm
package publication is an independent, authenticated gate.

Publish packages in dependency order: release
`@sumi-labs/corpus-contract` first, verify its exact registry version, tarball,
and installability, then release `@sumi-labs/docs-mcp`. The MCP package
consumes the contract at runtime, so its publication must follow that readback.

Build a production candidate with an explicit public origin:

```powershell
$env:SITE_URL = "https://docs.example.com"
$env:BASE_PATH = "/"
pnpm --filter @sumi-labs/docs-web verify:release
pnpm run verify:integration
```

The manual `Acceptance candidate` workflow accepts an exact 40-character commit
SHA, public origin, and deployment base path from the latest `main`, runs the
release suite without OIDC or
attestation authority, and uploads static archives, SHA-256 checksums, raw
performance evidence, project and runtime licenses, third-party notices, and a
CycloneDX component inventory. It does not deploy the site.

Provenance attestation is a separate protected job. It runs only when the
repository variable `ENABLE_ATTESTATION` is `true` and the
`candidate-attestation` environment is available and protected. Keep the
variable unset when the repository cannot enforce that boundary;
a skipped attestation remains an open release gate, not a successful one.

A person must verify both languages, all theme modes, canonical URLs, the
machine manifest, raw documents, OpenAPI output, every mapped page, and the MCP
cross-project check. Record the accepted commit, workflow run, origin, checksum,
tester, and time before promotion.

Keep the previously accepted immutable artifact. Roll back by restoring that
artifact or deployment, then verify the root, localized routes, and `/_mcp/`
projection again.

The `Documentation site` workflow separately deploys the latest verified
`main` commit to GitHub Pages. It derives the origin and base path from the Pages
configuration and verifies the complete rendered site and MCP projection before
upload. A Pages deployment does not publish the npm package, Windows executable,
Git tag, or GitHub Release.
