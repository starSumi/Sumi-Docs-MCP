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

const englishDocuments = manifest.documents
  .filter((document) => !document.startsWith("zh-cn/"))
  .sort();
const chineseDocuments = manifest.documents
  .filter((document) => document.startsWith("zh-cn/"))
  .map((document) => document.slice("zh-cn/".length))
  .sort();
assert.deepEqual(chineseDocuments, englishDocuments);

const pageFile = (page) =>
  page === "/" ? "index.html" : `${page.slice(1)}index.html`;

for (const document of manifest.documents) {
  assert.match(document, /^[a-zA-Z0-9_/-]+\.mdx?$/);
  await access(resolve(machineRoot, ...document.split("/")));
  const page = routeMap.routes[document];
  assert.match(page, /^(?:\/$|\/[a-zA-Z0-9_/-]+\/$)/);
  await access(resolve(outputRoot, ...pageFile(page).split("/")));
}

assert.deepEqual(
  Object.keys(routeMap.routes).sort(),
  [...manifest.documents].sort(),
);
if (manifest.openapi) await access(resolve(machineRoot, manifest.openapi));

const englishHome = await readFile(resolve(outputRoot, "index.html"), "utf8");
const chineseHome = await readFile(
  resolve(outputRoot, "zh-cn", "index.html"),
  "utf8",
);

assert.match(englishHome, /<main[^>]+lang="en"/);
assert.match(englishHome, /href="\/getting-started\/"/);
assert.match(chineseHome, /<main[^>]+lang="zh-CN"/);
assert.match(chineseHome, />Sumi 文档<\/h1>/);
assert.match(chineseHome, /href="\/zh-cn\/getting-started\/"/);
assert.match(chineseHome, /href="\/zh-cn\/configuration\/"/);

for (const document of englishDocuments) {
  const chineseDocument = `zh-cn/${document}`;
  const englishRoute = routeMap.routes[document];
  const chineseRoute = routeMap.routes[chineseDocument];
  const englishPage = await readFile(
    resolve(outputRoot, ...pageFile(englishRoute).split("/")),
    "utf8",
  );
  const chinesePage = await readFile(
    resolve(outputRoot, ...pageFile(chineseRoute).split("/")),
    "utf8",
  );

  assert.match(englishPage, /<main[^>]+lang="en"/);
  assert.ok(englishPage.includes(`value="${chineseRoute}"`));
  assert.match(chinesePage, /<main[^>]+lang="zh-CN"/);
  assert.ok(chinesePage.includes(`value="${englishRoute}"`));
}

console.log(
  `Verified ${manifest.documents.length} raw documents and rendered routes.`,
);
