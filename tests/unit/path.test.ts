import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { validateAndNormalizePath } from "../../src/utils/path.js";

test("validateAndNormalizePath keeps paths inside the documentation root", () => {
  const root = resolve("fixtures", "docs");

  assert.equal(
    validateAndNormalizePath(join("api", "reference.md"), root),
    join(root, "api", "reference.md"),
  );
});

test("validateAndNormalizePath rejects traversal and sibling-prefix paths", () => {
  const root = resolve("fixtures", "docs");

  assert.throws(
    () => validateAndNormalizePath(join("..", "secret.md"), root),
    /Path traversal/,
  );
  assert.throws(
    () =>
      validateAndNormalizePath(join("..", "docs-private", "secret.md"), root),
    /Path traversal/,
  );
});
