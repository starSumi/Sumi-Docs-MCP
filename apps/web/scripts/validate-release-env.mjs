import { readFile } from "node:fs/promises";
import { resolveSiteDeployment } from "../src/site-config.ts";
import { resolveRemoteMcpEnvironment } from "../integrations/sumi-docs-publisher.mjs";

const rawSiteUrl = process.env.SITE_URL?.trim();
if (!rawSiteUrl) {
  throw new Error("SITE_URL is required for a release build.");
}

const deployment = resolveSiteDeployment(rawSiteUrl, process.env.BASE_PATH);
const mcpPackage = JSON.parse(
  await readFile(
    new URL("../../../packages/mcp/package.json", import.meta.url),
    "utf8",
  ),
);
const remoteMcp = resolveRemoteMcpEnvironment({
  publicMcpUrl: process.env.PUBLIC_MCP_URL,
  publicMcpReadinessUrl: process.env.PUBLIC_MCP_READINESS_URL,
  version: mcpPackage.version,
});
console.log(`Release site URL: ${deployment.publicBaseUrl}`);
console.log(`Remote MCP readiness: ${remoteMcp ? "configured" : "disabled"}`);
