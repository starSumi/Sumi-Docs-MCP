import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { normalizeSiteBasePath } from "../src/site-config.ts";

const outputRoot = resolve("dist");
const basePath = normalizeSiteBasePath(process.env.BASE_PATH);
const mcpEntry = resolve("..", "..", "packages", "mcp", "dist", "index.js");
await access(mcpEntry);
const projectedManifest = JSON.parse(
  await readFile(
    resolve(outputRoot, "_mcp", "sumi-docs-manifest.json"),
    "utf8",
  ),
);
const expectedDocumentPaths = [...projectedManifest.documents].sort(
  (left, right) => left.localeCompare(right, "en"),
);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".mdx", "text/markdown; charset=utf-8"],
]);

const staticServer = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      basePath !== "/" &&
      decodedPath !== basePath.slice(0, -1) &&
      !decodedPath.startsWith(basePath)
    ) {
      response.writeHead(404).end();
      return;
    }
    let relativePath =
      basePath === "/"
        ? decodedPath.replace(/^\/+/, "")
        : decodedPath.slice(basePath.length).replace(/^\/+/, "");
    if (relativePath === "" || relativePath.endsWith("/"))
      relativePath += "index.html";
    const candidate = resolve(outputRoot, ...relativePath.split("/"));
    const rootPrefix = outputRoot.endsWith(sep)
      ? outputRoot
      : `${outputRoot}${sep}`;
    if (candidate !== outputRoot && !candidate.startsWith(rootPrefix)) {
      response.writeHead(404).end();
      return;
    }
    const file = await stat(candidate);
    if (!file.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "content-type":
        contentTypes.get(extname(candidate)) ?? "application/octet-stream",
      "content-length": file.size,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen, rejectListen) => {
  staticServer.once("error", rejectListen);
  staticServer.listen(0, "127.0.0.1", resolveListen);
});
const address = staticServer.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}${basePath}`;
const pageUrl = (route) =>
  new URL(route === "/" ? "" : route.replace(/^\/+/, ""), baseUrl).href;
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "sumi-docs-web-e2e",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};

async function readCorpusFromSource(source) {
  const processHandle = spawn(
    process.execPath,
    [mcpEntry, "serve", source, "--base-url", baseUrl],
    {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const processStderr = [];
  processHandle.stderr.on("data", (chunk) =>
    processStderr.push(chunk.toString()),
  );
  const processLines = createInterface({ input: processHandle.stdout });
  const responses = new Map();
  const corpus = new Promise((resolveCorpus, rejectCorpus) => {
    const timer = setTimeout(
      () =>
        rejectCorpus(
          new Error(`MCP corpus response timed out: ${processStderr.join("")}`),
        ),
      10_000,
    );
    processLines.on("line", (line) => {
      const message = JSON.parse(line);
      if (typeof message.id === "number") responses.set(message.id, message);
      if (responses.size !== expectedDocumentPaths.length + 1) return;
      clearTimeout(timer);
      resolveCorpus({
        listed: JSON.parse(
          responses.get(2)?.result?.content?.[0]?.text ?? "null",
        ),
        documents: new Map(
          expectedDocumentPaths.map((path, index) => [
            path,
            JSON.parse(
              responses.get(100 + index)?.result?.content?.[0]?.text ?? "null",
            ),
          ]),
        ),
      });
    });
  });
  try {
    const requests = [
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list_docs", arguments: {}, _meta: meta },
      },
      ...expectedDocumentPaths.map((path, index) => ({
        jsonrpc: "2.0",
        id: 100 + index,
        method: "tools/call",
        params: { name: "fetch_doc", arguments: { path }, _meta: meta },
      })),
    ];
    for (const request of requests)
      processHandle.stdin.write(`${JSON.stringify(request)}\n`);
    return await corpus;
  } finally {
    processLines.close();
    processHandle.kill();
  }
}

const v1Corpus = await readCorpusFromSource(`${baseUrl}_mcp/`);

const child = spawn(
  process.execPath,
  [mcpEntry, "serve", `${baseUrl}_mcp/v2/current.json`, "--base-url", baseUrl],
  { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
);
const stderr = [];
child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
const responses = new Map();
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (typeof message.id === "number") responses.set(message.id, message);
  } catch {
    // Protocol output is validated by the timeout and response assertions below.
  }
});

const requests = [
  { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: meta } },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "list_docs", arguments: {}, _meta: meta },
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "search_docs",
      arguments: { query: "manifest" },
      _meta: meta,
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "fetch_doc",
      arguments: { path: "getting-started.md" },
      _meta: meta,
    },
  },
  {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "get_openapi_spec",
      arguments: { endpoint: "/health" },
      _meta: meta,
    },
  },
  {
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "search_docs",
      arguments: { query: "远程文档源" },
      _meta: meta,
    },
  },
  {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "fetch_doc",
      arguments: { path: "zh-cn/getting-started.md" },
      _meta: meta,
    },
  },
  ...expectedDocumentPaths.map((path, index) => ({
    jsonrpc: "2.0",
    id: 100 + index,
    method: "tools/call",
    params: { name: "fetch_doc", arguments: { path }, _meta: meta },
  })),
];

try {
  for (const request of requests)
    child.stdin.write(`${JSON.stringify(request)}\n`);
  const deadline = Date.now() + 10_000;
  while (responses.size < requests.length && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  assert.equal(
    responses.size,
    requests.length,
    `MCP responses timed out. stderr: ${stderr.join("")}`,
  );

  const toolNames = responses.get(1)?.result?.tools?.map(({ name }) => name);
  assert.deepEqual(
    new Set(toolNames),
    new Set(["list_docs", "search_docs", "fetch_doc", "get_openapi_spec"]),
  );
  const parseToolResult = (id) =>
    JSON.parse(responses.get(id)?.result?.content?.[0]?.text ?? "null");
  const listed = parseToolResult(2);
  assert.equal(listed.length, expectedDocumentPaths.length);
  assert.deepEqual(
    listed.map(({ path }) => path),
    expectedDocumentPaths,
  );
  assert.deepEqual(
    listed.map(({ path }) => path),
    v1Corpus.listed.map(({ path }) => path),
  );
  assert.equal(
    listed.find(({ path }) => path === "getting-started.md")?.url,
    `${baseUrl}getting-started/`,
  );
  assert.equal(
    listed.find(({ path }) => path === "zh-cn/getting-started.md")?.url,
    `${baseUrl}zh-cn/getting-started/`,
  );
  assert.equal(parseToolResult(3)[0]?.path, "remote-sources.md");
  assert.match(parseToolResult(4)?.content ?? "", /four read-only tools/i);
  assert.deepEqual(Object.keys(parseToolResult(5)?.paths ?? {}), ["/health"]);
  const chineseSearchResults = parseToolResult(6);
  assert.equal(chineseSearchResults[0]?.path, "zh-cn/remote-sources.md");
  assert.ok(
    chineseSearchResults.every(({ path }) => path.startsWith("zh-cn/")),
  );
  assert.match(parseToolResult(7)?.content ?? "", /四个只读工具/);
  assert.ok(listed.some(({ path }) => path === "contributing.md"));
  assert.ok(listed.some(({ path }) => path === "skills-and-orchestration.md"));

  const routeMap = JSON.parse(
    await readFile(
      resolve(outputRoot, "_mcp", "sumi-docs-routes.json"),
      "utf8",
    ),
  );
  for (const [index, path] of expectedDocumentPaths.entries()) {
    const response = responses.get(100 + index);
    assert.notEqual(
      response?.result?.isError,
      true,
      `MCP failed to fetch '${path}'`,
    );
    const fetched = parseToolResult(100 + index);
    assert.equal(fetched.path, path);
    assert.equal(typeof fetched.content, "string");
    assert.ok(
      fetched.content.length > 0,
      `MCP returned empty content for '${path}'`,
    );
    assert.ok(Array.isArray(fetched.headings));
    const v1Fetched = v1Corpus.documents.get(path);
    assert.deepEqual(
      {
        path: v1Fetched?.path,
        title: v1Fetched?.title,
        content: v1Fetched?.content,
        frontmatter: v1Fetched?.frontmatter,
        headings: v1Fetched?.headings,
        url: v1Fetched?.url,
      },
      {
        path: fetched.path,
        title: fetched.title,
        content: fetched.content,
        frontmatter: fetched.frontmatter,
        headings: fetched.headings,
        url: fetched.url,
      },
      `v1 and v2 MCP results differ for '${path}'`,
    );
    const expectedPage = pageUrl(routeMap.routes[path]);
    const actualPage = new URL(fetched.url);
    const normalizedActualPage = actualPage.pathname.endsWith("/")
      ? actualPage.href
      : `${actualPage.href}/`;
    assert.equal(normalizedActualPage, expectedPage);
  }
  for (const document of listed) {
    const expectedPage = pageUrl(routeMap.routes[document.path]);
    const actualPage = new URL(document.url);
    const normalizedActualPage = actualPage.pathname.endsWith("/")
      ? actualPage.href
      : `${actualPage.href}/`;
    assert.equal(normalizedActualPage, expectedPage);
    const pageResponse = await fetch(expectedPage);
    assert.equal(pageResponse.status, 200, `${expectedPage} did not resolve`);
    assert.match(pageResponse.headers.get("content-type") ?? "", /^text\/html/);
  }

  console.log(
    `Verified equivalent v1/v2 corpora through all four MCP tools, ${listed.length * 2} document fetches, and ${listed.length} page URLs.`,
  );
} finally {
  lines.close();
  child.kill();
  await new Promise((resolveClose) => staticServer.close(resolveClose));
}
