import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputRoot = resolve("dist");
const machineRoot = resolve(outputRoot, "_mcp");
const manifest = JSON.parse(
  await readFile(resolve(machineRoot, "sumi-docs-manifest.json"), "utf8"),
);
const routeMap = JSON.parse(
  await readFile(resolve(machineRoot, "sumi-docs-routes.json"), "utf8"),
);

assert.deepEqual(Object.keys(manifest).sort(), [
  "documents",
  "openapi",
  "version",
]);
assert.equal(manifest.version, 1);
assert.ok(Array.isArray(manifest.documents) && manifest.documents.length > 0);
assert.equal(new Set(manifest.documents).size, manifest.documents.length);
assert.equal(routeMap.version, 1);

for (const document of manifest.documents) {
  assert.match(document, /^[a-zA-Z0-9_/-]+\.mdx?$/);
  await access(resolve(machineRoot, ...document.split("/")));
  const page = routeMap.routes[document];
  assert.match(page, /^\/[a-zA-Z0-9_/-]*\/$/);
  const pageFile = page === "/" ? "index.html" : `${page.slice(1)}index.html`;
  await access(resolve(outputRoot, ...pageFile.split("/")));
}

assert.deepEqual(
  Object.keys(routeMap.routes).sort(),
  [...manifest.documents].sort(),
);
if (manifest.openapi) await access(resolve(machineRoot, manifest.openapi));

console.log(
  `Verified ${manifest.documents.length} raw documents and rendered routes.`,
);
