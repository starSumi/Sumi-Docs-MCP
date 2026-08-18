import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";
import { fileURLToPath } from "node:url";
import sumiDocsPublisher from "./integrations/sumi-docs-publisher.mjs";
import { catalogSidebar, contentCatalog } from "./src/content-catalog.ts";
import { contentRoot } from "./src/content-root.ts";
import { canonicalTypeDocRoutes } from "./src/typedoc-routes.ts";

const site = process.env.SITE_URL || "http://127.0.0.1:4321";
const portableFilePath = (url) => fileURLToPath(url).replaceAll("\\", "/");

export default defineConfig({
  site,
  integrations: [
    starlight({
      title: {
        en: "Sumi Docs",
        "zh-CN": "Sumi 文档",
      },
      description:
        "Human and machine-readable documentation from one reviewed source.",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
        },
        "zh-cn": {
          label: "简体中文",
          lang: "zh-CN",
        },
      },
      logo: {
        src: "./src/assets/sumi-docs-mark.png",
        alt: "Sumi Docs",
      },
      expressiveCode: {
        themes: ["starlight-dark", "starlight-light"],
        useStarlightDarkModeSwitch: true,
      },
      customCss: ["./src/styles/custom.css"],
      plugins: [
        starlightTypeDoc({
          entryPoints: [
            portableFilePath(
              new URL(
                "../../packages/corpus-contract/src/index.ts",
                import.meta.url,
              ),
            ),
          ],
          tsconfig: portableFilePath(
            new URL(
              "../../packages/corpus-contract/tsconfig.json",
              import.meta.url,
            ),
          ),
          output: "reference/api/corpus-contract",
          sidebar: {
            label: "API Reference",
            collapsed: true,
          },
          typeDoc: {
            name: "@sumi-os/corpus-contract",
            entryFileName: "readme",
            readme: portableFilePath(
              new URL(
                "../../packages/corpus-contract/README.md",
                import.meta.url,
              ),
            ),
            disableSources: true,
            entryPointStrategy: "resolve",
            excludeExternals: true,
            excludeInternal: true,
            excludePrivate: true,
            excludeProtected: true,
            treatWarningsAsErrors: true,
            validation: {
              invalidLink: true,
              notDocumented: true,
              notExported: true,
            },
            requiredToBeDocumented: [
              "Enum",
              "EnumMember",
              "Variable",
              "Function",
              "Class",
              "Interface",
              "Property",
              "Method",
              "TypeAlias",
            ],
            packagesRequiringDocumentation: ["@sumi-os/corpus-contract"],
          },
        }),
        canonicalTypeDocRoutes(),
      ],
      sidebar: [...catalogSidebar(contentCatalog), typeDocSidebarGroup],
    }),
    sumiDocsPublisher({
      catalog: contentCatalog,
      contentRoot,
      openapi: "openapi.json",
    }),
  ],
});
