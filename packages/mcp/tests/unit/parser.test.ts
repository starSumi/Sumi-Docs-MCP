/**
 * @file Parser Unit Tests
 * Test Markdown parsing, HTML stripping, and heading extraction
 */

import { test } from "node:test";
import assert from "node:assert";
import { parseMarkdown } from "../../src/parser/markdown.js";

test("parseMarkdown - strips HTML tags", async () => {
  const input = `# Hello World

<div class="container">
  <p>This is a paragraph with <strong>HTML</strong> tags.</p>
</div>

Regular markdown text.`;

  const result = await parseMarkdown(input);

  // HTML should be stripped
  assert.ok(!result.content.includes("<div"));
  assert.ok(!result.content.includes("<p>"));
  assert.ok(!result.content.includes("<strong>"));

  // Text content should be preserved
  assert.ok(result.content.includes("This is a paragraph"));
  assert.ok(result.content.includes("Regular markdown text"));
});

test("parseMarkdown - extracts H1-H3 headings", async () => {
  const input = `# Main Title
## Subtitle
### Subsection
#### H4 Should Not Appear
Regular text.`;

  const result = await parseMarkdown(input);

  assert.strictEqual(result.headings.length, 3);
  assert.strictEqual(result.headings[0]?.level, 1);
  assert.strictEqual(result.headings[0]?.text, "Main Title");
  assert.strictEqual(result.headings[1]?.level, 2);
  assert.strictEqual(result.headings[1]?.text, "Subtitle");
  assert.strictEqual(result.headings[2]?.level, 3);
  assert.strictEqual(result.headings[2]?.text, "Subsection");
});

test("parseMarkdown - extracts frontmatter", async () => {
  const input = `---
title: Custom Title
author: Test Author
tags: [documentation, test]
---

# Document Body

Content here.`;

  const result = await parseMarkdown(input);

  assert.ok(result.frontmatter);
  assert.strictEqual(result.frontmatter.title, "Custom Title");
  assert.strictEqual(result.frontmatter.author, "Test Author");
  assert.ok(Array.isArray(result.frontmatter.tags));
});

test("parseMarkdown - title priority: frontmatter > H1 > first heading", async () => {
  // Case 1: Frontmatter title takes priority
  const withFrontmatter = `---
title: Frontmatter Title
---
# H1 Title`;
  const result1 = await parseMarkdown(withFrontmatter);
  assert.strictEqual(result1.title, "Frontmatter Title");

  // Case 2: H1 is used if no frontmatter
  const withH1 = `# H1 Title
## H2 Title`;
  const result2 = await parseMarkdown(withH1);
  assert.strictEqual(result2.title, "H1 Title");

  // Case 3: First heading if no H1
  const withH2 = `## H2 Title
### H3 Title`;
  const result3 = await parseMarkdown(withH2);
  assert.strictEqual(result3.title, "H2 Title");

  // Case 4: Fallback to "Untitled Document"
  const noHeadings = `Just some text without headings.`;
  const result4 = await parseMarkdown(noHeadings);
  assert.strictEqual(result4.title, "Untitled Document");
});

test("parseMarkdown - handles GFM tables", async () => {
  const input = `# Table Test

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |`;

  const result = await parseMarkdown(input);

  // Table content should be extracted as text
  assert.ok(result.content.includes("Column 1"));
  assert.ok(result.content.includes("Data 1"));
});

test("parseMarkdown - handles code blocks", async () => {
  const input = `# Code Example

\`\`\`javascript
const x = 42;
console.log(x);
\`\`\``;

  const result = await parseMarkdown(input);

  // Code content should be preserved
  assert.ok(result.content.includes("const x = 42"));
  assert.ok(result.content.includes("console.log"));
});

test("parseMarkdown - strips JSX components", async () => {
  const input = `# MDX Document

<CustomComponent prop="value">
  Content inside component
</CustomComponent>

Regular text.`;

  const result = await parseMarkdown(input);

  // JSX component tags should be stripped
  assert.ok(!result.content.includes("<CustomComponent"));
  assert.ok(!result.content.includes("</CustomComponent>"));

  // Inner content should be preserved
  assert.ok(result.content.includes("Content inside component"));
});

test("parseMarkdown - normalizes whitespace", async () => {
  const input = `# Title


Multiple    spaces     and

newlines.`;

  const result = await parseMarkdown(input);

  // Multiple spaces should be collapsed
  assert.ok(!result.content.includes("    "));

  // Content should be trimmed
  assert.ok(!result.content.startsWith(" "));
  assert.ok(!result.content.endsWith(" "));
});
