import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import {
  formatDoctorPath,
  sanitizeDiagnostic,
} from "../../src/utils/diagnostics.js";

test("sanitizeDiagnostic removes paths, credentials, and stack lines", () => {
  const diagnostic = sanitizeDiagnostic(
    new Error(
      "Cannot read C:\\Users\\private\\docs\\guide.md from https://user:secret@example.com/docs\n    at load (C:\\repo\\file.ts:1:1)",
    ),
  );

  assert.doesNotMatch(diagnostic, /Users|private|secret|at load/iu);
  assert.match(diagnostic, /<path>|<redacted>/u);
});

test("sanitizeDiagnostic handles POSIX, UNC, and known normalized paths", () => {
  for (const value of [
    "/home/person/project/docs/file.md",
    "\\\\server\\share\\private\\file.md",
    "D:/workspace/private/file.md",
  ]) {
    const diagnostic = sanitizeDiagnostic(`Cannot read ${value}`, {
      knownPaths: [value],
    });
    assert.equal(diagnostic, "Cannot read <path>");
  }
});

test("sanitizeDiagnostic preserves explicit paths but never credentials or stack", () => {
  const diagnostic = sanitizeDiagnostic(
    "Cannot read C:\\safe\\file.md via https://user:secret@example.com/docs\nstack",
    { showPaths: true },
  );
  assert.match(diagnostic, /C:\\safe\\file\.md/u);
  assert.doesNotMatch(diagnostic, /user:secret|stack/u);
});

test("formatDoctorPath uses relative paths and external placeholders by default", () => {
  const root = join(process.cwd(), "project");
  assert.equal(formatDoctorPath(root, root, "source", false), ".");
  assert.equal(
    formatDoctorPath(join(root, "docs"), root, "source", false),
    "docs",
  );
  assert.equal(
    formatDoctorPath(join(root, "..", "shared"), root, "source", false),
    "<external-source>",
  );
  assert.equal(
    formatDoctorPath(join(root, "docs"), root, "source", true),
    join(root, "docs"),
  );
});
