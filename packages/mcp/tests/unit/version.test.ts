import { test } from "node:test";
import assert from "node:assert/strict";
import packageJson from "../../package.json" with { type: "json" };
import { VERSION } from "../../src/version.js";

test("runtime version comes from package metadata", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(VERSION, packageJson.version);
});
