import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

interface PackageMetadata {
  files?: string[];
  scripts?: Record<string, string>;
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
    "pnpm audit --prod --audit-level high --registry https://registry.npmjs.org",
  );
});
