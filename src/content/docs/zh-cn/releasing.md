---
title: 发布
description: 构建、验收、提升和回滚不可变的站点候选产物。
---

公开源代码和发布产品是两个不同事件。代码提交可以公开，但 npm 包、已部署站点、
Git 标签或 GitHub Release 仍然可以不存在。

使用明确的公开源地址构建生产候选：

```powershell
$env:SITE_URL = "https://docs.example.com"
npm run verify:release
```

手动 `Site candidate` 工作流接收一个完整的 40 位提交 SHA，运行发布套件，并上传
静态归档、SHA-256 校验和与 GitHub 产物来源证明。它不会部署站点。

人工验收必须覆盖两种语言、所有主题模式、规范 URL、机器清单、原始文档、OpenAPI、
所有映射页面和 MCP 跨项目验证。提升前记录已接受的提交、工作流运行、源地址、
校验和、验收人和时间。

保留上一个已验收的不可变产物。回滚时恢复该产物或部署，然后重新验证根页面、
本地化路由和 `/_mcp/` 投影。
