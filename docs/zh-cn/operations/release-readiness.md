---
title: 发布就绪清单
description: 验收候选、人工评审和产品提升的阻断检查。
---

# 发布就绪清单

本页是模板。完成证据应存放在与 commit 绑定的 check、pull request 或候选 artifact 中，
不要提交一份永久打勾的副本。

## 变更就绪

- [ ] 范围、负责人、受影响契约和回滚已明确。
- [ ] 已验证当前源 commit 和 worktree 状态。
- [ ] 公开行为变更具有失败测试和文档更新。
- [ ] 英文与简体中文 catalog variant 完整。
- [ ] MCP 数据面没有引入客户端/session 状态或源文件写入。

## 验收候选

- [ ] 精确路径暂存已排除本地 session、log、credential、cache 和生成物。
- [ ] 依赖 lock host 策略与官方 registry audit 通过。
- [ ] 固定版本的根 Oxlint 策略与独立 TypeScript 编译器门均通过。
- [ ] 重复代码门保持在已评审的仓库阈值以内。
- [ ] Node.js 25.5 或更高版本上的根 verify、跨产品集成、MCP smoke 和 package 预览通过。
- [ ] 候选构建不具备 OIDC 或 attestation 写权限。
- [ ] 候选源是最新受保护的 `main` commit，并在提升前再次确认未过期。
- [ ] 已保存不可变 Web/MCP artifact、摘要、来源和原始性能证据。
- [ ] 签名或冷启动失败保持阻断，不能改写成成功。

## 人工验收

- [ ] 负责人在桌面与移动端检查网站，并实际运行 MCP example。
- [ ] 已评审安全、隐私、无障碍、i18n、回滚和运维交接。
- [ ] 每个例外都有范围、风险负责人、到期时间和回滚。
- [ ] 负责人针对一个精确 commit 与 artifact 摘要集合记录接受或拒绝。

## 产品提升

- [ ] 所有保留 refs 的 Git author、committer、tagger 元数据满足公开隐私策略。
- [ ] 若选择历史重写，已在一次性 clone 排演并验证，再使用 lease 保护推送。
- [ ] 所需远端规则、checks、environment 保护、签名、SBOM 和来源能力可用且已读回。
- [ ] 接受的 commit 未发生源码变化，直接创建 tag 并发布。
- [ ] Release、package、site 和 binary checksum 已读回，回滚仍可用。

公开源码不等于产品发布。Tag、package、部署和生产二进制文件仍须通过各自的发布门禁。
