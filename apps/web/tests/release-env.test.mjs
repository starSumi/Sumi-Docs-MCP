import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function validate(siteUrl, basePath) {
  const env = { ...process.env };
  if (siteUrl === undefined) delete env.SITE_URL;
  else env.SITE_URL = siteUrl;
  if (basePath === undefined) delete env.BASE_PATH;
  else env.BASE_PATH = basePath;

  return spawnSync(process.execPath, ["scripts/validate-release-env.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  });
}

test("accepts a public HTTPS origin", () => {
  const result = validate("https://docs.example.com");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /https:\/\/docs\.example\.com\//);
});

test("accepts and normalizes a separate deployment base path", () => {
  const result = validate("https://starsumi.github.io", "/Sumi-Docs-MCP");
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /https:\/\/starsumi\.github\.io\/Sumi-Docs-MCP\//,
  );
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

for (const basePath of [
  "Sumi-Docs-MCP",
  "//Sumi-Docs-MCP/",
  "/Sumi-Docs-MCP/../private/",
  "/Sumi-Docs-MCP?preview=true",
  "https://example.com/Sumi-Docs-MCP/",
]) {
  test(`rejects ambiguous base path '${basePath}'`, () => {
    const result = validate("https://starsumi.github.io", basePath);
    assert.notEqual(result.status, 0);
  });
}
