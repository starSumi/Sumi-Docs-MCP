import {
  DOCUMENT_PATH_PATTERN,
  FULL_COMMIT_PATTERN,
  IDENTIFIER_PATTERN,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS,
  MAX_MANIFEST_BYTES,
  MAX_OPENAPI_BYTES,
  MAX_PATH_LENGTH,
  MAX_ROUTE_LENGTH,
  MAX_TOTAL_DOCUMENT_BYTES,
  OPENAPI_PATH_PATTERN,
  REVISION_PATTERN,
  SHA256_PATTERN,
} from "./constants.js";
import {
  canonicalJson,
  computeRevision,
  normalizeManifestV2Core,
  revisionDirectory,
  sha256Hex,
} from "./canonical.js";
import type {
  CorpusManifest,
  CurrentLocatorV2,
  DocumentNavigation,
  IntegrityDescriptor,
  ManifestV1,
  ManifestV2,
  ManifestV2Core,
  ManifestV2Document,
  ManifestV2OpenApi,
  ManifestV2Provenance,
} from "./types.js";

const DOCUMENT_PATH = new RegExp(DOCUMENT_PATH_PATTERN);
const OPENAPI_PATH = new RegExp(OPENAPI_PATH_PATTERN);
const IDENTIFIER = new RegExp(IDENTIFIER_PATTERN);
const SHA256 = new RegExp(SHA256_PATTERN);
const REVISION = new RegExp(REVISION_PATTERN);
const FULL_COMMIT = new RegExp(FULL_COMMIT_PATTERN);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be a JSON object.`);
  return value;
}

function assertKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "Object",
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown)
    throw new TypeError(`${label} contains unknown field '${unknown}'.`);
  const missing = required.find((key) => !(key in value));
  if (missing) throw new TypeError(`${label} requires field '${missing}'.`);
}

function assertRestrictedPath(
  value: unknown,
  pattern: RegExp,
  label: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH ||
    !pattern.test(value) ||
    value.startsWith("/") ||
    value.includes("//")
  ) {
    throw new TypeError(
      `${label} must be a restricted portable relative path.`,
    );
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 digest.`);
  }
}

function assertBoundedBytes(
  value: unknown,
  maximum: number,
  label: string,
  allowZero = true,
): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < (allowZero ? 0 : 1) ||
    (value as number) > maximum
  ) {
    const lower = allowZero ? "non-negative" : "positive";
    throw new TypeError(
      `${label} must be a ${lower} safe integer no greater than ${maximum}.`,
    );
  }
}

function assertOrder(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

/** Return the canonical BCP 47 representation of a locale. */
export function canonicalizeLocale(value: string): string {
  try {
    const [locale] = Intl.getCanonicalLocales(value);
    if (!locale) throw new Error();
    return locale;
  } catch {
    throw new TypeError(`Invalid BCP 47 locale '${value}'.`);
  }
}

function assertCanonicalLocale(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || canonicalizeLocale(value) !== value) {
    throw new TypeError(`${label} must be a canonical BCP 47 locale.`);
  }
}

function hasForbiddenRouteCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      character === "\\" ||
      character === "?" ||
      character === "#" ||
      character === "%" ||
      codePoint === undefined ||
      codePoint <= 0x20 ||
      codePoint === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

function assertRoute(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ROUTE_LENGTH ||
    !value.startsWith("/") ||
    !value.endsWith("/") ||
    value.includes("//") ||
    hasForbiddenRouteCharacter(value)
  ) {
    throw new TypeError(
      "Document route must be a normalized absolute site path.",
    );
  }
  const segments = value.slice(1, -1).split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new TypeError("Document route must not contain dot segments.");
  }
}

function parseNavigation(value: unknown): DocumentNavigation {
  const candidate = assertRecord(value, "Document navigation");
  assertKeys(
    candidate,
    ["sectionId", "sectionOrder", "order"],
    [],
    "Document navigation",
  );
  if (
    typeof candidate.sectionId !== "string" ||
    !IDENTIFIER.test(candidate.sectionId)
  ) {
    throw new TypeError(
      "Navigation sectionId must be a stable lowercase identifier.",
    );
  }
  assertOrder(candidate.sectionOrder, "Navigation sectionOrder");
  assertOrder(candidate.order, "Navigation order");
  return {
    sectionId: candidate.sectionId,
    sectionOrder: candidate.sectionOrder,
    order: candidate.order,
  };
}

function parseDocument(value: unknown): ManifestV2Document {
  const candidate = assertRecord(value, "Document");
  assertKeys(
    candidate,
    ["id", "locale", "path", "route", "mediaType", "bytes", "sha256", "nav"],
    [],
    "Document",
  );
  if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id)) {
    throw new TypeError("Document id must be a stable lowercase identifier.");
  }
  assertCanonicalLocale(candidate.locale, "Document locale");
  assertRestrictedPath(candidate.path, DOCUMENT_PATH, "Document path");
  assertRoute(candidate.route);
  if (
    candidate.mediaType !== "text/markdown" &&
    candidate.mediaType !== "text/mdx"
  ) {
    throw new TypeError(
      "Document mediaType must be text/markdown or text/mdx.",
    );
  }
  assertBoundedBytes(candidate.bytes, MAX_DOCUMENT_BYTES, "Document bytes");
  assertDigest(candidate.sha256, "Document sha256");
  return {
    id: candidate.id,
    locale: candidate.locale,
    path: candidate.path,
    route: candidate.route,
    mediaType: candidate.mediaType,
    bytes: candidate.bytes,
    sha256: candidate.sha256,
    nav: parseNavigation(candidate.nav),
  };
}

function parseOpenApi(value: unknown): ManifestV2OpenApi {
  const candidate = assertRecord(value, "OpenAPI entry");
  assertKeys(candidate, ["path", "bytes", "sha256"], [], "OpenAPI entry");
  assertRestrictedPath(candidate.path, OPENAPI_PATH, "OpenAPI path");
  assertBoundedBytes(candidate.bytes, MAX_OPENAPI_BYTES, "OpenAPI bytes");
  assertDigest(candidate.sha256, "OpenAPI sha256");
  return {
    path: candidate.path,
    bytes: candidate.bytes,
    sha256: candidate.sha256,
  };
}

function parseProvenance(value: unknown): ManifestV2Provenance {
  const candidate = assertRecord(value, "Provenance");
  assertKeys(candidate, ["repository", "commit", "dirty"], [], "Provenance");
  if (typeof candidate.dirty !== "boolean") {
    throw new TypeError("Provenance dirty must be boolean.");
  }
  if (
    candidate.repository !== null &&
    typeof candidate.repository !== "string"
  ) {
    throw new TypeError("Provenance repository must be an HTTPS URL or null.");
  }
  if (typeof candidate.repository === "string") {
    let url: URL;
    try {
      url = new URL(candidate.repository);
    } catch {
      throw new TypeError(
        "Provenance repository must be an HTTPS URL or null.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      candidate.repository.length > MAX_ROUTE_LENGTH ||
      url.href !== candidate.repository
    ) {
      throw new TypeError(
        "Provenance repository must be a canonical HTTPS URL without credentials, query, or fragment.",
      );
    }
  }
  if (
    candidate.commit !== null &&
    (typeof candidate.commit !== "string" ||
      !FULL_COMMIT.test(candidate.commit))
  ) {
    throw new TypeError(
      "Provenance commit must be a lowercase full Git object ID or null.",
    );
  }
  if (candidate.repository === null && candidate.commit !== null) {
    throw new TypeError("Provenance commit requires a repository.");
  }
  return {
    repository: candidate.repository,
    commit: candidate.commit,
    dirty: candidate.dirty,
  };
}

/** Parse and strictly validate a version 1 manifest. */
export function parseManifestV1(value: unknown): ManifestV1 {
  const candidate = assertRecord(value, "Manifest v1");
  assertKeys(candidate, ["version", "documents"], ["openapi"], "Manifest v1");
  if (candidate.version !== 1 || !Array.isArray(candidate.documents)) {
    throw new TypeError(
      "Manifest v1 requires version 1 and a documents array.",
    );
  }
  if (candidate.documents.length > MAX_DOCUMENTS) {
    throw new TypeError(`Manifest v1 exceeds ${MAX_DOCUMENTS} documents.`);
  }
  const documents = candidate.documents.map((path) => {
    assertRestrictedPath(path, DOCUMENT_PATH, "Manifest v1 document");
    return path;
  });
  if (new Set(documents).size !== documents.length) {
    throw new TypeError("Manifest v1 contains duplicate document paths.");
  }
  if (candidate.openapi !== undefined) {
    assertRestrictedPath(
      candidate.openapi,
      OPENAPI_PATH,
      "Manifest v1 OpenAPI",
    );
  }
  return {
    version: 1,
    documents,
    ...(typeof candidate.openapi === "string" && {
      openapi: candidate.openapi,
    }),
  };
}

function parseManifestV2CoreRecord(
  candidate: Record<string, unknown>,
): ManifestV2Core {
  if (candidate.version !== 2) {
    throw new TypeError("Manifest v2 requires version 2.");
  }
  assertCanonicalLocale(candidate.defaultLocale, "Default locale");
  if (!Array.isArray(candidate.locales) || candidate.locales.length === 0) {
    throw new TypeError("Manifest v2 requires at least one locale.");
  }
  const locales = candidate.locales.map((locale) => {
    assertCanonicalLocale(locale, "Manifest locale");
    return locale;
  });
  if (new Set(locales).size !== locales.length) {
    throw new TypeError("Manifest v2 contains duplicate locales.");
  }
  if (!locales.includes(candidate.defaultLocale)) {
    throw new TypeError("Default locale must be listed in locales.");
  }
  if (
    !Array.isArray(candidate.documents) ||
    candidate.documents.length === 0 ||
    candidate.documents.length > MAX_DOCUMENTS
  ) {
    throw new TypeError(
      `Manifest v2 requires between 1 and ${MAX_DOCUMENTS} documents.`,
    );
  }
  const documents = candidate.documents.map(parseDocument);
  const uniqueness = [
    ["paths", documents.map((document) => document.path)],
    ["routes", documents.map((document) => document.route)],
    [
      "id and locale pairs",
      documents.map((document) => `${document.id}\u0000${document.locale}`),
    ],
  ] as const;
  for (const [label, values] of uniqueness) {
    if (new Set(values).size !== values.length) {
      throw new TypeError(`Manifest v2 contains duplicate ${label}.`);
    }
  }
  let totalDocumentBytes = 0;
  for (const document of documents) {
    if (!locales.includes(document.locale)) {
      throw new TypeError(
        `Document locale '${document.locale}' is not declared.`,
      );
    }
    totalDocumentBytes += document.bytes;
    if (totalDocumentBytes > MAX_TOTAL_DOCUMENT_BYTES) {
      throw new TypeError(
        `Manifest v2 exceeds ${MAX_TOTAL_DOCUMENT_BYTES} total document bytes.`,
      );
    }
  }
  return {
    version: 2,
    defaultLocale: candidate.defaultLocale,
    locales,
    documents,
    ...(candidate.openapi !== undefined && {
      openapi: parseOpenApi(candidate.openapi),
    }),
    provenance: parseProvenance(candidate.provenance),
  };
}

/** Parse, strictly validate, and normalize a version 2 manifest core. */
export function parseManifestV2Core(value: unknown): ManifestV2Core {
  const candidate = assertRecord(value, "Manifest v2 core");
  assertKeys(
    candidate,
    ["version", "defaultLocale", "locales", "documents", "provenance"],
    ["openapi"],
    "Manifest v2 core",
  );
  return normalizeManifestV2Core(parseManifestV2CoreRecord(candidate));
}

/** Parse and strictly validate a sealed version 2 manifest. */
export function parseManifestV2(value: unknown): ManifestV2 {
  const candidate = assertRecord(value, "Manifest v2");
  assertKeys(
    candidate,
    [
      "version",
      "revision",
      "defaultLocale",
      "locales",
      "documents",
      "provenance",
    ],
    ["openapi"],
    "Manifest v2",
  );
  if (
    typeof candidate.revision !== "string" ||
    !REVISION.test(candidate.revision)
  ) {
    throw new TypeError("Manifest v2 requires a valid revision.");
  }
  const core = parseManifestV2CoreRecord(candidate);
  const normalized = normalizeManifestV2Core(core);
  if (canonicalJson(core) !== canonicalJson(normalized)) {
    throw new TypeError("Manifest v2 must use canonical array ordering.");
  }
  const expected = computeRevision(normalized);
  if (candidate.revision !== expected) {
    throw new TypeError(`Manifest revision mismatch: expected ${expected}.`);
  }
  return { ...normalized, revision: candidate.revision };
}

/** Normalize, validate, and seal a version 2 manifest core. */
export function sealManifestV2(core: ManifestV2Core): ManifestV2 {
  const candidate = assertRecord(core, "Manifest v2 core");
  assertKeys(
    candidate,
    ["version", "defaultLocale", "locales", "documents", "provenance"],
    ["openapi"],
    "Manifest v2 core",
  );
  const producerInput = {
    ...candidate,
    ...(Array.isArray(candidate.documents) && {
      documents: candidate.documents.map((document) =>
        isRecord(document) && typeof document.path === "string"
          ? { ...document, path: document.path.replaceAll("\\", "/") }
          : document,
      ),
    }),
    ...(isRecord(candidate.openapi) &&
      typeof candidate.openapi.path === "string" && {
        openapi: {
          ...candidate.openapi,
          path: candidate.openapi.path.replaceAll("\\", "/"),
        },
      }),
  };
  const normalized = parseManifestV2Core(producerInput);
  return parseManifestV2({
    ...normalized,
    revision: computeRevision(normalized),
  });
}

/** Parse any supported corpus manifest version. */
export function parseManifest(value: unknown): CorpusManifest {
  const candidate = assertRecord(value, "Manifest");
  if (candidate.version === 1) return parseManifestV1(candidate);
  if (candidate.version === 2) return parseManifestV2(candidate);
  throw new TypeError("Unsupported manifest version.");
}

/** Parse and strictly validate a version 2 current locator. */
export function parseCurrentLocatorV2(value: unknown): CurrentLocatorV2 {
  const candidate = assertRecord(value, "Current locator");
  assertKeys(
    candidate,
    ["version", "revision", "manifest", "bytes", "sha256"],
    [],
    "Current locator",
  );
  if (candidate.version !== 2 || typeof candidate.revision !== "string") {
    throw new TypeError("Current locator requires version 2 and a revision.");
  }
  const directory = revisionDirectory(candidate.revision);
  const expectedPath = `snapshots/${directory}/manifest.json`;
  if (candidate.manifest !== expectedPath) {
    throw new TypeError(`Current locator manifest must be '${expectedPath}'.`);
  }
  assertBoundedBytes(
    candidate.bytes,
    MAX_MANIFEST_BYTES,
    "Current locator bytes",
    false,
  );
  assertDigest(candidate.sha256, "Current locator sha256");
  return {
    version: 2,
    revision: candidate.revision,
    manifest: candidate.manifest,
    bytes: candidate.bytes,
    sha256: candidate.sha256,
  };
}

function asBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

/** Describe raw content using its exact byte length and SHA-256 digest. */
export function describeIntegrity(
  value: string | Uint8Array,
): IntegrityDescriptor {
  const bytes = asBytes(value);
  return { bytes: bytes.byteLength, sha256: sha256Hex(bytes) };
}

/** Assert that raw content matches an expected byte length and digest. */
export function assertIntegrity(
  value: string | Uint8Array,
  expected: IntegrityDescriptor,
  label = "Content",
): void {
  if (!Number.isSafeInteger(expected.bytes) || expected.bytes < 0) {
    throw new TypeError(
      `${label} expected byte count must be a non-negative safe integer.`,
    );
  }
  assertDigest(expected.sha256, `${label} expected sha256`);
  const actual = describeIntegrity(value);
  if (actual.bytes !== expected.bytes) {
    throw new TypeError(
      `${label} byte count mismatch: expected ${expected.bytes}, received ${actual.bytes}.`,
    );
  }
  if (actual.sha256 !== expected.sha256) {
    throw new TypeError(`${label} SHA-256 mismatch.`);
  }
}

/** Create a current locator for an already sealed version 2 manifest. */
export function createCurrentLocatorV2(manifest: ManifestV2): CurrentLocatorV2 {
  const validated = parseManifestV2(manifest);
  const serialized = canonicalJson(validated);
  const integrity = describeIntegrity(serialized);
  return {
    version: 2,
    revision: validated.revision,
    manifest: `snapshots/${revisionDirectory(validated.revision)}/manifest.json`,
    ...integrity,
  };
}

/**
 * Verify immutable manifest bytes before parsing them, then bind the manifest
 * revision to the already validated current locator.
 */
export function parseLocatedManifestV2(
  locatorValue: unknown,
  manifestBytes: string | Uint8Array,
): ManifestV2 {
  const locator = parseCurrentLocatorV2(locatorValue);
  assertIntegrity(manifestBytes, locator, "Manifest");
  let text: string;
  try {
    text =
      typeof manifestBytes === "string"
        ? manifestBytes
        : new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes);
  } catch {
    throw new TypeError("Manifest must be valid UTF-8.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Manifest must be valid JSON.");
  }
  const manifest = parseManifestV2(value);
  if (manifest.revision !== locator.revision) {
    throw new TypeError(
      "Current locator revision does not match the manifest revision.",
    );
  }
  if (text !== canonicalJson(manifest)) {
    throw new TypeError("Manifest bytes must use canonical JSON.");
  }
  return manifest;
}
