---
title: 架构
description: 将人类展示层与只读 MCP 数据层分离。
---

网站和 MCP 服务端是两个拥有独立依赖、Git 历史和发布流水线的兄弟项目。

英文继续使用根路径以保持现有链接稳定，简体中文完整站点位于
`/zh-cn/`。Starlight 的语言选择器可以在对应页面之间切换，主题选择器
支持浅色、深色和跟随系统。它们只影响人类展示层，不改变 MCP manifest
或 stdio 协议。

当前 manifest v1 使用 `zh-cn/getting-started.md` 这类显式路径表示中文机器文档。MCP
客户端可以准确获取该路径，但协议尚未提供 locale 元数据、语言协商或回退。ADR-0003
保持 v1 稳定，并为这些机器能力定义版本化迁移边界。

```text
经过审阅的 Markdown / MDX / OpenAPI
        |
        +-- Astro + Starlight -> 渲染页面和 Pagefind
        |
        +-- 发布集成 -> 原始 corpus + 严格 manifest
                                      |
                                      v
                              Sumi-Docs-MCP over stdio
```

## 所有权

网站负责渲染、导航、可访问性、浏览器搜索和已发布的 corpus 投影。Sumi-Docs-MCP 负责有边界的获取、非执行文档解析、四个公开工具、输入校验和 stdio 传输。

## 为什么没有 workspace

两个项目没有共享运行时包，也没有原子发布要求。它们通过可在 HTTP 上测试的版本化数据契约集成，因此当前引入 pnpm workspace 或任务编排器会增加迁移和发布机制，却没有解决已证明的瓶颈。

## MDX 信任边界

只有经过审阅的 MDX 才能进入网站构建，因为 Astro 会执行受信任的组件表达式。Sumi-Docs-MCP 将已发布的 MDX 当作文档数据解析，不执行 JSX 或 JavaScript。
