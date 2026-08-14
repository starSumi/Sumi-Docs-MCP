const MANIFEST_FILE_NAME = "sumi-docs-manifest.json";
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_OPENAPI_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAX_DOCUMENTS = 1_000;
const DOWNLOAD_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_PATH_LENGTH = 1_024;
const DOCUMENT_PATH = /^[a-zA-Z0-9_/-]+\.mdx?$/;
const OPENAPI_PATH = /^[a-zA-Z0-9_/-]+\.json$/;

interface RemoteManifest {
  version: 1;
  documents: string[];
  openapi?: string;
}

export interface RemoteDocument {
  path: string;
  content: string;
  sourceUrl: string;
  lastModified?: Date;
}

export interface RemoteCorpus {
  documents: RemoteDocument[];
  openApiContent?: string;
}

export function isRemoteDocsSource(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function isRestrictedRelativePath(value: string, pattern: RegExp): boolean {
  return (
    value.length <= MAX_PATH_LENGTH &&
    pattern.test(value) &&
    !value.startsWith("/") &&
    !value.includes("//")
  );
}

export function normalizeRemoteManifestUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Remote documentation source must be an absolute URL.");
  }

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && isLoopback(url.hostname))
  ) {
    throw new Error(
      "Remote documentation requires HTTPS; HTTP is allowed only on loopback.",
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "Remote documentation URL must not contain credentials, a query, or a fragment.",
    );
  }
  if (!url.pathname.toLowerCase().endsWith(".json")) {
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.pathname += MANIFEST_FILE_NAME;
  }
  return url;
}

function validateManifest(value: unknown): RemoteManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Remote manifest must be a JSON object.");
  }
  const candidate = value as Record<string, unknown>;
  const knownKeys = new Set(["version", "documents", "openapi"]);
  if (Object.keys(candidate).some((key) => !knownKeys.has(key))) {
    throw new Error("Remote manifest contains an unknown field.");
  }
  if (candidate.version !== 1 || !Array.isArray(candidate.documents)) {
    throw new Error(
      "Remote manifest requires version 1 and a documents array.",
    );
  }
  if (candidate.documents.length > MAX_DOCUMENTS) {
    throw new Error(`Remote manifest exceeds ${MAX_DOCUMENTS} documents.`);
  }
  if (
    candidate.documents.some(
      (path) =>
        typeof path !== "string" ||
        !isRestrictedRelativePath(path, DOCUMENT_PATH),
    )
  ) {
    throw new Error(
      "Every remote document must be a restricted relative Markdown/MDX path.",
    );
  }
  const documents = candidate.documents as string[];
  if (new Set(documents).size !== documents.length) {
    throw new Error("Remote manifest contains duplicate document paths.");
  }
  if (
    candidate.openapi !== undefined &&
    (typeof candidate.openapi !== "string" ||
      !isRestrictedRelativePath(candidate.openapi, OPENAPI_PATH))
  ) {
    throw new Error(
      "Remote OpenAPI entry must be a restricted relative JSON path.",
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

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; size: number }> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Remote response exceeds ${maxBytes} bytes.`);
  }
  if (!response.body) return { text: "", size: 0 };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`Remote response exceeds ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const content = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size,
  );
  return { text: content.toString("utf8"), size };
}

async function fetchText(
  url: URL,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<{ text: string; size: number; lastModified?: Date }> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
      : AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "text/markdown, application/json, text/plain;q=0.9" },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Remote documentation redirects are not allowed.");
  }
  if (!response.ok) {
    throw new Error(
      `Remote documentation request failed with HTTP ${response.status}.`,
    );
  }

  const result = await readBoundedResponse(response, maxBytes);
  const lastModifiedValue = response.headers.get("last-modified");
  const lastModified = lastModifiedValue
    ? new Date(lastModifiedValue)
    : undefined;
  return {
    ...result,
    ...(lastModified &&
      !Number.isNaN(lastModified.getTime()) && { lastModified }),
  };
}

export async function loadRemoteCorpus(source: string): Promise<RemoteCorpus> {
  const manifestUrl = normalizeRemoteManifestUrl(source);
  const manifestResponse = await fetchText(manifestUrl, MAX_MANIFEST_BYTES);
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestResponse.text);
  } catch {
    throw new Error("Remote documentation manifest is not valid JSON.");
  }
  const manifest = validateManifest(manifestValue);

  const documents = new Array<RemoteDocument>(manifest.documents.length);
  const downloads = new AbortController();
  let nextIndex = 0;
  let totalBytes = 0;
  const workers = Array.from(
    { length: Math.min(DOWNLOAD_CONCURRENCY, manifest.documents.length) },
    async () => {
      while (nextIndex < manifest.documents.length) {
        const index = nextIndex++;
        const path = manifest.documents[index];
        if (!path) continue;
        const sourceUrl = new URL(path, manifestUrl);
        const response = await fetchText(
          sourceUrl,
          MAX_DOCUMENT_BYTES,
          downloads.signal,
        );
        totalBytes += response.size;
        if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
          throw new Error(
            `Remote documentation exceeds ${MAX_TOTAL_DOCUMENT_BYTES} total bytes.`,
          );
        }
        documents[index] = {
          path,
          content: response.text,
          sourceUrl: sourceUrl.href,
          ...(response.lastModified && { lastModified: response.lastModified }),
        };
      }
    },
  );
  try {
    await Promise.all(workers);
  } catch (error) {
    downloads.abort();
    await Promise.allSettled(workers);
    throw error;
  }

  let openApiContent: string | undefined;
  if (manifest.openapi) {
    openApiContent = (
      await fetchText(
        new URL(manifest.openapi, manifestUrl),
        MAX_OPENAPI_BYTES,
        downloads.signal,
      )
    ).text;
  }
  return {
    documents,
    ...(openApiContent !== undefined && { openApiContent }),
  };
}
