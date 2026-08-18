/** Maximum accepted serialized manifest size in bytes. */
export const MAX_MANIFEST_BYTES = 256 * 1024;
/** Maximum accepted size of one documentation file in bytes. */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
/** Maximum accepted OpenAPI document size in bytes. */
export const MAX_OPENAPI_BYTES = 8 * 1024 * 1024;
/** Maximum aggregate size of all documentation files in bytes. */
export const MAX_TOTAL_DOCUMENT_BYTES = 64 * 1024 * 1024;
/** Maximum number of documents in one manifest. */
export const MAX_DOCUMENTS = 1_000;
/** Maximum portable source path length. */
export const MAX_PATH_LENGTH = 1_024;
/** Maximum published route or provenance URL length. */
export const MAX_ROUTE_LENGTH = 4_096;

/** Regular-expression source for portable Markdown and MDX paths. */
export const DOCUMENT_PATH_PATTERN = "^[A-Za-z0-9_/-]+\\.mdx?$";
/** Regular-expression source for portable OpenAPI JSON paths. */
export const OPENAPI_PATH_PATTERN = "^[A-Za-z0-9_/-]+\\.json$";
/** Regular-expression source for stable lowercase identifiers. */
export const IDENTIFIER_PATTERN = "^[a-z0-9]+(?:[._-][a-z0-9]+)*$";
/** Regular-expression source for lowercase SHA-256 digests. */
export const SHA256_PATTERN = "^[a-f0-9]{64}$";
/** Regular-expression source for content-addressed manifest revisions. */
export const REVISION_PATTERN = "^sha256:[a-f0-9]{64}$";
/** Regular-expression source for complete SHA-1 or SHA-256 Git object IDs. */
export const FULL_COMMIT_PATTERN = "^(?:[a-f0-9]{40}|[a-f0-9]{64})$";
