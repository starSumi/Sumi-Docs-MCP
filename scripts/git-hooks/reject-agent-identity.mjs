import { spawnSync } from "node:child_process";

const automatedIdentity =
  /\b(?:claude(?:\s+code)?|codex|chatgpt|github\s+copilot|copilot|gemini|(?:ai|llm)\s+(?:agent|assistant))\b/i;

function readIdentity(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to inspect Git identity.");
  }
  return result.stdout;
}

const identity = [
  readIdentity(["var", "GIT_AUTHOR_IDENT"]),
  readIdentity(["var", "GIT_COMMITTER_IDENT"]),
].join("\n");

if (automatedIdentity.test(identity)) {
  console.error(
    "Git author and committer identities must name the accountable human or approved service account.",
  );
  process.exit(1);
}
