import minimist from "minimist";
import type { DoctorReport } from "./doctor.js";
import type { ParsedCLIOptions } from "./types/index.js";
import { normalizeBaseUrl } from "./utils/document-url.js";
import { sanitizeDiagnostic } from "./utils/diagnostics.js";
import {
  isRemoteDocsSource,
  normalizeRemoteManifestUrl,
} from "./vfs/remote-source.js";
import { VERSION } from "./version.js";

function printHelp(): void {
  console.log(`Sumi-Docs-MCP ${VERSION} - Read-only MCP server for documentation

Usage:
  sumi-docs-mcp serve [docs-source] [--config <path>] [--openapi <path>] [--base-url <url>] [--transport stdio]
  sumi-docs-mcp doctor [docs-source] [--config <path>] [--json] [--show-paths]

Options:
  [docs-source]          Local directory or remote HTTPS manifest/base URL
                         (default: project config, then <project-root>/docs)
  --config <path>        Explicit sumi-docs.config.json path
  --openapi <path>       Path to an OpenAPI JSON specification
                         (local directory mode only)
  --base-url <url>       Public HTTP(S) prefix for clickable document URLs
  --transport <type>     Transport type: stdio (default)
  --verbose              Enable verbose diagnostics
  --json                 Emit a machine-readable doctor report
  --show-paths           Show resolved local paths in doctor output
  --help, -h             Show this help
  --version, -v          Show the version`);
}

export function parseCliOptions(argv: string[]): ParsedCLIOptions | null {
  if (argv.some((argument) => argument.startsWith("--show-paths"))) {
    throw new Error("--show-paths is supported only by the doctor command.");
  }
  const args = minimist(argv, {
    string: ["config", "openapi", "base-url", "transport"],
    boolean: ["help", "version", "verbose"],
    alias: { h: "help", v: "version" },
    "--": true,
  });
  if (args.help || args.version) return null;
  for (const option of ["config", "openapi", "base-url", "transport"]) {
    if (
      argv.some(
        (argument) =>
          argument === `--${option}` || argument.startsWith(`--${option}=`),
      ) &&
      (typeof args[option] !== "string" || args[option].trim().length === 0)
    ) {
      throw new Error(`--${option} requires a non-empty value.`);
    }
  }
  if (
    args._[0] !== "serve" ||
    (args._[1] !== undefined && typeof args._[1] !== "string") ||
    args._.length > 2
  ) {
    throw new Error(
      "Usage: sumi-docs-mcp serve [docs-source] [--config <path>] [--openapi <path>] [--base-url <url>] [--transport stdio]",
    );
  }
  const transport = args.transport ?? "stdio";
  if (transport !== "stdio") {
    throw new Error(
      `Transport '${transport}' is not implemented; only stdio is currently supported.`,
    );
  }
  const docsSource = args._[1] as string | undefined;
  if (docsSource && isRemoteDocsSource(docsSource)) {
    normalizeRemoteManifestUrl(docsSource);
    if (args.openapi) {
      throw new Error(
        "Remote documentation must declare OpenAPI in its manifest; --openapi is local-only.",
      );
    }
  }
  const options: ParsedCLIOptions = {
    docsSource,
    openApiPath: args.openapi,
    baseUrl:
      typeof args["base-url"] === "string"
        ? normalizeBaseUrl(args["base-url"])
        : undefined,
    transport,
    verbose: Boolean(args.verbose),
  };
  if (typeof args.config === "string") options.configPath = args.config;
  return options;
}

export function parseDoctorOptions(argv: string[]): {
  options: ParsedCLIOptions;
  json: boolean;
  showPaths: boolean;
} {
  if (argv[0] !== "doctor") {
    throw new Error(
      "Usage: sumi-docs-mcp doctor [docs-source] [--config <path>] [--json] [--show-paths]",
    );
  }
  const json = argv.includes("--json");
  const showPaths = argv.includes("--show-paths");
  if (argv.some((argument) => argument.startsWith("--show-paths="))) {
    throw new Error("--show-paths does not accept a value.");
  }
  const serveArgv = [
    "serve",
    ...argv
      .slice(1)
      .filter(
        (argument) => argument !== "--json" && argument !== "--show-paths",
      ),
  ];
  const options = parseCliOptions(serveArgv);
  if (!options) {
    throw new Error(
      "Usage: sumi-docs-mcp doctor [docs-source] [--config <path>] [--json] [--show-paths]",
    );
  }
  return { options, json, showPaths };
}

function printDoctorReport(report: DoctorReport): void {
  console.log(`Sumi Docs doctor: ${report.ok ? "OK" : "FAILED"}`);
  console.log(
    `Node.js: ${report.node.current} (required ${report.node.required})`,
  );
  console.log(`Project root: ${report.project.root}`);
  console.log(`Config: ${report.project.configPath ?? "not found"}`);
  console.log(
    `Source: ${report.source.value} (${report.source.origin}, ${report.source.kind})`,
  );
  console.log(`Documents: ${report.source.documentCount}`);
  console.log(
    `OpenAPI: ${report.source.openApiLoaded ? "loaded" : "not configured"}`,
  );
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

  if (argv[0] === "doctor") {
    const doctor = parseDoctorOptions(argv);
    try {
      const { createDoctorReport } = await import("./doctor.js");
      const report = await createDoctorReport(
        doctor.options,
        process.cwd(),
        process.versions.node,
        doctor.showPaths,
      );
      if (doctor.json) console.log(JSON.stringify(report, null, 2));
      else printDoctorReport(report);
      if (!report.ok) process.exitCode = 1;
    } catch (error) {
      if (!doctor.json) throw error;
      console.log(
        JSON.stringify(
          {
            ok: false,
            error: {
              message: sanitizeDiagnostic(error, {
                showPaths: doctor.showPaths,
              }),
            },
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
    }
    return;
  }

  const parsedOptions = parseCliOptions(argv);
  if (!parsedOptions) return;
  const { resolveCliOptions } = await import("./project-config.js");
  const options = await resolveCliOptions(parsedOptions);

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
  console.error(sanitizeDiagnostic(error));
  process.exitCode = 1;
}
