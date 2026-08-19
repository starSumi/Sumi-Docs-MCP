import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

serveStdio(
  () =>
    new McpServer(
      { name: "sumi-docs-cold-start-sdk-empty", version: "1.0.0" },
      { capabilities: { tools: {} } },
    ),
  { legacy: "reject" },
);
