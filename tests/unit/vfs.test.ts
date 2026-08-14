/**
 * @file VFS Unit Tests
 * Test DocsVault loading, searching, and querying
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  stat,
  readFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DocsVault } from "../../src/vfs/DocsVault.js";

// Test fixture setup
async function createTestDocs(baseDir: string): Promise<void> {
  await mkdir(baseDir, { recursive: true });

  // Create sample documents
  await writeFile(
    join(baseDir, "intro.md"),
    `# Introduction

Welcome to the documentation. This is the intro page.`,
  );

  await writeFile(
    join(baseDir, "guide.md"),
    `---
title: User Guide
author: Test
---

# Getting Started

## Installation

Install the package using npm.

## Configuration

Configure your settings here.`,
  );

  await mkdir(join(baseDir, "api"), { recursive: true });
  await writeFile(
    join(baseDir, "api", "reference.md"),
    `# API Reference

## Functions

### authenticate()

Authenticates the user.`,
  );

  // Document with HTML that should be stripped
  await writeFile(
    join(baseDir, "advanced.md"),
    `# Advanced Topics

<div class="warning">
  <strong>Warning:</strong> This is advanced content.
</div>

Use with caution.`,
  );
}

async function createTestOpenApi(filePath: string): Promise<void> {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Test API",
      version: "1.0.0",
    },
    paths: {
      "/users": {
        get: {
          summary: "List users",
          responses: {
            "200": {
              description: "Success",
            },
          },
        },
      },
      "/users/{id}": {
        get: {
          summary: "Get user by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
        },
      },
    },
  };

  await writeFile(filePath, JSON.stringify(spec, null, 2));
}

test("DocsVault - loadFromDirectory scans all markdown files", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const tree = vault.listTree();

    assert.strictEqual(tree.length, 4, "Should load all 4 documents");

    // Verify paths are loaded
    const paths = tree.map((node) => node.path);
    assert.ok(paths.includes("intro.md"));
    assert.ok(paths.includes("guide.md"));
    assert.ok(paths.includes("api/reference.md"));
    assert.ok(paths.includes("advanced.md"));
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - getDoc retrieves specific document", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const doc = vault.getDoc("guide.md");

    assert.ok(doc, "Document should be found");
    assert.strictEqual(doc.title, "User Guide");
    assert.ok(doc.content.includes("Install the package"));
    assert.ok(doc.headings.includes("Getting Started"));
    assert.ok(doc.headings.includes("Installation"));
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - getDoc returns null for non-existent document", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const doc = vault.getDoc("nonexistent.md");

    assert.strictEqual(doc, null);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - search finds documents by keyword", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("installation");

    assert.ok(results.length > 0, "Should find at least one result");
    assert.ok(
      results.some((r) => r.path === "guide.md"),
      "Should find guide.md",
    );
    assert.ok(
      results[0]?.snippet.toLowerCase().includes("install"),
      "Snippet should contain search term",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - search ranks by relevance", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("api");

    assert.ok(results.length > 0);

    // api/reference.md should rank higher (has "API" in heading and multiple mentions)
    const firstResult = results[0];
    assert.ok(
      firstResult?.path.includes("api") ||
        firstResult?.title.toLowerCase().includes("api"),
      "Most relevant result should be API-related",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - search handles empty query", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("");

    assert.strictEqual(
      results.length,
      0,
      "Empty query should return no results",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - search limits results", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("the", 2);

    assert.ok(results.length <= 2, "Should respect maxResults limit");
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - HTML tags are stripped from content", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const doc = vault.getDoc("advanced.md");

    assert.ok(doc);
    assert.ok(!doc.content.includes("<div"), "HTML div should be stripped");
    assert.ok(
      !doc.content.includes("<strong>"),
      "HTML strong should be stripped",
    );
    assert.ok(
      doc.content.includes("Warning:"),
      "Text content should be preserved",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - loadOpenApi parses OpenAPI spec", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));
  const openApiPath = join(testDir, "openapi.json");

  try {
    await mkdir(testDir, { recursive: true });
    await createTestOpenApi(openApiPath);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);
    await vault.loadOpenApi(openApiPath);

    const spec = vault.getOpenApiSpec();

    assert.ok(spec, "OpenAPI spec should be loaded");
    assert.strictEqual(spec.info.title, "Test API");
    assert.strictEqual(spec.info.version, "1.0.0");
    assert.ok(spec.paths["/users"]);
    assert.ok(spec.paths["/users/{id}"]);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - getOpenApiSpec filters by endpoint", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));
  const openApiPath = join(testDir, "openapi.json");

  try {
    await mkdir(testDir, { recursive: true });
    await createTestOpenApi(openApiPath);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);
    await vault.loadOpenApi(openApiPath);

    const spec = vault.getOpenApiSpec("/users/{id}");
    assert.ok(spec);
    assert.deepEqual(Object.keys(spec.paths), ["/users/{id}"]);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - getStats returns correct counts", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const stats = vault.getStats();

    assert.strictEqual(stats.documentCount, 4);
    assert.strictEqual(stats.hasOpenApiSpec, false);

    // Load OpenAPI and check again
    const openApiPath = join(testDir, "openapi.json");
    await createTestOpenApi(openApiPath);
    await vault.loadOpenApi(openApiPath);

    const statsWithApi = vault.getStats();
    assert.strictEqual(statsWithApi.hasOpenApiSpec, true);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - preserves the previous snapshot when one file fails to load", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));
  const brokenPath = join(testDir, "guide.md");
  let failReads = false;

  const fileSystem = {
    readTextFile: async (path: string) => {
      if (failReads && path === brokenPath) {
        throw new Error("synthetic read failure");
      }
      return readFile(path, "utf8");
    },
    stat: (path: string) => stat(path),
  };

  try {
    await createTestDocs(testDir);
    const vault = new DocsVault(fileSystem);
    await vault.loadFromDirectory(testDir);
    const previousSnapshot = vault.listTree();

    failReads = true;
    await assert.rejects(
      () => vault.loadFromDirectory(testDir),
      /synthetic read failure/,
    );
    assert.deepStrictEqual(vault.listTree(), previousSnapshot);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});
