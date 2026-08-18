import { createHash } from "node:crypto";
import { REVISION_PATTERN } from "./constants.js";
import type { ManifestV2Core, ManifestV2Document } from "./types.js";

const REVISION = new RegExp(REVISION_PATTERN);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Compare manifest documents using their canonical navigation and identity order. */
export function compareManifestDocuments(
  left: ManifestV2Document,
  right: ManifestV2Document,
): number {
  return (
    left.nav.sectionOrder - right.nav.sectionOrder ||
    left.nav.order - right.nav.order ||
    compareText(left.id, right.id) ||
    compareText(left.locale, right.locale) ||
    compareText(left.path, right.path)
  );
}

/** Convert a producer-side Windows path into the portable manifest form. */
export function portableManifestPath(value: string): string {
  return value.replaceAll("\\", "/");
}

/**
 * Normalize fields whose representation must not affect a corpus revision.
 * Validation is intentionally separate so consumers can reject non-canonical
 * wire values while producers can normalize filesystem paths before sealing.
 */
export function normalizeManifestV2Core(core: ManifestV2Core): ManifestV2Core {
  return {
    version: 2,
    defaultLocale: core.defaultLocale,
    locales: [...core.locales].sort(compareText),
    documents: core.documents
      .map((document) => ({
        ...document,
        path: portableManifestPath(document.path),
        nav: { ...document.nav },
      }))
      .sort(compareManifestDocuments),
    ...(core.openapi && {
      openapi: {
        ...core.openapi,
        path: portableManifestPath(core.openapi.path),
      },
    }),
    provenance: { ...core.provenance },
  };
}

function serializeCanonical(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(
          "Canonical JSON does not support non-finite numbers.",
        );
      }
      return JSON.stringify(value);
    case "object": {
      if (ancestors.has(value)) {
        throw new TypeError("Canonical JSON does not support cyclic values.");
      }
      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          const entries: string[] = [];
          for (let index = 0; index < value.length; index += 1) {
            if (!(index in value)) {
              throw new TypeError(
                "Canonical JSON does not support sparse arrays.",
              );
            }
            entries.push(serializeCanonical(value[index], ancestors));
          }
          return `[${entries.join(",")}]`;
        }
        const prototype = Object.getPrototypeOf(value) as unknown;
        if (prototype !== Object.prototype && prototype !== null) {
          throw new TypeError("Canonical JSON only supports plain objects.");
        }
        if (Object.getOwnPropertySymbols(value).length > 0) {
          throw new TypeError("Canonical JSON does not support symbol keys.");
        }
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${serializeCanonical(record[key], ancestors)}`,
          )
          .join(",")}}`;
      } finally {
        ancestors.delete(value);
      }
    }
    default:
      throw new TypeError(
        `Canonical JSON does not support ${typeof value} values.`,
      );
  }
}

/** Serialize supported JSON values with object keys sorted by UTF-16 code units. */
export function canonicalJson(value: unknown): string {
  return serializeCanonical(value, new Set());
}

/** Return the lowercase SHA-256 digest of UTF-8 text or raw bytes. */
export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Compute the content-addressed revision for a normalized manifest core. */
export function computeRevision(core: ManifestV2Core): string {
  const normalized = normalizeManifestV2Core(core);
  return `sha256:${sha256Hex(canonicalJson(normalized))}`;
}

/** Return the digest-only, colon-free snapshot directory name. */
export function revisionDirectory(revision: string): string {
  if (!REVISION.test(revision)) {
    throw new TypeError("Revision must be sha256:<64 lowercase hex>.");
  }
  return revision.slice("sha256:".length);
}
