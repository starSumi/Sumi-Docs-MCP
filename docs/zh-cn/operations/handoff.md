---
title: 维护者交接
description: 在新的维护会话开始时安全地重建当前状态。
---

# 维护者交接

新维护会话开始时按以下顺序执行：

1. 阅读根目录及最近作用域内的 `AGENTS.md`。
2. 运行 `git status --short --branch`，确认当前分支和 remote。
3. 阅读当前 ADR，然后检查实时 Git、CI 和候选 artifact。不得依赖仓库内的当前状态快照。
4. 使用 Node.js 25.5.0 或更高版本，先运行范围最小的失败门。
5. 信任本地生成物或旧报告之前，先检查不可变语料 revision 和 GitHub checks。
6. 保留无关改动，只暂存本次任务的精确路径。
7. 在同一个干净候选提交上重新运行并从私有远程 CI 回读之前，本地通过结果只能视为临时证据。

随后阅读[产品需求](../product/product-requirements.md)、[检查点协议](checkpoints.md)、
[发布清单](release-readiness.md)和[评估矩阵](evaluation-matrix.md)。这些文档定义工作
路径；实时 Git 与 CI 证据决定当前状态。

## 状态放置

受版本控制的源代码负责决策、schema、fixture、维护策略和本交接文档。GitHub 负责评审
与 CI 证据，不可变 manifest 负责消费者 revision 身份。机器本地 watcher、lease、
cache、retry、cursor、process 和 SQLite 状态应位于仓库外的 Sumi Docs 用户数据目录。
不得在父级 `.sumi` workspace 容器中创建产品状态。

## 停止条件

任何必需门禁为红色、候选提交不明确、源树不干净、来源不可复现、可执行文件未签名且
没有明确接受的例外，或者缺少人工验收时，都不得发布。
