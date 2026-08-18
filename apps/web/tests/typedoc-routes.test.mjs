import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalTypeDocRoutes,
  normalizeTypeDocSidebar,
} from "../src/typedoc-routes.ts";

test("TypeDoc sidebar routes use the same lowercase canonical slugs as content", () => {
  const input = [
    { label: "Guide", link: "/getting-started/" },
    {
      label: "API",
      items: [
        {
          label: "CurrentLocatorV2",
          link: "/reference/api/corpus-contract/interfaces/CurrentLocatorV2/",
        },
        {
          label: "Chinese fallback",
          link: "/zh-cn/reference/api/corpus-contract/README/#Overview",
        },
        {
          autogenerate: {
            directory: "/reference/api/corpus-contract/Type-Aliases/",
          },
        },
      ],
    },
  ];

  assert.deepEqual(normalizeTypeDocSidebar(input), [
    { label: "Guide", link: "/getting-started/" },
    {
      label: "API",
      items: [
        {
          label: "CurrentLocatorV2",
          link: "/reference/api/corpus-contract/interfaces/currentlocatorv2/",
        },
        {
          label: "Chinese fallback",
          link: "/zh-cn/reference/api/corpus-contract/readme/#Overview",
        },
        {
          autogenerate: {
            directory: "/reference/api/corpus-contract/type-aliases/",
          },
        },
      ],
    },
  ]);
  assert.notStrictEqual(normalizeTypeDocSidebar(input), input);
});

test("canonical TypeDoc route plugin applies the sidebar transform", () => {
  const plugin = canonicalTypeDocRoutes();
  let update;
  plugin.hooks["config:setup"]({
    config: {
      sidebar: [
        {
          label: "API",
          link: "/reference/api/corpus-contract/README/",
        },
      ],
    },
    updateConfig(value) {
      update = value;
    },
  });

  assert.equal(plugin.name, "sumi-docs-canonical-typedoc-routes");
  assert.deepEqual(update, {
    sidebar: [
      {
        label: "API",
        link: "/reference/api/corpus-contract/readme/",
      },
    ],
  });
});
