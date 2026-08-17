import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const automatedIdentityPattern =
  /\b(?:claude(?:\s+code)?|codex|chatgpt|github\s+copilot|copilot|gemini|(?:ai|llm)\s+(?:agent|assistant))\b/i;

export function containsAutomatedIdentity(value) {
  return automatedIdentityPattern.test(value);
}

function readIdentity(commandArgs) {
  const result = spawnSync("git", commandArgs, {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`Unable to inspect Git identity: ${detail}`);
  }

  return result.stdout;
}

function main(args) {
  const commitIndex = args.indexOf("--commit");
  let identity;

  if (commitIndex >= 0) {
    const commit = args[commitIndex + 1];
    if (!commit || !/^[0-9a-f]{40}$/i.test(commit)) {
      throw new Error("--commit requires a full 40-character SHA.");
    }
    identity = readIdentity([
      "show",
      "-s",
      "--format=%an%n%ae%n%cn%n%ce",
      commit,
    ]);
  } else {
    identity = [
      readIdentity(["var", "GIT_AUTHOR_IDENT"]),
      readIdentity(["var", "GIT_COMMITTER_IDENT"]),
    ].join("\n");
  }

  if (containsAutomatedIdentity(identity)) {
    console.error(
      "Git author and committer identities must name the accountable human or approved service account.",
    );
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main(process.argv.slice(2));
}
