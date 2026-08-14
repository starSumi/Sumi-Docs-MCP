import { createServer } from "node:http";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import minimist from "minimist";

const args = minimist(process.argv.slice(2), {
  string: ["docs", "openapi", "port"],
  boolean: ["help"],
});

if (args.help) {
  console.log(`Usage:
  node scripts/preview-docs.js --docs <directory> [--openapi <path>] [--port 4173]

The preview binds to 127.0.0.1 and serves a read-only remote-source manifest,
Markdown/MDX files, and an optional OpenAPI JSON document.`);
  process.exit(0);
}

const docsArgument = args.docs ?? "examples/basic/docs";
if (typeof docsArgument !== "string" || docsArgument.trim() === "") {
  console.error("--docs must name one documentation directory.");
  process.exit(1);
}

const portText = args.port ?? "4173";
const port = Number(portText);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error("--port must be an integer between 0 and 65535.");
  process.exit(1);
}

const root = await realpath(resolve(docsArgument));
if (!(await stat(root)).isDirectory()) {
  console.error("--docs must name one documentation directory.");
  process.exit(1);
}

const defaultOpenApi =
  args.docs === undefined && args.openapi === undefined
    ? "examples/basic/openapi.json"
    : undefined;
const openApiArgument = args.openapi ?? defaultOpenApi;
let openApiPath;
if (openApiArgument !== undefined) {
  if (typeof openApiArgument !== "string" || openApiArgument.trim() === "") {
    console.error("--openapi must name one JSON file.");
    process.exit(1);
  }
  openApiPath = await realpath(resolve(openApiArgument));
  if (!(await stat(openApiPath)).isFile() || !/\.json$/i.test(openApiPath)) {
    console.error("--openapi must name one JSON file.");
    process.exit(1);
  }
}

function isInsideRoot(candidate) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) &&
      pathFromRoot !== ".." &&
      !isAbsolute(pathFromRoot))
  );
}

function securityHeaders(contentType) {
  return {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "content-type": contentType,
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  };
}

function send(response, method, status, body, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders("text/plain; charset=utf-8"),
    ...headers,
    "content-length": Buffer.byteLength(body),
  });
  response.end(method === "HEAD" ? undefined : body);
}

async function listDocumentPaths(directory = root) {
  const documents = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const candidate = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      documents.push(...(await listDocumentPaths(candidate)));
      continue;
    }
    if (!entry.isFile() || !/\.mdx?$/i.test(entry.name)) continue;
    const actualPath = await realpath(candidate);
    if (!isInsideRoot(actualPath)) continue;
    documents.push(relative(root, actualPath).split(sep).join("/"));
  }
  return documents.sort((left, right) => left.localeCompare(right));
}

async function resolveDocument(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  const relativePath = decodedPath.replace(/^\/+/, "");
  const hasMarkdownExtension = /\.mdx?$/i.test(relativePath);
  if (
    relativePath === "" ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    relativePath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  ) {
    return undefined;
  }

  const candidates = hasMarkdownExtension
    ? [resolve(root, relativePath)]
    : [
        resolve(root, `${relativePath}.md`),
        resolve(root, `${relativePath}.mdx`),
      ];
  for (const candidate of candidates) {
    if (!isInsideRoot(candidate)) continue;
    try {
      const actualPath = await realpath(candidate);
      if (!isInsideRoot(actualPath) || !(await stat(actualPath)).isFile())
        continue;
      return actualPath;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return undefined;
}

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    send(response, method, 405, "Method not allowed.\n", {
      allow: "GET, HEAD",
    });
    return;
  }

  try {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/") {
      const documents = (await listDocumentPaths()).map((path) =>
        path.replace(/\.mdx?$/i, ""),
      );
      send(response, method, 200, `${documents.join("\n")}\n`);
      return;
    }

    if (requestUrl.pathname === "/sumi-docs-manifest.json") {
      const manifest = {
        version: 1,
        documents: await listDocumentPaths(),
        ...(openApiPath && { openapi: "openapi.json" }),
      };
      send(response, method, 200, `${JSON.stringify(manifest, null, 2)}\n`, {
        "content-type": "application/json; charset=utf-8",
      });
      return;
    }

    if (requestUrl.pathname === "/openapi.json" && openApiPath) {
      send(response, method, 200, await readFile(openApiPath, "utf8"), {
        "content-type": "application/json; charset=utf-8",
      });
      return;
    }

    const documentPath = await resolveDocument(requestUrl.pathname);
    if (!documentPath) {
      send(response, method, 404, "Document not found.\n");
      return;
    }

    const body = await readFile(documentPath, "utf8");
    send(response, method, 200, body, {
      "content-type": "text/markdown; charset=utf-8",
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    send(response, method, 500, "Unable to read the document.\n");
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const activePort =
    typeof address === "object" && address ? address.port : port;
  console.error(`Preview server listening at http://127.0.0.1:${activePort}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
