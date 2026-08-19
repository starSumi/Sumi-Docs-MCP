import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli || !existsSync(pnpmCli) || !/pnpm/iu.test(pnpmCli)) {
  console.error(
    "The pnpm CLI path is unavailable. Start this command with the pinned pnpm entry point.",
  );
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [pnpmCli, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
