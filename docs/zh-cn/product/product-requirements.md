---
title: 产品需求
description: Sumi Docs 的产品范围、用户结果、非目标和发布验收标准。
---

# 产品需求

本文定义 Sumi Docs 的产品需求。设计决策进入 ADR，交付证据进入 checkpoint 和 CI。

## 产品承诺

同一套经过评审的文档语料，通过 Astro 和 Starlight 网站服务人类，通过只读 MCP
服务 Agent。在一个 Git commit 上接受的文档必须具备确定的身份、语言、路由、摘要和
机器投影。任何消费者都不能静默读到只发布了一部分的语料。

## 用户与核心结果

| 用户       | 必须获得的结果                                                         |
| ---------- | ---------------------------------------------------------------------- |
| 阅读者     | 使用稳定导航、主题和无障碍能力浏览完整的英文与简体中文文档。           |
| Agent      | 无需依赖 Skill，通过严格 MCP tools 发现、搜索和读取同一套评审语料。    |
| 项目采用者 | 从仓库 `docs/` 或显式配置启动，且产品状态不与 `.sumi` 或宿主目录冲突。 |
| 维护者     | 原子地修改源码、契约、Web 投影和 MCP 消费者，并从 commit 重现候选。    |
| 发布负责人 | 审核不可变证据，在产品提升前明确接受或拒绝候选。                       |

## 首发必需范围

- 包含 Web、MCP 与 corpus contract 的 pnpm workspace；
- 确定的双语 catalog，以及与不变 v1 契约并行的不可变 manifest v2；
- 本地目录和受限 HTTPS manifest 文档源；
- Codex、Claude Code 和 VS Code 的原生项目适配器；
- 使用一份仓库级 Oxlint 策略完成 JavaScript 与 TypeScript 静态检查，并把
  TypeScript 编译器检查保留为独立门禁；
- 严格路径包含、输入校验、诊断脱敏、摘要校验和最小权限 CI；
- 可执行示例、package 预览、跨产品测试、回滚与人工验收证据。

## 首次公开发布的非目标

- 通过 MCP 修改文档；
- MCP 进程中的客户端、对话或 session 状态；
- 认证爬取、任意网站爬取或 HTTP framework；
- 自动翻译、语义搜索或自治发布审批；
- 未通过架构门的内嵌 controller 数据库、后台协调服务、Rust 替换、Bazel 或 Nix。

## 质量标准

正确性和兼容性优先于吞吐。Manifest v1 必须兼容，v2 必须规范且可验证篡改，失败时
必须保留上一已接受 revision。安全门覆盖路径、secret、依赖来源、workflow 权限和
package 边界。

冷启动验收遵循 ADR-0011。发布测量会随机交错运行产品、空的官方 SDK server 和 raw SEA
测量基线，每类各 100 次。产品必须没有 error 或 timeout，中位数不高于 200 ms，p95
不高于 350 ms；相对 SDK 基线的中位数增量不高于 35 ms 且倍数不高于 1.30，p95 增量
不高于 75 ms。p99 与最大值仅用于诊断。签名和公开发布隐私同样是阻断项，除非负责人
明确记录例外。

## 发布定义

候选必须对应一个干净 commit，其 package、集成、安全、宿主适配器、来源、Web、可执行
文件和性能证据全部绑定到该 commit。公开可见性、tag、package、部署和 Release 是独立
提升动作，必须先通过 CP6 人工验收。

参见[检查点协议](../../operations/checkpoints/)、
[发布就绪](../../operations/release-readiness/)和
[评估矩阵](../../operations/evaluation-matrix/)。
