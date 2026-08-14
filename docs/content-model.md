# Content model

## Sources of truth

The two repositories have separate documentation responsibilities:

- `Sumi-Docs-MCP/docs/` is authoritative for server operation, protocol,
  architecture, development, and release procedure.
- `Sumi-Docs-MCP/examples/basic/docs/` is a tested executable projection of
  selected operator documentation plus independent example content. The MCP
  integration test owns its synchronization allowlist.
- `sumi-docs-web/src/content/docs/` is authoritative for the public bilingual
  handbook. It is both rendered for people and copied through an explicit
  allowlist into the machine-readable corpus.

Generated `dist/`, Pagefind data, `sumi-docs-manifest.json`, and
`sumi-docs-routes.json` are build outputs. They must not be edited as content
registries or committed.

## Add or change a public page

1. Add or update the English source under `src/content/docs/`.
2. Add or update its Simplified Chinese counterpart under
   `src/content/docs/zh-cn/`.
3. Add both sidebar entries and explicit source-to-page mappings in
   `astro.config.mjs`. Include a page in the publisher only when it is safe for
   unauthenticated public and model access.
4. Run `npm run verify:push`. The build checks source parity, route uniqueness,
   locale navigation, raw files, and rendered pages.
5. Build the sibling MCP project and run `npm run verify:mcp`. This exercises
   all four tools and every URL returned from the complete manifest.

Renames and deletions update both locales and both route mappings in the same
change. Do not infer locale from filenames in the MCP protocol; manifest v1
treats locale-prefixed values as ordinary paths.

## Trust boundary

Astro may execute expressions from trusted MDX during the build. Only reviewed
repository content may enter `src/content/docs/`. Do not copy remote or
user-supplied MDX into the site build.

Everything under `dist/_mcp/` is intentionally public and becomes untrusted
model input when an MCP client loads it. Exclude credentials, private URLs,
internal incident data, local paths, agent session logs, and historical raw
transcripts. The publisher allowlist is a security boundary, not a convenience
list.
