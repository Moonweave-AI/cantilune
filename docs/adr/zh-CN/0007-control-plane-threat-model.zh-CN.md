# ADR-0007：控制面威胁模型与管理边界

| 字段           | 值                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted**（M3 工程范围——补充 ADR-0003 runtime 本地模型）                                                         |
| Date           | 2026-08-11                                                                                                          |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                               |
| Reviewers      | Joker-of-Gotham（DRI 临时）；FCP 前外部 Security 评审人招募开放（见治理文档）                                       |
| Related        | ADR-0003、ADR-0006、RFC-0001 §7、`@cantilune/control-plane`、`@cantilune/conformance`、`diagrams/04-control-plane/` |

## 背景

ADR-0003 覆盖 runtime 本地的准入/提交边界。控制面引入了一个独立的管理面：schema/策略目录写入、资格/授权、四视角证据、prepared token、epoch 激活 CAS、以及 fleet rollout。Stop-Ship 评审（2026-08-11）要求在将控制面视为受信任的激活权威之前，有一个显式的威胁模型。

## 威胁角色与资产

| 角色                | 能力                                                                   | 主要资产                                  |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| 外部 API 调用方     | 提交 register/submit/approve/prepare/commit/policy/rollout 的 wire DTO | Schema 目录、active binding、准入审计日志 |
| 被攻陷的 proposer   | 尝试自批准、伪造证据摘要、陈旧 CAS                                     | 准入工作流完整性                          |
| 被攻陷的 operator   | 尝试在无授权角色的情况下提交                                           | Epoch 激活、runtime schema head           |
| 脑裂 operator 对    | binding CAS 失败时 runtime epoch 已应用                                | Binding 生成单调性                        |
| 存储故障注入器      | 部分快照/日志写入、跨进程竞态                                          | 持久 binding head、提交决策               |
| 恶意 runtime 参与者 | 不能直接变更目录——必须经过准入                                         | binding 所引用的 runtime head             |

## 信任边界

```
Untrusted wire DTO ──► ingressWireCodec (strict keys) ──► AdministrationContext roles
        │                                                      │
        ├─ qualification evaluator ◄── schema-qualifier ───────┤
        ├─ authorization evaluator ◄── schema-authorizer ──────┤
        ├─ four-view verifier ◄── conformance bundle ──────────┤
        └─ prepared record (server-only) ──► opaque handle ────┘
                                   │
                     prepare ──► runtime epoch admin (readiness gates)
                                   │
                     commit ──► decided → runtime_applied → finalize (binding CAS)
                                   │
                     recovery ──► forward finalize when binding drift detected
```

| 边界           | 规则                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| Ingress        | 版本化 wire codec 拒绝未知字段；品牌化 ID 在服务端解析                        |
| 角色           | `AdministrationContext` 携带角色集；proposer ≠ approver；提交需要 authorizer  |
| Prepared token | 服务端 `PreparedAdmissionRecord`；客户端仅收到不透明句柄                      |
| 证据           | 四视角 bundle 必须与准入主体（domain、epochs、plan digest、runtime head）匹配 |
| 激活           | 通过 `(activationDomainId, bindingGeneration)` 上的 CAS 提升 binding          |
| 两阶段提交     | 持久化 `CommitDecisionRecord` 追踪 `decided → runtime_applied → finalized`    |
| 脑裂恢复       | `recovery_required` + `recoverForwardCommit` 在 runtime 已前进时 finalize     |
| 策略激活       | 策略修订注册 + binding CAS + `onPolicyActivated` runtime 通知 hook            |
| 跨进程持久化   | 文件快照受 `.control-plane.lock` 保护 + 持久化时原子重命名                    |
| E-Stop         | `setFrozen` 阻止 register/submit/approve/prepare/commit/policy/rollout/ack    |

## 权限矩阵（M3）

| 操作                | 所需角色                           | 确保                                            |
| ------------------- | ---------------------------------- | ----------------------------------------------- |
| 注册 schema 修订    | catalog-writer（服务引导）         | 由 `(schemaId, revisionId)` 键控的不可变修订    |
| 提交准入            | schema-proposer + schema-qualifier | 处于 submitted 状态的准入记录                   |
| 批准准入            | schema-authorizer（≠ proposer）    | 附带授权证据                                    |
| Prepare 准入        | schema-committer + 有效四视角      | 服务端 prepared 记录 + runtime prepared epoch   |
| 提交准入            | schema-authorizer + 有效 prepared  | Binding generation +1，runtime schema head 对齐 |
| 恢复提交            | 持有既有决策记录的 operator        | 幂等 finalize 或前向恢复                        |
| 激活策略            | policy-admin + 兼容 schema         | Binding generation +1，策略引用更新             |
| Fleet rollout / ack | rollout-admin / runtime-worker     | 仅对账报告——无目录变更                          |

## 已实施的缓解措施（2026-08-11）

| 风险                 | 缓解措施                                                            |
| -------------------- | ------------------------------------------------------------------- |
| 伪造的 prepared 句柄 | 提交时按 preparedId 解析服务端记录；客户端句柄不透明                |
| 自批准               | proposer == approver 时触发 `separation_of_duties_violation`        |
| 证据替换             | 一致性验证器将摘要绑定到准入主体                                    |
| 脑裂提交             | 两阶段决策日志 + `recoverForwardCommit`                             |
| 陈旧 binding CAS     | 在 submit/prepare/commit/policy 上检查期望的 generation             |
| 未知 wire 字段       | `ingressWireCodec` 严格键允许列表                                   |
| 策略激活空操作       | CAS binding 更新 + `onPolicyActivated` hook 用于 runtime 评估器切换 |
| 跨进程快照竞态       | 文件锁下的 `casActiveBindingDurable`                                |
| 非单调 schema        | 单调扩展验证器 + 不可变修订                                         |
| 控制面冻结绕过       | 所有变更命令上的 `ensureNotFrozen`                                  |

## 残余风险（M3 → 生产）

| 风险                   | 状态 | 说明                                      |
| ---------------------- | ---- | ----------------------------------------- |
| 外部 Security 独立签字 | 开放 | DRI 临时评审人；FCP 前招募                |
| 四视角的 Lean 证明桥接 | 开放 | 仅摘要级一致性                            |
| 多租户隔离             | 推迟 | M3 测试框架中单一激活域                   |
| 管理 API 的 HSM / mTLS | 推迟 | 仅进程内服务接线                          |
| Fleet 对账授权加固     | 部分 | 角色门禁已就位；持久化 rollout 日志不完整 |

## 后果

- 控制面不得在无 `AdministrationContext` 的情况下接受调用方提供的授权字符串。
- runtime 集成必须接线可变 schema context + 激活时的策略通知。
- 文件后端部署必须使用 `casActiveBindingDurable`（或等价的锁 + 重载）以支持跨进程 worker。
- 可观察性保持只读；epoch 边界来自准入回执。

## 批准

**DRI 签字**：Joker-of-Gotham
**Architecture / Security 评审**：Joker-of-Gotham（临时，COI 已披露）——FCP 前外部评审人待定
**日期**：2026-08-11
