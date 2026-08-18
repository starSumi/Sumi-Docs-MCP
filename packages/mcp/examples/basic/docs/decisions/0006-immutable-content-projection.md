# ADR-0006: Publish an immutable version 2 content projection

- Status: Accepted
- Date: 2026-08-17
- Owners: Sumi Docs maintainers
- Extends: [ADR-0003](0003-localized-content-projection.md)

## Context

Manifest version 1 is a bounded list of source paths. The website separately
maintains its sidebar, source-to-page mappings, and rendered routes. The MCP
consumer therefore cannot verify that downloaded files belong to one
publication, cannot represent locale or canonical identity, and guesses page
URLs from source paths.

Changing the strict v1 payload would break existing consumers. Treating the
latest mutable files as one snapshot can also mix revisions when a publisher or
consumer races with an update.

## Decision

Keep the existing v1 URL and payload unchanged. Publish version 2 in parallel:

```text
_mcp/sumi-docs-manifest.json
_mcp/v2/current.json
_mcp/v2/snapshots/<revision>/manifest.json
_mcp/v2/snapshots/<revision>/docs/...
```

`current.json` is a small locator containing the revision and SHA-256 digest of
the immutable manifest. A v2 manifest contains:

- schema `version: 2`, `revision`, `defaultLocale`, and canonical `locales`;
- a stable document `id`, explicit `locale`, raw `path`, rendered `route`,
  media type, byte count, SHA-256 digest, and deterministic navigation data;
- optional OpenAPI path, byte count, and digest;
- source provenance with repository, full commit when available, and dirty
  state. Missing provenance is represented explicitly rather than invented.

Document path, route, and `(id, locale)` are independently unique. Locale uses
canonical BCP 47. Route is relative to the site so deployment origin remains a
runtime `baseUrl` concern.

The revision is `sha256:<digest>` of a canonical UTF-8 representation of the
manifest core without the revision itself. Input order, filesystem enumeration,
platform separators, timestamps, and deployment origin must not affect it.

The website owns one reviewed content catalog. That catalog drives sidebar
navigation, v1 allowlisting, route verification, and v2 generation. Filesystem
discovery only proves that the catalog has no unexpected omissions; discovering
a file does not publish it automatically. Ordering is
`sectionOrder, order, id, locale, path`.

The Web build writes one complete, commit-bound artifact. Publication follows
this state machine:

```text
AUTHORING -> VALIDATING -> STAGING -> HASHING -> SEALED
          -> STAGE_COMPLETE_ARTIFACT -> VERIFY_ARTIFACT -> COMMIT_ARTIFACT
```

The publisher builds v1, routes, the immutable v2 snapshot, and `current.json`
under a private sibling directory. It rereads the reviewed inputs and verifies
the staged output before one same-parent rename makes `_mcp` visible. It refuses
to replace a different existing `_mcp` directory; a repeat of the exact artifact
is idempotent. Any validation failure or source change therefore leaves the
previous output untouched. Deployment must promote the entire accepted site
artifact with the hosting provider's generation or ETag precondition. A local
filesystem lock or a `current.json` rewrite is not a cross-host deployment CAS.
Previously accepted deployment artifacts are retained for rollback and
in-flight consumers.

The MCP consumer verifies the locator, manifest, size, and every content digest
before atomically replacing its process-local read-only vault. A failed refresh
keeps the previous ready revision. v1 remains supported with its current
bounded acquisition rules and public tool result shapes.

Pagination cursors, if added, are opaque base64url values containing schema
version, corpus revision, filter digest, and last stable sort key. The client
holds the cursor; the server stores no client or session state. A revision
change returns `CURSOR_STALE` rather than silently continuing in another
snapshot.

## Status and change detection

The server may expose additive corpus status through a tool and a resource. It
reports configured source, loaded revision, source-change state, last successful
verification, and sanitized errors. It cannot reliably identify whether a human
or an agent edited a file, so it reports content change rather than authorship.

Filesystem notifications are an optimization only. Correctness comes from a
fresh deterministic hash or remote locator comparison. The loaded snapshot
remains usable until a complete replacement is verified.

## Compatibility

Additive v2 URLs, server instructions, resources, and a status tool are
compatible. Replacing v1 strings with objects, changing the four existing tool
schemas or result envelopes, implicit locale filtering, deriving routes, or
hot-swapping a cursor across revisions are breaking changes and are rejected.

## Validation and rollback

Contract tests must prove deterministic revisions across scan order and
platform path forms, digest rejection, source-race abort, duplicate and locale
validation, custom routes, root and subpath deployments, v1 fixture stability,
and two independent cursor consumers. Rollback restores a previously accepted
whole-site artifact; manifest v1 remains shape-compatible in every candidate.
