import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

interface SeaConfig {
  main?: string;
  output?: string;
  useSnapshot?: boolean;
  useCodeCache?: boolean;
  assets?: Record<string, string>;
}

test("SEA config embeds the bundled CommonJS entry point", async () => {
  const config = JSON.parse(
    await readFile("sea-config.json", "utf8"),
  ) as SeaConfig;

  assert.equal(config.main, ".sea/entry.cjs");
  assert.equal(config.output, "artifacts/bin/sumi-docs-mcp.exe");
  assert.equal(config.useSnapshot, false);
  assert.equal(config.useCodeCache, true);
  assert.deepEqual(config.assets, {});
});
