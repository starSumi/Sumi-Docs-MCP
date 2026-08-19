---
title: Release readiness checklist
description: Blocking checks for acceptance candidates, human review, and product promotion.
---

# Release readiness checklist

Use this as a template. Completed evidence belongs in a commit-bound check,
pull request, or candidate artifact. Do not commit a permanently checked copy.

## Change readiness

- [ ] Scope, owner, affected contracts, and rollback are explicit.
- [ ] The current source commit and worktree state were verified.
- [ ] Public behavior changes have a failing test and documentation update.
- [ ] English and Simplified Chinese catalog variants are complete.
- [ ] No client/session state or source mutation entered the MCP data plane.

## Acceptance candidate

- [ ] Exact-path staging excludes local sessions, logs, credentials, caches, and generated output.
- [ ] Dependency lock host policy and official-registry audits pass.
- [ ] The pinned root Oxlint policy and independent TypeScript compiler gates pass.
- [ ] The duplicate-code gate remains within its reviewed repository threshold.
- [ ] Root verify, cross-product integration, MCP smoke, and package previews pass on Node.js 25.5 or newer.
- [ ] Candidate build runs without OIDC or attestation write permission.
- [ ] The candidate source is the latest protected `main` commit and remains current before promotion.
- [ ] Immutable Web/MCP artifacts, digests, provenance, and raw performance evidence are retained.
- [ ] Failed signing or cold-start gates are recorded as blockers, not converted to success.

## Human acceptance

- [ ] The owner inspected the site on desktop and mobile and exercised the MCP example.
- [ ] Security, privacy, accessibility, i18n, rollback, and operational handoff were reviewed.
- [ ] Every exception names its scope, risk owner, expiry, and rollback.
- [ ] The owner recorded accept or reject against one exact commit and artifact digest set.

## Product promotion

- [ ] Git author, committer, and tagger metadata meet the public privacy policy across all retained refs.
- [ ] History rewrite, if selected, was rehearsed from a disposable clone and verified before lease-protected push.
- [ ] Required remote rules, checks, environment protection, signing, SBOM, and provenance are available and read back.
- [ ] The accepted commit is tagged and published without source changes.
- [ ] Release, package, site, and binary checksums are read back; rollback remains available.

Public source visibility is not a product release. Tags, packages, deployments,
and production binaries remain blocked until their release gates pass.
