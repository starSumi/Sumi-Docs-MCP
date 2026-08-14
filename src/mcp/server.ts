import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { MCPErrorCode } from "../types/index.js";
import type { DocsVault } from "../vfs/DocsVault.js";
import { buildDocumentUrl, normalizeBaseUrl } from "../utils/document-url.js";
import { VERSION } from "../version.js";

const PROTOCOL_VERSION = "2026-07-28";
const CAPABILITIES = ["tools"];

export interface DocsMcpServerOptions {
  baseUrl?: string;
}

const emptySchema = z.object({}).strict();
const searchSchema = z
  .object({
    query: z.string().trim().min(1).max(200),
  })
  .strict();
const fetchSchema = z
  .object({
    path: z.string().regex(/^[a-zA-Z0-9_/-]+\.mdx?$/),
  })
  .strict();
const openApiSchema = z
  .object({
    endpoint: z
      .string()
      .regex(/^\/[a-zA-Z0-9_/-]*$/)
      .optional(),
  })
  .strict();

function meta(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: CAPABILITIES,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function textResult(
  value: unknown,
  extraMeta?: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    _meta: meta(extraMeta),
  };
}

function errorResult(errorCode: MCPErrorCode, message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
    _meta: meta({ errorCode }),
  };
}

/** MCP protocol facade over the read-only DocsVault. */
export class DocsMcpServer {
  readonly server: McpServer;
  private readonly getVault: () => Promise<DocsVault>;
  private readonly baseUrl: string | undefined;

  private documentUrl(path: string, sourceUrl?: string): string | undefined {
    return this.baseUrl ? buildDocumentUrl(this.baseUrl, path) : sourceUrl;
  }

  constructor(
    vault: DocsVault | Promise<DocsVault> | (() => Promise<DocsVault>),
    options: DocsMcpServerOptions = {},
  ) {
    this.baseUrl = options.baseUrl
      ? normalizeBaseUrl(options.baseUrl)
      : undefined;
    if (typeof vault === "function") {
      let vaultReady: Promise<DocsVault> | undefined;
      this.getVault = () => (vaultReady ??= vault());
    } else {
      const vaultReady = Promise.resolve(vault);
      this.getVault = () => vaultReady;
    }
    this.server = new McpServer(
      { name: "sumi-docs-mcp", version: VERSION },
      { capabilities: { tools: {} } },
    );
    this.registerTools();
  }

  async connect(transport: Parameters<McpServer["connect"]>[0]): Promise<void> {
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }

  private registerTools(): void {
    this.server.registerTool(
      "list_docs",
      {
        title: "List Documentation",
        description:
          "List all Markdown and MDX files, including public URLs when configured.",
        inputSchema: emptySchema,
      },
      async () => {
        try {
          const vault = await this.getVault();
          return textResult(
            vault.listTree().map(({ path, title, lastModified, sourceUrl }) => {
              const url = this.documentUrl(path, sourceUrl);
              return {
                path,
                title,
                lastModified: lastModified?.toISOString(),
                ...(url && { url }),
              };
            }),
          );
        } catch (error) {
          console.error("list_docs failed:", error);
          return errorResult("PARSE_ERROR", "Unable to list documentation.");
        }
      },
    );

    this.server.registerTool(
      "search_docs",
      {
        title: "Search Documentation",
        description:
          "Search by keyword and return ranked snippets, headings, and optional public URLs.",
        inputSchema: searchSchema,
      },
      async ({ query }) => {
        try {
          const vault = await this.getVault();
          return textResult(
            vault.search(query).map(({ sourceUrl, ...result }) => {
              const url = this.documentUrl(result.path, sourceUrl);
              return { ...result, ...(url && { url }) };
            }),
          );
        } catch (error) {
          console.error("search_docs failed:", error);
          return errorResult("PARSE_ERROR", "Unable to search documentation.");
        }
      },
    );

    this.server.registerTool(
      "fetch_doc",
      {
        title: "Fetch Documentation",
        description:
          "Retrieve one document and its public URL when configured.",
        inputSchema: fetchSchema,
      },
      async ({ path }) => {
        try {
          const vault = await this.getVault();
          const document = vault.getDoc(path);
          if (!document) {
            return errorResult("PATH_NOT_FOUND", `Document not found: ${path}`);
          }
          const url = this.documentUrl(document.path, document.sourceUrl);
          return textResult({
            path: document.path,
            ...(url && { url }),
            content: document.content,
            frontmatter: document.frontmatter,
            headings: document.headings,
          });
        } catch (error) {
          console.error(`fetch_doc failed for ${path}:`, error);
          return errorResult(
            "PARSE_ERROR",
            "Unable to fetch the requested document.",
          );
        }
      },
    );

    this.server.registerTool(
      "get_openapi_spec",
      {
        title: "Get OpenAPI Specification",
        description:
          "Retrieve the loaded OpenAPI 3.x specification, optionally filtered by endpoint.",
        inputSchema: openApiSchema,
      },
      async ({ endpoint }) => {
        try {
          const vault = await this.getVault();
          const spec = vault.getOpenApiSpec(endpoint);
          if (!spec) {
            return errorResult(
              "PATH_NOT_FOUND",
              "No OpenAPI specification is loaded.",
            );
          }
          return textResult(spec);
        } catch (error) {
          console.error("get_openapi_spec failed:", error);
          return errorResult(
            "PARSE_ERROR",
            "Unable to retrieve the OpenAPI specification.",
          );
        }
      },
    );
  }
}

export function createDocsMcpServer(
  vault: DocsVault | Promise<DocsVault> | (() => Promise<DocsVault>),
  options?: DocsMcpServerOptions,
): DocsMcpServer {
  return new DocsMcpServer(vault, options);
}
