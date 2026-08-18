import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function isMainModule(
  moduleUrl: string,
  entryPath: string | undefined = process.argv[1],
): boolean {
  if (!entryPath) return false;

  try {
    return (
      realpathSync.native(resolve(entryPath)) ===
      realpathSync.native(fileURLToPath(moduleUrl))
    );
  } catch {
    return pathToFileURL(resolve(entryPath)).href === moduleUrl;
  }
}
