import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ALLOWED_HOST_FILES = new Set([
  ".agents/skills/sumi-docs-maintain/SKILL.md",
  ".agents/skills/sumi-docs-maintain/agents/openai.yaml",
  ".claude/skills/sumi-docs-maintain/SKILL.md",
  ".codex/config.toml",
  ".mcp.json",
  ".vscode/mcp.json",
]);

const HOST_ROOT =
  /^(?:\.agent|\.agents|\.claude|\.codex|\.vscode)(?:\/|$)|^\.mcp(?:\.|$)/iu;
const REGULAR_FILE_MODE = "100644";

export function isHostControlledPath(path) {
  return HOST_ROOT.test(path);
}

export function parseIndexEntries(output) {
  return output
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf("\t");
      if (tab < 0) throw new Error("Unexpected git ls-files output.");
      const [mode] = entry.slice(0, tab).split(" ");
      return { mode, path: entry.slice(tab + 1) };
    });
}

export function validateHostEntries(entries, { requireComplete = false } = {}) {
  const errors = [];
  const present = new Set();
  for (const entry of entries) {
    if (!isHostControlledPath(entry.path)) continue;
    if (!ALLOWED_HOST_FILES.has(entry.path)) {
      errors.push(`Host-local path is not allowlisted: ${entry.path}`);
      continue;
    }
    if (entry.mode !== REGULAR_FILE_MODE) {
      errors.push(
        `Host adapter must be a regular non-executable file: ${entry.path} (${entry.mode})`,
      );
      continue;
    }
    present.add(entry.path);
  }
  if (requireComplete) {
    for (const path of ALLOWED_HOST_FILES) {
      if (!present.has(path)) {
        errors.push(`Required host adapter is not tracked: ${path}`);
      }
    }
  }
  return errors;
}

export function validateHostContents(contents) {
  const errors = [];
  const maintainerSkill = contents.get(
    ".agents/skills/sumi-docs-maintain/SKILL.md",
  );
  if (maintainerSkill !== undefined) {
    if (!maintainerSkill.includes("apps/web/src/content-catalog.ts")) {
      errors.push(
        "Maintainer Skill must reference the TypeScript content catalog.",
      );
    }
    if (maintainerSkill.includes("content-catalog.mjs")) {
      errors.push(
        "Maintainer Skill references the retired JavaScript content catalog.",
      );
    }
    for (const command of [
      "pnpm run verify",
      "pnpm run verify:integration",
      "pnpm run smoke:mcp",
      "pnpm run pack:mcp",
    ]) {
      if (!maintainerSkill.includes(command)) {
        errors.push(
          `Maintainer Skill is missing the workspace command: ${command}`,
        );
      }
    }
    if (/\bnpm run\b/u.test(maintainerSkill)) {
      errors.push(
        "Maintainer Skill must not bypass the pnpm workspace lifecycle.",
      );
    }
  }

  const claudeAdapter = contents.get(
    ".claude/skills/sumi-docs-maintain/SKILL.md",
  );
  if (
    claudeAdapter !== undefined &&
    !claudeAdapter.includes(
      "../../../.agents/skills/sumi-docs-maintain/SKILL.md",
    )
  ) {
    errors.push(
      "Claude Skill adapter must route to the canonical maintainer Skill.",
    );
  }

  return errors;
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed.`);
  }
  return result.stdout;
}

function readTrackedEntries(cwd) {
  return parseIndexEntries(runGit(["ls-files", "--stage", "-z"], cwd));
}

function readStagedEntries(cwd) {
  const changed = runGit(
    ["diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z"],
    cwd,
  )
    .split("\0")
    .filter((path) => path && isHostControlledPath(path));

  return changed.flatMap((path) =>
    parseIndexEntries(runGit(["ls-files", "--stage", "-z", "--", path], cwd)),
  );
}

function readIndexContents(entries, cwd) {
  return new Map(
    entries
      .filter((entry) => isHostControlledPath(entry.path))
      .map((entry) => [entry.path, runGit(["show", `:${entry.path}`], cwd)]),
  );
}

export function verifyHostFiles(mode, cwd = process.cwd()) {
  const entries =
    mode === "--staged" ? readStagedEntries(cwd) : readTrackedEntries(cwd);
  const errors = validateHostEntries(entries, {
    requireComplete: mode === "--tracked",
  });
  errors.push(...validateHostContents(readIndexContents(entries, cwd)));
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return entries.filter((entry) => isHostControlledPath(entry.path)).length;
}

function main() {
  const [mode, ...extra] = process.argv.slice(2);
  if (!new Set(["--staged", "--tracked"]).has(mode) || extra.length > 0) {
    throw new Error(
      "Usage: node scripts/verify-host-files.mjs (--staged|--tracked)",
    );
  }
  const count = verifyHostFiles(mode);
  process.stdout.write(`Verified ${count} host adapter file(s).\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
