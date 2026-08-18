---
title: Contributing
description: Take an issue from proposal through review, validation, and merge.
---

This repository owns the human documentation site and the public
machine-readable projection consumed by Sumi-Docs-MCP. A contribution is ready
only when those two surfaces remain consistent in both supported languages.

## Start with an issue

Open an issue before changing the publishing contract, locale or route model,
trusted-content boundary, production dependencies, deployment process, or
Skill and agent integration. Describe the problem, intended external behavior,
alternatives, compatibility impact, and acceptance evidence. Report security
vulnerabilities through `SECURITY.md`, not a public issue.

A direct pull request is appropriate for a narrow content correction, test-only
improvement, or internal fix that preserves public behavior.

## Prepare the pull request

Create a topic branch from the current default branch and keep one conceptual
change in each pull request. Use a draft pull request while the design, content,
tests, or translations are incomplete. Every published English page requires a
Simplified Chinese counterpart and an explicit source-to-route mapping in the
reviewed `apps/web/src/content-catalog.ts` catalog.

Complete the pull request template with:

- what changed, why it is needed, and how it works;
- the related issue or why one was unnecessary;
- content, route, locale, security, dependency, and deployment impact;
- exact validation commands and results;
- rollback steps for operational changes.

Use Conventional Commits. Rebase a private topic branch when it falls behind,
but do not rewrite commits already shared with other contributors.

## Validate the complete projection

Run:

```powershell
pnpm run verify
pnpm run verify:integration
```

`verify:push` checks formatting, tests, Astro diagnostics, the build, locale and
route parity, and production dependencies. `verify:mcp` exercises all four MCP
tools against the built remote corpus and verifies every returned human page
URL. Report any failed or skipped gate explicitly.

Mark a pull request ready only when the required checks pass, the documentation
and changelog are current, and review threads are resolved. GitHub merge commits
are disabled; maintainers choose squash or rebase merge according to whether an
intentional commit sequence adds review value.

Read [Development](/development/), [Releasing](/releasing/), and
[Skills, MCP, and orchestration](/skills-and-orchestration/) for the boundaries
behind these checks.
