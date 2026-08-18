---
title: 架构
description: 将人类展示层与只读 MCP 数据层分离。
---

网站、MCP 服务端和 corpus contract 是同一个 pnpm workspace 中各自负责的 package。
Web 与 MCP 仍有独立的构建和发布生命周期；共享范围只包括 schema、canonicalization
和 conformance helper。

英文继续使用根路径以保持现有链接稳定，简体中文完整站点位于
`/zh-cn/`。Starlight 的语言选择器可以在对应页面之间切换，主题选择器
支持浅色、深色和跟随系统。它们只影响人类展示层，不改变 MCP manifest
或 stdio 协议。

manifest v1 使用 `zh-cn/getting-started.md` 这类显式路径表示中文机器文档，但不提供
locale 元数据、语言协商或回退。并行发布的 manifest v2 增加稳定文档 ID、显式 locale
与 route、内容摘要、导航数据、来源 provenance 和不可变 revision。

```text
经过审阅的 docs/ + content catalog + OpenAPI
        |
        +-- Astro + Starlight -> 渲染页面和 Pagefind
        |
        +-- 发布集成 -> v1 + 不可变 v2 snapshot
                                      |
                                      v
                              Sumi-Docs-MCP over stdio
```

## 所有权

网站负责渲染、导航、可访问性、浏览器搜索和已发布的 corpus 投影。corpus-contract package
负责纯 manifest 校验与 canonicalization。Sumi-Docs-MCP 负责有边界的获取、非执行文档
解析、公开工具、输入校验和 stdio 传输。

## Workspace 边界

workspace 让 producer 与 consumer 的契约变更可以原子提交，但不会合并信任模型。Web
不导入 MCP parser 或 transport，MCP 也不执行 Astro 或受信 MDX。经过审阅的 content
catalog 是站点导航和投影成员的唯一事实源。

## MDX 信任边界

只有经过审阅的 MDX 才能进入网站构建，因为 Astro 会执行受信任的组件表达式。Sumi-Docs-MCP 将已发布的 MDX 当作文档数据解析，不执行 JSX 或 JavaScript。
