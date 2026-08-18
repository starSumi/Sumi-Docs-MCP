# Content model

## Sources of truth

The pnpm workspace keeps separate ownership boundaries:

- `packages/mcp/docs/` is authoritative for server operation, protocol,
  architecture, development, and release procedure.
- `packages/mcp/examples/basic/docs/` is executable MCP documentation.
- `docs/` at the workspace root owns the reviewed bilingual handbook rendered
  for people and projected for machine consumers.
- `apps/web/src/content-catalog.ts` is the reviewed publication allowlist and
  the single source for navigation, locale variants, routes, stable IDs, and
  navigation order.
- `packages/corpus-contract/` owns manifest validation, canonicalization, and
  revision semantics. Web publishing code calls that package instead of
  maintaining another schema implementation.

Generated `dist/`, Pagefind data, both manifest versions, immutable snapshots,
`current.json`, and `sumi-docs-routes.json` are build outputs. They must not be
edited as content registries or committed.

## Add or change a public page

1. Add or update the English source under the workspace root `docs/`.
2. Add or update its Simplified Chinese counterpart under `docs/zh-cn/`.
3. Add one conceptual document and its explicit locale variants to
   `src/content-catalog.ts`. Include a page only when it is safe for
   unauthenticated public and model access. Do not add a second mapping to
   `astro.config.mjs`; the catalog generates the sidebar and both projections.
4. Run `pnpm run verify:push`. The build checks source parity, route uniqueness,
   locale navigation, raw files, and rendered pages.
5. Build the MCP workspace package and run `pnpm run verify:mcp`. This exercises
   all four tools and every URL returned from the complete manifest.

Renames and deletions update both locale variants in the same catalog change.
Routes and sidebar slugs are explicit and may differ from source paths. Do not
infer locale from filenames in the MCP protocol; manifest v1 treats
locale-prefixed values as ordinary paths.

## Publication transaction

At build start, the publisher reads every reviewed source and OpenAPI input into
one sealed byte set. It constructs v1, routes, the immutable v2 snapshot, and
`current.json` under a private sibling directory. It then rereads every input,
verifies the complete output, and commits `_mcp` with one same-parent rename. A
mismatch fails the build without exposing a partial machine projection. The
publisher refuses to replace a different existing `_mcp`; deployment promotes
the whole accepted site artifact through the hosting provider's generation or
ETag precondition.

The v2 layout is:

```text
dist/_mcp/v2/current.json
dist/_mcp/v2/snapshots/<sha256>/manifest.json
dist/_mcp/v2/snapshots/<sha256>/docs/...
```

`current.json` contains the immutable manifest revision, byte count, and digest.
The manifest records each document's stable ID, canonical locale, source path,
human route, byte count, SHA-256 digest, navigation coordinates, and source
provenance. Manifest v1 remains unchanged for existing consumers.

Client-specific Skill packages do not belong in this content tree. The
published Skills page documents ownership and integration requirements, while
the runnable Skill remains in the owning client or user catalog.

## Trust boundary

Astro may execute expressions from trusted MDX during the build. Only reviewed
repository content may enter the workspace root `docs/`. Do not copy remote or
user-supplied MDX into the site build.

Everything under `dist/_mcp/` is intentionally public and becomes untrusted
model input when an MCP client loads it. Exclude credentials, private URLs,
internal incident data, local paths, agent session logs, and historical raw
transcripts. The publisher allowlist is a security boundary, not a convenience
list.
