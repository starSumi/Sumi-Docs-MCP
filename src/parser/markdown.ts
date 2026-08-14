/**
 * @file Markdown Parser
 * Converts raw Markdown/MDX to clean semantic text with structural metadata
 *
 * Core Principle: Strip all HTML/JSX noise, preserve semantic meaning
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkStripHtml from "remark-strip-html";
import { toString } from "mdast-util-to-string";
import { parse as parseYaml } from "yaml";
import type { Root, Heading, Content } from "mdast";

/**
 * Parsed document structure
 */
export interface ParsedDocument {
  /** Clean semantic text (HTML/JSX stripped) */
  content: string;
  /** Extracted headings (H1-H3 only) */
  headings: Array<{ level: number; text: string }>;
  /** Parsed frontmatter (if present) */
  frontmatter?: Record<string, unknown>;
  /** Document title (first H1 or frontmatter.title) */
  title: string;
}

/**
 * Cached unified processor (build once, reuse for all documents)
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml", "toml"])
  .use(remarkGfm)
  .use(remarkStripHtml);

/**
 * Parse raw Markdown/MDX into clean semantic structure
 *
 * @param rawMarkdown - Raw markdown text
 * @returns Parsed document with stripped content and metadata
 */
export async function parseMarkdown(
  rawMarkdown: string,
): Promise<ParsedDocument> {
  // Parse to AST (reuse cached processor)
  const ast = processor.parse(rawMarkdown);
  const tree = (await processor.run(ast)) as Root;

  // Extract frontmatter
  const frontmatter = extractFrontmatter(tree);

  // Extract headings (H1-H3 only)
  const headings = extractHeadings(tree);

  // Convert to clean text (strips HTML, preserves semantic structure)
  const content = stripHtmlAndExtractText(tree);

  // Determine title (first H1 or frontmatter.title)
  const title = determineTitle(headings, frontmatter);

  return {
    content,
    headings,
    frontmatter,
    title,
  };
}

/**
 * Extract frontmatter from MDAST
 */
function extractFrontmatter(tree: Root): Record<string, unknown> | undefined {
  const frontmatterNode = tree.children.find(
    (node): node is Extract<Content, { type: "yaml" }> => node.type === "yaml",
  );

  if (!frontmatterNode) {
    return undefined;
  }

  try {
    const parsed = parseYaml(frontmatterNode.value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract H1-H3 headings from MDAST
 */
function extractHeadings(tree: Root): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];

  function visit(node: Content | Root): void {
    if (node.type === "heading" && node.depth <= 3) {
      const text = toString(node as Heading).trim();
      if (text) {
        headings.push({ level: node.depth, text });
      }
    }

    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  visit(tree);
  return headings;
}

/**
 * Strip HTML/JSX and convert MDAST to clean semantic text
 *
 * Strategy: Walk the AST and add spacing between block elements
 * to ensure proper tokenization for search
 */
function stripHtmlAndExtractText(tree: Root): string {
  // Remove frontmatter nodes from text extraction
  const contentTree: Root = {
    type: "root",
    children: tree.children.filter((node) => {
      const nodeType = (node as { type: string }).type;
      return nodeType !== "yaml" && nodeType !== "toml";
    }),
  };

  // Convert to plain text with space between block elements
  const parts: string[] = [];
  for (const node of contentTree.children) {
    const text = toString(node).trim();
    if (text) {
      parts.push(text);
    }
  }

  // Join with spaces to ensure tokenization works
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Determine document title from headings or frontmatter
 */
function determineTitle(
  headings: Array<{ level: number; text: string }>,
  frontmatter?: Record<string, unknown>,
): string {
  // Priority 1: frontmatter.title
  if (frontmatter?.title && typeof frontmatter.title === "string") {
    return frontmatter.title;
  }

  // Priority 2: First H1
  const firstH1 = headings.find((h) => h.level === 1);
  if (firstH1) {
    return firstH1.text;
  }

  // Priority 3: First heading of any level
  if (headings.length > 0) {
    return headings[0]!.text;
  }

  // Fallback: Untitled
  return "Untitled Document";
}
