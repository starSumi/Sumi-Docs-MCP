import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function readNodeRuntimeLicense(executablePath = process.execPath) {
  const candidates = [
    join(dirname(executablePath), "LICENSE"),
    join(dirname(dirname(executablePath)), "LICENSE"),
  ];
  const matches = [...new Set(candidates)].filter((path) => existsSync(path));
  if (matches.length === 0) {
    throw new Error(
      "The Node.js distribution license was not found beside the runtime or its installation prefix.",
    );
  }

  const content = readFileSync(matches[0]);
  for (const path of matches.slice(1)) {
    if (!content.equals(readFileSync(path))) {
      throw new Error(
        "Conflicting Node.js distribution licenses were found for the runtime.",
      );
    }
  }

  return { content, path: matches[0] };
}
