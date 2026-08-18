import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

const PINNED_ACTION = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/u;
const PNPM_SETUP_ACTION =
  "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1";
const ACTIVE_WORKFLOWS = new Set([
  "candidate.yml",
  "ci.yml",
  "operations-observe.yml",
]);

function workflowSteps(workflow) {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

function sameKeys(object, keys) {
  return (
    object &&
    typeof object === "object" &&
    JSON.stringify(Object.keys(object).sort()) ===
      JSON.stringify([...keys].sort())
  );
}

function validatePnpmLifecycle(workflowName, jobName, job, errors) {
  const steps = job?.steps ?? [];
  const setupIndex = steps.findIndex((step) => step.uses === PNPM_SETUP_ACTION);
  const installIndex = steps.findIndex((step) =>
    String(step.run ?? "").includes(
      "pnpm install --frozen-lockfile --ignore-scripts",
    ),
  );
  const setup = steps[setupIndex];
  if (
    setupIndex < 0 ||
    installIndex <= setupIndex ||
    String(setup?.with?.version) !== "10.26.0" ||
    setup?.with?.run_install !== false
  ) {
    errors.push(
      `${workflowName} ${jobName} must install pinned pnpm before the frozen dependency install.`,
    );
  }
  if (
    steps.some((step) =>
      /(?:^|\s)npm\s+(?:ci|install|run|test|pack|audit)(?:\s|$)/u.test(
        String(step.run ?? ""),
      ),
    )
  ) {
    errors.push(
      `${workflowName} ${jobName} must not invoke npm lifecycle commands.`,
    );
  }
}

export function validateWorkflowPolicy({
  ci,
  candidate,
  operations,
  rootWorkflowNames,
  nestedWorkflowPaths,
}) {
  const errors = [];
  const workflows = {
    "ci.yml": ci,
    "candidate.yml": candidate,
    "operations-observe.yml": operations,
  };

  for (const [name, workflow] of Object.entries(workflows)) {
    for (const step of workflowSteps(workflow)) {
      if (step.uses && !PINNED_ACTION.test(step.uses)) {
        errors.push(`${name} contains a mutable action: ${step.uses}`);
      }
    }
  }

  const unexpectedRoot = rootWorkflowNames.filter(
    (name) => !ACTIVE_WORKFLOWS.has(name),
  );
  const missingRoot = [...ACTIVE_WORKFLOWS].filter(
    (name) => !rootWorkflowNames.includes(name),
  );
  if (unexpectedRoot.length > 0) {
    errors.push(`Unreviewed root workflows: ${unexpectedRoot.join(", ")}`);
  }
  if (missingRoot.length > 0) {
    errors.push(`Missing active workflows: ${missingRoot.join(", ")}`);
  }
  if (nestedWorkflowPaths.length > 0) {
    errors.push(
      `Nested workflows are inert: ${nestedWorkflowPaths.join(", ")}`,
    );
  }

  if (
    !sameKeys(ci.permissions, ["contents"]) ||
    ci.permissions.contents !== "read"
  ) {
    errors.push("CI must have read-only contents permission.");
  }
  validatePnpmLifecycle(
    "CI",
    "commit-policy",
    ci.jobs?.["commit-policy"],
    errors,
  );
  validatePnpmLifecycle("CI", "verify", ci.jobs?.verify, errors);

  if (
    !sameKeys(candidate.permissions, ["contents"]) ||
    candidate.permissions.contents !== "read"
  ) {
    errors.push(
      "Candidate workflow-level permissions must be contents: read only.",
    );
  }
  if (
    candidate.concurrency?.group !==
      "acceptance-candidate-${{ github.workflow }}" ||
    candidate.concurrency?.["cancel-in-progress"] !== true
  ) {
    errors.push("Candidate concurrency must cancel superseded runs globally.");
  }

  const build = candidate.jobs?.build;
  const attest = candidate.jobs?.attest;
  validatePnpmLifecycle("Candidate", "build", build, errors);
  if (!String(build?.if ?? "").includes("refs/heads/main")) {
    errors.push("Candidate build must be restricted to main.");
  }
  if (build?.permissions && !sameKeys(build.permissions, ["contents"])) {
    errors.push("Candidate build has unexpected permissions.");
  }
  if (
    workflowSteps({ jobs: { build } }).some((step) =>
      step.uses?.startsWith("actions/attest@"),
    )
  ) {
    errors.push("Candidate build must not hold or use attestation authority.");
  }
  const buildSteps = workflowSteps({ jobs: { build } });
  const performance = buildSteps.find((step) => step.id === "performance");
  const candidateUpload = buildSteps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  const uploadIndex = buildSteps.findIndex((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  const enforcementIndex = buildSteps.findIndex(
    (step) => step.id === "enforce-performance",
  );
  const enforcement = buildSteps[enforcementIndex];
  if (
    performance?.["continue-on-error"] !== true ||
    !String(performance?.run ?? "").includes(
      "--output ../../artifacts/cold-start.json",
    ) ||
    String(performance?.run ?? "").includes("*>") ||
    enforcementIndex <= uploadIndex ||
    !String(enforcement?.if ?? "").includes("!cancelled()") ||
    !String(enforcement?.run ?? "").includes("steps.performance.outcome")
  ) {
    errors.push(
      "Candidate performance diagnostics must upload before a blocking final gate.",
    );
  }
  const expectedCandidateArtifacts = [
    "artifacts/cold-start.json",
    "artifacts/sumi-docs-mcp-*.zip",
    "artifacts/sumi-docs-mcp-*.zip.sha256",
    "artifacts/sumi-docs-web-*.zip",
    "artifacts/sumi-docs-web-*.zip.sha256",
  ];
  const candidateArtifactPaths = String(candidateUpload?.with?.path ?? "")
    .trim()
    .split(/\r?\n/u)
    .map((path) => path.trim())
    .filter(Boolean);
  if (
    JSON.stringify(candidateArtifactPaths) !==
    JSON.stringify(expectedCandidateArtifacts)
  ) {
    errors.push(
      "Candidate artifacts must use the reviewed structured allowlist.",
    );
  }
  if (
    attest?.environment !== "candidate-attestation" ||
    !String(attest?.if ?? "").includes("ENABLE_PRIVATE_ATTESTATION") ||
    !String(attest?.if ?? "").includes("refs/heads/main")
  ) {
    errors.push("Attestation must be explicit, protected, and main-only.");
  }
  if (
    !sameKeys(attest?.permissions, [
      "actions",
      "attestations",
      "contents",
      "id-token",
    ]) ||
    attest.permissions.actions !== "read" ||
    attest.permissions.contents !== "read" ||
    attest.permissions["id-token"] !== "write" ||
    attest.permissions.attestations !== "write"
  ) {
    errors.push("Attestation job permissions are not least-privilege.");
  }
  const attestSteps = workflowSteps({ jobs: { attest } });
  if (
    !attestSteps.some((step) =>
      step.uses?.startsWith("actions/download-artifact@"),
    )
  ) {
    errors.push("Attestation must download the exact build artifact.");
  }
  if (!attestSteps.some((step) => step.uses?.startsWith("actions/attest@"))) {
    errors.push("Attestation job is missing provenance generation.");
  }

  const observe = operations.jobs?.observe;
  validatePnpmLifecycle("Operations", "observe", observe, errors);
  if (
    !String(observe?.if ?? "").includes("refs/heads/main") ||
    !String(observe?.if ?? "").includes("!cancelled()")
  ) {
    errors.push(
      "Operations observation must be current-main and cancellation aware.",
    );
  }
  const observeSteps = workflowSteps({ jobs: { observe } });
  const health = observeSteps.find(
    (step) => step.name === "Observe product health",
  );
  const freshness = observeSteps.find((step) => step.id === "freshness");
  const upload = observeSteps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  if (!freshness || !String(freshness.if ?? "").includes("!cancelled()")) {
    errors.push("Operations observation is missing its final freshness check.");
  }
  if (
    !String(upload?.if ?? "").includes("!cancelled()") ||
    !String(upload?.if ?? "").includes("freshness.outputs.current")
  ) {
    errors.push(
      "Operations upload must reject cancelled or superseded observations.",
    );
  }
  if (
    String(health?.run ?? "").includes("tee ") ||
    String(health?.run ?? "").includes("2>&1") ||
    upload?.with?.path !== "artifacts/operations/observation.json"
  ) {
    errors.push(
      "Operations artifacts must contain only the structured observation.",
    );
  }

  return errors;
}

function findNestedWorkflowPaths(root) {
  const results = [];
  for (const owner of ["apps", "packages"]) {
    const ownerRoot = join(root, owner);
    const walk = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/[\\/]\.github[\\/]workflows[\\/].+\.ya?ml$/iu.test(path)) {
          results.push(relative(root, path).replaceAll("\\", "/"));
        }
      }
    };
    walk(ownerRoot);
  }
  return results;
}

export function loadWorkflowPolicyInput(root = process.cwd()) {
  const workflowRoot = join(root, ".github", "workflows");
  const load = (name) => parse(readFileSync(join(workflowRoot, name), "utf8"));
  return {
    ci: load("ci.yml"),
    candidate: load("candidate.yml"),
    operations: load("operations-observe.yml"),
    rootWorkflowNames: readdirSync(workflowRoot)
      .filter((name) => /\.ya?ml$/iu.test(name))
      .sort(),
    nestedWorkflowPaths: findNestedWorkflowPaths(root),
  };
}

function main() {
  const errors = validateWorkflowPolicy(loadWorkflowPolicyInput());
  if (errors.length > 0) throw new Error(errors.join("\n"));
  process.stdout.write("Verified active workflow trust boundaries.\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
