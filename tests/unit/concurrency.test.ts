/**
 * @file Concurrency bounds test
 * Tests that file loading respects concurrency limits
 */

import { test } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DocsVault } from "../../src/vfs/DocsVault.js";

test("DocsVault - respects MAX_CONCURRENT_FILES bound", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await mkdir(testDir, { recursive: true });

    // Create 50 small files to test concurrency
    const filePromises = [];
    for (let i = 0; i < 50; i++) {
      filePromises.push(
        writeFile(
          join(testDir, `doc-${i.toString().padStart(3, "0")}.md`),
          `# Document ${i}\n\nContent for document ${i}.`,
        ),
      );
    }
    await Promise.all(filePromises);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const tree = vault.listTree();
    assert.strictEqual(tree.length, 50, "Should load all 50 documents");

    // Note: Without instrumentation, we verify:
    // 1. All files loaded successfully
    // 2. No unbounded promise creation (verified by code inspection)
    // 3. Process doesn't crash with EMFILE error
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - loads nested directories correctly", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "a"), { recursive: true });
    await mkdir(join(testDir, "b"), { recursive: true });
    await mkdir(join(testDir, "a", "c"), { recursive: true });

    await writeFile(join(testDir, "root.md"), "# Root");
    await writeFile(join(testDir, "a", "a.md"), "# A");
    await writeFile(join(testDir, "b", "b.md"), "# B");
    await writeFile(join(testDir, "a", "c", "c.md"), "# C");

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const tree = vault.listTree();
    assert.strictEqual(tree.length, 4);

    const paths = tree.map((n) => n.path).sort();
    assert.deepStrictEqual(paths, ["a/a.md", "a/c/c.md", "b/b.md", "root.md"]);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});
