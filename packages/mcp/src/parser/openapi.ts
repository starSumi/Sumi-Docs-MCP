/**
 * @file OpenAPI Parser
 * Load and validate OpenAPI 3.x specifications
 */

import { readFile } from "node:fs/promises";

/**
 * OpenAPI specification structure (simplified)
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    [key: string]: unknown;
  };
  paths: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Parse OpenAPI specification from file
 *
 * @param filePath - Path to OpenAPI JSON/YAML file
 * @returns Parsed OpenAPI spec
 * @throws Error if file is invalid or not OpenAPI 3.x
 */
export async function parseOpenApi(filePath: string): Promise<OpenAPISpec> {
  const content = await readFile(filePath, "utf-8");

  return parseOpenApiContent(content);
}

/** Parse and validate an OpenAPI specification already loaded into memory. */
export function parseOpenApiContent(content: string): OpenAPISpec {
  let spec: unknown;

  try {
    spec = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse OpenAPI document as JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  // Validate basic OpenAPI structure
  if (!isOpenAPISpec(spec)) {
    throw new Error(
      "Invalid OpenAPI specification: missing required fields (openapi, info, paths)",
    );
  }

  // Validate OpenAPI version (3.x only)
  if (!spec.openapi.startsWith("3.")) {
    throw new Error(
      `Unsupported OpenAPI version: ${spec.openapi}. Only OpenAPI 3.x is supported.`,
    );
  }

  return spec;
}

/**
 * Type guard for OpenAPI spec
 */
function isOpenAPISpec(obj: unknown): obj is OpenAPISpec {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.openapi === "string" &&
    typeof candidate.info === "object" &&
    candidate.info !== null &&
    typeof candidate.paths === "object" &&
    candidate.paths !== null
  );
}

/**
 * Filter OpenAPI spec by endpoint path
 *
 * @param spec - Full OpenAPI spec
 * @param endpointPath - Path to filter (e.g., "/users/{id}")
 * @returns Filtered spec containing only matching endpoint
 */
export function filterByEndpoint(
  spec: OpenAPISpec,
  endpointPath: string,
): OpenAPISpec {
  const matchingPaths: Record<string, unknown> = {};

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (path === endpointPath || path.startsWith(endpointPath)) {
      matchingPaths[path] = pathItem;
    }
  }

  return {
    ...spec,
    paths: matchingPaths,
  };
}
