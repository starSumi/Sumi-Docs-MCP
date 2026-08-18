import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
