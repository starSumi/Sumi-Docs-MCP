# Contributing

This repository owns a static Astro/Starlight site and its public
machine-readable corpus projection. Contributions must preserve English and
Simplified Chinese route parity, the explicit publishing allowlist, trusted-only
MDX compilation, and independent MCP/Web release lifecycles. Read
[docs/content-model.md](docs/content-model.md),
[docs/deployment.md](docs/deployment.md), and [SECURITY.md](SECURITY.md) before
changing those boundaries. `AGENTS.md` contains the matching execution rules
used by repository automation.

Start with the published [contribution workflow](src/content/docs/contributing.md)
for issue triage, pull request readiness, validation evidence, and merge policy.
Changes involving client Skills or workflow orchestration must also follow
[the Skill and orchestration boundary](src/content/docs/skills-and-orchestration.md).

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
