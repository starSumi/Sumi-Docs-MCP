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

assert.equal(vscode.type, "stdio");
assert.equal(codex.command, "pnpm");
assert.equal(claude.command, "node");
assert.equal(vscode.command, "node");

function resolveVariables(value) {
  return value
    .replaceAll("${CLAUDE_PROJECT_DIR}", projectRoot)
    .replaceAll("${workspaceFolder}", projectRoot);
}

async function probe({ name, command, args, cwd }) {
  let resolvedCommand = command;
  let resolvedArgs = args.map(resolveVariables);
  if (process.platform === "win32" && command === "pnpm") {
    assert.match(
      process.env.npm_execpath ?? "",
      /pnpm(?:\.cjs)?$/i,
      "npm_execpath must identify pnpm on Windows",
    );
    resolvedCommand = process.execPath;
    resolvedArgs = [process.env.npm_execpath, ...resolvedArgs];
  }
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
      if (message.id !== 1) return;
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
  child.stdin.write(request);
  const result = await response;

  assert.deepEqual(
    new Set(result.result?.tools?.map(({ name: toolName }) => toolName)),
    expectedTools,
    `${name} must expose the stable four-tool surface`,
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
const request = `${JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: { _meta: meta },
})}\n`;

for (const adapter of [
  {
    name: "Codex",
    command: codex.command,
    args: codex.args,
    cwd: join(projectRoot, "docs", "operations"),
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
