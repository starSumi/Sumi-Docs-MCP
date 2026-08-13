import { readFileSync } from "node:fs";

const messagePath = process.argv[2];
if (!messagePath) {
  console.error("Commit message path is required.");
  process.exit(2);
}

const message = readFileSync(messagePath, "utf8")
  .replaceAll("\r\n", "\n")
  .trimEnd();
const visibleMessage = message
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");
const toolReference =
  /\b(?:claude(?:\s+code)?|codex|chatgpt|github\s+copilot|copilot|gemini)\b/i;

if (toolReference.test(visibleMessage)) {
  console.error(
    "Commit messages must describe the engineering change without automated-tool names. Record relevant assistance in review notes.",
  );
  process.exit(1);
}
