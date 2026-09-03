# MCP tool reference

## Server instructions

The MCP initialization result includes concise, self-contained instructions in
its first 512 characters. They identify the server as read-only, route discovery
to `list_docs`, lexical lookup to `search_docs`, exact retrieval to `fetch_doc`,
and API retrieval to `get_openapi_spec`, and state that source changes require a
process restart. Clients that do not load a repository Skill can use this native
protocol guidance without changing the tool contract.

Sumi-Docs-MCP exposes four read-only tools over the official stdio and
Streamable HTTP adapters. The modern protocol target is MCP `2026-07-28`.
Established clients that still use MCP `2025-06-18` are served through the SDK's
stateless legacy path. A modern client may send `tools/list` as its first request
with the required request metadata; a legacy client may use the usual
`initialize` and `notifications/initialized` exchange instead. The two paths
share the same read-only tools and corpus snapshot.

Every tool result contains one text content item. For successful calls, that
text is JSON encoded and `_meta` contains `protocolVersion`, `capabilities`,
and an ISO 8601 `timestamp`. Unknown argument fields and malformed values are
rejected by strict schemas before content loading or handler execution. The
server normalizes these failures to `INVALID_INPUT` without returning validator
details.

## `list_docs`

Input:

```json
{}
```

The result text is a JSON array. Each item contains `path` and `title`, plus
`lastModified` when known and `url` when a public page can be resolved.
Public URLs remove the Markdown extension; a final `index.md` or `index.mdx`
maps to its directory page.

```json
[
  {
    "path": "getting-started.md",
    "title": "Getting started",
    "lastModified": "2026-08-14T08:00:00.000Z",
    "url": "https://docs.example.com/getting-started"
  }
]
```

## `search_docs`

Input:

```json
{ "query": "remote manifest" }
```

`query` is trimmed and must contain 1 to 200 characters. The result text is a
JSON array of `path`, `title`, `headings`, `snippet`, optional `score`,
and optional `url`.

Search is Unicode-aware lexical substring matching with relevance scoring. It
is not semantic or embedding search. Equal scores are ordered by path, so a
fixed corpus produces deterministic results.

## `fetch_doc`

Input:

```json
{ "path": "getting-started.md" }
```

The path must be a restricted relative `.md` or `.mdx` key already present in
the loaded index. The result contains `path`, parsed `content`, `frontmatter`,
`headings`, and an optional `url`. The tool never opens a client-supplied
filesystem path.

## `get_openapi_spec`

Input for the complete loaded specification:

```json
{}
```

Input for one exact endpoint:

```json
{ "endpoint": "/health" }
```

The optional endpoint must start with `/` and use the restricted path
characters accepted by the schema. The result is the OpenAPI object with
`paths` filtered to that exact endpoint when requested.

## Errors and lifecycle

A handled tool error sets `isError: true` and returns a sanitized text message.
The server uses `PATH_NOT_FOUND`, `INVALID_INPUT`, and `PARSE_ERROR` as
client-facing error categories. Every handled or validation error includes the
category in `_meta.errorCode`. Absolute paths, stack traces, raw input, and
validator details are never returned to the client. Operator diagnostics go to
stderr because stdout is reserved for MCP JSON-RPC.

The server object is cheap to construct. Stdio loads one bounded local or remote
corpus snapshot and optional OpenAPI document on the first content tool call;
`tools/list` does not wait for that load. Streamable HTTP completes the same kind
of bounded load before listening. The resulting read-only index is reused until
process exit. There is no live reload, client-specific state, or conversation
state.
