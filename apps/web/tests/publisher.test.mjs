import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  capturePublicationInputs,
  createPublication,
  normalizePublisherOptions,
  publishProjection,
} from "../integrations/sumi-docs-publisher.mjs";
import {
  catalogPublisherDocuments,
  catalogSidebar,
  contentCatalog,
  defineContentCatalog,
} from "../src/content-catalog.ts";

const provenance = { repository: null, commit: null, dirty: false };

function catalog(documents, locales = ["en"]) {
  return defineContentCatalog({
    defaultLocale: locales[0],
    locales,
    sections: [{ id: "guides", order: 10, label: "Guides" }],
    documents,
  });
}

function document(overrides = {}) {
  return {
    id: "start",
    sectionId: "guides",
    order: 10,
    sidebarSlug: "manual/custom-start",
    label: "Start",
    variants: [
      { locale: "en", source: "guides/start.md", route: "/manual/start/" },
    ],
    ...overrides,
  };
}

test("one reviewed catalog drives custom sidebar slugs and publisher routes", () => {
  const customCatalog = catalog([document()]);
  assert.deepEqual(catalogSidebar(customCatalog), [
    {
      label: "Guides",
      items: [{ slug: "manual/custom-start", label: "Start" }],
    },
  ]);
  assert.deepEqual(catalogPublisherDocuments(customCatalog), [
    {
      id: "start",
      locale: "en",
      source: "guides/start.md",
      page: "/manual/start/",
      nav: { sectionId: "guides", sectionOrder: 10, order: 10 },
    },
  ]);
});

test("the product catalog preserves all 34 reviewed document variants", () => {
  const options = normalizePublisherOptions({
    catalog: contentCatalog,
    openapi: "openapi.json",
  });
  assert.equal(options.documents.length, 34);
  assert.equal(new Set(options.documents.map(({ source }) => source)).size, 34);
  const byIdentity = new Map(
    options.documents.map((entry) => [`${entry.id}:${entry.locale}`, entry]),
  );
  for (const { id } of contentCatalog.documents) {
    for (const locale of contentCatalog.locales) {
      assert.ok(byIdentity.has(`${id}:${locale}`), `${id}:${locale}`);
    }
  }
  assert.deepEqual(
    ["overview", "getting-started", "configuration"].flatMap((id) =>
      contentCatalog.locales.map(
        (locale) => byIdentity.get(`${id}:${locale}`).source,
      ),
    ),
    [
      "index.mdx",
      "zh-cn/index.mdx",
      "getting-started.md",
      "zh-cn/getting-started.md",
      "configuration.md",
      "zh-cn/configuration.md",
    ],
  );
});

test("catalog normalization rejects duplicate identities, paths, and routes", () => {
  assert.throws(
    () => catalog([document(), document({ order: 20 })]),
    /Duplicate catalog document id/,
  );
  assert.throws(
    () =>
      catalog([
        document({ id: "first" }),
        document({
          id: "second",
          order: 20,
          sidebarSlug: "second",
          variants: [
            {
              locale: "en",
              source: "guides/start.md",
              route: "/manual/second/",
            },
          ],
        }),
      ]),
    /must be unique/,
  );
  assert.throws(
    () =>
      catalog([
        document({ id: "first" }),
        document({
          id: "second",
          order: 20,
          sidebarSlug: "second",
          variants: [
            {
              locale: "en",
              source: "guides/second.md",
              route: "/manual/start/",
            },
          ],
        }),
      ]),
    /must be unique/,
  );
});

test("v2 revision and digests are deterministic across catalog input order", () => {
  const alpha = document({
    id: "alpha",
    order: 10,
    sidebarSlug: "alpha",
    variants: [{ locale: "en", source: "alpha.md", route: "/custom/alpha/" }],
  });
  const beta = document({
    id: "beta",
    order: 20,
    sidebarSlug: "beta",
    variants: [{ locale: "en", source: "beta.md", route: "/custom/beta/" }],
  });
  const makePublication = (documents) => {
    const options = normalizePublisherOptions({ catalog: catalog(documents) });
    const captured = {
      documents: options.documents.map((entry) => ({
        ...entry,
        bytes: Buffer.from(`# ${entry.id}\n`, "utf8"),
      })),
    };
    return createPublication({ options, captured, provenance });
  };
  const left = makePublication([alpha, beta]);
  const right = makePublication([beta, alpha]);
  assert.equal(left.v2.revision, right.v2.revision);
  assert.deepEqual(left.v2.documents, right.v2.documents);
  assert.equal(
    left.v2.documents[0].bytes,
    Buffer.byteLength(`# ${left.v2.documents[0].id}\n`),
  );
  assert.match(left.v2.documents[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(left.current.bytes, left.manifestBytes.length);
  assert.match(left.current.sha256, /^[a-f0-9]{64}$/);
});

test("source drift aborts before a machine projection is promoted", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "sumi-docs-publisher-"));
  const contentRoot = resolve(temporary, "content");
  const publicDir = resolve(temporary, "public");
  const outputRoot = resolve(temporary, "dist");
  const source = resolve(contentRoot, "guides", "start.md");
  try {
    await Promise.all([
      mkdir(resolve(contentRoot, "guides"), { recursive: true }),
      mkdir(publicDir, { recursive: true }),
      mkdir(resolve(outputRoot, "_mcp"), { recursive: true }),
    ]);
    await writeFile(resolve(outputRoot, "_mcp", "previous.txt"), "ready\n");
    await writeFile(source, "# Before\n");
    const options = normalizePublisherOptions({
      catalog: catalog([document()]),
    });
    const captured = await capturePublicationInputs({
      contentRoot,
      publicDir,
      options,
    });
    await writeFile(source, "# After\n");
    await assert.rejects(
      publishProjection({
        outputRoot,
        contentRoot,
        publicDir,
        options,
        captured,
        provenance,
      }),
      /Source drift detected/,
    );
    assert.equal(
      await readFile(resolve(outputRoot, "_mcp", "previous.txt"), "utf8"),
      "ready\n",
    );
    await assert.rejects(
      access(resolve(outputRoot, "_mcp", "v2", "current.json")),
      /ENOENT/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("content capture rejects unreviewed and missing catalog sources", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "sumi-docs-catalog-"));
  const contentRoot = resolve(temporary, "content");
  const publicDir = resolve(temporary, "public");
  try {
    await Promise.all([
      mkdir(resolve(contentRoot, "guides"), { recursive: true }),
      mkdir(publicDir, { recursive: true }),
    ]);
    await writeFile(resolve(contentRoot, "guides", "start.md"), "# Start\n");
    await writeFile(
      resolve(contentRoot, "guides", "unreviewed.md"),
      "# Unreviewed\n",
    );

    await assert.rejects(
      capturePublicationInputs({
        contentRoot,
        publicDir,
        options: normalizePublisherOptions({
          catalog: catalog([document()]),
        }),
      }),
      /Omitted: guides\/unreviewed\.md; missing: none/,
    );

    await rm(resolve(contentRoot, "guides", "unreviewed.md"));
    await assert.rejects(
      capturePublicationInputs({
        contentRoot,
        publicDir,
        options: normalizePublisherOptions({
          catalog: catalog([
            document({
              variants: [
                {
                  locale: "en",
                  source: "guides/missing.md",
                  route: "/manual/start/",
                },
              ],
            }),
          ]),
        }),
      }),
      /Omitted: guides\/start\.md; missing: guides\/missing\.md/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("concurrent publishers commit one complete artifact", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "sumi-docs-publisher-cas-"));
  const outputRoot = resolve(temporary, "dist");

  async function publisherInput(name, body) {
    const contentRoot = resolve(temporary, name, "content");
    const publicDir = resolve(temporary, name, "public");
    await Promise.all([
      mkdir(resolve(contentRoot, "guides"), { recursive: true }),
      mkdir(publicDir, { recursive: true }),
    ]);
    await writeFile(resolve(contentRoot, "guides", "start.md"), body);
    const options = normalizePublisherOptions({
      catalog: catalog([document()]),
    });
    const captured = await capturePublicationInputs({
      contentRoot,
      publicDir,
      options,
    });
    return {
      outputRoot,
      contentRoot,
      publicDir,
      options,
      captured,
      provenance,
    };
  }

  try {
    const candidates = await Promise.all([
      publisherInput("alpha", "# Alpha\n"),
      publisherInput("beta", "# Beta\n"),
    ]);
    const results = await Promise.allSettled(
      candidates.map((candidate) => publishProjection(candidate)),
    );
    assert.equal(
      results.filter(({ status }) => status === "fulfilled").length,
      1,
    );
    const rejection = results.find(({ status }) => status === "rejected");
    assert.match(String(rejection?.reason), /CAS_CONFLICT/);

    const current = JSON.parse(
      await readFile(resolve(outputRoot, "_mcp", "v2", "current.json"), "utf8"),
    );
    const winnerIndex = results.findIndex(
      ({ status }) => status === "fulfilled",
    );
    assert.equal(current.revision, results[winnerIndex].value.v2.revision);
    assert.deepEqual(
      (
        await readdir(resolve(outputRoot, "_mcp", "v2", "snapshots"), {
          withFileTypes: true,
        })
      )
        .filter(
          (entry) => entry.isDirectory() && !entry.name.startsWith(".tmp-"),
        )
        .map((entry) => entry.name)
        .sort(),
      [results[winnerIndex].value.directory],
    );

    const repeated = await publishProjection(candidates[winnerIndex]);
    assert.equal(repeated.v2.revision, current.revision);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("an incomplete existing artifact fails closed", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "sumi-docs-publisher-lock-"));
  const contentRoot = resolve(temporary, "content");
  const publicDir = resolve(temporary, "public");
  const outputRoot = resolve(temporary, "dist");
  try {
    await Promise.all([
      mkdir(resolve(contentRoot, "guides"), { recursive: true }),
      mkdir(publicDir, { recursive: true }),
      mkdir(resolve(outputRoot, "_mcp", "v2"), { recursive: true }),
    ]);
    await writeFile(resolve(contentRoot, "guides", "start.md"), "# Start\n");
    await writeFile(
      resolve(outputRoot, "_mcp", "partial-output"),
      "incomplete",
    );
    const options = normalizePublisherOptions({
      catalog: catalog([document()]),
    });
    const captured = await capturePublicationInputs({
      contentRoot,
      publicDir,
      options,
    });
    await assert.rejects(
      publishProjection({
        outputRoot,
        contentRoot,
        publicDir,
        options,
        captured,
        provenance,
      }),
      /CAS_CONFLICT/,
    );
    assert.equal(
      await readFile(resolve(outputRoot, "_mcp", "partial-output"), "utf8"),
      "incomplete",
    );
    await assert.rejects(
      access(resolve(outputRoot, "_mcp", "v2", "current.json")),
      /ENOENT/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
