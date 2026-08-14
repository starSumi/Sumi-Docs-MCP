# Development and validation

## Setup

Use Node.js 25.5.0 and npm 11.15.0. `.node-version`, `package.json`, and the
GitHub workflows declare the same toolchain.

```powershell
npm ci
npm run dev
```

`npm run dev` serves the checked-in example corpus from TypeScript. Use
`npm run dev:watch` while changing source files. Both commands reserve stdout
for MCP JSON-RPC traffic.

`npm run preview:docs` is a separate loopback HTTP process for opening the
example corpus and exercising the remote-source loader. It does not carry MCP
traffic and is not a second MCP transport. Override its corpus, OpenAPI input,
and port with `--docs`, `--openapi`, and `--port`:

```powershell
npm run preview:docs -- --docs C:\docs\product --port 4173
```

While it is running, `node dist/index.js serve http://127.0.0.1:4173/` loads its
generated manifest as a remote source.

Run a compiled-process round trip against that remote source with:

```powershell
npm run example:smoke -- --docs-source http://127.0.0.1:4173/
```

## Required checks

Run these before handing off a change:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run example:smoke
npm pack --dry-run
```

Changes to SEA configuration or packaging also require Node.js 25.5 or newer:

```powershell
npm run build:sea
.\artifacts\bin\sumi-docs-mcp.exe --version
npm run example:smoke -- --executable artifacts/bin/sumi-docs-mcp.exe
npm run benchmark:cold-start -- --executable artifacts/bin/sumi-docs-mcp.exe
```

The benchmark measures process spawn to the first `tools/list` response. It exits
nonzero when any measured iteration reaches the 100 ms project hard limit. That
limit is currently an open performance requirement, not a passing status.

## Test layout

- `tests/unit/` covers parsers, VFS behavior, CLI parsing, path validation, and
  SEA configuration.
- `tests/integration/mcp.test.ts` covers protocol behavior in memory.
- `tests/integration/remote-source.test.ts` covers bounded remote acquisition
  and all four MCP tools over a remote snapshot.
- `tests/integration/example-corpus.test.ts` verifies the checked-in example.
- `scripts/smoke-example.js` verifies the compiled CLI over a real stdio child
  process.

Protocol changes should begin with a failing test. Security fixes require a
regression test that demonstrates the rejected input or incorrect boundary.

## Packaging

`npm pack` runs `prepack`, which rebuilds `dist/`. The package allowlist contains
the compiled distribution, active operator documentation, examples, project
policies, README, and license. Local state, historical reports, tests, and SEA
artifacts are excluded.

The npm package is not currently published. Do not document `npx` or global
installation as supported until registry publication is verified.

The GitHub Releases candidate and human-acceptance workflow is documented in
[releasing.md](releasing.md). Candidate construction includes the Windows x64
archive, an installable npm tarball, checksums, a CycloneDX SBOM, a benchmark
record, and provenance attestations.
