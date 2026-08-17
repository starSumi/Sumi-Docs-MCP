---
title: Troubleshooting
description: Diagnose launcher, stdio, remote corpus, URL, and stale-snapshot problems.
---

## The executable prints help and exits

The executable is a command-line server, not a desktop application. Launch it
through an MCP client with `serve <docs-source>`, or run the documented command
from a terminal. Double-clicking it without arguments prints help and exits with
code 0.

## The process appears silent

Stdio servers wait for JSON-RPC on standard input. Silence after startup is
normal. Protocol output uses stdout; diagnostics use stderr. Do not add ordinary
logs to stdout.

## Results have no clickable URL

Pass an HTTP or HTTPS `--base-url`. It maps a machine document path to a page a
person can open; it does not host files or change the MCP transport.

## A remote corpus fails to load

Point the source at the directory containing `sumi-docs-manifest.json`, normally
the deployed site's `/_mcp/` path. The loader accepts HTTPS, plus loopback HTTP
for local testing. It rejects credentials, redirects, traversal, unknown
manifest fields, oversized responses, and non-JSON OpenAPI sources.

## Source changes do not appear

The corpus is a process-local snapshot. Restart the MCP process after changing
local files or publishing a new remote corpus.

Use `--verbose` for diagnostics. Client-facing errors remain sanitized; inspect
stderr for operator details.
