# ADR-0002: Keep the MCP server and documentation site in sibling repositories

- Status: Superseded by [ADR-0008](0008-product-workspace-topology.md)
- Date: 2026-08-13
- Owners: Sumi Docs maintainers
- Extends: [ADR-0001](0001-astro-starlight-dual-surface.md)
- Initialization clause amended by:
  [ADR-0004](0004-authoritative-repository-initialization.md)

## Context

ADR-0001 separates the headless MCP data plane from the human-facing Astro and
Starlight site, but leaves the repository and package-manager topology open.

The MCP server is an npm package with a committed `package-lock.json`, npm
scripts, release checks, Git hooks, and CI definitions. The website is
a new independently deployed static application. The two applications do not
share runtime code, release versions, or an atomic deployment requirement. Their
shared boundary is a versioned content projection: raw documentation, optional
OpenAPI JSON, a strict manifest, and verified page URLs.

A proposal recommended moving both applications into a pnpm workspace, adding
Turborepo, and extracting the MCP parser, VFS, and types into shared packages.
That topology is useful when packages are developed and released as one source
graph. It does not create that need by itself, and it would make the current npm
lockfile, CI, hooks, release process, and repository history part of a migration
before the first website page exists.

The current MCP working directory has no discoverable Git root. It may be a
source-distributed copy or a checkout whose Git metadata is unavailable. A new
repository created here would not recover the missing history.

The `.omc/` directory is operator-local state owned by a Claude development
plugin. It is not an MCP artifact, website package, shared tool, or candidate for
source-code archival.

## Decision

Create `sumi-docs-web` as a sibling project and independent Git repository. Keep
Sumi-Docs-MCP as a single npm package. Use npm and a separate lockfile in each
project.

The expected local topology is:

```text
.sumi/
  Sumi-Docs-MCP/   # headless MCP package and its existing release lifecycle
  sumi-docs-web/   # Astro/Starlight site and its independent deployment
```

The website will be scaffolded from the official Starlight template with
`npm create astro@latest -- --template starlight`. Exact dependency versions are
recorded in its lockfile, not duplicated as prose policy.

The applications integrate through published data, not shared source packages:

1. `sumi-docs-web` owns trusted content and builds rendered pages.
2. Its publishing integration copies a bounded raw corpus and emits the strict
   manifest accepted by Sumi-Docs-MCP.
3. CI starts the compiled MCP server against that published projection and
   verifies all four tools and every mapped human-facing URL.

Do not extract `src/parser`, `src/vfs`, or `src/types` for website reuse. Astro
must compile trusted MDX for rendering while Sumi-Docs-MCP must parse MDX as
untrusted data without execution. Sharing those implementations would obscure a
deliberate trust-boundary difference.

Do not initialize a new Git repository inside the existing Sumi-Docs-MCP working
directory or rewrite its history. Recover or re-clone its authoritative Git
repository before rebasing or publishing. The new website has no prior history,
so it may initialize a new repository on `main` after its scaffold is verified.

This restriction applied while repository ownership and provenance were
unknown. ADR-0004 records the owner's later authorization to establish a new
authoritative history from the verified source state; it does not reinterpret
the missing history as recovered.

Keep `.omc/` in place and ignored. Do not move it into `tools/`, a workspace, or
an archive. Keep `dist/`, `.sea/`, and `artifacts/` as ignored lifecycle outputs;
their presence is not a reason to restructure source ownership.

## Reconsideration triggers

Reconsider a monorepo only when evidence shows at least one of these conditions:

- a real source package must be consumed and versioned by both applications;
- routine changes cannot be made safely without atomic commits across both
  repositories;
- releases must be versioned and promoted as one unit; or
- measured CI time or dependency duplication justifies a shared task graph.

If a monorepo is later approved, choose its package manager and task runner in a
replacement ADR. The migration must cover repository history, lockfiles, local
and CI commands, hooks, release provenance, cache trust, rollback, and package
publishing. pnpm and Turborepo remain candidates, not defaults.

## Consequences

Positive consequences:

- the MCP package keeps its tested dependency and release boundary;
- the website can deploy independently without coupling static-site changes to
  an MCP release;
- each project has one package manager, one lockfile, and one clear owner;
- the content manifest becomes an explicit compatibility contract rather than
  an implicit source-code dependency.

Costs and constraints:

- cross-project compatibility requires an end-to-end test rather than a single
  workspace typecheck;
- coordinated content-contract changes require two reviewed changes;
- local development uses two project directories and two install commands.

## Alternatives considered

### pnpm workspace with Turborepo now

Rejected for the initial implementation. There is no shared package graph or
atomic release requirement to offset the migration and operational cost.

### npm workspace in the MCP repository

Rejected. Package-manager continuity would reduce migration cost, but the root
repository would still cease to be the headless MCP project described by its
current contract.

### Copy MCP parser and VFS code into the website

Rejected. It would duplicate implementation while conflating two different MDX
trust models.

## Validation and rollback

The decision is validated when:

- each project installs and builds from its own lockfile;
- the website output contains a manifest accepted by the current remote loader;
- a compiled MCP process can list, search, fetch, and read OpenAPI from the
  website build through HTTP; and
- all manifest page URLs resolve successfully.

Before the website is published, rollback consists of removing the independent
website project. Sumi-Docs-MCP requires no package-manager or runtime rollback
because this decision does not change it.
