---
title: Releasing
description: Build, review, promote, and roll back an immutable site candidate.
---

Source publication and a product release are separate events. A commit may be
public while no npm package, deployed site, tag, or GitHub Release exists.

Build a production candidate with an explicit public origin:

```powershell
$env:SITE_URL = "https://docs.example.com"
npm run verify:release
```

The manual `Site candidate` workflow accepts an exact 40-character commit SHA,
runs the release suite, and uploads a static archive, SHA-256 checksum, and
GitHub artifact provenance. It does not deploy the site.

A person must verify both languages, all theme modes, canonical URLs, the
machine manifest, raw documents, OpenAPI output, every mapped page, and the MCP
cross-project check. Record the accepted commit, workflow run, origin, checksum,
tester, and time before promotion.

Keep the previously accepted immutable artifact. Roll back by restoring that
artifact or deployment, then verify the root, localized routes, and `/_mcp/`
projection again.
