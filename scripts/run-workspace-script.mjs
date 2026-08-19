import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [workspacePath, scriptName, ...scriptArguments] = process.argv.slice(2);

if (!workspacePath || !scriptName) {
  console.error(
    "Usage: node scripts/run-workspace-script.mjs <workspace> <script> [arguments]",
  );
  process.exit(2);
}

const workspaceRoot = resolve(repositoryRoot, workspacePath);
const workspaceRelative = relative(repositoryRoot, workspaceRoot);
if (
  workspaceRelative === "" ||
  workspaceRelative === ".." ||
  isAbsolute(workspaceRelative) ||
  workspaceRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
) {
  console.error("Workspace must be a repository-relative child directory.");
  process.exit(2);
}

const packageJson = JSON.parse(
  readFileSync(resolve(workspaceRoot, "package.json"), "utf8"),
);
if (!Object.hasOwn(packageJson.scripts ?? {}, scriptName)) {
  console.error(
    `Unknown script ${JSON.stringify(scriptName)} in ${workspaceRelative.replaceAll("\\", "/")}/package.json.`,
  );
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [
    `--run=${scriptName}`,
    ...(scriptArguments.length > 0 ? ["--", ...scriptArguments] : []),
  ],
  {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
