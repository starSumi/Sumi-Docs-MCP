# Historical snapshot: Phase 2 implementation

> Superseded summary. Do not use this file as current build, dependency, test,
> protocol, or release documentation.

Date: 2026-08-12

This phase introduced the Markdown/MDX parser, OpenAPI parser, in-memory
documentation index, path helpers, lexical search helpers, and their initial
unit tests. It preceded the final MCP adapter, remote manifest loader, bounded
transactional local loading, current URL behavior, and release automation.

The implementation has changed materially since this snapshot. Active module
boundaries are documented in `docs/architecture.md`; current behavior is proved
by source and tests.
