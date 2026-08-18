# Contributing

This repository is private while its product and release contracts are being
validated. Coordinate substantive changes through a GitHub issue or pull request
before implementation.

## Local setup

Use Node.js 25.5.0 or newer from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm run lint
pnpm run duplication
pnpm run verify
pnpm run verify:integration
```

Oxlint uses the repository-level `.oxlintrc.json`. TypeScript compiler checks
remain separate and run as part of workspace verification.

Follow the root and nearest nested `AGENTS.md`. Keep changes within the owning
workspace, add a regression test before fixing protocol behavior, and update the
active documentation when a public contract changes.

Use conventional commit messages. The repository rejects automated-agent names
and generated co-author attribution in commit identity or commit text. Pull
requests must state validation evidence, compatibility impact, and rollback.

No contributor may publish a package, create a release tag, change repository
visibility, or archive a predecessor repository before the documented human
acceptance gate is complete.
