# Remote documentation sources

Remote mode reads a bounded, immutable corpus snapshot from an HTTP host. It
uses the same stdio MCP transport and the same four tools as local directory
mode. It is a source mode, not an HTTP MCP transport.

## Manifest

Publish `sumi-docs-manifest.json` beside the source documents:

```json
{
  "version": 1,
  "documents": ["getting-started.md", "api/authentication.mdx"],
  "openapi": "openapi.json"
}
```

`version` and `documents` are required. `openapi` is optional. Unknown fields,
duplicate document entries, absolute paths, traversal segments, and paths
outside the restricted Markdown/MDX or JSON character set are rejected. Every
entry is resolved relative to the manifest URL and redirects are rejected.

Start the server with either the directory URL or the complete manifest URL:

```powershell
node dist/index.js serve https://content.example.com/product/
node dist/index.js serve https://content.example.com/product/sumi-docs-manifest.json
```

HTTPS is required except for loopback HTTP used during local development. URLs
with credentials, query strings, or fragments are rejected. Authentication
headers and cookies are not supported; publish the corpus on a host the MCP
process can read without credentials.

## Resource limits

The loader applies these fixed limits before parsing:

| Resource                   |         Limit |
| -------------------------- | ------------: |
| Manifest                   |       256 KiB |
| Documents                  | 1,000 entries |
| One Markdown/MDX document  |         2 MiB |
| All Markdown/MDX documents |        64 MiB |
| OpenAPI JSON               |         8 MiB |
| Parallel downloads         |             8 |
| One request                |    10 seconds |

All documents are downloaded and parsed during the first content tool call.
The snapshot is reused until process exit. Restart the process to pick up remote
changes. One failed, oversized, invalid, or redirected response rejects the
whole snapshot.

## Machine and human URLs

The positional URL tells Sumi-Docs-MCP where machines read the manifest and raw
files. Without `--base-url`, list, search, and fetch results expose each raw
document URL. Use `--base-url` when people should open a separate rendered site:

```powershell
node dist/index.js serve https://raw.example.com/product/ --base-url https://docs.example.com/product/
```

The resulting `url` values use the rendered site prefix and extensionless
document paths. The server does not check that those pages exist.

## Local remote-mode exercise

Terminal 1 hosts the example source and generated manifest:

```powershell
npm run preview:docs
```

Terminal 2 starts the MCP server in remote source mode:

```powershell
node dist/index.js serve http://127.0.0.1:4173/ --base-url http://127.0.0.1:4173/
```

Configure an MCP client to launch the second command. The preview is bound to
loopback and is intended only for development.
