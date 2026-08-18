import type { ParsedCLIOptions } from "./types/index.js";
import { isRemoteDocsSource } from "./vfs/remote-source.js";
import { DocsVault } from "./vfs/DocsVault.js";
import { resolveCliOptions } from "./project-config.js";
import { formatDoctorPath } from "./utils/diagnostics.js";

const REQUIRED_NODE_VERSION = "25.5.0";

export interface DoctorReport {
  ok: boolean;
  node: {
    current: string;
    required: ">=25.5.0";
    compatible: boolean;
  };
  project: {
    root: string;
    configPath?: string;
  };
  source: {
    value: string;
    origin: "cli" | "config" | "default";
    kind: "local" | "remote";
    loadable: true;
    documentCount: number;
    openApiLoaded: boolean;
    baseUrl?: string;
  };
}

function nodeVersionAtLeast(current: string, required: string): boolean {
  const currentParts = current
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  const requiredParts = required
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < 3; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const requiredPart = requiredParts[index] ?? 0;
    if (currentPart > requiredPart) return true;
    if (currentPart < requiredPart) return false;
  }
  return true;
}

/** Resolve and fully load the configured read-only corpus without starting MCP. */
export async function createDoctorReport(
  parsedOptions: ParsedCLIOptions,
  cwd: string = process.cwd(),
  nodeVersion: string = process.versions.node,
  showPaths: boolean = false,
): Promise<DoctorReport> {
  const options = await resolveCliOptions(parsedOptions, cwd);
  const vault = new DocsVault();
  const remote = isRemoteDocsSource(options.docsSource);
  if (remote) {
    await vault.loadFromRemoteManifest(options.docsSource);
  } else {
    await vault.loadFromDirectory(options.docsSource);
    if (options.openApiPath) await vault.loadOpenApi(options.openApiPath);
  }
  const stats = vault.getStats();
  const compatible = nodeVersionAtLeast(nodeVersion, REQUIRED_NODE_VERSION);

  return {
    ok: compatible,
    node: {
      current: nodeVersion,
      required: ">=25.5.0",
      compatible,
    },
    project: {
      root: showPaths ? options.projectRoot : ".",
      ...(options.configPath && {
        configPath: formatDoctorPath(
          options.configPath,
          options.projectRoot,
          "config",
          showPaths,
        ),
      }),
    },
    source: {
      value: remote
        ? options.docsSource
        : formatDoctorPath(
            options.docsSource,
            options.projectRoot,
            "source",
            showPaths,
          ),
      origin: options.sourceOrigin,
      kind: remote ? "remote" : "local",
      loadable: true,
      documentCount: stats.documentCount,
      openApiLoaded: stats.hasOpenApiSpec,
      ...(options.baseUrl && { baseUrl: options.baseUrl }),
    },
  };
}
