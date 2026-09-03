# ADR-0012: Serve one documentation core over stdio and Streamable HTTP

- Status: Accepted
- Date: 2026-08-19
- Owners: Sumi Docs maintainers

## Context

Sumi Docs already acquires a corpus from a local directory or a bounded HTTPS
manifest. That source mode does not make the MCP endpoint remotely accessible.
GitHub Pages and similar static hosts can publish the Web site and `_mcp`
content projection, but they cannot run a Streamable HTTP MCP process.

Four addresses have different owners and must not be conflated:

1. a stable document identity and logical source path;
2. a local directory or remote manifest used to acquire corpus bytes;
3. a catalog route used to open the rendered page;
4. an MCP endpoint used by an agent host.

Deriving one layer from another is unsafe. A file name is not necessarily a
browser route, and an HTTPS manifest is not an MCP transport endpoint.

## Decision

The supported Node.js implementation exposes the same `DocsMcpServer` factory
through two additive transports:

- `stdio` remains the default for local agent hosts and the SEA executable;
- stateless Streamable HTTP is available from the Node.js distribution through
  the official MCP server and Node adapter packages.

The HTTP command completes one bounded corpus load before opening its listener.
The handler then constructs a fresh protocol server for each request while all
instances share that immutable, process-local read-only snapshot. This preserves
the absence of client, conversation, and session state without reparsing the
corpus for every call. Stdio keeps its first-content-call lazy load. Both
transports register the same tools, schemas, instructions, error mapping, and
protocol version.

The HTTP listener binds to `127.0.0.1` by default. A non-loopback bind requires
an explicit public-network acknowledgement and at least one allowed Host.
Present Origin headers are validated against an allowlist. The adapter limits
request-body size, rejects unknown paths, and serves both the modern
`2026-07-28` envelope and the SDK's stateless `2025-06-18` legacy exchange.
Modern requests still require a matching protocol header and request envelope;
legacy requests are classified by the SDK and do not bypass those modern
checks. TLS termination and request-rate controls belong at the reverse proxy
or service platform. The process exposes a lightweight `/healthz` liveness route
and a corpus-aware `/readyz` readiness route for that platform.

The unauthenticated endpoint is suitable only for a corpus intended to be
public. Private-corpus deployment requires a separate accepted authorization
design using the MCP authorization contract; a static token shortcut is not
part of this decision.

The canonical deployment shape is:

```text
reviewed source + catalog
  -> Web pages and immutable _mcp projection on a static origin
  -> one read-only DocsMcpServer core
       -> stdio for a local host
       -> /mcp over Streamable HTTP for a remote host
```

The v2 manifest owns document identity, locale, route, digest, and revision.
Local and remote acquisition retain the same logical document path. Tool
results use the reviewed route when the manifest provides one; they do not
infer a page route from a remote fetch URL.

## Consequences

`@modelcontextprotocol/node` becomes a production dependency with a narrow,
documented purpose. No HTTP framework, crawler, controller database, mutable
MCP state, or second tool implementation is introduced. The static site and
HTTP service may share a public domain through a reverse proxy, but remain
separate deployable artifacts.

The SEA remains optimized and supported for stdio. HTTP serving uses the Node.js
distribution. The maintained container wraps that distribution without adding
a second protocol implementation; its corpus mount is read-only and its runtime
defaults to a non-root user with dropped capabilities.

## Validation and rollback

Integration tests exercise both the modern 2026 request envelope and the 2025
legacy exchange over a real loopback HTTP server, plus a process-level stdio
handshake probe. They compare the four advertised tools across transports.
Negative tests cover Host and Origin validation, endpoint routing, body limits,
protocol metadata, malformed modern envelopes, and non-loopback CLI safeguards.
When HTTP or stdio
acquires the immutable v2 projection, cross-product verification requires its
reported revision to equal the Web current locator. Local-directory acquisition
has no wire revision; its document bytes, paths, routes, and tool behavior are
verified against the reviewed catalog instead.

Rollback removes the HTTP entry and Node adapter dependency. The default stdio
CLI, tool contract, corpus formats, Web output, and existing host adapters stay
unchanged.
