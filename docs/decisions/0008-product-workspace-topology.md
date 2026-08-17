# ADR-0008: Unify the product in an npm workspace

- Status: Accepted
- Date: 2026-08-17
- Owners: Sumi Docs maintainers
- Supersedes: [ADR-0002](0002-polyrepo-and-package-manager.md)

## Context

ADR-0002 required a real shared package, atomic changes, or repeated cross-repo
coordination before reconsidering separate repositories. Those triggers now
exist. Manifest v2 requires one schema, fixtures, producer conformance tests,
and consumer conformance tests. Website and MCP changes have repeatedly landed
as paired commits, and website verification currently depends on a hard-coded
sibling checkout path.

The product is still small: two applications and one narrow contract package.
There is no evidence that a remote build cache, a cross-language hermetic graph,
or a second package manager would recover its operational cost.

## Decision

Create one private product repository with this ownership layout:

```text
apps/web/                   # Astro and Starlight human surface and publisher
packages/mcp/               # headless MCP server and distributable CLI
packages/corpus-contract/   # JSON Schema, fixtures, canonicalization, conformance
examples/product-docs/      # executable self-documenting product corpus
```

Use npm workspaces and one root lockfile. Keep MCP and Web as independently
versioned and independently releasable artifacts. Root scripts provide the
cross-product build and conformance gates; package scripts remain usable within
their owning workspace.

The contract package contains data schemas, canonicalization, fixtures, and
pure validation only. It must not contain Astro rendering, trusted MDX
execution, MCP transport, filesystem acquisition, or the MCP parser. Sharing a
repository does not merge the Web and MCP trust boundaries.

Preserve both existing Git histories when importing them. The existing private
repositories remain available and unarchived during migration and human
acceptance. Archival, redirects, tags, or public release require a later explicit
acceptance step.

Do not introduce Turborepo, Bazel, or Nix for this migration. Reconsider a task
runner when measured CI scheduling or cache duplication is material. Consider
Bazel only with at least ten independently built packages, or a critical path
over ten minutes with at least 60 percent cacheable work and a trial showing at
least 30 percent improvement. Nix may be an optional Linux environment only
after repeated environment drift; native Windows build, SEA, and signing remain
required.

## Consequences

Schema and fixture changes become atomic, cross-product CI no longer assumes a
sibling directory, and one project-level agent integration can describe the
whole product. The repository has a larger checkout and a shared dependency
lock, while artifact release decisions remain separate.

## Validation and rollback

Migration is accepted only when imported history is visible, both package
builds pass from a clean root install, package-local commands still work,
v1/v2 conformance runs without sibling paths, npm package boundaries are
unchanged, and the website preview serves the full product corpus. Until human
acceptance, rollback is continued use of the two unchanged private repositories.
