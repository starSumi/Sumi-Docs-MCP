---
title: 开始使用
description: 让 Sumi-Docs-MCP 读取本地文档或这份已发布的文档集合。
---

Sumi-Docs-MCP 通过四个只读工具提供文档：列表、搜索、获取文档和 OpenAPI 查询。它通过 stdio 与 MCP 客户端通信。

## 本地文档集合

先构建 MCP 服务端，再把它指向 Markdown 或 MDX 目录：

```powershell
npm run build
node dist/index.js serve C:\docs\product --openapi C:\docs\product\openapi.json
```

进程会等待 MCP 客户端发送 JSON-RPC 请求。直接打开可执行文件只显示帮助并退出，这是 CLI 的正常行为。

## 已发布的文档集合

站点部署后，使用机器投影作为来源，并使用站点根地址生成供人打开的链接：

```powershell
node dist/index.js serve https://docs.example.com/_mcp/ --base-url https://docs.example.com/
```

远程模式仍然使用 stdio 承载 MCP 流量。HTTPS 只用于下载只读文档快照。

## 客户端配置

配置 MCP 客户端启动 `node` 或独立可执行文件，并传入相同的 `serve` 参数。GUI 客户端可能从无关的工作目录启动进程，因此本地文件始终使用绝对路径。
