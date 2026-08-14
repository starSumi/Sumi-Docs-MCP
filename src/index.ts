#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { reportCliError, run } from "./cli.js";

export { parseCliOptions, run } from "./cli.js";

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  run(process.argv.slice(2)).catch(reportCliError);
}
