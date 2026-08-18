---
name: sumi-docs-maintain
description: Scope-aware project adapter for the globally activated Sumi Docs local developer maintainer.
---

# Sumi Docs Maintainer Adapter

This repository is a member of the Sumi Docs project family. Route maintenance
work to the globally activated `sumi-docs-maintain` skill, which owns the
reviewed corpus, catalog, MCP projection, publishing, and release workflow.

Use this adapter only when the workspace has the Sumi Docs markers:

- `sumi-docs.config.json` and `pnpm-workspace.yaml` at the workspace root;
- a package named `@sumi-os/docs-mcp`, `@sumi-os/corpus-contract`, or
  `@sumi-os/docs-web`;
- or a direct Sumi Docs MCP/Web sibling workspace in the same publishing
  chain.

If those markers are absent, do not route to this role. The MCP server remains
the no-Skill fallback for documentation queries.
