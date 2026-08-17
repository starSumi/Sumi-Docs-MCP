/**
 * @file Unicode and lexical substring search tests
 * Tests for Unicode support, substring matching, and deterministic sorting
 */

import { test } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DocsVault } from "../../src/vfs/DocsVault.js";

async function createUnicodeTestDocs(baseDir: string): Promise<void> {
  await mkdir(baseDir, { recursive: true });

  // Chinese content
  await writeFile(
    join(baseDir, "chinese.md"),
    `# 安装指南

本文档介绍如何安装和配置系统。

## 快速安装

运行以下命令进行安装：npm install`,
  );

  // Cyrillic content
  await writeFile(
    join(baseDir, "russian.md"),
    `# Установка пакета

Документация по установке и настройке.

## Быстрая установка

Используйте команду: npm install пакет`,
  );

  // C++ and punctuation
  await writeFile(
    join(baseDir, "cpp.md"),
    `# C++ Programming Guide

Learn C++ programming basics.

## Using C++

Install C++ compiler and tools.`,
  );

  // Substring matching test
  await writeFile(
    join(baseDir, "installation.md"),
    `# Installation Guide

Complete installation instructions.

## Post-installation

Configuration after installation.`,
  );

  // Multiple docs for tie-breaking
  await writeFile(
    join(baseDir, "a-doc.md"),
    `# Document A

This document contains the word test.`,
  );

  await writeFile(
    join(baseDir, "b-doc.md"),
    `# Document B

This document contains the word test.`,
  );

  await writeFile(
    join(baseDir, "c-doc.md"),
    `# Document C

This document contains the word test.`,
  );
}

test("search - finds Chinese content", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("安装");

    assert.ok(results.length > 0, "Should find Chinese content");
    assert.ok(
      results.some((r) => r.path === "chinese.md"),
      "Should find chinese.md",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("search - finds Cyrillic content", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("пакет");

    assert.ok(results.length > 0, "Should find Cyrillic content");
    assert.ok(
      results.some((r) => r.path === "russian.md"),
      "Should find russian.md",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("search - handles C++ with punctuation", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("C++");

    assert.ok(results.length > 0, "Should find C++");
    assert.ok(
      results.some((r) => r.path === "cpp.md"),
      "Should find cpp.md",
    );
    assert.ok(
      !results.some((r) => r.path === "chinese.md" || r.path === "russian.md"),
      "Should not return false matches",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("search - substring matching: stall matches Installation", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("stall");

    assert.ok(
      results.length > 0,
      'Should find documents with "stall" substring',
    );
    assert.ok(
      results.some((r) => r.path === "installation.md"),
      'Should match "stall" in "Installation"',
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("search - deterministic sorting: score desc, then path asc", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    // Search for 'test' which appears in a-doc, b-doc, c-doc with same score
    const results1 = vault.search("test");
    const results2 = vault.search("test");

    assert.ok(results1.length >= 3, "Should find at least 3 documents");

    // Results should be stable across calls
    assert.deepStrictEqual(
      results1.map((r) => r.path),
      results2.map((r) => r.path),
      "Results should be deterministic",
    );

    // For same-score docs, should sort by path ascending
    const testDocs = results1.filter((r) =>
      ["a-doc.md", "b-doc.md", "c-doc.md"].includes(r.path),
    );

    if (testDocs.length >= 2) {
      for (let i = 1; i < testDocs.length; i++) {
        assert.ok(
          testDocs[i - 1]!.path < testDocs[i]!.path,
          `Path ${testDocs[i - 1]!.path} should come before ${testDocs[i]!.path}`,
        );
      }
    }
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("search - snippet shows actual match location", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const results = vault.search("安装");

    assert.ok(results.length > 0);
    const result = results.find((r) => r.path === "chinese.md");
    assert.ok(result);
    assert.ok(
      result.snippet.includes("安装"),
      "Snippet should contain the actual matched term",
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - repeated loadFromDirectory does not crash", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await createUnicodeTestDocs(testDir);

    const vault = new DocsVault();

    // First load
    await vault.loadFromDirectory(testDir);
    const results1 = vault.search("安装");
    assert.ok(results1.length > 0);

    // Second load (should not crash with duplicate ID)
    await vault.loadFromDirectory(testDir);
    const results2 = vault.search("安装");
    assert.ok(results2.length > 0);

    // Third load
    await vault.loadFromDirectory(testDir);
    const results3 = vault.search("安装");
    assert.ok(results3.length > 0);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("DocsVault - partial load failure does not corrupt state", async () => {
  const testDir = await mkdtemp(join(tmpdir(), "sumi-test-"));

  try {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      join(testDir, "good.md"),
      "# Good Document\n\nContent here.",
    );

    const vault = new DocsVault();
    await vault.loadFromDirectory(testDir);

    const before = vault.search("good");
    assert.ok(before.length > 0, "Should find good.md initially");

    // Now try to load from a non-existent directory (should fail)
    try {
      await vault.loadFromDirectory(join(testDir, "nonexistent"));
      assert.fail("Should have thrown error for non-existent directory");
    } catch {
      // Expected
    }

    // Original state should be preserved
    const after = vault.search("good");
    assert.ok(after.length > 0, "Should still find good.md after failed load");
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});
