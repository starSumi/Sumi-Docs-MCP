/** Backward-compatible path-only corpus manifest. */
export interface ManifestV1 {
  /** Manifest schema version. */
  version: 1;
  /** Portable Markdown or MDX document paths. */
  documents: string[];
  /** Optional portable OpenAPI JSON path. */
  openapi?: string;
}

/** Stable navigation ordering attached to a localized document. */
export interface DocumentNavigation {
  /** Stable lowercase navigation section identifier. */
  sectionId: string;
  /** Zero-based section ordering key. */
  sectionOrder: number;
  /** Zero-based ordering key within the section. */
  order: number;
}

/** One immutable, localized document entry in a version 2 manifest. */
export interface ManifestV2Document {
  /** Locale-independent stable document identifier. */
  id: string;
  /** Canonical BCP 47 locale. */
  locale: string;
  /** Portable path to the immutable Markdown or MDX bytes. */
  path: string;
  /** Canonical browser route ending in a slash. */
  route: string;
  /** Media type of the immutable source document. */
  mediaType: "text/markdown" | "text/mdx";
  /** Exact byte length of the source document. */
  bytes: number;
  /** Lowercase SHA-256 digest of the source document bytes. */
  sha256: string;
  /** Stable navigation placement. */
  nav: DocumentNavigation;
}

/** Immutable OpenAPI entry in a version 2 manifest. */
export interface ManifestV2OpenApi {
  /** Portable path to the OpenAPI JSON bytes. */
  path: string;
  /** Exact byte length of the OpenAPI document. */
  bytes: number;
  /** Lowercase SHA-256 digest of the OpenAPI document bytes. */
  sha256: string;
}

/**
 * Provenance fields are nullable so an unavailable value is represented rather
 * than guessed or omitted. A commit without its source repository is invalid.
 */
export interface ManifestV2Provenance {
  /** Canonical HTTPS repository URL, or null when unavailable. */
  repository: string | null;
  /** Complete Git object ID, or null when unavailable. */
  commit: string | null;
  /** Whether the producer observed uncommitted source changes. */
  dirty: boolean;
}

/** Revision-independent fields used to seal a version 2 manifest. */
export interface ManifestV2Core {
  /** Manifest schema version. */
  version: 2;
  /** Canonical locale used when no localized variant is requested. */
  defaultLocale: string;
  /** Canonical locales represented by the manifest. */
  locales: string[];
  /** Deterministically ordered immutable document entries. */
  documents: ManifestV2Document[];
  /** Optional immutable OpenAPI entry. */
  openapi?: ManifestV2OpenApi;
  /** Source provenance observed by the publisher. */
  provenance: ManifestV2Provenance;
}

/** Sealed version 2 corpus manifest with a content-addressed revision. */
export interface ManifestV2 extends ManifestV2Core {
  /** SHA-256 revision computed from the canonical manifest core. */
  revision: string;
}

/** Mutable pointer to one immutable version 2 manifest snapshot. */
export interface CurrentLocatorV2 {
  /** Locator schema version. */
  version: 2;
  /** Revision of the referenced manifest. */
  revision: string;
  /** Digest-derived path to the immutable manifest bytes. */
  manifest: string;
  /** Exact byte length of the referenced manifest. */
  bytes: number;
  /** Lowercase SHA-256 digest of the referenced manifest bytes. */
  sha256: string;
}

/** Byte length and SHA-256 digest used for integrity verification. */
export interface IntegrityDescriptor {
  /** Exact byte length. */
  bytes: number;
  /** Lowercase SHA-256 digest. */
  sha256: string;
}

/** Any supported corpus manifest version. */
export type CorpusManifest = ManifestV1 | ManifestV2;
