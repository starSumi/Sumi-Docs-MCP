import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

function packageIdentity(moduleId) {
  const withoutQuery = moduleId.replace(/^\0+/u, "").split("?", 1)[0];
  const path = withoutQuery.startsWith("file:")
    ? fileURLToPath(withoutQuery)
    : withoutQuery;
  if (
    !isAbsolute(path) ||
    !path.replaceAll("\\", "/").includes("/node_modules/")
  ) {
    return undefined;
  }

  let cursor = dirname(path);
  for (;;) {
    try {
      const manifest = JSON.parse(
        readFileSync(join(cursor, "package.json"), "utf8"),
      );
      if (
        typeof manifest.name === "string" &&
        typeof manifest.version === "string"
      ) {
        return `${manifest.name}@${manifest.version}`;
      }
    } catch {
      // Continue to the enclosing package boundary.
    }
    const parent = dirname(cursor);
    if (parent === cursor) return undefined;
    cursor = parent;
  }
}

export default function sumiBrowserComponents() {
  return {
    name: "sumi-browser-components",
    apply: "build",
    generateBundle(_options, bundle) {
      const components = new Set();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const moduleId of Object.keys(output.modules)) {
          const identity = packageIdentity(moduleId);
          if (identity) components.add(identity);
        }
      }
      if (components.size === 0) {
        throw new Error("The browser component inventory is empty.");
      }
      this.emitFile({
        type: "asset",
        fileName: "_compliance/browser-components.json",
        source: `${JSON.stringify(
          {
            version: 1,
            basis: "vite-client-chunk-modules",
            components: [...components].sort((left, right) =>
              left.localeCompare(right),
            ),
          },
          null,
          2,
        )}\n`,
      });
    },
  };
}
