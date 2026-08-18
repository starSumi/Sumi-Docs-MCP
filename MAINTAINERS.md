# Maintainers

## Accountable owner

- GitHub owner: `starSumi`
- Product: Sumi Docs workspace, website, corpus contract, and MCP distribution
- Release authority: the repository owner after recorded human acceptance

Agents, automation, and language models are tools, not authors, maintainers, or
release approvers. Git author and committer metadata must identify the
accountable human or an approved service account.

## Ownership areas

| Area                        | Owner responsibility                                          |
| --------------------------- | ------------------------------------------------------------- |
| `packages/corpus-contract/` | schema compatibility, canonicalization, fixtures              |
| `packages/mcp/`             | protocol, acquisition, parser, security, executable           |
| `apps/web/`                 | trusted content rendering, navigation, projection publishing  |
| `docs/`                     | reviewed product truth and operational handbook               |
| `.github/`                  | least-privilege CI, candidate evidence, health reconciliation |
| host adapters               | native Codex, Claude Code, and VS Code compatibility          |

Changes spanning contract producer and consumer require one workspace change
and cross-product conformance evidence. Security and release policy changes
require owner review.
