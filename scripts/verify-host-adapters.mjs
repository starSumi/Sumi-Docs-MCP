import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const expectedTools = new Set([
  "list_docs",
  "search_docs",
  "fetch_doc",
  "get_openapi_spec",
]);

const readJson = async (path) =>
  JSON.parse(await readFile(join(projectRoot, path), "utf8"));

const codex = parseToml(
  await readFile(join(projectRoot, ".codex/config.toml"), "utf8"),
).mcp_servers.sumi_docs;
const claude = (await readJson(".mcp.json")).mcpServers["sumi-docs"];
const vscode = (await readJson(".vscode/mcp.json")).servers["sumi-docs"];
const expectedVersion = (await readJson("packages/mcp/package.json")).version;
const serverInfoMetaKey = "io.modelcontextprotocol/serverInfo";

assert.equal(vscode.type, "stdio");
assert.equal(codex.command, "node");
assert.equal(claude.command, "node");
assert.equal(vscode.command, "node");
assert.equal(codex.cwd, ".");

function resolveVariables(value) {
  return value
    .replaceAll("${CLAUDE_PROJECT_DIR}", projectRoot)
    .replaceAll("${workspaceFolder}", projectRoot);
}

async function sendRequest({ name, command, args, cwd }, message) {
  const resolvedCommand = command;
  const resolvedArgs = args.map(resolveVariables);
  const child = spawn(resolvedCommand, resolvedArgs, {
    cwd,
    env: process.env,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

  const response = new Promise((resolveResult, rejectResult) => {
    const timeout = setTimeout(() => {
      child.kill();
      rejectResult(new Error(`${name} timed out. stderr: ${stderr.join("")}`));
    }, 15_000);
    const output = createInterface({ input: child.stdout });
    output.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        clearTimeout(timeout);
        child.kill();
        rejectResult(new Error(`${name} wrote non-JSON stdout: ${line}`));
        return;
      }
      if (message.id !== messageId) return;
      clearTimeout(timeout);
      output.close();
      child.kill();
      resolveResult(message);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectResult(error);
    });
    child.once("close", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        rejectResult(
          new Error(`${name} exited with ${code}. stderr: ${stderr.join("")}`),
        );
      }
    });
  });
  const messageId = message.id;
  child.stdin.write(`${JSON.stringify(message)}\n`);
  return response;
}

async function probe(adapter) {
  const toolsResponse = await sendRequest(adapter, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: { _meta: meta },
  });

  assert.deepEqual(
    new Set(toolsResponse.result?.tools?.map(({ name: toolName }) => toolName)),
    expectedTools,
    `${adapter.name} must expose the stable four-tool surface`,
  );
  assert.equal(
    toolsResponse.result?._meta?.[serverInfoMetaKey]?.version,
    expectedVersion,
    `${adapter.name} must report the expected server version`,
  );

  const corpusResponse = await sendRequest(adapter, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "list_docs",
      arguments: {},
      _meta: meta,
    },
  });
  const content = corpusResponse.result?.content;
  assert.equal(
    Array.isArray(content) && content[0]?.type,
    "text",
    `${adapter.name} must return a text list_docs result`,
  );
  const paths = new Set(JSON.parse(content[0].text).map(({ path }) => path));
  assert.ok(
    paths.has("architecture.md") && paths.has("getting-started.md"),
    `${adapter.name} must load the reviewed self-hosted product corpus`,
  );
}

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "host-adapter-smoke",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};
for (const adapter of [
  {
    name: "Codex",
    command: codex.command,
    args: codex.args,
    cwd: projectRoot,
  },
  {
    name: "Claude Code",
    command: claude.command,
    args: claude.args,
    cwd: projectRoot,
  },
  {
    name: "VS Code",
    command: vscode.command,
    args: vscode.args,
    cwd: projectRoot,
  },
]) {
  await probe(adapter);
}

console.log("Verified Codex, Claude Code, and VS Code MCP adapters.");
