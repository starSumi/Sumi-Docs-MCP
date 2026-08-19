---
title: 开始使用
description: 让 Sumi-Docs-MCP 读取本仓库、另一份本地语料或已发布语料。
---

Sumi-Docs-MCP 通过四个只读工具提供文档：列表、搜索、获取文档和 OpenAPI 查询。它通过
stdio 与 MCP 客户端通信。

## 本仓库

从 workspace 根目录安装并构建：

```powershell
pnpm install --frozen-lockfile
pnpm run build
node packages/mcp/dist/index.js doctor --json
node packages/mcp/dist/index.js serve
```

受版本控制的项目配置选择根 `docs/`。进程随后等待 MCP 客户端通过 JSON-RPC 调用。
仓库内 Codex、Claude Code 和 VS Code adapter 见[Agent 宿主集成](../agent-hosts/)。

若要读取另一份本地 Markdown 或 MDX 语料，请显式传入目录：

```powershell
node packages/mcp/dist/index.js serve ./product-docs --openapi ./product-docs/openapi.json
```

直接打开可执行文件只会显示帮助并退出，这是 CLI 的正常行为。

## 已发布语料

站点部署后，使用机器投影作为来源，并使用站点根地址生成供人打开的链接：

```powershell
node packages/mcp/dist/index.js serve https://docs.example.com/_mcp/ --base-url https://docs.example.com/
```

远程模式仍使用 stdio 承载 MCP 流量。HTTPS 只用于下载有边界的只读文档快照，服务不会
爬取网站。

## 客户端配置

配置 MCP 客户端启动 `node` 或独立可执行文件，并传入相同的 `serve` 参数。应优先使用
宿主的项目根变量或 pnpm workspace 启动器，不要提交某台机器的绝对路径。
