/**
 * @file Path Utilities
 * Pure functions for path normalization and validation
 */

import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * Validate and normalize a path to prevent directory traversal
 *
 * @param inputPath - User-provided path
 * @param rootPath - Root directory (absolute path)
 * @returns Normalized absolute path
 * @throws Error if path attempts to escape root directory
 */
export function validateAndNormalizePath(
  inputPath: string,
  rootPath: string,
): string {
  const normalizedRoot = resolve(rootPath);
  const normalizedInput = resolve(normalizedRoot, inputPath);
  const relativePath = relative(normalizedRoot, normalizedInput);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }

  return normalizedInput;
}

/**
 * Convert absolute path to relative path from root
 *
 * @param absolutePath - Absolute file path
 * @param rootPath - Root directory
 * @returns Relative path with forward slashes
 */
export function toRelativePath(absolutePath: string, rootPath: string): string {
  const rel = relative(rootPath, absolutePath);
  return rel.replace(/\\/g, "/");
}

/**
 * Check if file path is a Markdown file
 *
 * @param filePath - File path to check
 * @returns True if .md or .mdx extension
 */
export function isMarkdownFile(filePath: string): boolean {
  return /\.mdx?$/i.test(filePath);
}

/**
 * Sanitize search query
 *
 * @param query - Raw user input
 * @returns Sanitized query (trimmed, lowercased)
 */
export function sanitizeQuery(query: string): string {
  return query.trim().toLowerCase();
}
