import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { toPortableReportPath } from "../../scripts/report-path.mjs";

test("report paths are relative inside the project", () => {
  const projectRoot = join(process.cwd(), "project");
  const target = join(projectRoot, "artifacts", "bin", "server.exe");

  assert.equal(
    toPortableReportPath(target, projectRoot),
    "artifacts/bin/server.exe",
  );
});

test("report paths outside the project expose only the file name", () => {
  const projectRoot = join(process.cwd(), "project");
  const target = join(process.cwd(), "runtime", "node.exe");

  assert.equal(toPortableReportPath(target, projectRoot), "node.exe");
});
