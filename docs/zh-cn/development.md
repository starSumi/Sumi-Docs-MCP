---
title: 开发
description: 开发文档站并验证它与 Sumi-Docs-MCP 的契约。
---

产品使用一个 pnpm workspace 和根 `pnpm-lock.yaml`。使用 Node.js 25.5 或更高版本，并从
workspace 根目录执行安装与跨产品命令。

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sumi-labs/docs-web dev
```

面向人的内容位于 workspace 根 `docs/`。经过审阅的
`apps/web/src/content-catalog.ts` 为每个稳定文档 ID 和 locale 明确绑定源文件、渲染
route 与导航位置。Starlight 导航、manifest v1、route map 和不可变 manifest v2
都由该 catalog 生成。

提交前运行仓库门禁：

```powershell
pnpm run verify
pnpm run verify:integration
```

`verify` 检查格式、测试、Astro 诊断、静态构建、路由与语言配对、不可变摘要和
生产依赖。`verify:integration` 会让已编译的 MCP workspace package 读取构建产物，调用工具，
并验证每个返回的页面 URL。

只有经过审核的 Markdown 和 MDX 才能进入站点构建。不要加入模型凭据、私有文档、
认证抓取或浏览器端 stdio；这些能力需要单独评审的服务端边界。
