# ADR-0006：控制面 Schema 准入与 Epoch 激活

| 字段           | 值                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted**（M3 进程内范围；生产 epoch 恢复 Stop-Ship 于 2026-08-13 重开；FCP 评审待完成）                                                  |
| Date           | 2026-08-11                                                                                                                                   |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                        |
| Reviewers      | Joker-of-Gotham（DRI 临时 Architecture + Security）；FCP 前的外部独立评审——见 `docs/governance/reviewer-assignments.md`                      |
| Related        | RFC-0001 §7、ADR-0003、ADR-0007、ADR-0005、`@cantilune/control-plane`、`@cantilune/runtime`、`@cantilune/conformance`、formal Signature.lean |

> **QA 更正——2026-08-13：**跨进程 epoch 恢复已闭合的声称被暂停。
> `MemoryEpochAdministration` 将其 prepared/committed 回执日志保留在进程内存中，
> 因此在持久 head CAS 之后、holder/日志更新之前发生崩溃时，无法从
> `admissionId` 恢复。M3 进程内行为仍然实现，但生产/FCP epoch 原子性
> 为 Stop-Ship，待持久 epoch 日志或经批准的认证恢复协议解决。见 ADR-0012
> 与 `docs/qa/0012-agent-execution-continuity-qa.md`。

## 背景

此前的 `@cantilune/control-plane` 桩将注册表写入视为激活，并允许调用方提供的授权字符串。runtime 在构造时捕获静态 schema。一次 Stop-Ship 评审（2026-08-11）发现了 split-brain 提交顺序、可伪造的 prepared token、以及非持久化的文件恢复问题。

分布式控制面语义由 **ADR-0007**（威胁模型）覆盖。本 ADR 记录工程决策与 M3 交付范围。

## 决策

将控制面实现为一个**不可变 schema/策略目录 + 服务端校验的资格/授权 + 证据绑定的四视角准入 + CAS epoch 激活**边界，与业务 `CoordinationIntent` 准入分离。

### M3 范围（已落地于仓库）

| 能力                                                                             | 状态                    |
| -------------------------------------------------------------------------------- | ----------------------- |
| `@cantilune/core` 中的品牌化控制面 ID                                            | ✅                      |
| `AdministrationContext` + 基于角色的资格/授权评估器                              | ✅                      |
| 绑定到准入主体的四视角证据（`@cantilune/conformance`）                           | ✅                      |
| 服务端 `PreparedAdmissionRecord` + 不透明提交句柄                                | ✅                      |
| 两阶段提交：`decided → runtime_applied → finalized` + 前向恢复                   | ✅                      |
| 不可变 schema 修订 + wire codec                                                  | ✅                      |
| 管理命令上的严格 ingress wire codec（未知字段拒绝）                              | ✅                      |
| 内存 + 文件持久存储（Map 安全快照、决策、回执、事件）                            | ✅                      |
| 通过文件锁 + `casActiveBindingDurable` 实现的跨进程 binding CAS                  | ✅                      |
| runtime `MemoryEpochAdministration` + 活态 `schemaContext` holder + 进程内幂等性 | ⚠️ 跨进程恢复 Stop-Ship |
| 策略激活：binding CAS + runtime `onPolicyActivated` 通知                         | ✅                      |
| L5 契约否定测试 + L6 活态 schema 切换 + L7 文件恢复 / OS CAS 测试                | ✅                      |
| ADR-0007 控制面威胁模型                                                          | ✅                      |

### 仍推迟（生产 / FCP 出口）

- 独立外部 Security + Architecture 签字（非 DRI）
- 四视角证书的 Lean 证明桥接
- 多租户激活域 + 网络化管理 API（mTLS/HSM）
- Fleet rollout 持久化对账日志
- auth/CAS 分支的变异测试

## 关键不变量

1. Schema 修订内容在注册后不可变；读取时校验摘要。
2. 注册不激活；激活需要准入 + runtime 提交 + binding CAS。
3. 资格与授权需要受信任的 `AdministrationContext`——不是调用方字符串。
4. Prepared token 是服务端记录；客户端仅收到不透明句柄。
5. 四视角证据必须与准入主体（domain、epochs、plan digest、head）匹配。
6. 提交是两阶段的：持久化决策、幂等 runtime apply、带前向恢复的原子 finalize。
7. 策略激活提升 binding generation 并通过 hook 通知 runtime。
8. Proposer 不可自批准（`separation_of_duties_violation`）。

## 后果

- runtime 接线必须使用可变的 `schemaContext` holder 或 resolver——已从 admit/replay 路径移除静态捕获。
- 破坏性 schema 变更需要新的 schema family；单调扩展保留既有声明。
- 可观察性消费准入回执作为 epoch 边界；它不执行准入。

## 批准

**DRI 签字**：Joker-of-Gotham
**Architecture / Security 评审**：Joker-of-Gotham（临时，COI 已披露）——FCP 前外部评审人待定
**日期**：2026-08-11
