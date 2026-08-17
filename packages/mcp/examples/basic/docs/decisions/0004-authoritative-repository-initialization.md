# ADR-0004: Initialize authoritative repositories from verified source state

- Status: Accepted
- Date: 2026-08-14
- Owners: Sumi Docs maintainers
- Amends: [ADR-0002](0002-polyrepo-and-package-manager.md)

## Context

The Sumi-Docs-MCP working copy arrived without a `.git` directory or
linked-worktree marker. No local object database, remote refs, tags, or commit
topology could be recovered. Historical phase notes and development-session
records are content evidence, not Git provenance.

ADR-0002 correctly prohibited inventing a replacement repository while the
owner's intent and authoritative remote were unknown. The owner has now
explicitly authorized this verified source state to become the new authoritative
repository and has authorized creation of both GitHub remotes.

The website already has three focused local commits and no configured remote.
Its history has been inspected and does not require rewriting.

## Decision

Initialize Sumi-Docs-MCP on `main` as a new repository and record the complete
verified source tree as one initial import. Preserve the existing
`sumi-docs-web` history. Create independent GitHub repositories under
`starSumi` and publish each `main` branch without force pushing.

The MCP initial commit is a provenance boundary, not a reconstruction of missing
history. Do not synthesize earlier commits from phase reports, timestamps,
session logs, or file contents. Do not claim authorship for changes whose
original Git metadata is unavailable.

Configure the remotes privately first, push and read back the exact branch tips,
then make the source repositories public only after security reporting and
repository settings are ready. Enable CI, dependency security features, protected
default branches, and private vulnerability reporting where the GitHub plan
supports them.

Publishing source does not approve a product release. Do not create a release
tag, npm publication, deployed documentation site, or GitHub Release until the
documented human acceptance gate passes. The open SEA cold-start limit remains a
release blocker unless it is fixed or receives a recorded exception.

## Consequences

- Published history begins at an explicit, reviewable initial-import boundary.
- The missing earlier object database remains unavailable and is not imitated.
- Future changes use Conventional Commits, repository hooks, CI, and GitHub
  branch policy.
- The sibling repositories retain independent lockfiles, histories, and release
  lifecycles from ADR-0002.
- Any future history rewrite applies only to commits created after this boundary
  and follows the guarded workflow in `docs/git-workflow.md`.

## Rollback

Before the first push, rollback is removal of the newly created local Git
metadata and empty remotes, provided no collaborator has consumed them. After a
push, preserve the published initial commit; correct source or policy through new
reviewed commits. Do not rewrite the boundary merely to improve cosmetics.
