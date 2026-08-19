---
title: Skills, MCP, and orchestration
description: Decide whether behavior belongs in a Skill, the MCP server, an agent host, or the documentation site.
---

Sumi keeps content, capability, and workflow responsibilities separate. This
lets the same reviewed documentation work in a browser and through different
MCP clients without making the MCP server depend on one agent runtime.

## Ownership boundaries

| Layer                   | Responsibility                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Skill                   | Decide when the capability applies and describe the usage procedure, prerequisites, examples, failures, and validation. |
| Sumi-Docs-MCP           | Acquire a bounded local or remote corpus and expose four stateless, read-only documentation tools.                      |
| Agent host or workflow  | Select and sequence tools, retry, delegate, request approval, and own any client session.                               |
| Astro and Starlight     | Render reviewed content for people and publish the explicit raw corpus and route map.                                   |
| Reviewed BFF or service | Own future browser credentials, authorization, or server-side sessions if those capabilities are designed.              |

A Skill can tell an agent when to search Sumi and how to cite the page returned
by `fetch_doc`. It should not copy the MCP server's parser, path validation,
network limits, or schemas. The MCP server does not decide which agent runs
next or retain conversation state.

## Maintainer Skill

Local developers may install the optional `$sumi-docs-maintain` role in their
global agent Skill catalog. Its activation must remain limited to the Sumi Docs
project family. The repository does not ship or require that local role; the
project MCP adapters provide the documentation-query fallback for Codex, Claude
Code, and VS Code. See [Agent host integration](/agent-hosts/).

Open an issue before changing or adding a reusable integration. Include trigger and
non-trigger examples, supported host versions, MCP prerequisites, the ordered
workflow, failure behavior, credential and approval boundaries, deterministic
evals, compatibility impact, and rollback.

If the proposal changes an MCP tool, update the server schema, tests, tool
reference, examples, and changelog in the server repository. If it introduces
stateful orchestration, authenticated acquisition, or multi-agent control, it
requires a separate architecture decision or service boundary rather than code
inside the current read-only MCP server.

For the full repository process, see [Contributing](/contributing/).
