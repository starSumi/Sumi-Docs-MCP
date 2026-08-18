import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { isMainModule } from "../../src/utils/main-module.js";

test("recognizes an entry reached through a workspace directory link", async () => {
  const root = await mkdtemp(join(tmpdir(), "sumi-docs-main-module-"));
  const packageRoot = join(root, "package");
  const linkedRoot = join(root, "workspace-link");
  const entry = join(packageRoot, "index.js");

  try {
    await mkdir(packageRoot);
    await writeFile(entry, "export {};\n");
    await symlink(
      packageRoot,
      linkedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );

    assert.equal(
      isMainModule(pathToFileURL(entry).href, join(linkedRoot, "index.js")),
      true,
    );
    assert.equal(
      isMainModule(pathToFileURL(entry).href, resolve(root, "other.js")),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
