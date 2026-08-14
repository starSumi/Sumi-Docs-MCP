import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("artifacts/bin", { recursive: true });

const result = spawnSync(process.execPath, ["--build-sea", "sea-config.json"], {
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
