import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { parse, stringify } from "yaml";

import { contentCatalog } from "../apps/web/src/content-catalog.ts";

export const TRANSLATION_PAIR = Object.freeze(["README.md", "README.zh-CN.md"]);
export const DOC_TRANSLATION_PATHS = Object.freeze(
  contentCatalog.documents.flatMap((document) =>
    ["en", "zh-CN"].map((locale) => {
      const variant = document.variants.find(
        (entry) => entry.locale === locale,
      );
      if (!variant) {
        throw new Error(
          `Catalog document '${document.id}' is missing locale '${locale}'.`,
        );
      }
      return `docs/${variant.source}`;
    }),
  ),
);

const RECORDS = Object.freeze([
  { path: "README.i18n.yaml", sources: TRANSLATION_PAIR },
  { path: "docs.i18n.yaml", sources: DOC_TRANSLATION_PATHS },
]);

export function gitBlobHash(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

function readIndexFile(path, root) {
  const result = spawnSync("git", ["show", `:${path}`], {
    cwd: root,
    encoding: null,
  });
  if (result.status !== 0) {
    throw new Error(`${path} is missing from the staged translation pair.`);
  }
  return result.stdout;
}

function readPlaneFile(path, { cached, root }) {
  return cached ? readIndexFile(path, root) : readFileSync(path);
}

export function validatePairRecord(
  record,
  contents,
  expectedPaths = TRANSLATION_PAIR,
) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return ["Translation pairing record must be a YAML object."];
  }
  const expected = [...expectedPaths].sort();
  const actual = Object.keys(record).sort();
  const errors = [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(
      `Translation pairing record must contain only ${expected.join(", ")}.`,
    );
    return errors;
  }
  for (const path of expectedPaths) {
    const hash = gitBlobHash(contents.get(path));
    if (record[path] !== hash) {
      errors.push(`${path} changed after the bilingual pair was confirmed.`);
    }
  }
  return errors;
}

export function verifyTranslationPairing({
  cached = false,
  root = process.cwd(),
} = {}) {
  return RECORDS.flatMap(({ path: recordPath, sources }) => {
    const contents = new Map(
      sources.map((path) => [path, readPlaneFile(path, { cached, root })]),
    );
    const recordBytes = readPlaneFile(recordPath, { cached, root });
    const record = parse(recordBytes.toString("utf8"));
    return validatePairRecord(record, contents, sources).map(
      (error) => `${recordPath}: ${error}`,
    );
  });
}

function writeRecords() {
  for (const { path: recordPath, sources } of RECORDS) {
    const record = Object.fromEntries(
      sources.map((path) => [path, gitBlobHash(readFileSync(path))]),
    );
    writeFileSync(
      recordPath,
      "# Pair freshness baseline only; semantic equivalence requires human review.\n" +
        stringify(record),
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--cached", "--write"].includes(arg))) {
    throw new Error("Usage: verify-translation-pairing [--cached | --write]");
  }
  if (args.includes("--cached") && args.includes("--write")) {
    throw new Error("--cached and --write are mutually exclusive.");
  }
  if (args.includes("--write")) writeRecords();
  const errors = verifyTranslationPairing({
    cached: args.includes("--cached"),
  });
  if (errors.length > 0) throw new Error(errors.join("\n"));
  process.stdout.write(
    `Verified ${TRANSLATION_PAIR.length + DOC_TRANSLATION_PATHS.length} bilingual content files.\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
