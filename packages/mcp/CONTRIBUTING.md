# Contributing

Sumi-Docs-MCP is a headless, read-only documentation server. Contributions must
preserve strict tool schemas, sanitized errors, path containment, bounded remote
acquisition, stdio protocol output, and the absence of client or session state.
Read [docs/architecture.md](docs/architecture.md),
[docs/tool-reference.md](docs/tool-reference.md), and [SECURITY.md](SECURITY.md)
before changing those boundaries. `AGENTS.md` contains the matching execution
rules used by repository automation.

Start with [the contribution workflow](docs/contributing.md) for issue triage,
branch and pull request expectations, review readiness, validation evidence,
and merge policy. Changes involving client Skills or agent orchestration must
also follow [the Skill and orchestration boundary](docs/skills-and-orchestration.md).

## Workflow

1. Reproduce a bug with a failing test or define the observable acceptance
   criteria for a feature.
2. Keep changes within the owning module. Update shared types before protocol
   implementations when a contract changes.
3. Preserve the read-only tool surface and the absence of client or session
   state.
4. Update user documentation and examples when commands, options, or public tool
   behavior change.
5. Run the required checks in [docs/development.md](docs/development.md).

Do not add a production dependency without documenting why the standard library
and existing dependencies are insufficient. Do not commit `dist/`, `.sea/`,
`artifacts/`, local agent state, coverage, or editor metadata.

## Commit scope

Keep generated artifacts separate from source changes. Historical phase reports
belong in `docs/history/`; durable architecture decisions belong in
`docs/decisions/`. Release-facing changes belong in `CHANGELOG.md`.

The original source archive did not contain Git metadata. The owner authorized
initializing this checkout as the new authoritative repository on 2026-08-14;
that initial import is a provenance boundary, not a reconstruction of missing
history. Branch, commit, and pull request procedures are now enforced by the
repository hooks and GitHub workflows.

## Git quality gates

Use Conventional Commits and keep each commit focused on one reviewable concern.
The repository installs Husky hooks from `pnpm install --frozen-lockfile` when a real `.git` worktree is
present:

- `pre-commit` validates accountable Git identity and performs read-only lint
  and formatting checks on staged paths.
- `commit-msg` validates the message and rejects automated-tool names or
  attribution without altering real Git author metadata.
- `pre-push` runs lint, typecheck, and tests; release-only SEA gates remain
  separate.

Do not routinely bypass hooks with `--no-verify`. See
[docs/git-workflow.md](docs/git-workflow.md) for message examples, hook behavior,
CI boundaries, and the approval-gated history rewrite playbook.
