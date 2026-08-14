---
title: 开发
description: 开发文档站并验证它与 Sumi-Docs-MCP 的契约。
---

文档站和 MCP 服务是两个相邻的 npm 项目，分别维护锁文件。文档站使用 Node.js
22.12 或更高版本，MCP 服务使用 Node.js 25.5 或更高版本。

```powershell
npm ci
npm run dev
```

面向人的内容位于 `src/content/docs/`。发布集成只会把显式白名单复制到
`dist/_mcp/`，不会扫描仓库根目录。每篇公开英文文档都有对应的简体中文版本，
并在 `astro.config.mjs` 中配置明确的渲染路由。

提交前运行仓库门禁：

```powershell
npm run verify:push
npm run verify:mcp
```

`verify:push` 检查格式、测试、Astro 诊断、静态构建、路由与语言配对以及生产依赖。
`verify:mcp` 会让已编译的相邻 MCP 服务读取构建产物，调用四个工具，并验证每个
返回的页面 URL。

只有经过审核的 Markdown 和 MDX 才能进入站点构建。不要加入模型凭据、私有文档、
认证抓取或浏览器端 stdio；这些能力需要单独评审的服务端边界。
