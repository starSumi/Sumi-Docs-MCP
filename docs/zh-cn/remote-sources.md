---
title: 远程文档源
description: 为只读远程文档发布受限的 manifest。
---

远程模式从严格 manifest 下载不可变文档快照。它不会爬取网站，也不会增加 HTTP MCP 传输。

## Manifest

每次生产构建都会生成 `_mcp/sumi-docs-manifest.json`：

```json
{
  "version": 1,
  "documents": ["getting-started.md", "configuration.md"],
  "openapi": "openapi.json"
}
```

文档路径必须是受限的相对 Markdown 或 MDX 路径。OpenAPI 是可选的受限相对 JSON 路径。未知字段、重复项、重定向、超大响应和跨源路径都会被 Sumi-Docs-MCP 拒绝。

同一次构建还会生成 `_mcp/v2/current.json` 和按摘要寻址的不可变快照。需要完整性校验时，应传入精确的 v2 locator：

```powershell
node packages/mcp/dist/index.js serve http://127.0.0.1:4321/_mcp/v2/current.json --base-url http://127.0.0.1:4321/
```

MCP loader 会校验规范化 manifest、revision、字节数和 SHA-256 摘要。目录 URL 与 v1 manifest URL 继续作为向后兼容入口。

## 人类页面路由

旁边的 `_mcp/sumi-docs-routes.json` 将每个 corpus 路径映射到渲染页面。它是部署校验产物，不属于 MCP manifest 协议。构建会在映射页面或原始文件缺失时失败。

## 本地演练

构建并预览站点，然后使用本地机器投影：

```powershell
pnpm run build
pnpm run preview
node dist/index.js serve http://127.0.0.1:4321/_mcp/ --base-url http://127.0.0.1:4321/
```

回环 HTTP 仅用于开发。生产远程文档源必须使用 HTTPS，并且不支持凭据、Cookie、重定向、查询字符串或片段。
