#!/usr/bin/env node

/**
 * Post-build script: Ensures ESM entry point has proper shebang
 * and executable permissions for Unix-like systems.
 */

import { readFile, writeFile, chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entryPoint = join(__dirname, "..", "dist", "index.js");

async function main() {
  try {
    const content = await readFile(entryPoint, "utf-8");

    // Add shebang if not present
    if (!content.startsWith("#!/usr/bin/env node")) {
      const newContent = `#!/usr/bin/env node\n${content}`;
      await writeFile(entryPoint, newContent, "utf-8");
      console.log("Added shebang to dist/index.js");
    }

    // Make executable (Unix-like systems)
    if (process.platform !== "win32") {
      await chmod(entryPoint, 0o755);
      console.log("Made dist/index.js executable");
    }

    console.log("Post-build complete");
  } catch (error) {
    console.error("Post-build failed:", error);
    process.exit(1);
  }
}

main();
