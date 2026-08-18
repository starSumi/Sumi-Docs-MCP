#!/usr/bin/env node

import { reportCliError, run } from "./cli.js";
import { isMainModule } from "./utils/main-module.js";

export { parseCliOptions, run } from "./cli.js";

if (isMainModule(import.meta.url)) {
  run(process.argv.slice(2)).catch(reportCliError);
}
