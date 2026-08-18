import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("doctor --json redacts local paths by default", async () => {
  const root = await mkdtemp(join(tmpdir(), "sumi-docs-doctor-"));
  const docs = join(root, "docs");
  try {
    await mkdir(docs, { recursive: true });
    await writeFile(join(docs, "guide.md"), "# Guide\n\nReady.\n");

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "src/index.ts", "doctor", docs, "--json"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const report = JSON.parse(stdout) as {
      ok: boolean;
      source: { value: string; documentCount: number; loadable: boolean };
    };

    assert.equal(report.ok, true);
    assert.equal(report.source.value, "<external-source>");
    assert.equal(report.source.documentCount, 1);
    assert.equal(report.source.loadable, true);
    assert.doesNotMatch(
      stdout,
      new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu"),
    );
    assert.doesNotMatch(
      stderr,
      new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu"),
    );
    assert.equal(stderr, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("doctor --show-paths explicitly reports resolved local paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "sumi-docs-doctor-paths-"));
  const docs = join(root, "docs");
  try {
    await mkdir(docs, { recursive: true });
    await writeFile(join(docs, "guide.md"), "# Guide\n\nReady.\n");

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/index.ts",
        "doctor",
        docs,
        "--json",
        "--show-paths",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const report = JSON.parse(stdout) as {
      source: { value: string };
    };

    assert.equal(report.source.value, docs);
    assert.equal(stderr, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
