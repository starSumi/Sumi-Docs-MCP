import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  catalogPublisherDocuments,
  contentCatalog,
} from "../apps/web/src/content-catalog.ts";

import {
  ALLOWED_HOST_FILES,
  isHostControlledPath,
  parseIndexEntries,
  validateHostEntries,
} from "../scripts/verify-host-files.mjs";
import { validateLockfile } from "../scripts/verify-lockfile.mjs";
import { readNodeRuntimeLicense } from "../scripts/node-runtime-license.mjs";
import {
  createSbom,
  noticeSection,
} from "../scripts/build-compliance-artifacts.mjs";
import {
  REQUIRED_PNPM_VERSION,
  validatePackageManager,
} from "../scripts/enforce-package-manager.mjs";
import {
  verifyDependencyGraph,
  verifyNotices,
} from "../scripts/verify-compliance-artifacts.mjs";
import {
  loadWorkflowPolicyInput,
  validateWorkflowPolicy,
} from "../scripts/verify-workflows.mjs";
import {
  DOC_TRANSLATION_PATHS,
  gitBlobHash,
  validatePairRecord,
} from "../scripts/verify-translation-pairing.mjs";

test("host adapters use an exact case-sensitive allowlist", () => {
  for (const path of ALLOWED_HOST_FILES) {
    assert.equal(isHostControlledPath(path), true);
    assert.deepEqual(validateHostEntries([{ mode: "100644", path }]), []);
  }

  for (const path of [
    ".claude/projects/session.jsonl",
    ".codex/sessions/rollout.jsonl",
    ".agent/state.json",
    ".agents/logs/trace.json",
    ".vscode/settings.json",
    ".Claude/skills/sumi-docs-maintain/SKILL.md",
    ".MCP.json",
    ".mcp.local.json",
  ]) {
    assert.equal(isHostControlledPath(path), true);
    assert.match(
      validateHostEntries([{ mode: "100644", path }])[0],
      /not allowlisted/u,
    );
  }
});

test("host adapters reject symlinks and executable file modes", () => {
  const path = ".codex/config.toml";
  assert.match(validateHostEntries([{ mode: "120000", path }])[0], /regular/u);
  assert.match(validateHostEntries([{ mode: "100755", path }])[0], /regular/u);
  assert.match(
    validateHostEntries([{ mode: "120000", path: ".mcp.json" }])[0],
    /regular/u,
  );
});

test("tracked host adapter validation requires the complete supported set", () => {
  const complete = [...ALLOWED_HOST_FILES].map((path) => ({
    mode: "100644",
    path,
  }));
  assert.deepEqual(
    validateHostEntries(complete, { requireComplete: true }),
    [],
  );

  const errors = validateHostEntries(complete.slice(1), {
    requireComplete: true,
  });
  assert.deepEqual(errors, [
    `Required host adapter is not tracked: ${complete[0].path}`,
  ]);
});

test("git index parsing is NUL-safe", () => {
  const output =
    "100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\t.codex/config.toml\0" +
    "100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\t.vscode/name\nwith-newline.json\0";
  assert.deepEqual(parseIndexEntries(output), [
    { mode: "100644", path: ".codex/config.toml" },
    { mode: "100644", path: ".vscode/name\nwith-newline.json" },
  ]);
});

test("lockfile policy rejects mirrors, weak integrity, and external links", () => {
  const base = {
    lockfileVersion: "9.0",
    importers: { ".": {} },
    packages: {
      "good@1.0.0": {
        resolution: { integrity: `sha512-${"A".repeat(86)}==` },
      },
    },
  };
  assert.deepEqual(validateLockfile(base).errors, []);

  for (const metadata of [
    {
      resolution: {
        tarball: "https://registry.npmmirror.com/bad/-/bad-1.0.0.tgz",
        integrity: `sha512-${"A".repeat(86)}==`,
      },
    },
    {
      resolution: {
        tarball: "http://registry.npmjs.org/bad/-/bad-1.0.0.tgz",
        integrity: `sha512-${"A".repeat(86)}==`,
      },
    },
    {
      resolution: { integrity: "sha1-weak" },
    },
    { resolution: { git: "https://example.invalid/repository.git" } },
  ]) {
    const result = validateLockfile({
      lockfileVersion: "9.0",
      importers: { ".": {} },
      packages: { "bad@1.0.0": metadata },
    });
    assert.ok(result.errors.length > 0);
  }
});

test("the install lifecycle requires the pinned pnpm version", () => {
  const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(rootPackage.packageManager, `pnpm@${REQUIRED_PNPM_VERSION}`);
  assert.equal(rootPackage.engines.pnpm, REQUIRED_PNPM_VERSION);
  assert.equal(
    rootPackage.scripts.preinstall,
    "node scripts/enforce-package-manager.mjs",
  );
  assert.equal(
    validatePackageManager(
      `pnpm/${REQUIRED_PNPM_VERSION} npm/? node/v25.5.0 win32 x64`,
    ),
    undefined,
  );
  assert.match(validatePackageManager("npm/11.15.0 node/v25.5.0"), /Use pnpm/u);
  assert.match(validatePackageManager("pnpm/10.25.0 npm/?"), /Expected pnpm/u);

  for (const workspacePackagePath of [
    "apps/web/package.json",
    "packages/corpus-contract/package.json",
    "packages/mcp/package.json",
  ]) {
    const workspacePackage = JSON.parse(
      readFileSync(workspacePackagePath, "utf8"),
    );
    assert.deepEqual(workspacePackage.volta, {
      extends: "../../package.json",
    });
  }

  const packageFiles = [
    "package.json",
    "apps/web/package.json",
    "packages/corpus-contract/package.json",
    "packages/mcp/package.json",
  ];
  for (const packageFile of packageFiles) {
    const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
    for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
      assert.doesNotMatch(
        command,
        /(?:^|&&|\|\|)\s*pnpm(?:\s+run)?\b/u,
        `${packageFile} script ${name} recursively invokes pnpm`,
      );
    }
  }

  for (const hookPath of [
    ".husky/commit-msg",
    ".husky/pre-commit",
    ".husky/pre-push",
  ]) {
    const hook = readFileSync(hookPath, "utf8");
    assert.match(hook, /command -v volta/u);
    assert.match(hook, /volta run --node 25\.5\.0 -- pnpm run/u);
    assert.match(hook, /else\n {2}pnpm run (?:commitlint|lint:staged|verify)/u);
  }

  const rootPackageManifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(
    rootPackageManifest.scripts["build:compliance"],
    "node scripts/build-compliance-artifacts.mjs && node scripts/verify-compliance-artifacts.mjs",
  );

  const accepted = spawnSync(
    process.execPath,
    ["scripts/enforce-package-manager.mjs"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_user_agent: `pnpm/${REQUIRED_PNPM_VERSION} npm/? node/v25.5.0 win32 x64`,
      },
    },
  );
  assert.equal(accepted.status, 0, accepted.stderr);

  const rejected = spawnSync(
    process.execPath,
    ["scripts/enforce-package-manager.mjs"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_user_agent: "npm/11.15.0 node/v25.5.0",
      },
    },
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Use pnpm/u);
});

test("Node runtime license discovery supports archive and Unix layouts", () => {
  const root = mkdtempSync(join(tmpdir(), "sumi-node-license-"));
  try {
    const archiveRoot = join(root, "archive");
    const unixBin = join(root, "unix", "bin");
    mkdirSync(archiveRoot, { recursive: true });
    mkdirSync(unixBin, { recursive: true });
    writeFileSync(join(archiveRoot, "LICENSE"), "archive license\n");
    writeFileSync(join(root, "unix", "LICENSE"), "unix license\n");

    assert.equal(
      readNodeRuntimeLicense(join(archiveRoot, "node.exe")).content.toString(),
      "archive license\n",
    );
    assert.equal(
      readNodeRuntimeLicense(join(unixBin, "node")).content.toString(),
      "unix license\n",
    );
    assert.throws(
      () => readNodeRuntimeLicense(join(root, "missing", "bin", "node")),
      /distribution license was not found/u,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("compliance dependency edges resolve scoped pnpm-style siblings", () => {
  const root = mkdtempSync(join(tmpdir(), "sumi-compliance-graph-"));
  const appPath = join(root, "app");
  const parentPath = join(appPath, "node_modules", "@fixture", "parent");
  const childPath = join(appPath, "node_modules", "@fixture", "child");
  const writePackage = (path, manifest) => {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(path, "index.js"), "export {};\n");
  };

  try {
    const appManifest = {
      name: "fixture-app",
      version: "1.0.0",
      license: "MIT",
      dependencies: { "@fixture/parent": "1.0.0" },
    };
    const parentManifest = {
      name: "@fixture/parent",
      version: "1.0.0",
      license: "MIT",
      exports: { ".": { import: "./index.js" } },
      dependencies: { "@fixture/child": "1.0.0" },
    };
    const childManifest = {
      name: "@fixture/child",
      version: "1.0.0",
      license: "MIT",
      main: "index.js",
    };
    writePackage(appPath, appManifest);
    writePackage(parentPath, parentManifest);
    writePackage(childPath, childManifest);

    const components = [
      {
        identity: "@fixture/child@1.0.0",
        name: "@fixture/child",
        version: "1.0.0",
        license: "MIT",
        path: childPath,
      },
      {
        identity: "@fixture/parent@1.0.0",
        name: "@fixture/parent",
        version: "1.0.0",
        license: "MIT",
        path: parentPath,
      },
    ];
    const inventory = new Map(
      components.map((component) => [component.identity, component]),
    );
    const artifact = {
      key: "fixture",
      artifactRole: "test-input",
      manifest: appManifest,
      manifestPath: join(appPath, "package.json"),
      rootIdentity: "fixture-app@1.0.0",
      components: new Set(inventory.keys()),
      firstParty: new Map(),
      includeNode: false,
    };
    const bom = createSbom(artifact, components);
    assert.deepEqual(
      bom.dependencies.find((entry) => entry.ref === "fixture-app@1.0.0")
        .dependsOn,
      ["@fixture/parent@1.0.0"],
    );
    assert.deepEqual(
      bom.dependencies.find((entry) => entry.ref === "@fixture/parent@1.0.0")
        .dependsOn,
      ["@fixture/child@1.0.0"],
    );
    assert.doesNotThrow(() => verifyDependencyGraph(bom, artifact, inventory));

    const missingEdge = structuredClone(bom);
    missingEdge.dependencies.find(
      (entry) => entry.ref === "@fixture/parent@1.0.0",
    ).dependsOn = [];
    assert.throws(
      () => verifyDependencyGraph(missingEdge, artifact, inventory),
      /dependency edge set is incorrect/u,
    );

    const missingPath = join(root, "orphan", "@fixture", "missing");
    const missingComponent = {
      identity: "@fixture/missing@1.0.0",
      name: "@fixture/missing",
      version: "1.0.0",
      license: "MIT",
      path: missingPath,
    };
    writePackage(missingPath, {
      name: missingComponent.name,
      version: missingComponent.version,
      license: missingComponent.license,
      main: "index.js",
    });
    writeFileSync(
      join(parentPath, "package.json"),
      JSON.stringify({
        ...parentManifest,
        dependencies: {
          ...parentManifest.dependencies,
          "@fixture/missing": "1.0.0",
        },
      }),
    );
    components.push(missingComponent);
    inventory.set(missingComponent.identity, missingComponent);
    artifact.components.add(missingComponent.identity);
    assert.throws(
      () => createSbom(artifact, components),
      /Selected dependency @fixture\/missing cannot be resolved/u,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("compliance notices require non-empty license evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "sumi-compliance-license-"));
  const component = {
    identity: "fixture-license@1.0.0",
    name: "fixture-license",
    version: "1.0.0",
    license: "MIT",
    path: root,
  };

  try {
    writeFileSync(join(root, "NOTICE"), "Supplemental attribution.\n");
    assert.throws(
      () => noticeSection(component, "test-input", new Map()),
      /No non-empty license file or exact reviewed override/u,
    );

    writeFileSync(join(root, "LICENSE"), "  \n");
    assert.throws(
      () => noticeSection(component, "test-input", new Map()),
      /No non-empty license file or exact reviewed override/u,
    );

    const badOverride = new Map([
      [
        component.identity,
        {
          license: "MIT",
          source: "https://example.invalid/license",
          sha256: "0".repeat(64),
          text: "Reviewed terms",
          evidence: [],
        },
      ],
    ]);
    assert.throws(
      () => noticeSection(component, "test-input", badOverride),
      /override drifted/u,
    );

    writeFileSync(join(root, "LICENSE"), "Fixture license terms.\n");
    const section = noticeSection(component, "test-input", new Map());
    assert.match(section, /^License evidence: package-file$/mu);
    assert.match(section, /^License source: LICENSE$/mu);
    assert.match(section, /^Supplemental notice source: NOTICE$/mu);

    const noticesPath = join(root, "THIRD_PARTY_NOTICES.txt");
    const bom = {
      components: [
        {
          name: component.name,
          "bom-ref": component.identity,
          properties: [],
        },
      ],
    };
    writeFileSync(
      noticesPath,
      `THIRD-PARTY SOFTWARE NOTICES\n\n${section}\n\n${"=".repeat(80)}\n`,
    );
    assert.doesNotThrow(() => verifyNotices(noticesPath, bom));

    const malformed = section
      .replace("License source: LICENSE", "License source: NOTICE")
      .replace("----- LICENSE -----", "----- NOTICE -----");
    writeFileSync(
      noticesPath,
      `THIRD-PARTY SOFTWARE NOTICES\n\n${malformed}\n\n${"=".repeat(80)}\n`,
    );
    assert.throws(
      () => verifyNotices(noticesPath, bom),
      /package-file evidence is incomplete/u,
    );

    rmSync(join(root, "LICENSE"));
    const reviewedText = "Reviewed license terms";
    const validOverride = new Map([
      [
        component.identity,
        {
          license: "MIT",
          source: "https://example.invalid/license",
          sha256: createHash("sha256").update(reviewedText).digest("hex"),
          text: reviewedText,
          evidence: [],
        },
      ],
    ]);
    assert.match(
      noticeSection(component, "test-input", validOverride),
      /^License evidence: reviewed-override$/mu,
    );
    assert.throws(
      () =>
        noticeSection(
          { ...component, identity: "fixture-license@1.0.1" },
          "test-input",
          validOverride,
        ),
      /No non-empty license file or exact reviewed override/u,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("product source directories contain TypeScript only", () => {
  const sourceRoots = [
    "apps/web/src",
    "packages/corpus-contract/src",
    "packages/mcp/src",
  ];
  const javascriptSources = [];
  const visitSource = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visitSource(path);
      else if (entry.isFile() && /\.(?:c|m)?js$/u.test(entry.name)) {
        javascriptSources.push(path.replaceAll("\\", "/"));
      }
    }
  };
  for (const root of sourceRoots) visitSource(root);
  assert.deepEqual(javascriptSources, []);
});

test("README translations require an exact confirmed content pair", () => {
  const contents = new Map([
    ["README.md", Buffer.from("English\n")],
    ["README.zh-CN.md", Buffer.from("Chinese\n")],
  ]);
  const record = Object.fromEntries(
    [...contents].map(([path, content]) => [path, gitBlobHash(content)]),
  );
  assert.deepEqual(validatePairRecord(record, contents), []);

  contents.set("README.md", Buffer.from("changed\n"));
  assert.match(validatePairRecord(record, contents)[0], /changed/u);
  assert.ok(
    validatePairRecord({ ...record, extra: "value" }, contents).some((error) =>
      error.includes("only"),
    ),
  );
});

test("the content catalog drives a complete bilingual freshness baseline", () => {
  assert.equal(DOC_TRANSLATION_PATHS.length, 34);
  assert.equal(new Set(DOC_TRANSLATION_PATHS).size, 34);
  assert.ok(DOC_TRANSLATION_PATHS.every((path) => path.startsWith("docs/")));

  const contents = new Map(
    DOC_TRANSLATION_PATHS.map((path) => [path, Buffer.from(`${path}\n`)]),
  );
  const record = Object.fromEntries(
    [...contents].map(([path, content]) => [path, gitBlobHash(content)]),
  );
  assert.deepEqual(
    validatePairRecord(record, contents, DOC_TRANSLATION_PATHS),
    [],
  );
});

test("mutable operational state stays outside Git and the public corpus", () => {
  const mutableStateName =
    /(?:^|\/)(?:current-state|candidate-(?:state|status)|checkpoint|cursor|state)\.[^/]+$/iu;
  const docsFiles = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile())
        docsFiles.push(relative("docs", path).replaceAll("\\", "/"));
    }
  };
  visit("docs");

  assert.deepEqual(
    docsFiles.filter((path) => mutableStateName.test(path)),
    [],
  );
  assert.deepEqual(
    catalogPublisherDocuments(contentCatalog)
      .map(({ source }) => source)
      .filter((path) => mutableStateName.test(path)),
    [],
  );

  const ignore = readFileSync(".gitignore", "utf8");
  assert.match(ignore, /(?:^|\n)\.agent\/(?:\r?\n|$)/u);

  for (const stableDocument of [
    "operations/checkpoints.md",
    "operations/handoff.md",
    "operations/release-readiness.md",
    "operations/evaluation-matrix.md",
  ]) {
    assert.ok(docsFiles.includes(stableDocument));
  }
});

test("Oxlint is the single repository lint engine", () => {
  const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
  const mcpPackage = JSON.parse(
    readFileSync("packages/mcp/package.json", "utf8"),
  );
  const config = JSON.parse(readFileSync(".oxlintrc.json", "utf8"));

  assert.equal(rootPackage.devDependencies.oxlint, "1.78.0");
  assert.match(rootPackage.scripts.lint, /^oxlint\b/u);
  assert.match(mcpPackage.scripts.lint, /^oxlint\b/u);
  assert.equal(existsSync("packages/mcp/eslint.config.js"), false);

  for (const dependency of ["eslint", "@eslint/js", "typescript-eslint"]) {
    assert.equal(rootPackage.devDependencies[dependency], undefined);
    assert.equal(mcpPackage.devDependencies[dependency], undefined);
  }

  assert.deepEqual(config.plugins, ["typescript"]);
  assert.equal(config.categories.correctness, "off");
  assert.equal(config.rules["no-unused-vars"], "error");
  assert.equal(config.rules["typescript/no-explicit-any"], "error");
  assert.equal(config.options.reportUnusedDisableDirectives, "error");
});

test("duplicate-code growth is bounded by one root policy", () => {
  const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
  const config = JSON.parse(readFileSync(".jscpd.json", "utf8"));

  assert.equal(rootPackage.devDependencies.jscpd, "5.0.12");
  assert.match(rootPackage.scripts.duplication, /^jscpd\b/u);
  assert.ok(rootPackage.scripts.verify.includes("node --run duplication"));
  assert.equal(config.threshold, 5);
  assert.equal(config.minTokens, 60);
  assert.ok(config.ignore.includes("**/tests/**"));
  assert.equal("exitCode" in config, false);
});

test("active workflows enforce privilege and supersession boundaries", () => {
  const input = loadWorkflowPolicyInput();
  assert.deepEqual(validateWorkflowPolicy(input), []);

  const weakened = structuredClone(input);
  weakened.candidate.permissions["id-token"] = "write";
  weakened.operations.jobs.observe.steps.find(
    (step) => step.name === "Upload immutable observation",
  ).if = "always()";
  weakened.candidate.jobs.build.steps =
    weakened.candidate.jobs.build.steps.filter(
      (step) => step.id !== "enforce-performance",
    );
  weakened.operations.jobs.observe.steps.find(
    (step) => step.name === "Observe product health",
  ).run += "\npnpm run verify 2>&1 | tee artifacts/operations/verify.log";
  weakened.candidate.jobs.build.steps.find(
    (step) => step.name === "Upload for human acceptance",
  ).with.path = "artifacts/*";
  weakened.candidate.jobs.build.steps.find(
    (step) => step.id === "performance",
  ).run =
    "pnpm run benchmark:cold-start -- --iterations 100 --output ../../artifacts/cold-start.json";
  weakened.candidate.jobs.build.steps.find(
    (step) => step.name === "Package candidate",
  ).run = [
    "pnpm run build:compliance",
    "Copy-Item artifacts/compliance/web/NODEJS_LICENSE.txt web",
    "Compress-Archive artifacts/bin/sumi-docs-mcp.exe artifacts/mcp.zip",
  ].join("\n");
  weakened.candidate.jobs.build.steps.find(
    (step) => step.name === "Smoke test Windows executable",
  ).run =
    "pnpm --filter @sumi-os/docs-mcp example:smoke -- --executable artifacts/bin/sumi-docs-mcp.exe";
  weakened.ci.jobs.verify.steps = weakened.ci.jobs.verify.steps.filter(
    (step) => step.name !== "Install the pinned package manager",
  );
  weakened.pages.jobs.build.steps.find(
    (step) => step.name === "Build and verify site",
  ).env.BASE_PATH = "/unreviewed/";
  weakened.pages.jobs.build.steps.find(
    (step) => step.name === "Upload verified Pages artifact",
  ).with.path = ".";
  weakened.pages.jobs.deploy.permissions.contents = "write";
  const errors = validateWorkflowPolicy(weakened);
  assert.ok(errors.some((error) => error.includes("permissions")));
  assert.ok(errors.some((error) => error.includes("cancelled or superseded")));
  assert.ok(errors.some((error) => error.includes("performance diagnostics")));
  assert.ok(errors.some((error) => error.includes("structured allowlist")));
  assert.ok(errors.some((error) => error.includes("structured observation")));
  assert.ok(errors.some((error) => error.includes("compliance material")));
  assert.ok(errors.some((error) => error.includes("built SEA binary")));
  assert.ok(errors.some((error) => error.includes("pinned pnpm")));
  assert.ok(errors.some((error) => error.includes("configured origin/base")));
  assert.ok(errors.some((error) => error.includes("verified Web artifact")));
  assert.ok(errors.some((error) => error.includes("deployment authority")));
});

test("candidate cold-start evidence command rejects weakened or custom baselines", () => {
  const exactCommand = [
    "New-Item -ItemType Directory -Force artifacts | Out-Null",
    "pnpm run benchmark:cold-start --docs examples/basic/docs --iterations 100 --executable artifacts/bin/sumi-docs-mcp.exe --output ../../artifacts/cold-start.json",
    "exit $LASTEXITCODE",
  ].join("\n");
  const variants = [
    exactCommand.replace("--docs examples/basic/docs ", ""),
    exactCommand.replace("--executable artifacts/bin/sumi-docs-mcp.exe ", ""),
    exactCommand.replace("--iterations 100", "--iterations 1"),
    exactCommand.replace(" --output", " --raw-executable custom.exe --output"),
    exactCommand.replace(" --output", " --sdk-executable custom.exe --output"),
    exactCommand.replace(" --output ../../artifacts/cold-start.json", ""),
  ];

  const valid = loadWorkflowPolicyInput();
  valid.candidate.jobs.build.steps.find(
    (step) => step.id === "performance",
  ).run = exactCommand;
  assert.deepEqual(validateWorkflowPolicy(valid), []);

  for (const run of variants) {
    const weakened = structuredClone(valid);
    weakened.candidate.jobs.build.steps.find(
      (step) => step.id === "performance",
    ).run = run;
    assert.ok(
      validateWorkflowPolicy(weakened).some((error) =>
        error.includes("performance diagnostics"),
      ),
      run,
    );
  }
});
