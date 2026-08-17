# ADR-0003: Evolve localized content through a versioned projection

- Status: Accepted
- Date: 2026-08-13
- Owners: Sumi Docs maintainers
- Extends: [ADR-0001](0001-astro-starlight-dual-surface.md)

## Context

The documentation website now renders English at `/` and Simplified Chinese at
`/zh-cn/`. Its publisher emits both locale variants through the strict manifest
v1 and verifies an explicit source-to-page route map.

Manifest v1 represents documents as relative path strings. Sumi-Docs-MCP treats
`zh-cn/getting-started.md` as a path; `DocNode`, `list_docs`, `search_docs`, and
`fetch_doc` do not expose a locale, stable cross-language document identity,
content revision, route, or provenance. The route map is a website deployment
artifact and is not consumed by the MCP remote loader.

A language selector therefore proves that equivalent pages are navigable for a
person, but it does not make language an explicit machine-readable dimension.
Adding optional fields to v1 document entries would break its strict schema and
existing consumers. HTTP `Accept-Language` is also not available to the current
stdio tool contract.

## Decision

Keep manifest v1 and the four current MCP tool schemas unchanged. Localized
documents may be published through locale-prefixed paths, and current clients
will continue to list and search those paths without implicit language
selection or fallback.

Treat the following as distinct contracts:

- `version` in a manifest identifies the manifest schema, not the product or
  documentation release.
- A document `id` identifies one conceptual document across translations.
- A `locale` identifies one language variant using a canonical BCP 47 tag.
- A corpus `revision` identifies one immutable publication of the complete
  machine-readable projection.
- A document `path` identifies the raw published source; a `route` identifies
  the corresponding human page. Neither is derived from the other.
- A content digest verifies the raw bytes acquired for a document. Provenance
  identifies the reviewed source revision that produced the projection.

Any future language-aware projection requires a new schema version. Its minimum
document record will contain `id`, `locale`, `path`, `route`, and a SHA-256
content digest. The corpus will contain an immutable `revision` and, when the
publisher can supply it reliably, source provenance. ADR-0006 finalizes the v2
publication and compatibility boundary.

Do not add access-control fields to a public static manifest. Private corpora,
authenticated acquisition, tenant visibility, and authorization require a
separate architecture and threat-model decision; metadata in a downloadable
manifest cannot enforce access.

### Locale semantics

- Locale is explicit metadata, not inferred from the first path segment or a
  filename convention.
- The website may provide human-facing fallback navigation. Machine filtering
  must not silently substitute another locale.
- A future optional locale filter uses exact canonical tags by default. An
  explicit fallback policy may be added only with deterministic ordering and
  integration tests.
- Existing unfiltered calls continue to return all published variants.
- `fetch_doc(path)` remains unambiguous and backward compatible. Fetching by
  conceptual `id` and locale would be a separate public tool-contract change.

### Compatibility and rollout

1. Continue publishing and consuming `sumi-docs-manifest.json` as strict v1.
2. Design v2 from fixtures and JSON Schema, including malformed tags, duplicate
   `(id, locale)` pairs, missing translations, route collisions, and digest
   mismatches.
3. During migration, publish v2 under a distinct URL while retaining v1. Do not
   change the v1 payload in place.
4. Add v2 reading to Sumi-Docs-MCP only after it preserves v1 behavior and the
   four existing tools pass against both projections.
5. Add locale-aware tool input only after its default, filtering, ordering, and
   fallback semantics are documented as a public API change.

Rollback is removal of the parallel v2 artifact and continued v1 publication;
no v1 consumer or current tool schema is changed by this decision.

## Validation gates

The current v1 bilingual publication must verify:

- every raw source has exactly one explicit rendered route;
- every manifest path and route is unique and every rendered URL resolves;
- locale page HTML declares the expected language;
- equivalent-page language navigation stays inside the intended locale;
- all four MCP tools work against the complete published corpus.

A future v2 additionally must verify:

- canonical BCP 47 locale tags and unique `(id, locale)` pairs;
- stable IDs across revisions and explicit reporting of missing variants;
- raw-byte digests before parsing;
- corpus revision and source provenance reproducibility;
- v1/v2 compatibility, bounded download size, peak memory, and first-content
  tool latency as the number of locales grows.

## Consequences

Positive consequences:

- The current bilingual site ships without pretending that path naming is a
  complete localization protocol.
- Existing MCP clients keep their strict, tested v1 behavior.
- A future locale-aware contract has stable identity, routing, integrity, and
  compatibility boundaries before implementation begins.

Costs and constraints:

- Current MCP search can return both language variants and cannot filter by
  locale.
- The publisher maintains explicit source-to-route mappings for each locale.
- Adding machine locale selection requires coordinated, reviewed changes in two
  repositories and a public API migration.

## Alternatives considered

### Put locale objects into manifest v1

Rejected. It violates the strict `documents: string[]` contract and would make
an incompatible payload claim to be schema version 1.

### Infer locale from directory names

Rejected. Non-language directories and future route restructuring make the
inference ambiguous, and it does not establish translation identity.

### Use `Accept-Language`

Rejected for the current stdio transport. Tool calls do not carry HTTP content
negotiation headers, and implicit negotiation would make results depend on
transport context instead of explicit tool input.

### Add ACL metadata now

Rejected. The current remote projection is public and unauthenticated. Access
control requires an enforcing server boundary, not descriptive static fields.
