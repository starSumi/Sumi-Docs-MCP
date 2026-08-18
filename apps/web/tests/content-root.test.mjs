import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCatalogAnchors,
  contentCatalog,
} from "../src/content-catalog.ts";
import { contentPatterns, generateContentId } from "../src/content-root.ts";

test("the reviewed catalog has one deterministic entry anchor per locale", () => {
  assert.doesNotThrow(() => assertCatalogAnchors(contentCatalog));
  assert.deepEqual(
    contentCatalog.documents
      .flatMap(({ variants }) => variants)
      .filter(({ source }) => /(?:^|\/)index\.mdx?$/u.test(source))
      .map(({ locale, source, route }) => ({ locale, source, route })),
    [
      { locale: "en", source: "index.mdx", route: "/" },
      { locale: "zh-CN", source: "zh-cn/index.mdx", route: "/zh-cn/" },
    ],
  );
});

test("reviewed and generated documentation share stable collection ids", () => {
  assert.deepEqual(contentPatterns, [
    "docs/**/[^_]*.{md,mdx}",
    "apps/web/src/content/docs/reference/api/corpus-contract/**/[^_]*.md",
  ]);
  assert.equal(
    generateContentId({ entry: "docs/getting-started.md", data: {} }),
    "getting-started",
  );
  assert.equal(
    generateContentId({
      entry:
        "apps/web/src/content/docs/reference/api/corpus-contract/interfaces/CurrentLocatorV2.md",
      data: {},
    }),
    "reference/api/corpus-contract/interfaces/currentlocatorv2",
  );
  assert.equal(
    generateContentId({
      entry:
        "apps/web/src/content/docs/reference/api/corpus-contract/functions/ParseManifest.md",
      data: { slug: "reference/api/corpus-contract/functions/ParseManifest" },
    }),
    "reference/api/corpus-contract/functions/parsemanifest",
  );
  assert.equal(
    generateContentId({ entry: "docs/zh-cn/index.mdx", data: {} }),
    "zh-cn",
  );
  assert.equal(
    generateContentId({ entry: "docs/index.mdx", data: { slug: "home" } }),
    "home",
  );
  assert.throws(
    () => generateContentId({ entry: "other/page.md", data: {} }),
    /Unsupported documentation source/u,
  );
});
