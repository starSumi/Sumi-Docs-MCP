# Documentation map

The active documentation is organized by task:

| Document                                                | Audience                 | Purpose                                              |
| ------------------------------------------------------- | ------------------------ | ---------------------------------------------------- |
| [Getting started](getting-started.md)                   | operators                | First local, remote, client, and executable run      |
| [Configuration](configuration.md)                       | operators                | CLI arguments, environment boundary, and limits      |
| [MCP tool reference](tool-reference.md)                 | client integrators       | Exact tool inputs, outputs, errors, and lifecycle    |
| [Remote sources](remote-sources.md)                     | operators and publishers | Strict manifest and bounded HTTPS acquisition        |
| [Troubleshooting](troubleshooting.md)                   | operators                | Launcher, stdio, URL, OpenAPI, and source failures   |
| [Architecture](architecture.md)                         | maintainers              | Module boundaries, trust model, and data lifecycle   |
| [Contributing](contributing.md)                         | contributors             | Issue, pull request, review, and merge lifecycle     |
| [Development](development.md)                           | contributors             | Setup, tests, builds, examples, and packaging        |
| [Git workflow](git-workflow.md)                         | contributors             | Commit policy, hooks, CI, and guarded rewrites       |
| [Skills and orchestration](skills-and-orchestration.md) | integrators              | Skill, MCP, agent host, and Web ownership boundaries |
| [Releasing](releasing.md)                               | release owners           | Candidate, human acceptance, promotion, rollback     |
| [Architecture decisions](decisions/)                    | maintainers              | Durable decisions and supersession links             |
| [History](history/)                                     | auditors                 | Superseded phase snapshots, not current authority    |

The root [README](../README.md) is the first-run contract. The root
[SECURITY](../SECURITY.md), [CONTRIBUTING](../CONTRIBUTING.md), and
[CHANGELOG](../CHANGELOG.md) files own their conventional repository roles.

`examples/basic/docs/` is an executable self-hosting projection of selected
operator, contribution, integration, and architecture documents plus an independent MDX API example.
Integration tests define and enforce which files mirror this directory. It is
not a second authority.
