# Configuration and environments

Sumi-Docs-MCP accepts CLI arguments and one tracked project contract,
`sumi-docs.config.json`. It does not load `.env` files and it does not branch
behavior on `NODE_ENV`.

## CLI options

```text
sumi-docs-mcp serve [docs-source] [--config <path>] [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
sumi-docs-mcp doctor [docs-source] [--config <path>] [--json] [--show-paths]
```

| Option              | Required | Meaning                                                          |
| ------------------- | -------- | ---------------------------------------------------------------- |
| `[docs-source]`     | no       | local directory or remote HTTPS manifest/base URL                |
| `--config <path>`   | no       | explicitly selected strict project config                        |
| `--openapi <path>`  | no       | local-mode OpenAPI 3.x JSON exposed by `get_openapi_spec`        |
| `--base-url <url>`  | no       | human-facing page prefix added to document tool results          |
| `--transport stdio` | no       | transport selector; stdio is the default and only implementation |
| `--verbose`         | no       | emits lifecycle diagnostics to stderr                            |
| `doctor --json`     | no       | emits a machine-readable read-only diagnostic report             |
| `--show-paths`      | no       | doctor-only opt-in for resolved local paths                      |

## Project discovery

The documentation source is resolved in this order:

1. the explicit CLI source;
2. `source` in an explicitly selected `--config` file;
3. `source` in the nearest `sumi-docs.config.json`, up to and including the
   nearest Git worktree root;
4. `<project-root>/docs`.

The project root is the nearest directory containing a `.git` directory or
worktree file. Without that boundary, the current working directory is the
project root and discovery does not inspect its parents. A surrounding
directory named `.sumi` has no special meaning and is never used as Sumi Docs
state.

The version 1 config is a strict JSON object:

```json
{
  "version": 1,
  "source": "docs",
  "openapi": "openapi.json",
  "baseUrl": "https://docs.example.com/"
}
```

All fields are optional, but a supplied `version` must be `1`. Unknown fields
are rejected. Configured local paths are relative to the config file and must
remain inside the project root, including after resolving the source directory
itself. Explicit CLI paths are operator-selected and may be outside the
project. CLI values override corresponding config values.

When an explicit CLI source selects a remote manifest, a configured local
`openapi` path belongs to the replaced local source and is ignored. An explicit
CLI `--openapi` remains invalid in remote mode; declare it in the manifest.

The resolved local source must be a readable directory containing at least one
Markdown or MDX file. A missing or empty source fails before the MCP transport
starts. Remote sources retain the strict bounded manifest contract.

## Doctor

`doctor` applies the same discovery and precedence rules, then fully loads the
read-only corpus and optional OpenAPI document without starting MCP:

```powershell
node dist/index.js doctor --json
node dist/index.js doctor ./product-docs
node dist/index.js doctor --config C:\project\sumi-docs.config.json
```

The report includes the Node.js compatibility check, project root, selected
config, source origin, local or remote source kind, document count, OpenAPI
state, and configured base URL. Local paths are project-relative or explicit
external placeholders by default. `--show-paths` reveals them only for local
interactive diagnosis; credentials and stack traces stay redacted. JSON mode
writes one object to stdout and uses a nonzero exit code for a failed check.
Sanitized loader diagnostics remain on stderr.

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
pnpm run preview:docs -- --docs ./product-docs --port 4173
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

Pass `--openapi ./product-docs/openapi.json` to the preview process when a custom
corpus needs remote OpenAPI. This HTTP server is a development aid, not a
production documentation host.

## Execution modes

| Mode                 | Entry point                               | Dependency boundary                            | Intended use                          |
| -------------------- | ----------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| Local development    | `tsx src/index.ts` through `pnpm run dev` | checkout dependencies                          | source work and debugging             |
| Automated tests      | TypeScript tests through `pnpm test`      | checkout dependencies                          | CI and regression checks              |
| Node.js distribution | `dist/index.js`                           | Node.js plus installed production dependencies | local integration and package preview |
| SEA executable       | `artifacts/bin/sumi-docs-mcp.exe`         | self-contained executable                      | deployment without external Node.js   |

Development and production do not select different business behavior. They use
different entry artifacts. Source discovery follows the same deterministic
project contract in every mode.

## Environment variables

There are no application environment variables. The cold-start benchmark also
uses CLI options:

```powershell
pnpm run benchmark:cold-start -- --docs examples/basic/docs --iterations 5
pnpm run benchmark:cold-start -- --docs examples/basic/docs --iterations 5 --executable artifacts/bin/sumi-docs-mcp.exe
```

Do not add `.env.example` until the application has an actual environment-based
configuration contract.
