import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const result = await build({
  entryPoints: ["scripts/sea-entry.ts"],
  outfile: ".sea/entry.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node25",
  minify: true,
  sourcemap: false,
  legalComments: "eof",
  metafile: true,
});

writeFileSync(
  ".sea/esbuild-metafile.json",
  `${JSON.stringify(result.metafile, null, 2)}\n`,
  "utf8",
);
