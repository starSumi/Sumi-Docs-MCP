# ADR-0001: Separate Astro documentation UI from the MCP data plane

- Status: Accepted
- Date: 2026-08-13
- Owners: Sumi Docs maintainers
- Repository topology: [ADR-0002](0002-polyrepo-and-package-manager.md)
- Localized projection: [ADR-0003](0003-localized-content-projection.md)

## Context

Sumi-Docs-MCP provides a read-only MCP interface over local or remote
Markdown, MDX, and OpenAPI content. It is headless, has no client or session
state, and currently exposes only a stdio transport.

The same documentation also needs a human-facing website with navigation,
rendered pages, search, code presentation, and optional interactive Agent
features. Adding a UI framework, browser runtime, authentication, or user
sessions to this package would mix the website control plane with the MCP data
plane and would conflict with the current module and security boundaries.

## Decision

Build the human-facing documentation experience as a separate application,
provisionally named `sumi-docs-web`, using Astro and Starlight. Keep
Sumi-Docs-MCP as an independent headless, read-only MCP server.

Both applications consume one trusted documentation source:

```text
trusted content source
  Markdown / reviewed MDX / OpenAPI / route metadata
        |
        +-- Astro + Starlight
        |     -> rendered documentation site
        |     -> Pagefind index for human search
        |     -> optional interactive islands
        |
        +-- thin publishing integration
              -> raw Markdown and MDX
              -> optional OpenAPI JSON
              -> sumi-docs-manifest.json
                        |
                        v
              Sumi-Docs-MCP remote loader
                        |
                        v
              MCP tools over stdio
```

### Ownership boundaries

`sumi-docs-web` owns:

- HTML rendering, navigation, accessibility, SEO, and human-facing search;
- trusted build-time MDX component mappings;
- browser UI, including any optional Agent island;
- any BFF, authentication, authorization, user session, rate limit, and model
  credential required by browser Agent features;
- publishing the rendered site and the machine-readable corpus projection.

Sumi-Docs-MCP owns:

- bounded acquisition of a local directory or remote manifest snapshot;
- semantic-text extraction from Markdown and MDX without executing MDX code;
- the stable `list_docs`, `search_docs`, `fetch_doc`, and
  `get_openapi_spec` tool contracts;
- strict input validation, sanitized errors, and read-only corpus access;
- MCP transport behavior. Stdio remains the only accepted transport until a
  separate decision approves another transport.

### Content and routing contract

The trusted content and explicit route metadata are the source of truth. The
manifest is a generated deployment projection and must not be edited as an
independent content registry.

The first publishing integration will:

1. Copy the raw Markdown and MDX files, and optional OpenAPI JSON, into a
   public machine-readable subtree.
2. Generate the current strict manifest shape:

   ```json
   {
     "version": 1,
     "documents": ["getting-started.md", "api/authentication.mdx"],
     "openapi": "openapi.json"
   }
   ```

3. Produce or validate an explicit mapping between corpus paths and rendered
   page routes.
4. Verify during CI that every URL returned through `--base-url` resolves to a
   published page.

The implementation must not infer source files solely from final page paths.
Custom slugs, index routes, locale prefixes, Astro `base`, and trailing-slash
behavior require an explicit, tested mapping. The website now supports explicit
English and Simplified Chinese route mappings. The current MCP manifest remains
path-only and does not provide locale negotiation; ADR-0003 defines the boundary
for a future language-aware projection without changing manifest v1.

Starlight's Pagefind index and Sumi-Docs-MCP's lexical index are intentionally
separate derived artifacts. Pagefind serves browser users; MCP tools serve
models and MCP clients.

### Trust and security boundaries

- Only trusted, reviewed MDX may enter the Astro build. Astro compiles MDX
  expressions and components; remote or user-supplied MDX must not be executed.
- Sumi-Docs-MCP continues to parse MDX as documentation data and does not
  evaluate JSX or JavaScript.
- Raw published documents and frontmatter must be checked for secrets before
  deployment.
- Browser code must not receive model credentials or other server secrets.
  Credentials remain in a BFF or another trusted server process.
- A browser cannot connect directly to the stdio transport. An interactive
  Agent island calls an HTTPS BFF; the BFF acts as the MCP client and owns
  child-process lifecycle, timeouts, concurrency, restart, and shutdown.
- Documentation returned by MCP remains untrusted model input. Its contents do
  not become system instructions.
- The existing remote-loader protocol, origin, redirect, timeout, count, and
  size limits remain in force.

### Deployment models

- Static hosting publishes HTML, raw documents, OpenAPI, and the manifest. A
  user's local MCP client may start Sumi-Docs-MCP and point it at that remote
  corpus. A static site alone cannot host a browser Agent BFF.
- A long-running Node.js service, VM, or container may host a BFF that supervises
  and reuses one Sumi-Docs-MCP stdio child process.
- Serverless functions and edge runtimes must not assume a persistent stdio
  child process, compatible Node.js process APIs, or reusable corpus state. Use
  a separate long-running BFF if browser Agent features are required there.
- A Streamable HTTP MCP transport is deferred. It requires a separate ADR and
  protocol, authentication, Origin, TLS, CORS, rate-limit, and conformance
  review.

## Consequences

Positive consequences:

- The MCP server retains a small dependency and security surface.
- Human and machine experiences share content without sharing runtime state.
- Astro integrations can be selected for the website without changing the MCP
  package contract.
- The rendered page and the MCP result can be connected through verified public
  URLs.

Costs and constraints:

- A separate application and release pipeline must be maintained.
- The publishing integration and route mapping require contract and end-to-end
  tests.
- A browser Agent requires a stateful service boundary even when the
  documentation site itself is static.
- Content updates require rebuilding the site and restarting long-lived MCP
  snapshots that consume the changed corpus.

## Alternatives considered

### Add Astro or React to Sumi-Docs-MCP

Rejected. It combines UI, browser, and user-state concerns with the read-only
MCP data plane and violates the current headless architecture.

### Adopt a community Starlight MCP integration

Rejected for the initial implementation. A second MCP runtime, index, and tool
contract would duplicate Sumi-Docs-MCP ownership and create compatibility
drift. Community integration code may be studied, but directory inclusion is
not a security or compatibility endorsement.

### Use the Astro Docs MCP server for Sumi content

Rejected. The Astro Docs MCP server provides Astro's own documentation to
development tools; it is not a corpus host or publishing integration for this
project.

### Add Streamable HTTP to Sumi-Docs-MCP now

Deferred until a concrete remote MCP consumer and deployment model require it.
The existing remote-source URL is a corpus input and does not change the MCP
transport from stdio.

## Implementation gates

No Web implementation begins until its work item preserves this decision and
defines:

1. the `sumi-docs-web` repository or sibling-project boundary;
2. the source-directory, publish-directory, and route-map contracts;
3. the exact Astro and Starlight versions and official integrations;
4. the MDX author trust policy;
5. static-only or long-running BFF deployment ownership;
6. CI coverage for manifest schema, raw asset availability, all four MCP tools,
   and every returned human-facing URL.

Performance and security claims must be supported by measured results and a
documented threat model. Terms such as semantic search, zero-cost hydration,
absolute safety, or a universal performance advantage are not accepted without
corresponding implementation and evidence.

## Supersession

This decision may be replaced by a later ADR. A replacement must identify the
changed requirement, migration impact, validation plan, and rollback path.
