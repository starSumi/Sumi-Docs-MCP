# Contributing

Read `AGENTS.md` before changing the site. It defines the repository boundary,
content trust model, and required validation.

## Workflow

1. Define the observable content, publishing, or rendering behavior being
   changed.
2. Keep reviewed site content under `src/content/docs/` and build-time
   projection logic under `integrations/`.
3. Update both human routes and machine mappings when a published document
   changes.
4. Add or update a deterministic test for publishing-contract changes.
5. Run `npm run verify:push` and, when the sibling server is available,
   `npm run verify:mcp`.

Use Conventional Commits and keep each commit focused. Do not bypass hooks as a
routine workflow. Do not commit `dist/`, `.astro/`, `artifacts/`, `node_modules/`,
local environment files, coverage, or editor metadata.

For deployment changes, follow `docs/deployment.md`. A public deployment also
requires a configured private security-reporting channel and the real public
origin in `SITE_URL`.
