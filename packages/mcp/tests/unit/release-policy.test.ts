import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

interface PackageMetadata {
  bin?: Record<string, string>;
  files?: string[];
  private?: boolean;
  publishConfig?: {
    access?: string;
    registry?: string;
  };
  scripts?: Record<string, string>;
}

test("package metadata is ready for a public npm release", async () => {
  const packageJson = JSON.parse(
    await readFile("package.json", "utf8"),
  ) as PackageMetadata;

  assert.equal(packageJson.private, undefined);
  assert.deepEqual(packageJson.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org",
  });
  assert.equal(packageJson.bin?.["sumi-docs-mcp"], "dist/index.js");
});

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
    "node ../../scripts/run-pnpm-command.mjs audit --prod --audit-level high --registry https://registry.npmjs.org",
  );
});
