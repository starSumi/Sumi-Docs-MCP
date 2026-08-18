---
title: MCP tool reference
description: Inputs, outputs, ordering, and errors for the four read-only tools.
---

Sumi-Docs-MCP exposes four stateless tools. Every argument object is validated
strictly; unknown fields and malformed values are rejected before execution.

| Tool               | Arguments                 | Result                                                                |
| ------------------ | ------------------------- | --------------------------------------------------------------------- |
| `list_docs`        | `{}`                      | Document paths, titles, optional timestamps, and optional public URLs |
| `search_docs`      | `{ "query": string }`     | Ranked lexical matches with headings, snippets, and optional URLs     |
| `fetch_doc`        | `{ "path": string }`      | Parsed content, frontmatter, headings, and an optional public URL     |
| `get_openapi_spec` | `{ "endpoint"?: string }` | The full OpenAPI object or one exact endpoint                         |

Search queries must contain 1 to 200 characters. Search is Unicode-aware
lexical substring matching, not semantic or embedding search. Equal scores are
ordered by path so repeated calls over the same corpus are deterministic.

`fetch_doc` accepts a restricted relative `.md` or `.mdx` path already present
in the index. It never opens a client-supplied filesystem path.

Tool errors set `isError: true` and return a sanitized message. `_meta.errorCode`
is one of `PATH_NOT_FOUND`, `INVALID_INPUT`, or `PARSE_ERROR`; absolute paths and
stack traces are not exposed. Successful and failed results also identify the
MCP protocol version and server capabilities in `_meta`.

The first content tool call loads one read-only corpus snapshot. Later calls
reuse that snapshot until the process exits, so source changes require a restart.
