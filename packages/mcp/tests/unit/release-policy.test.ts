import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parse } from "yaml";

interface WorkflowStep {
  name?: string;
  run?: string;
  uses?: string;
}

interface Workflow {
  permissions?: Record<string, string>;
  on?: {
    workflow_dispatch?: {
      inputs?: Record<string, unknown>;
    };
  };
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
}

interface PackageMetadata {
  files?: string[];
  scripts?: Record<string, string>;
}

async function readWorkflow(path: string): Promise<Workflow> {
  return parse(await readFile(path, "utf8")) as Workflow;
}

function allSteps(workflow: Workflow): WorkflowStep[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

test("package boundary includes every active architecture decision", async () => {
  const packageJson = JSON.parse(
    await readFile("package.json", "utf8"),
  ) as PackageMetadata;

  assert.equal(
    packageJson.files?.includes(
      "docs/decisions/0003-localized-content-projection.md",
    ),
    true,
  );
  assert.equal(
    packageJson.scripts?.["audit:prod"],
    "npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org",
  );
});

test("CI and candidate builds audit production dependencies", async () => {
  for (const path of [
    ".github/workflows/ci.yml",
    ".github/workflows/release-candidate.yml",
  ]) {
    const steps = allSteps(await readWorkflow(path));
    assert.equal(
      steps.some((step) => step.run === "npm run audit:prod"),
      true,
      `${path} must run the production dependency audit`,
    );
  }
});

test("release workflows pin actions to immutable commit SHAs", async () => {
  for (const path of [
    ".github/workflows/release-candidate.yml",
    ".github/workflows/prepare-release-draft.yml",
  ]) {
    const actionSteps = allSteps(await readWorkflow(path)).filter(
      (step) => step.uses,
    );
    assert.ok(actionSteps.length > 0);
    for (const step of actionSteps) {
      assert.match(
        step.uses ?? "",
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/,
        `${path} contains a mutable action reference`,
      );
    }
  }
});

test("draft promotion requires human and unsigned-binary acceptance", async () => {
  const workflow = await readWorkflow(
    ".github/workflows/prepare-release-draft.yml",
  );
  const inputs = workflow.on?.workflow_dispatch?.inputs ?? {};
  const steps = allSteps(workflow);

  assert.ok("candidate_run_id" in inputs);
  assert.ok("confirmation" in inputs);
  assert.ok("performance_exception" in inputs);
  assert.ok("unsigned_binary_exception" in inputs);
  assert.equal(workflow.permissions?.contents, "write");
  assert.equal(workflow.permissions?.actions, "read");
  assert.equal(workflow.permissions?.issues, "read");
  assert.equal(
    steps.some(
      (step) =>
        step.name === "Require approval for the unsigned Windows binary",
    ),
    true,
  );
});
