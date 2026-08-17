# Configuration and environments

Sumi-Docs-MCP has one runtime configuration surface: CLI arguments. It does not
load `.env` files and it does not branch behavior on `NODE_ENV`.

## CLI options

```text
sumi-docs-mcp serve <docs-source> [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
```

| Option              | Required | Meaning                                                          |
| ------------------- | -------- | ---------------------------------------------------------------- |
| `<docs-source>`     | yes      | local directory or remote HTTPS manifest/base URL                |
| `--openapi <path>`  | no       | local-mode OpenAPI 3.x JSON exposed by `get_openapi_spec`        |
| `--base-url <url>`  | no       | human-facing page prefix added to document tool results          |
| `--transport stdio` | no       | transport selector; stdio is the default and only implementation |
| `--verbose`         | no       | emits lifecycle diagnostics to stderr                            |

Hidden directories and `node_modules` below the documentation root are skipped.
The server constructs a read-only in-memory snapshot on the first tool call.
Restart it after changing source documentation.

Remote mode downloads the manifest-declared corpus when the first content tool
is called. Use either an explicit manifest URL or its containing directory:

```powershell
node dist/index.js serve https://content.example.com/product/sumi-docs-manifest.json
node dist/index.js serve https://content.example.com/product/
```

Both commands use the same MCP tools as local mode. `--openapi` is rejected in
remote mode; declare `openapi` in the remote manifest instead. The server does
not crawl HTML pages or infer a remote directory listing. See
[remote-sources.md](remote-sources.md).

## Public document URLs

`--base-url` must be an absolute HTTP or HTTPS URL without credentials, a query
string, or a fragment. The server preserves its path prefix and maps each corpus
path to an extensionless URL:

```text
--base-url https://docs.example.com/product/
guides/install.md  -> https://docs.example.com/product/guides/install
api/auth.mdx       -> https://docs.example.com/product/api/auth
index.mdx          -> https://docs.example.com/product/
zh-cn/index.md     -> https://docs.example.com/product/zh-cn/
```

Path segments are URL-encoded. A final `index.md` or `index.mdx` maps to its
directory page. Configure the option only when the public site uses this path
convention; it does not host files or verify that the resulting pages exist. In
local mode, results omit `url` when this option is absent. In remote mode,
results use each raw remote Markdown/MDX URL by default; an explicit
`--base-url` replaces it with the human-facing page URL.

### Local URL before deployment

Run the read-only preview in a separate terminal:

```powershell
npm run preview:docs -- --docs C:\docs\product --port 4173
```

Configure the MCP process with the matching base URL:

```text
--base-url http://127.0.0.1:4173/
```

The preview binds only to `127.0.0.1`, accepts only `GET` and `HEAD`, and exposes
both raw Markdown paths and extensionless page URLs. It also generates
`/sumi-docs-manifest.json`, so a second process can exercise remote mode locally:

```powershell
node dist/index.js serve http://127.0.0.1:4173/
```

Pass `--openapi C:\path\to\openapi.json` to the preview process when a custom
corpus needs remote OpenAPI. This HTTP server is a development aid, not a
production documentation host.

## Execution modes

| Mode                 | Entry point                              | Dependency boundary                            | Intended use                        |
| -------------------- | ---------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| Local development    | `tsx src/index.ts` through `npm run dev` | checkout dependencies                          | source work and debugging           |
| Automated tests      | TypeScript tests through `npm test`      | checkout dependencies                          | CI and regression checks            |
| Node.js distribution | `dist/index.js`                          | Node.js plus installed production dependencies | local integration and npm packaging |
| SEA executable       | `artifacts/bin/sumi-docs-mcp.exe`        | self-contained executable                      | deployment without external Node.js |

Development and production do not select different business behavior. They use
different entry artifacts. The document source remains an explicit input in
every mode.

## Environment variables

There are no application environment variables. The cold-start benchmark also
uses CLI options:

```powershell
npm run benchmark:cold-start -- --docs examples/basic/docs --iterations 5
npm run benchmark:cold-start -- --docs examples/basic/docs --iterations 5 --executable artifacts/bin/sumi-docs-mcp.exe
```

Do not add `.env.example` until the application has an actual environment-based
configuration contract.
