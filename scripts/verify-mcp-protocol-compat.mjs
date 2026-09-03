import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, ["packages/mcp/dist/index.js", "serve"], {
  cwd: projectRoot,
  env: process.env,
  shell: false,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

const stderr = [];
const pending = new Map();
let nextId = 1;
const output = createInterface({ input: child.stdout });
child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
output.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    child.kill();
    for (const { reject } of pending.values())
      reject(new Error("MCP server wrote non-JSON stdout."));
    pending.clear();
    return;
  }
  if (typeof message.id !== "number") return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timeout);
  request.resolve(message);
});

child.once("error", (error) => {
  for (const { reject, timeout } of pending.values()) {
    clearTimeout(timeout);
    reject(error);
  }
  pending.clear();
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolveResponse, rejectResponse) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      rejectResponse(new Error(`Timed out waiting for ${method}.`));
    }, 10_000);
    pending.set(id, {
      resolve: resolveResponse,
      reject: rejectResponse,
      timeout,
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
    );
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

function toolText(response) {
  assert.equal(response.error, undefined);
  const result = response.result;
  assert.equal(result?.isError, undefined);
  assert.equal(result?.content?.[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

try {
  const initialized = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "sumi-protocol-compat", version: "1.0.0" },
  });
  assert.equal(initialized.error, undefined);
  assert.equal(initialized.result?.protocolVersion, "2025-06-18");
  notify("notifications/initialized", {});

  const tools = await request("tools/list", {});
  assert.deepEqual(
    new Set(tools.result?.tools?.map(({ name }) => name)),
    new Set(["fetch_doc", "get_openapi_spec", "list_docs", "search_docs"]),
  );

  const listed = toolText(
    await request("tools/call", { name: "list_docs", arguments: {} }),
  );
  assert.ok(listed.some(({ path }) => path === "architecture.md"));

  const searched = toolText(
    await request("tools/call", {
      name: "search_docs",
      arguments: { query: "protocol" },
    }),
  );
  assert.ok(searched.length > 0);

  const fetched = toolText(
    await request("tools/call", {
      name: "fetch_doc",
      arguments: { path: "architecture.md" },
    }),
  );
  assert.equal(fetched.path, "architecture.md");
} catch (error) {
  const detail = stderr.join("").trim().slice(-2_000);
  throw new Error(
    `${error instanceof Error ? error.message : String(error)}${
      detail ? ` stderr: ${detail}` : ""
    }`,
    { cause: error },
  );
} finally {
  output.close();
  child.stdin.end();
  child.kill();
}

console.log("Verified MCP 2025-06-18 legacy handshake and tool calls.");
