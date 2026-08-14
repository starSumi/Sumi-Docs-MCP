# Changelog

This file records user-visible changes. Internal phase notes are retained under
`docs/history/` and are not release records.

## 0.1.0 - 2026-08-12

- Implemented Markdown/MDX and OpenAPI parsing.
- Implemented the read-only documentation index.
- Added the four MCP tools over stdio.
- Added a runnable example corpus and end-to-end stdio smoke test.
- Added source, development, configuration, architecture, and troubleshooting
  documentation.
- Added deterministic Git hooks, remote commit-policy checks, and a guarded
  history-rewrite playbook.
- Added a human-gated GitHub Releases candidate pipeline with checksums,
  CycloneDX SBOM, provenance, and draft-only promotion.
- Corrected the development commands and npm packaging preflight.
- Moved standalone build output to ignored `artifacts/bin/`.
- Clarified that search is lexical, stdio is the only transport, and the corpus
  is a process-local read-only snapshot.
- Added optional `--base-url` mapping so document list, search, and fetch results
  can include clickable public URLs.
- Mapped `index.md` and `index.mdx` document URLs to their directory pages.
- Added a loopback-only, read-only local document preview for using those URLs
  before a public site is deployed.
- Added remote documentation source mode using a strict, bounded JSON manifest.
  Local directories and remote HTTPS corpora expose the same four MCP tools.
- Preserved Unicode lexical substring search and deterministic result ordering.
- Made local corpus loading bounded and transactional so failed refreshes retain
  the previous read-only snapshot.
- Added an exact MCP tool reference and documented the authoritative repository
  initialization boundary.
