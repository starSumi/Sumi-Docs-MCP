import { existsSync } from "node:fs";

const repositoryMarker = new URL("../.git", import.meta.url);
const hooksDisabled = process.env.HUSKY === "0";
const productionInstall = process.env.NODE_ENV === "production";
const continuousIntegration = process.env.CI === "true";

if (
  hooksDisabled ||
  productionInstall ||
  continuousIntegration ||
  !existsSync(repositoryMarker)
) {
  process.exit(0);
}

const husky = (await import("husky")).default;
const diagnostic = husky();

if (diagnostic) console.error(diagnostic);
