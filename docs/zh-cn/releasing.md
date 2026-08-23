---
title: 发布
description: 构建、验收、提升和回滚不可变的站点候选产物。
---

公开源代码和发布产品是两个不同事件。代码提交可以公开，但 npm 包、已部署站点、
Git 标签或 GitHub Release 仍然可以不存在。

使用明确的公开源地址构建生产候选：

```powershell
$env:SITE_URL = "https://docs.example.com"
$env:BASE_PATH = "/"
pnpm --filter @sumi-labs/docs-web verify:release
pnpm run verify:integration
```

手动 `Acceptance candidate` 工作流只接受 `main` 最新提交的完整 40 位 SHA、公开源地址和
部署基础路径。
它在没有 OIDC 或 attestation 权限的 job 中运行发布套件，并上传静态归档、SHA-256
校验和、原始性能证据、项目与运行时许可证、第三方声明和 CycloneDX 组件清单；它不会
部署站点。

来源证明由独立的受保护 job 生成。只有仓库变量 `ENABLE_ATTESTATION` 为 `true`，且
`candidate-attestation` environment 已存在并受到保护时才会运行。若仓库无法落实该
边界，应保持变量未设置；跳过来源证明是未关闭的发布门，不是成功。

人工验收必须覆盖两种语言、所有主题模式、规范 URL、机器清单、原始文档、OpenAPI、
所有映射页面和 MCP 跨项目验证。提升前记录已接受的提交、工作流运行、源地址、
校验和、验收人和时间。

保留上一个已验收的不可变产物。回滚时恢复该产物或部署，然后重新验证根页面、
本地化路由和 `/_mcp/` 投影。

`Documentation site` 工作流会单独把经过验证的最新 `main` 提交部署到 GitHub Pages。
它从 Pages 配置取得公开源地址和基础路径，并在上传前验证完整站点和 MCP 投影。Pages
部署不会发布 npm 包、Windows 可执行文件、Git 标签或 GitHub Release。
