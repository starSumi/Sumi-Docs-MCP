# Sumi-Docs-MCP

Sumi-Docs-MCP is a read-only MCP server for Markdown, MDX, and OpenAPI
documentation stored in a local directory or on a remote HTTPS host. It exposes
four tools over stdio: list documents, search by keyword, fetch one document,
and retrieve an OpenAPI specification.

Source is hosted at [GitHub](https://github.com/starSumi/Sumi-Docs-MCP). No npm
package or GitHub Release has been published for pre-release `0.1.0`; run the
checkout locally or build the documented executable artifact.

## Quick start

Prerequisite: Node.js 25.5.0 or newer.

```powershell
npm ci
npm run example:smoke
```

The smoke test builds the server, starts a real stdio child process, and verifies
all four tools against the checked-in corpus in `examples/basic/`.

Start the same corpus for an MCP client:

```powershell
npm run build
node dist/index.js serve examples/basic/docs --openapi examples/basic/openapi.json --base-url https://docs.example.com/product/
```

The process uses stdout for JSON-RPC. Diagnostics go to stderr. It is normal for
the process to wait silently until a client sends a request.

For client configuration, start from
[`examples/clients/launcher-template.json`](examples/clients/launcher-template.json),
replace the placeholders with absolute paths, and follow the configuration
contract of your MCP client. Remote-source clients can start from
[`examples/clients/remote-launcher-template.json`](examples/clients/remote-launcher-template.json).

For Codex, the equivalent user- or project-level `config.toml` entry is:

```toml
[mcp_servers.sumiDocs]
command = 'C:\absolute\path\to\sumi-docs-mcp.exe'
args = [
  'serve',
  'C:\absolute\path\to\docs',
  '--openapi',
  'C:\absolute\path\to\openapi.json',
  '--base-url',
  'https://docs.example.com/product/'
]
```

With `--base-url`, `list_docs`, `search_docs`, and `fetch_doc` include a public
`url` for each document. MCP clients can show the result to the model and render
the URL as a link for the operator.

If the public site is not deployed yet, start the loopback-only preview in a
separate terminal:

```powershell
npm run preview:docs
```

Then use `http://127.0.0.1:4173/` as `--base-url`. The preview serves the
checked-in example by default. To preview another corpus:

```powershell
npm run preview:docs -- --docs C:\absolute\path\to\docs --port 4173
```

## Commands

| Purpose                         | Command                                         | Result                               |
| ------------------------------- | ----------------------------------------------- | ------------------------------------ |
| Run the example from TypeScript | `npm run dev`                                   | stdio server using `examples/basic/` |
| Restart on source changes       | `npm run dev:watch`                             | development-only stdio server        |
| Preview clickable local URLs    | `npm run preview:docs`                          | loopback-only Markdown preview       |
| Validate the example end to end | `npm run example:smoke`                         | build plus five MCP requests         |
| Build the Node.js distribution  | `npm run build`                                 | `dist/`                              |
| Run the built example           | `npm start`                                     | stdio server from `dist/`            |
| Build a standalone executable   | `npm run build:sea`                             | `artifacts/bin/sumi-docs-mcp.exe`    |
| Run quality checks              | `npm run lint`, `npm run typecheck`, `npm test` | static checks and tests              |

To serve another corpus, invoke the CLI directly:

```powershell
node dist/index.js serve C:\absolute\path\to\docs --openapi C:\absolute\path\to\openapi.json --base-url https://docs.example.com/
```

To serve a remote corpus, point the same command at its manifest or containing
directory:

```powershell
node dist/index.js serve https://content.example.com/product/
```

The remote host must expose `sumi-docs-manifest.json`. The same four MCP tools
operate on the downloaded read-only snapshot. Remote OpenAPI is declared in the
manifest, so `--openapi` is local-only. See
[Remote documentation sources](docs/remote-sources.md) for the manifest format
and network limits. The only implemented MCP transport is stdio.

## Tool surface

| Tool               | Input                       | Behavior                                       |
| ------------------ | --------------------------- | ---------------------------------------------- |
| `list_docs`        | `{}`                        | lists files and optional public URLs           |
| `search_docs`      | `{ "query": "token" }`      | returns ranked matches and optional URLs       |
| `fetch_doc`        | `{ "path": "guide.md" }`    | returns parsed content and an optional URL     |
| `get_openapi_spec` | `{ "endpoint": "/health" }` | returns all or one endpoint of the loaded spec |

See [docs/tool-reference.md](docs/tool-reference.md) for exact schemas, result
fields, error behavior, protocol metadata, and snapshot lifecycle.

The server has no client or session state. It builds one process-local, read-only
corpus snapshot on the first tool call. Source changes require a process restart.

## Configuration model

Runtime configuration comes from CLI arguments, not `.env` files:

```text
sumi-docs-mcp serve <docs-source> [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
```

`<docs-source>` is either a local directory or a remote HTTPS manifest/base URL.
`--base-url` controls clickable human-facing page URLs; it is not the remote
content source.

The benchmark has its own command options; see
[`docs/development.md`](docs/development.md). There are no required application
environment variables.

## Documentation

- [Getting started](docs/getting-started.md)
- [Configuration and environments](docs/configuration.md)
- [Remote documentation sources](docs/remote-sources.md)
- [Contribution workflow](docs/contributing.md)
- [Skills, MCP, and orchestration](docs/skills-and-orchestration.md)
- [Development and validation](docs/development.md)
- [Git workflow and commit policy](docs/git-workflow.md)
- [Release candidates and human acceptance](docs/releasing.md)
- [Architecture and constraints](docs/architecture.md)
- [Architecture decisions](docs/architecture.md#architecture-decisions)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](CONTRIBUTING.md)
- [Historical project reports](docs/history/README.md)

## Current limitations

- stdio is the only transport.
- Search is lexical keyword matching, not embedding or semantic search.
- The corpus is loaded into memory on first use and is not refreshed in place.
- Remote sources require an explicit manifest; the server does not crawl sites.
- The standalone executable is a local build artifact, not a published release.
- The documented cold-start hard limit of 100 ms is not currently met; prior
  Node 25.5 measurements were approximately 150-218 ms.

## License

MIT. See [LICENSE](LICENSE).
