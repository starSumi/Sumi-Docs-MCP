import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";

mkdirSync(".sea/benchmark", { recursive: true });
mkdirSync("artifacts/bin", { recursive: true });

await build({
  entryPoints: {
    "benchmark-raw-responder": "scripts/benchmark-raw-responder.js",
    "benchmark-sdk-empty": "scripts/benchmark-sdk-empty.js",
  },
  outdir: ".sea/benchmark",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node25",
  outExtension: { ".js": ".cjs" },
  minify: true,
  sourcemap: false,
  legalComments: "eof",
});

for (const config of [
  "scripts/benchmark-raw-sea-config.json",
  "scripts/benchmark-sdk-empty-sea-config.json",
]) {
  const result = spawnSync(process.execPath, ["--build-sea", config], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
