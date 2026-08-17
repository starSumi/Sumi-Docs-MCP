# Release process

This project separates candidate construction, human acceptance, and public
release. A tag push does not publish anything.

## One-time repository setup

1. Restore or initialize the real Git repository and configure its GitHub
   remote. Do not manufacture replacement history from a source-only copy.
2. Create a GitHub environment named `release`.
3. Configure required reviewers for that environment, enable prevention of
   self-review, and disable administrator bypass where the repository plan
   supports those controls.
4. Require the `CI` workflow on the protected default branch.
   Require the `Commit policy` check and both operating-system variants of the
   `verify` job.
5. Create a `release-exception-approved` issue label. Limit use of that label to
   release owners.
6. Enable private vulnerability reporting or publish another private security
   contact before making the repository public.
7. Add the real repository, homepage, and issue tracker URLs to `package.json`
   after the GitHub repository exists.

The release workflows use only the repository `GITHUB_TOKEN`. They do not need a
personal access token or release secret. Artifact attestations require a public
repository on current GitHub Free, Pro, or Team plans; private/internal
repositories require GitHub Enterprise Cloud.

## Build a candidate

Choose the release version before building a candidate. Update `package.json`
and `CHANGELOG.md`, run the full validation suite, and commit those release-prep
changes. The candidate must be built from that immutable commit; no version or
changelog edit is allowed between acceptance and tagging.

Run the `Release candidate` workflow manually. Select the branch or tag whose
tip is under test and enter that exact full 40-character SHA. The workflow
rejects an input SHA that differs from its dispatch ref, so the workflow
provenance, checkout, and candidate manifest identify the same commit. It runs
static checks and tests on Node.js 25.5.0,
builds and smoke-tests the Windows x64 SEA executable, records the cold-start
benchmark, creates checksums, generates provenance attestations, and uploads one
candidate artifact retained for 14 days.

The candidate contains:

- `sumi-docs-mcp-v<version>-windows-x64.zip`
- `sumi-os-docs-mcp-<version>.tgz`
- `SHA256SUMS`
- `RELEASE-MANIFEST.json`
- `benchmark.json`
- `sbom.cdx.json` (CycloneDX)

The workflow also creates a signed SBOM attestation that binds the CycloneDX
document to the ZIP and npm tarball.

The source archives shown by GitHub Releases are generated from the tag, so the
workflow does not upload a duplicate `git archive` tarball.

## Human acceptance

Download the candidate from the workflow run. Verify the checksums and test the
archive that would be released, not a locally rebuilt executable.

```powershell
Get-FileHash .\sumi-docs-mcp-v*-windows-x64.zip -Algorithm SHA256
gh attestation verify .\sumi-docs-mcp-v*-windows-x64.zip --repo OWNER/REPOSITORY
```

Extract the ZIP and run:

```powershell
.\sumi-docs-mcp.exe --version
node path\to\scripts\smoke-example.js --executable .\sumi-docs-mcp.exe
```

Also connect the executable to the intended MCP client and exercise
`list_docs`, `search_docs`, `fetch_doc`, and `get_openapi_spec` against a copy of
representative documentation. Record the candidate workflow run ID and the
accepted commit SHA. A failed hard requirement must be fixed or explicitly
accepted as a documented release exception before proceeding.

The Windows executable is currently unsigned, and the manifest states that
fact. Before a production release, either configure Authenticode signing with a
protected signing identity or record an explicit release-owner decision to ship
an unsigned binary. The current draft workflow requires that decision as an
open repository issue carrying the `release-exception-approved` label.
Checksums and provenance attestations establish artifact identity but are not a
substitute for operating-system code signing.

## Prepare the release draft

After acceptance, confirm that the current commit is the accepted candidate
commit and create an annotated tag on exactly that commit:

```powershell
git status --short
git rev-parse HEAD
git tag -a v0.1.0 -m "Release 0.1.0"
git push origin v0.1.0
```

Run `Prepare release draft` with the accepted candidate run ID, the tag, and the
confirmation value `ACCEPTED`. Set `performance_exception` to `NONE` when the
cold-start hard gate passed. If it failed, the only accepted value is a tracking
issue URL in this repository. Set `unsigned_binary_exception` to the repository
issue that records the release-owner decision to distribute the current
unsigned executable. Each exception issue must remain open and carry the
`release-exception-approved` label. The protected
`release` environment pauses the job for reviewer approval. The job then
verifies that:

- the tag is annotated and matches `package.json`;
- the tag commit is the candidate workflow commit;
- the candidate workflow completed successfully;
- every downloaded asset matches `SHA256SUMS`;
- the unsigned executable has a tracked, approved release exception;
- GitHub recognizes the candidate provenance attestations.

It reuses the accepted candidate assets and does not rebuild them. The workflow
creates a draft Release. Review its notes and assets in GitHub, then publish it
manually. Enable immutable releases in repository settings when that feature is
available for the repository.

## Version policy

Do not create a `v1.0.0` tag while the application reports another version.
Until a deliberate stable-contract decision is made, the repository remains on
the version recorded in `package.json`. Version changes must update the CLI and
MCP server identity and pass the version-consistency test in the same commit.
