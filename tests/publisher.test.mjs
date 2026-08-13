import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublisherOptions } from "../integrations/sumi-docs-publisher.mjs";

test("normalizes an explicit source-to-page mapping", () => {
  assert.deepEqual(
    normalizePublisherOptions({
      documents: [{ source: "guides/start.md", page: "/guides/start" }],
      openapi: "openapi.json",
    }),
    {
      documents: [{ source: "guides/start.md", page: "/guides/start/" }],
      openapi: "openapi.json",
    },
  );
});

test("rejects traversal, duplicates, unknown fields, and invalid pages", () => {
  assert.throws(
    () =>
      normalizePublisherOptions({
        documents: [{ source: "../secret.md", page: "/secret/" }],
      }),
    /restricted relative path/,
  );
  assert.throws(
    () =>
      normalizePublisherOptions({
        documents: [
          { source: "a.md", page: "/a/" },
          { source: "a.md", page: "/b/" },
        ],
      }),
    /must be unique/,
  );
  assert.throws(
    () =>
      normalizePublisherOptions({
        documents: [{ source: "a.md", page: "/a/", extra: true }],
      }),
    /unknown field/,
  );
  assert.throws(
    () =>
      normalizePublisherOptions({
        documents: [{ source: "a.md", page: "relative" }],
      }),
    /absolute site path/,
  );
});
