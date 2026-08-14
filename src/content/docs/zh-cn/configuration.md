---
title: 配置
description: 分离文档来源、公开页面地址和传输设置。
---

CLI 使用参数配置，而不是环境变量：

```text
sumi-docs-mcp serve <docs-source> [--openapi <path>] [--base-url <url>] [--transport stdio] [--verbose]
```

## 来源和页面地址

`<docs-source>` 决定机器读取的内容，可以是本地目录，也可以是远程 HTTPS manifest 或其目录地址。

`--base-url` 决定 MCP 结果中供人打开的 URL。它不会托管内容，也不会改变 MCP 传输方式。Markdown 扩展名会被移除，末段为 `index.md` 或 `index.mdx` 时映射到所在目录页面。

## 开发和分发

| 模式           | 入口                              | 用途                            |
| -------------- | --------------------------------- | ------------------------------- |
| 源码开发       | `npm run dev`                     | 使用已提交的示例调试 TypeScript |
| Node 分发      | `node dist/index.js`              | 运行编译后的包                  |
| 独立可执行文件 | `artifacts/bin/sumi-docs-mcp.exe` | 不依赖外部 Node 安装运行        |

应用没有必需的环境变量。源码变更需要重启服务，因为每个进程会保留一份只读文档快照。
