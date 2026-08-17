import minimist from "minimist";
import type { CLIOptions } from "./types/index.js";
import { normalizeBaseUrl } from "./utils/document-url.js";
import {
  isRemoteDocsSource,
  normalizeRemoteManifestUrl,
} from "./vfs/remote-source.js";
import { VERSION } from "./version.js";

function printHelp(): void {
  console.log(`Sumi-Docs-MCP ${VERSION} - Read-only MCP server for documentation

Usage:
  sumi-docs-mcp serve <docs-source> [--openapi <path>] [--base-url <url>] [--transport stdio]

Options:
  <docs-source>          Local directory or remote HTTPS manifest/base URL
  --openapi <path>       Path to an OpenAPI JSON specification
                         (local directory mode only)
  --base-url <url>       Public HTTP(S) prefix for clickable document URLs
  --transport <type>     Transport type: stdio (default)
  --verbose              Enable verbose diagnostics
  --help, -h             Show this help
  --version, -v          Show the version`);
}

export function parseCliOptions(argv: string[]): CLIOptions | null {
  const args = minimist(argv, {
    string: ["openapi", "base-url", "transport"],
    boolean: ["help", "version", "verbose"],
    alias: { h: "help", v: "version" },
    "--": true,
  });
  if (args.help || args.version) return null;
  if (args._[0] !== "serve" || typeof args._[1] !== "string") {
    throw new Error(
      "Usage: sumi-docs-mcp serve <docs-source> [--openapi <path>] [--base-url <url>] [--transport stdio]",
    );
  }
  const transport = args.transport ?? "stdio";
  if (transport !== "stdio") {
    throw new Error(
      `Transport '${transport}' is not implemented; only stdio is currently supported.`,
    );
  }
  const docsSource = args._[1];
  if (isRemoteDocsSource(docsSource)) {
    normalizeRemoteManifestUrl(docsSource);
    if (args.openapi) {
      throw new Error(
        "Remote documentation must declare OpenAPI in its manifest; --openapi is local-only.",
      );
    }
  }
  return {
    docsSource,
    openApiPath: args.openapi,
    baseUrl:
      typeof args["base-url"] === "string"
        ? normalizeBaseUrl(args["base-url"])
        : undefined,
    transport,
    verbose: Boolean(args.verbose),
  };
}

export async function run(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(VERSION);
    return;
  }

  const options = parseCliOptions(argv);
  if (!options) return;

  const [{ DocsMcpServer }, { serveStdio }] = await Promise.all([
    import("./mcp/server.js"),
    import("@modelcontextprotocol/server/stdio"),
  ]);

  const loadVault = async (): Promise<
    import("./vfs/DocsVault.js").DocsVault
  > => {
    const { DocsVault } = await import("./vfs/DocsVault.js");
    const vault = new DocsVault();
    if (isRemoteDocsSource(options.docsSource)) {
      await vault.loadFromRemoteManifest(options.docsSource);
    } else {
      await vault.loadFromDirectory(options.docsSource);
      if (options.openApiPath) await vault.loadOpenApi(options.openApiPath);
    }
    return vault;
  };

  serveStdio(
    () => new DocsMcpServer(loadVault, { baseUrl: options.baseUrl }).server,
    { legacy: "reject" },
  );
}

export function reportCliError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
