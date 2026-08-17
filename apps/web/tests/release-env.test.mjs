import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

function validate(siteUrl) {
  const env = { ...process.env };
  if (siteUrl === undefined) delete env.SITE_URL;
  else env.SITE_URL = siteUrl;

  return spawnSync(process.execPath, ["scripts/validate-release-env.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  });
}

test("accepts a public HTTPS origin", () => {
  const result = validate("https://docs.example.com");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /https:\/\/docs\.example\.com/);
});

for (const [name, value] of [
  ["missing URL", undefined],
  ["HTTP URL", "http://docs.example.com"],
  ["credentials", "https://user:secret@docs.example.com"],
  ["query", "https://docs.example.com?preview=true"],
  ["subpath", "https://docs.example.com/product/"],
]) {
  test(`rejects ${name}`, () => {
    const result = validate(value);
    assert.notEqual(result.status, 0);
  });
}

test("site candidate remains immutable and human-gated", async () => {
  const workflow = await readFile(
    ".github/workflows/site-candidate.yml",
    "utf8",
  );
  const actionReferences = [...workflow.matchAll(/uses:\s+(\S+)/g)].map(
    (match) => match[1],
  );

  assert.ok(actionReferences.length > 0);
  for (const action of actionReferences) {
    assert.match(action, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/);
  }
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /REQUESTED_COMMIT/);
  assert.match(workflow, /SITE_URL:/);
  assert.match(workflow, /Upload candidate for human acceptance/);
  assert.doesNotMatch(workflow, /deploy-pages|gh-pages|release create/i);
});
