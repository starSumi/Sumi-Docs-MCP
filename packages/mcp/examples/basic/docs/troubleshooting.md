# Troubleshooting

## The server appears to hang

A stdio MCP server waits for JSON-RPC input and does not present an interactive
prompt. Run `npm run example:smoke` to verify the process, or attach it through an
MCP client. Ordinary diagnostics appear on stderr.

## The CLI prints Usage and exits

The `serve` command and a local directory or remote source URL are required:

```powershell
node dist/index.js serve C:\absolute\path\to\docs
```

## A client cannot find the corpus

Use absolute paths in client configuration. Relative paths are resolved from the
MCP server process working directory, which GUI clients may choose independently
of the project directory.

## OpenAPI is unavailable

Confirm that `--openapi` points to readable JSON with `openapi`, `info`, and
`paths` fields. When the option is omitted, `get_openapi_spec` returns a
`PATH_NOT_FOUND` tool error.

In remote mode, `--openapi` is invalid. Add the relative JSON path to the
manifest's `openapi` field and restart the process.

## A remote source does not load

Confirm that the host serves valid `sumi-docs-manifest.json` and every declared
path without redirects. Production sources require HTTPS; loopback HTTP is
allowed for local testing. The server does not send cookies or authentication
headers and does not crawl an HTML documentation site.

## Source changes do not appear

The corpus is a process-local snapshot. Restart the MCP server after editing a
document or OpenAPI file.

## A local document URL does not open

The MCP process does not host HTTP pages. Start `npm run preview:docs` in a
separate terminal and keep it running. The preview port must match the port in
`--base-url`, and both processes must point to the same documentation root.

## SEA build fails

Check `node --version`. Native `--build-sea` requires Node.js 25.5 or newer for
this project. A normal `npm run build` does not create the standalone executable.
