---
title: Releasing
description: Build, review, promote, and roll back an immutable site candidate.
---

Source publication and a product release are separate events. A commit may be
public while no npm registry package, deployed site, tag, or GitHub Release exists.

Build a production candidate with an explicit public origin:

```powershell
$env:SITE_URL = "https://docs.example.com"
pnpm --filter @sumi-os/docs-web verify:release
pnpm run verify:integration
```

The manual `Acceptance candidate` workflow accepts an exact 40-character commit
SHA from the latest `main`, runs the release suite without OIDC or
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
