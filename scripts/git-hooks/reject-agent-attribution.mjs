import { readFileSync } from "node:fs";

const messagePath = process.argv[2];

if (!messagePath) {
  console.error("Commit message path is required.");
  process.exit(2);
}

const message = readFileSync(messagePath, "utf8")
  .replaceAll("\r\n", "\n")
  .trimEnd();
const footerBlock = message.split(/\n\s*\n/u).at(-1) ?? "";
const attributionPattern = /^(co-authored-by|signed-off-by):\s*(.+)$/i;
const automatedNamePattern =
  /^(claude(?: code)?|codex|chatgpt|github copilot|copilot|gemini)$/i;
const automatedMarkerPattern =
  /(?:\[bot\]|\b(?:ai|llm)\s+(?:agent|assistant)\b)/i;
const toolReferencePattern =
  /\b(?:claude(?:\s+code)?|codex|chatgpt|github\s+copilot|copilot|gemini)\b/i;

const rejectedTrailers = footerBlock.split("\n").filter((line) => {
  const match = attributionPattern.exec(line);
  if (!match) return false;

  const value = match[2].trim();
  const emailMatch = /<([^>]+)>/.exec(value);
  const displayName = value.replace(/\s*<[^>]+>\s*$/, "").trim();

  if (automatedMarkerPattern.test(value)) return true;

  return (
    automatedNamePattern.test(displayName) ||
    (emailMatch
      ? automatedNamePattern.test(emailMatch[1].split("@")[0])
      : false)
  );
});

if (rejectedTrailers.length > 0) {
  console.error(
    "Commit messages must not attribute authorship or sign-off to an automated agent. " +
      "Keep real human authorship metadata and describe tool assistance in review notes when relevant.",
  );
  process.exit(1);
}

const visibleMessage = message
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

if (toolReferencePattern.test(visibleMessage)) {
  console.error(
    "Commit messages must describe the engineering change without automated-tool names. " +
      "Record relevant tool assistance in pull-request or review notes.",
  );
  process.exit(1);
}
