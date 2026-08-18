import { pathToFileURL } from "node:url";

export const REQUIRED_PNPM_VERSION = "10.26.0";

export function validatePackageManager(userAgent) {
  const match = /^pnpm\/([^\s]+)(?:\s|$)/u.exec(userAgent ?? "");
  if (!match) {
    return `Use pnpm ${REQUIRED_PNPM_VERSION} to install this workspace.`;
  }
  if (match[1] !== REQUIRED_PNPM_VERSION) {
    return `Expected pnpm ${REQUIRED_PNPM_VERSION}, received pnpm ${match[1]}.`;
  }
  return undefined;
}

function main() {
  const error = validatePackageManager(process.env.npm_config_user_agent);
  if (error) throw new Error(error);
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
