# Skills, MCP, and orchestration

Sumi-Docs-MCP is a stateless, read-only capability provider. It is not an agent
runtime or workflow engine. Keeping these responsibilities separate makes the
tool contract portable across Codex, Claude Code, IDE clients, and future MCP
hosts.

## Ownership model

| Layer                   | Owns                                                                                         | Does not own                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Skill                   | trigger conditions, usage procedure, prerequisites, examples, and validation                 | live documentation data, server authentication, or durable session state |
| Sumi-Docs-MCP           | bounded document acquisition and the four read-only MCP tools over stdio or Streamable HTTP  | client routing, conversation memory, multi-agent delegation, or UI       |
| Agent host or workflow  | tool selection, sequencing, retries, delegation, approvals, and any client session           | document parsing and source access rules already owned by the MCP server |
| Astro/Starlight site    | reviewed human pages and the public machine-readable projection                              | stdio transport, local file access, or agent execution                   |
| BFF or service boundary | future browser credentials, authorization, and server-side sessions when explicitly designed | hidden expansion of the headless MCP contract                            |

The practical rule is: a Skill can teach an agent when to call `list_docs`,
`search_docs`, `fetch_doc`, and `get_openapi_spec`; the MCP server performs
those calls against a controlled corpus; the agent host decides the sequence.
Stateless transport does not provide agent memory, checkpoint recovery, or host
filesystem isolation. Those remain owned by the client host or a separately
reviewed controller.

## A client-side Skill

A reusable Sumi Skill may cover:

- when a documentation question should query Sumi rather than use model
  memory;
- how to discover the corpus before choosing a document;
- how to cite the returned page URL for a human reader;
- how to handle missing documents or an unavailable server;
- which tool calls and fixtures validate the workflow.

It should not duplicate parser, search, path validation, network policy, or MCP
schemas from this repository. It should configure or invoke the installed MCP
server through the host's supported integration surface.

## Where a Skill belongs

The product workspace ships the optional project Skills `$sumi-docs-use`,
`$sumi-docs-pr`, and `$sumi-docs-audit` under the canonical `.agents/skills/`
directory. They route setup, operation, contribution, and read-only audit
workflows; they do not implement or proxy MCP. Broader maintainer behavior
belongs in the local developer's governed global skill catalog and must
activate only for the Sumi Docs project family.

No Skill is required to query the server. The agent host is the MCP client and
can discover the four tools from protocol initialization and `tools/list`.
Agents should prefer these tools for ordinary documentation questions and
inspect source and tests when changing or verifying implementation behavior.

Do not add a directory merely because a loader recognizes its name. Classify
the owner, lifecycle, security boundary, compatibility impact, validation, and
rollback first.

## Contributing a Skill integration

Open an issue before adding or changing a reusable Skill integration. Include:

- trigger and explicit non-trigger examples;
- supported host and version assumptions;
- MCP configuration and prerequisites;
- the ordered workflow and failure behavior;
- data, credential, and approval boundaries;
- deterministic validation or eval cases;
- compatibility and rollback instructions.

If the proposal changes a public MCP tool or result, update the tool schema,
integration tests, tool reference, examples, and changelog in the same change.
If it adds session state, authenticated acquisition, or multi-agent control,
the proposal is an architecture change outside the current server contract and
requires an ADR or separate service design before implementation.

## Example interaction

An agent answering "How is this project released?" can follow this sequence:

1. Call `search_docs` with `release` or the operator's language-specific term.
2. Call `fetch_doc` for the most relevant release document.
3. Answer from the returned content and expose its optional `url` to the human.

The Skill may define this decision procedure. Sumi-Docs-MCP owns the search and
fetch behavior. The host owns the tool-call loop and presentation.
