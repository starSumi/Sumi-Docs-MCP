---
title: 配置
description: 配置来源发现、公开页面 URL、运行模式和状态放置。
---

CLI 支持显式参数和严格的受版本控制项目配置：

```text
sumi-docs-mcp serve [docs-source] [--config <path>] [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
sumi-docs-mcp doctor [docs-source] [--config <path>] [--json] [--show-paths]
```

解析顺序为：显式 CLI source、显式 `--config`、当前 Git 边界内最近的
`sumi-docs.config.json`，最后是可信项目根的 `docs/`。没有 Git 时不会向父目录搜索。

显式 CLI source 选择远程 manifest 时，配置中的本地 `openapi` 仍属于已被替换的本地
source，因此会被忽略。远程模式仍会拒绝显式 CLI `--openapi`；应在 manifest 中声明。

## 来源和页面地址

`docs-source` 决定机器读取的内容，可以是本地目录，也可以是远程 HTTPS manifest 或
其目录地址。

`--base-url` 决定 MCP 结果中供人打开的 URL。它不会托管内容，也不会改变 MCP 传输。
Markdown 扩展名会被移除，末段为 `index.md` 或 `index.mdx` 时映射到所在目录页面。

## 开发和分发

| 模式           | 入口                                           | 用途                                  |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| MCP 源码开发   | `pnpm --filter @sumi-os/docs-mcp dev`          | 使用受版本控制的示例开发 TypeScript   |
| Web 源码开发   | `pnpm --filter @sumi-os/docs-web dev`          | 运行支持 reload 的本地 Starlight 站点 |
| Node 分发      | `node packages/mcp/dist/index.js`              | 从本 workspace 运行编译后的 package   |
| 独立可执行文件 | `packages/mcp/artifacts/bin/sumi-docs-mcp.exe` | 不依赖外部 Node 安装运行              |

应用没有必需的环境变量。`SITE_URL` 属于 Web release build，不是 MCP runtime 配置。
每个服务进程保留一个只读语料快照，因此源内容变化后必须重启。

`doctor` 默认只显示项目相对路径或明确的外部路径占位符。`--show-paths` 只用于本机
交互诊断；即使启用，凭据和调用栈仍会被净化。`serve` 会拒绝该参数。

## 状态放置

不要创建产品 `.sumi/` 目录；父目录可能已经是 operator workspace 容器。受版本控制的
默认值放在 `sumi-docs.config.json`。未来可变 cursor、cache、lease、checkpoint 或
database 状态应位于仓库外的平台用户数据目录。
