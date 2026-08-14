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
            {
              slug: "tool-reference",
              label: "MCP tool reference",
              translations: { "zh-CN": "MCP 工具参考" },
            },
            {
              slug: "troubleshooting",
              label: "Troubleshooting",
              translations: { "zh-CN": "故障排查" },
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
            {
              slug: "development",
              label: "Development",
              translations: { "zh-CN": "开发" },
            },
            {
              slug: "releasing",
              label: "Releasing",
              translations: { "zh-CN": "发布" },
            },
          ],
        },
      ],
    }),
    sumiDocsPublisher({
      documents: [
        { source: "index.mdx", page: "/" },
        { source: "getting-started.md", page: "/getting-started/" },
        { source: "configuration.md", page: "/configuration/" },
        { source: "tool-reference.md", page: "/tool-reference/" },
        { source: "troubleshooting.md", page: "/troubleshooting/" },
        { source: "remote-sources.md", page: "/remote-sources/" },
        { source: "architecture.md", page: "/architecture/" },
        { source: "development.md", page: "/development/" },
        { source: "releasing.md", page: "/releasing/" },
        { source: "zh-cn/index.mdx", page: "/zh-cn/" },
        { source: "zh-cn/getting-started.md", page: "/zh-cn/getting-started/" },
        { source: "zh-cn/configuration.md", page: "/zh-cn/configuration/" },
        { source: "zh-cn/tool-reference.md", page: "/zh-cn/tool-reference/" },
        { source: "zh-cn/troubleshooting.md", page: "/zh-cn/troubleshooting/" },
        { source: "zh-cn/remote-sources.md", page: "/zh-cn/remote-sources/" },
        { source: "zh-cn/architecture.md", page: "/zh-cn/architecture/" },
        { source: "zh-cn/development.md", page: "/zh-cn/development/" },
        { source: "zh-cn/releasing.md", page: "/zh-cn/releasing/" },
      ],
      openapi: "openapi.json",
    }),
  ],
});
