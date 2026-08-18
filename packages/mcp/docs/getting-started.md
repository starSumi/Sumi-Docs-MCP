# Getting started

## Requirements

- Node.js 25.5.0 or newer
- npm with lockfile support
- A directory containing `.md` or `.mdx` files
- Or a remote HTTPS host with a Sumi documentation manifest
- Optionally, an OpenAPI 3.x JSON document

Use `pnpm install --frozen-lockfile` for a reproducible checkout installation:

```powershell
pnpm install --frozen-lockfile
```

## Verify the checkout

```powershell
pnpm run example:smoke
```

This command compiles the project and runs a stdio round trip against
`examples/basic/`. A successful run ends with:

```text
Example stdio smoke test passed (5 MCP requests).
```

## Serve your documentation

Build once, then point the CLI at a corpus. Relative paths are resolved from the
current working directory:

```powershell
pnpm run build
node dist/index.js serve ./product-docs --openapi ./product-docs/openapi.json --base-url https://docs.example.com/product/
```

From a Git worktree with a `docs/` directory, diagnose and start it without a
positional path:

```powershell
node dist/index.js doctor --json
node dist/index.js serve
```

Use a tracked `sumi-docs.config.json` when the source is not `docs/`. Discovery
stops at the nearest Git worktree root. In a directory without Git, it checks
only the current directory, so a parent workspace named `.sumi` cannot be
selected accidentally.

Omit `--openapi` when the corpus has no API specification. Add `--verbose` for
shutdown diagnostics. All protocol output is written to stdout, so do not pipe
ordinary log messages into the server process.

For a remote corpus, use its base or manifest URL. The host supplies OpenAPI
through its manifest:

```powershell
node dist/index.js serve https://content.example.com/product/
```

The public tools and MCP client configuration are otherwise unchanged. See
[remote-sources.md](remote-sources.md) for the manifest and security contract.

## Connect an MCP client

Build the project first. Then configure the client to launch:

```text
command: node
arguments:
  C:/absolute/path/to/Sumi-Docs-MCP/dist/index.js
  serve
  C:/absolute/path/to/docs
  --openapi
  C:/absolute/path/to/openapi.json
  --base-url
  https://docs.example.com/product/
```

Use an absolute source or `--config` path unless the client explicitly starts
the server in the project working directory. GUI clients often use an
application directory instead. The JSON template under `examples/clients/` is
only a launcher template; configuration locations and accepted schemas remain
client-specific.

In Codex, ask it to search the configured documentation after starting a new
session. A successful integration appears as an MCP call such as
`sumiDocs.search_docs` followed by search results containing `path`, `snippet`,
and `url`. The document content is readable in the conversation, and clients
that linkify URLs can open the corresponding public page.

When the public documentation site is not available, run this in a separate
terminal:

```powershell
pnpm run preview:docs -- --docs ./product-docs --port 4173
```

Use `http://127.0.0.1:4173/` for `--base-url` in the MCP client configuration.
Keep the preview process running while opening links. Stop it with `Ctrl+C`.
The same preview can also exercise remote source mode by using
`http://127.0.0.1:4173/` as the positional `<docs-source>`.

## Standalone executable

Node.js 25.5 or newer is required to build the SEA executable:

```powershell
pnpm run build:sea
.\artifacts\bin\sumi-docs-mcp.exe --version
.\artifacts\bin\sumi-docs-mcp.exe serve ./product-docs
```

The resulting executable does not require an external Node.js installation or
project `node_modules` at runtime. It remains a local artifact until a release
pipeline publishes it.
