import { reportCliError, run } from "../dist/cli.js";

function optional(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name) {
  const value = optional(name);
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

function commaSeparated(name, { required: isRequired = false } = {}) {
  const value = isRequired ? required(name) : optional(name);
  if (!value) return [];
  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.some((entry) => entry.length === 0)) {
    throw new Error(`${name} must not contain empty entries.`);
  }
  return [...new Set(entries)];
}

function repeatedOption(name, values) {
  return values.flatMap((value) => [name, value]);
}

async function main() {
  const docsSource = optional("SUMI_DOCS_SOURCE") ?? "/data/docs";
  const httpHost = optional("SUMI_DOCS_HTTP_HOST") ?? "0.0.0.0";
  const httpPort =
    optional("SUMI_DOCS_HTTP_PORT") ?? optional("PORT") ?? "3000";
  const httpPath = optional("SUMI_DOCS_HTTP_PATH") ?? "/mcp";
  const allowedHosts = commaSeparated("SUMI_DOCS_ALLOWED_HOSTS", {
    required: true,
  });
  const allowedOrigins = commaSeparated("SUMI_DOCS_ALLOWED_ORIGINS");
  const openApiPath = optional("SUMI_DOCS_OPENAPI");
  const baseUrl = optional("SUMI_DOCS_BASE_URL");

  const args = [
    "serve",
    docsSource,
    "--transport",
    "streamable-http",
    "--http-host",
    httpHost,
    "--http-port",
    httpPort,
    "--http-path",
    httpPath,
    "--allow-public-network",
    ...repeatedOption("--allowed-host", allowedHosts),
    ...repeatedOption("--allowed-origin", allowedOrigins),
    ...(openApiPath ? ["--openapi", openApiPath] : []),
    ...(baseUrl ? ["--base-url", baseUrl] : []),
  ];

  await run(args);
}

await main().catch(reportCliError);
