## Summary

Describe the visible site or machine-projection change.

## Related issue

Link the issue, or explain why this narrow change does not require one.

## Change type

- [ ] Human documentation or translation
- [ ] Machine corpus, route map, or publishing contract
- [ ] Styling, accessibility, or theme behavior
- [ ] Build, deployment, CI, or release process
- [ ] Skill, agent, or orchestration integration

## What, why, and how

Explain the problem, intended outcome, and implementation approach.

## Contract and risk

- [ ] English and Simplified Chinese pages remain paired.
- [ ] Every published source has an explicit page mapping.
- [ ] Human pages and `_mcp` content describe the same behavior.
- [ ] Trusted-content and public-data boundaries are preserved.
- [ ] No secret, generated artifact, local agent state, or unrelated change is included.
- [ ] Skill changes define trigger, non-trigger, failure, validation, and rollback behavior.

## Validation

| Command                                 | Result and environment |
| --------------------------------------- | ---------------------- |
| `npm run verify:push`                   |                        |
| `npm run verify:mcp`                    |                        |
| Additional browser or deployment checks |                        |

List failed or skipped gates explicitly.

## Rollback

Describe how to revert the content, route, projection, or deployment change.

## Reviewer notes

Call out locale, route, security, accessibility, or compatibility decisions that
need particular attention.
