# ADR-0007: Integrate through native agent-host contracts

- Status: Accepted
- Date: 2026-08-17
- Owners: Sumi Docs maintainers

## Context

Codex, Claude Code, and VS Code recognize different project instruction, skill,
and MCP configuration files. A repository Skill can improve routing, but users
may not install it or an agent may not invoke it. A custom startup `notice`
would not be a portable MCP capability.

Project MCP configuration can execute commands. On Windows, VS Code does not
sandbox local MCP processes, so checked-in configuration must preserve workspace
trust and the host's first-run approval.

## Decision

The correctness baseline is the MCP server's self-describing protocol surface:

- concise initialization `instructions`, with the complete essential guidance
  in the first 512 characters;
- accurate tool names, descriptions, and strict schemas;
- an additive corpus-status tool and resource when implemented;
- clear stderr diagnostics and a deterministic CLI `doctor` command.

No Skill is required for list, search, fetch, OpenAPI retrieval, or status.
Resources and change notifications are optional enhancements; clients that only
support tools remain fully functional. Do not add a non-standard `notice`
property or depend on MCP logging being shown as a startup banner.

Host adapters remain thin and native:

| Host        | Project instructions                     | Skill                            | MCP configuration                                             |
| ----------- | ---------------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| Codex       | `AGENTS.md`                              | `.agents/skills/<name>/SKILL.md` | `.codex/config.toml`                                          |
| Claude Code | `CLAUDE.md` importing `AGENTS.md`        | `.claude/skills/<name>/SKILL.md` | `.mcp.json`                                                   |
| VS Code     | `AGENTS.md` and host instruction support | no required duplicate            | root `.mcp.json` for Agent Host, otherwise `.vscode/mcp.json` |

The root `.mcp.json` uses the Claude Code and Agent Host common stdio subset.
Do not register the same server in both root `.mcp.json` and
`.vscode/mcp.json`; add the latter only after a tested extension-host need.
Codex receives its own TOML configuration because it does not consume
`.mcp.json`.

Repository adapters may reference a built local executable only when their
prerequisite is explicit and testable. Consumer templates use a released PATH
command or an operator-supplied executable path; they never depend on a sibling
checkout. Workspace MCP trust and first-run approval stay enabled. No repository
file changes user-global host settings.

Project Skills teach trigger and orchestration policy only. They route agents to
the MCP tools, require status or discovery before answering, and explain failure
behavior. They do not duplicate parsing, access control, source mutation, host
state, or MCP implementation.

## Graceful degradation

When the Skill is missing, initialization instructions and tool descriptions are
the fallback. When project MCP configuration is missing, `doctor --json` emits
the exact supported setup state and documentation location. When the server is
unavailable, the host reports that failure; the agent must not silently answer
from stale generated state while claiming it came from Sumi Docs.

## Validation and rollback

Clean-clone acceptance covers Codex MCP discovery, Claude Code instruction
import and MCP approval, VS Code Workspace Trust and MCP discovery, all four
stable tools, status, and stdout/stderr separation. Adapter removal does not
change the server protocol or corpus, which is the rollback boundary.
