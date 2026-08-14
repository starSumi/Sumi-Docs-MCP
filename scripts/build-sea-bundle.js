import { build } from "esbuild";

await build({
  entryPoints: ["scripts/sea-entry.ts"],
  outfile: ".sea/entry.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node25",
  minify: true,
  sourcemap: false,
  legalComments: "none",
});
