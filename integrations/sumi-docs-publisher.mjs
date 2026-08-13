import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DOCUMENT_PATH = /^[a-zA-Z0-9_/-]+\.mdx?$/;
const OPENAPI_PATH = /^[a-zA-Z0-9_/-]+\.json$/;

function assertRelativePath(value, pattern, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    !pattern.test(value) ||
    value.startsWith("/") ||
    value.includes("//") ||
    value.split("/").includes("..")
  ) {
    throw new Error(`${label} must be a restricted relative path.`);
  }
}

function assertContained(root, candidate) {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  if (candidate !== root && !candidate.startsWith(normalizedRoot)) {
    throw new Error("Publishing path escapes its configured root.");
  }
}

export function normalizePublisherOptions(options = {}) {
  if (!Array.isArray(options.documents) || options.documents.length === 0) {
    throw new Error("Publisher requires at least one document mapping.");
  }
  if (options.documents.length > 1000) {
    throw new Error("Publisher supports at most 1000 documents.");
  }

  const seenSources = new Set();
  const seenPages = new Set();
  const documents = options.documents.map((document) => {
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      throw new Error("Every document mapping must be an object.");
    }
    if (
      Object.keys(document).some((key) => !["source", "page"].includes(key))
    ) {
      throw new Error("Document mapping contains an unknown field.");
    }
    assertRelativePath(document.source, DOCUMENT_PATH, "Document source");
    if (
      typeof document.page !== "string" ||
      !document.page.startsWith("/") ||
      document.page.includes("..") ||
      document.page.includes("?") ||
      document.page.includes("#")
    ) {
      throw new Error("Document page must be an absolute site path.");
    }
    const page = document.page.endsWith("/")
      ? document.page
      : `${document.page}/`;
    if (seenSources.has(document.source) || seenPages.has(page)) {
      throw new Error("Document source paths and page routes must be unique.");
    }
    seenSources.add(document.source);
    seenPages.add(page);
    return { source: document.source, page };
  });

  if (options.openapi !== undefined) {
    assertRelativePath(options.openapi, OPENAPI_PATH, "OpenAPI source");
  }
  return { documents, ...(options.openapi && { openapi: options.openapi }) };
}

export default function sumiDocsPublisher(rawOptions) {
  const options = normalizePublisherOptions(rawOptions);
  let projectRoot;
  let publicDir;

  return {
    name: "sumi-docs-publisher",
    hooks: {
      "astro:config:done": ({ config }) => {
        projectRoot = fileURLToPath(config.root);
        publicDir = fileURLToPath(config.publicDir);
      },
      "astro:build:done": async ({ dir, logger }) => {
        const outputRoot = fileURLToPath(dir);
        const machineRoot = resolve(outputRoot, "_mcp");
        const contentRoot = resolve(projectRoot, "src/content/docs");
        await mkdir(machineRoot, { recursive: true });

        for (const document of options.documents) {
          const source = resolve(contentRoot, ...document.source.split("/"));
          const destination = resolve(
            machineRoot,
            ...document.source.split("/"),
          );
          assertContained(contentRoot, source);
          assertContained(machineRoot, destination);
          if (![".md", ".mdx"].includes(extname(source).toLowerCase())) {
            throw new Error(
              "Only Markdown and MDX documents may be published.",
            );
          }
          await mkdir(dirname(destination), { recursive: true });
          await copyFile(source, destination);
        }

        if (options.openapi) {
          const source = resolve(publicDir, ...options.openapi.split("/"));
          const destination = resolve(
            machineRoot,
            ...options.openapi.split("/"),
          );
          assertContained(publicDir, source);
          assertContained(machineRoot, destination);
          await mkdir(dirname(destination), { recursive: true });
          await copyFile(source, destination);
        }

        const manifest = {
          version: 1,
          documents: options.documents.map(({ source }) => source),
          ...(options.openapi && { openapi: options.openapi }),
        };
        const routes = Object.fromEntries(
          options.documents.map(({ source, page }) => [source, page]),
        );
        await Promise.all([
          writeFile(
            resolve(machineRoot, "sumi-docs-manifest.json"),
            `${JSON.stringify(manifest, null, 2)}\n`,
          ),
          writeFile(
            resolve(machineRoot, "sumi-docs-routes.json"),
            `${JSON.stringify({ version: 1, routes }, null, 2)}\n`,
          ),
        ]);
        logger.info(
          `Published ${options.documents.length} documents to ${posix.join("_mcp", "sumi-docs-manifest.json")}.`,
        );
      },
    },
  };
}
