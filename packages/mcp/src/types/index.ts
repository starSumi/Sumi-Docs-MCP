/**
 * Type definitions for MCP tools and resources
 * Following MCP 2026-07-28 specification
 */

/**
 * Metadata included in every MCP v2 request/response
 */
export interface MCPMeta {
  protocolVersion: string;
  capabilities?: string[];
  timestamp?: string;
  [key: string]: unknown;
}

/** Error codes exposed to MCP clients. */
export type MCPErrorCode = "PATH_NOT_FOUND" | "INVALID_INPUT" | "PARSE_ERROR";

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

/**
 * JSON Schema for tool input validation
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

/**
 * Document node in the VFS
 */
export interface DocNode {
  path: string;
  title: string;
  content: string;
  headings: string[];
  frontmatter?: Record<string, unknown>;
  lastModified?: Date;
  sourceUrl?: string;
}

/**
 * Search result with snippet
 */
export interface SearchResult {
  path: string;
  title: string;
  headings: string[];
  snippet: string;
  score?: number;
  sourceUrl?: string;
}

/**
 * VFS configuration
 */
export interface VFSConfig {
  docsRoot: string;
  openApiPath?: string;
  maxFileSize?: number;
}

/**
 * CLI options
 */
export interface CLIOptions {
  transport: "stdio";
  docsSource: string;
  openApiPath?: string;
  baseUrl?: string;
  verbose?: boolean;
}
