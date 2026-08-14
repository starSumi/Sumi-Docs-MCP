import { reportCliError, run } from "../src/cli.js";

run(process.argv.slice(2)).catch(reportCliError);
