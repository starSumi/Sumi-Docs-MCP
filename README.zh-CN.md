# Sumi Docs

[English](README.md) | 简体中文

Sumi Docs 将一套经过评审的文档语料发布给两类使用者：

- 人通过 Astro 和 Starlight 网站浏览；
- Agent 通过只读 MCP 服务器查询同一套语料。

本仓库处于私有开发阶段，尚未公开发布。

## 前置要求

- Node.js 25.5.0 或更高版本
- 通过 Corepack 使用 pnpm 10.26.0，或使用 `packageManager` 声明的版本
- 加载仓库提供的 Agent 宿主配置前，先信任当前 checkout

## 首次运行

```powershell
pnpm install --frozen-lockfile
pnpm run build
node packages/mcp/dist/index.js doctor --json
```

Doctor 默认只报告项目相对路径或外部来源占位符。仅在本地诊断时添加
`--show-paths`；不要把该输出附加到公开 issue 或构建产物中。

检入的 `sumi-docs.config.json` 选择根目录 `docs/` 和示例 OpenAPI 文档。
启动面向人的网站：

```powershell
pnpm --filter @sumi-os/docs-web dev
```

打开 `http://127.0.0.1:4321`。Codex、Claude Code 和 VS Code 的项目适配器见
[Agent 宿主集成](docs/zh-cn/agent-hosts.md)。它们无需可选的维护 Skill，即可暴露
四个 MCP 工具。

## 工作区

```text
apps/web/                   Astro/Starlight 网站和语料发布器
packages/mcp/               stdio MCP 服务器和 CLI
packages/corpus-contract/   Manifest schema 和一致性 fixture
docs/                       产品手册和默认语料
```

| 模式       | 命令                                    | 用途                               |
| ---------- | --------------------------------------- | ---------------------------------- |
| Web 开发   | `pnpm --filter @sumi-os/docs-web dev`   | 支持热更新的本地网站               |
| MCP 开发   | `pnpm --filter @sumi-os/docs-mcp dev`   | 针对示例语料运行 TypeScript 服务器 |
| 生产构建   | `pnpm run build`                        | 构建契约、MCP 和静态网站           |
| 编译后 MCP | `node packages/mcp/dist/index.js serve` | 通过 stdio 提供自动发现的项目语料  |
| 验证       | `pnpm run verify`                       | 运行 package 质量、测试和依赖门禁  |
| 跨产品验证 | `pnpm run verify:integration`           | 通过 MCP 验证 Web 生成的语料       |

项目不要求运行时 secret 或应用环境变量。只有发布网站候选版本时才要求
`SITE_URL`。生成输出、本地状态、日志、缓存和 `.env` 文件保持忽略。

各 workspace 的专用说明保留在其自身目录中。当前架构决策位于
`packages/mcp/docs/decisions/`；根手册只呈现面向使用者的结果，不复制决策记录。

在通过文档规定的人工验收门之前，不得创建 tag、发布 package、修改可见性或公开发布。
