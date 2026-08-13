import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sumiDocsPublisher from "./integrations/sumi-docs-publisher.mjs";

const site = process.env.SITE_URL || "http://127.0.0.1:4321";

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
      sidebar: [
        {
          label: "Start here",
          translations: {
            "zh-CN": "从这里开始",
          },
          items: [
            {
              slug: "index",
              label: "Overview",
              translations: { "zh-CN": "概览" },
            },
            {
              slug: "getting-started",
              label: "Getting started",
              translations: { "zh-CN": "开始使用" },
            },
            {
              slug: "configuration",
              label: "Configuration",
              translations: { "zh-CN": "配置" },
            },
          ],
        },
        {
          label: "Operate",
          translations: {
            "zh-CN": "运行与维护",
          },
          items: [
            {
              slug: "remote-sources",
              label: "Remote sources",
              translations: { "zh-CN": "远程文档源" },
            },
            {
              slug: "architecture",
              label: "Architecture",
              translations: { "zh-CN": "架构" },
            },
          ],
        },
      ],
    }),
    sumiDocsPublisher({
      documents: [
        { source: "getting-started.md", page: "/getting-started/" },
        { source: "configuration.md", page: "/configuration/" },
        { source: "remote-sources.md", page: "/remote-sources/" },
        { source: "architecture.md", page: "/architecture/" },
        { source: "zh-cn/getting-started.md", page: "/zh-cn/getting-started/" },
        { source: "zh-cn/configuration.md", page: "/zh-cn/configuration/" },
        { source: "zh-cn/remote-sources.md", page: "/zh-cn/remote-sources/" },
        { source: "zh-cn/architecture.md", page: "/zh-cn/architecture/" },
      ],
      openapi: "openapi.json",
    }),
  ],
});
