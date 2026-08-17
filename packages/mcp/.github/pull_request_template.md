## Summary

Describe the externally observable change in a few sentences.

## Related issue

Link the issue, or explain why this narrow change does not require one.

## Change type

- [ ] MCP server or public protocol contract
- [ ] Documentation or executable example
- [ ] Security or source-acquisition boundary
- [ ] Build, packaging, CI, or release process
- [ ] Skill, agent, or orchestration integration

## What, why, and how

Explain what changed, why it is needed, and the implementation approach.

## Contract and risk

- [ ] Read-only behavior and the absence of client/session state are preserved, or the architecture change is approved.
- [ ] Tool schemas, types, examples, active documentation, and changelog are updated when applicable.
- [ ] No secret, generated artifact, local agent state, or unrelated change is included.
- [ ] New dependencies and security limits are justified when applicable.
- [ ] Skill changes include trigger, non-trigger, failure, validation, and rollback behavior.

## Validation

| Command                            | Result and environment |
| ---------------------------------- | ---------------------- |
| `npm run verify:push`              |                        |
| `npm run build`                    |                        |
| `npm run example:smoke`            |                        |
| `npm pack --dry-run`               |                        |
| Additional or cross-project checks |                        |

List failed or skipped gates explicitly.

## Rollback

Describe how to remove or disable this change if it causes a regression.

## Reviewer notes

Call out compatibility, security, performance, or migration decisions that need
particular attention.
