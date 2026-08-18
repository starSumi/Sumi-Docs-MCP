import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  assertIntegrity,
  canonicalJson,
  canonicalizeLocale,
  computeRevision,
  createCurrentLocatorV2,
  describeIntegrity,
  parseCurrentLocatorV2,
  parseLocatedManifestV2,
  parseManifestV1,
  parseManifestV2,
  portableManifestPath,
  revisionDirectory,
  sealManifestV2,
  sha256Hex,
} from "../dist/index.js";

const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url);
const readJson = async (name) =>
  JSON.parse(await readFile(fixture(name), "utf8"));

test("v1 fixture remains path-only and strict", async () => {
  const manifest = await readJson("valid/manifest-v1.json");
  assert.deepEqual(parseManifestV1(manifest), manifest);
  assert.throws(
    () =>
      parseManifestV1({ version: 1, documents: ["start.md"], locale: "en" }),
    /unknown field/,
  );
  const invalid = await readJson("invalid/manifest-v1-unknown-field.json");
  assert.throws(() => parseManifestV1(invalid), /unknown field/);
});

test("BCP 47 canonicalization is explicit", () => {
  assert.equal(canonicalizeLocale("zh-cn"), "zh-CN");
  assert.equal(canonicalizeLocale("sr-cyrl-rs"), "sr-Cyrl-RS");
  assert.throws(() => canonicalizeLocale("not a locale"), /Invalid BCP 47/);
});

test("canonical JSON is deterministic and rejects non-JSON values", () => {
  assert.equal(
    canonicalJson({ b: 1, a: { d: 2, c: 3 } }),
    '{"a":{"c":3,"d":2},"b":1}',
  );
  assert.equal(
    canonicalJson(["x", { z: true, a: null }]),
    '["x",{"a":null,"z":true}]',
  );
  assert.equal(canonicalJson(-0), "0");
  assert.throws(() => canonicalJson(Number.NaN), /non-finite/);
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => canonicalJson(sparse), /sparse/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cyclic/);
});

test("v2 fixture verifies its revision, stable ordering, and content digests", async () => {
  const manifest = await readJson("valid/manifest-v2.json");
  const parsed = parseManifestV2(manifest);
  assert.deepEqual(parsed, manifest);
  assert.equal(parsed.documents[0].locale, "en");
  assert.equal(parsed.locales.join(","), "en,zh-CN");

  const en = await readFile(fixture("content/getting-started.md"));
  const zh = await readFile(fixture("content/zh-cn/getting-started.md"));
  const openapi = await readFile(fixture("content/openapi.json"));
  assertIntegrity(en, parsed.documents[0], "English document");
  assertIntegrity(zh, parsed.documents[1], "Chinese document");
  assertIntegrity(openapi, parsed.openapi, "OpenAPI document");
  assert.deepEqual(
    createCurrentLocatorV2(parsed),
    await readJson("valid/current-v2.json"),
  );
});

test("producer sealing normalizes Windows paths without changing the revision", async () => {
  const manifest = await readJson("valid/manifest-v2.json");
  const core = { ...manifest };
  delete core.revision;
  const windowsCore = {
    ...core,
    documents: core.documents.map((document) => ({
      ...document,
      path: document.path.replaceAll("/", "\\"),
    })),
    openapi: { ...core.openapi, path: core.openapi.path.replaceAll("/", "\\") },
  };
  assert.equal(computeRevision(core), computeRevision(windowsCore));
  assert.equal(
    portableManifestPath("zh-cn\\getting-started.md"),
    "zh-cn/getting-started.md",
  );
  assert.deepEqual(sealManifestV2(windowsCore), manifest);
  assert.throws(
    () => sealManifestV2({ ...windowsCore, unexpected: true }),
    /unknown field/,
  );

  const rootRoute = {
    ...core,
    documents: core.documents.map((document, index) =>
      index === 0 ? { ...document, route: "/" } : document,
    ),
  };
  assert.equal(sealManifestV2(rootRoute).documents[0].route, "/");
});

test("v2 rejects cross-field collisions, noncanonical locales, provenance gaps, and revision drift", async () => {
  for (const name of [
    "invalid/manifest-v2-bad-revision.json",
    "invalid/manifest-v2-noncanonical-locale.json",
    "invalid/manifest-v2-duplicate-route.json",
    "invalid/manifest-v2-implicit-provenance.json",
  ]) {
    await assert.rejects(async () => parseManifestV2(await readJson(name)));
  }
  const valid = await readJson("valid/manifest-v2.json");
  assert.throws(
    () =>
      parseManifestV2({
        ...valid,
        documents: valid.documents.map((doc) => ({ ...doc, extra: true })),
      }),
    /unknown field/,
  );
  assert.throws(
    () =>
      parseManifestV2({
        ...valid,
        documents: valid.documents.map((doc) => ({
          ...doc,
          route: "/bad/../",
        })),
      }),
    /dot segments/,
  );
  assert.throws(
    () => parseManifestV2({ ...valid, locales: [...valid.locales].reverse() }),
    /canonical array ordering/,
  );
  assert.throws(
    () =>
      parseManifestV2({
        ...valid,
        documents: [...valid.documents].reverse(),
      }),
    /canonical array ordering/,
  );
});

test("locator revision directories are Windows-safe and path-bound", async () => {
  const locator = await readJson("valid/current-v2.json");
  const unsafeLocator = await readJson("invalid/current-v2-unsafe-path.json");
  const manifest = await readJson("valid/manifest-v2.json");
  assert.equal(revisionDirectory(locator.revision), locator.revision.slice(7));
  assert.deepEqual(parseCurrentLocatorV2(locator), locator);
  assert.throws(() => parseCurrentLocatorV2(unsafeLocator), /manifest must be/);
  assert.throws(
    () => parseCurrentLocatorV2({ ...locator, bytes: 0 }),
    /positive/,
  );
  assert.throws(
    () => assertIntegrity("x", { bytes: 1, sha256: "NOT-A-DIGEST" }),
    /lowercase SHA-256/,
  );
  const manifestBytes = canonicalJson(manifest);
  assert.deepEqual(parseLocatedManifestV2(locator, manifestBytes), manifest);
  assert.throws(
    () => parseLocatedManifestV2(locator, `${manifestBytes} `),
    /byte count mismatch/,
  );
  const prettyManifest = JSON.stringify(manifest, null, 2);
  assert.throws(
    () =>
      parseLocatedManifestV2(
        { ...locator, ...describeIntegrity(prettyManifest) },
        prettyManifest,
      ),
    /canonical JSON/,
  );
});

test("schemas are JSON and declare strict objects", async () => {
  for (const name of [
    "manifest-v1.schema.json",
    "manifest-v2.schema.json",
    "current-v2.schema.json",
  ]) {
    const schema = JSON.parse(
      await readFile(fixture(`../schemas/${name}`), "utf8"),
    );
    assert.equal(
      schema.$schema,
      "https://json-schema.org/draft/2020-12/schema",
    );
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
  }
});

test("sha256 helper hashes UTF-8 bytes", () => {
  assert.equal(
    sha256Hex("# Start\n"),
    "12442db336c4ffa46525044d6e8ad4addd85359bea060b780b62470d458375df",
  );
  assert.deepEqual(describeIntegrity("# Start\n"), {
    bytes: 8,
    sha256: "12442db336c4ffa46525044d6e8ad4addd85359bea060b780b62470d458375df",
  });
});
