import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

test("the CLI startup chunk excludes corpus acquisition and parsing", async () => {
  const result = await build({
    absWorkingDir: packageRoot,
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    metafile: true,
    outdir: "virtual-dist",
    platform: "node",
    splitting: true,
    target: "node25",
    write: false,
  });

  const entry = Object.values(result.metafile.outputs).find(
    (output) => output.entryPoint?.replaceAll("\\", "/") === "src/index.ts",
  );
  assert.ok(entry, "expected an esbuild entry output for src/index.ts");

  const startupInputs = Object.keys(entry.inputs).map((input) =>
    input.replaceAll("\\", "/"),
  );
  const forbiddenInputs = startupInputs.filter((input) =>
    [
      "/src/vfs/",
      "/src/parser/",
      "/node_modules/remark",
      "/node_modules/unified/",
      "/node_modules/yaml/",
      "/packages/corpus-contract/",
    ].some((segment) => `/${input}`.includes(segment)),
  );

  assert.deepEqual(forbiddenInputs, []);
});
