import { existsSync } from "node:fs";

const repositoryMarker = new URL("../.git", import.meta.url);
const disabled = process.env.HUSKY === "0";
const production = process.env.NODE_ENV === "production";
const ci = process.env.CI === "true";

if (disabled || production || ci || !existsSync(repositoryMarker))
  process.exit(0);

const husky = (await import("husky")).default;
const diagnostic = husky();
if (diagnostic) console.error(diagnostic);
