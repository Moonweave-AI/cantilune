# ADR-0003：运行时威胁模型与权限边界

| 字段           | 值                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted**（工程原型范围）                                                                                                        |
| Date           | 2026-08-10                                                                                                                          |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                               |
| Reviewers      | Joker-of-Gotham (DRI，兼任 Security + Architecture second reader；COI 见 `reviewer-assignments.md`)；FCP 前外部 Security 招募仍开放 |
| Related        | RFC-0001 §9、ADR-0002、`@cantilune/runtime`、`diagrams/02-runtime/`                                                                 |

## 背景

RFC-0001 §9 要求在 runtime/comms/network 实现之前具备威胁模型。一次 2026-08-10 的代码评审发现 `@cantilune/runtime` 无法充当受信任的权限边界：伪造准入票据、绑定上的 TOCTOU、非原子提交、浅层重放验证，以及对历史快照引用的观察改写。

本 ADR 记录 M2 工程原型范围的**运行时局部威胁模型**与权限矩阵。Comms/A2A/网络侧面在后续 ADR 之前仍属范围之外。

## 威胁角色与资产

| 角色                   | 能力                                                                       | 主要资产                                 |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| 外部调用者（不受信任） | 提交 `CoordinationIntent`、`ObserveInput`（source + payloadRef）、组合 DTO | `CollaborationSnapshot`、`ChangeLog`、锁 |
| 恶意 agent 参与者      | 持有或寻求 artifact/capability；可能误绑定角色                             | 任务所有权、scoped capability、会话      |
| 被攻陷的测试/支持代码  | 不得进入生产接线                                                           | 策略求值器、ID 生成器                    |
| 存储故障注入器         | 部分写入、重排、崩溃                                                       | 持久 head、changelog、sidecar            |

## 信任边界

```
Untrusted DTO ──► normalize + validate ──► AdmissionGateway ──► registry-scoped ticket
                                                      │
PolicyEvaluator (default deny; templateAware for M2) ◄┘
                                                      │
Internal registry (AdmittedRecord) ◄── ticket resolves ──► Committer ──► DurableCoordinator
ObserveInput ──► principal must match source ──► ingestObservation ──► head CAS
FileResourceLockTable ──► cross-process footprint exclusion (same dir as bundle)
```

| 边界              | 规则                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| 票据              | 注册表作用域的 `AdmissionTicket` + `AdmittedId`；提交经内部注册表解析（非加密令牌） |
| Principal（协调） | `initiator` / `from` 角色必须匹配已认证的 `ActorRef` principal                      |
| Principal（观察） | `ObserveInput.source` 必须匹配 `runtime.observe` 上的显式 `principal` 选项          |
| 足迹              | 仅从规范化后的 `matchBindings` 派生；绝不通过隔离范围拓宽拓扑                       |
| Apply             | 处理器对 `(before, recipe)` 是纯的；新实体引用在配方中预分配                        |
| 持久化            | 单次 `DurableCoordinator.commit(expectedHead, …)` CAS；观察分配新 `snapshotRef`     |
| 跨进程锁          | `FileResourceLockTable` 与 bundle 共享锁文件目录；仅不相交足迹                      |

## 权限矩阵（M2）

| 操作                 | 要求（准入）                                                                               | 保证（apply 后）                          | 能力检查                            |
| -------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------- |
| `introduce_artifact` | `from` 已注册；task 不存在                                                                 | task 存在；`from` 持写锁                  | scoped `artifact` capability        |
| `delegate`           | task 存在；`from` 持 scoped 锁；`to` 已注册                                                | `to` 持锁                                 | `delegator.holds` 严格 scope/holder |
| `create_session`     | `from` 已注册                                                                              | `from` 已注册                             | —                                   |
| `fork_branch`        | `from` 已注册                                                                              | `from` 已注册                             | —                                   |
| `publish_artifact`   | task 存在；`from` 持有                                                                     | task 存在                                 | owner 或 scoped capability          |
| `transfer_session`   | session 存在；**`from` 为 controller**（`session.controller_matches`）；`from`/`to` 已注册 | session 存在                              | 仅 controller 转移                  |
| `observe`            | 显式 principal 匹配 source；head CAS                                                       | 新 snapshot ref；append-only auditTail 段 | principal/source 对齐               |

当省略 `policy` 时的默认：**`denyByDefaultPolicyEvaluator()`**。M2 接线**应当**使用 **`templateAwarePolicyEvaluator()`**（模板 `requires` 已门禁准入）。`allowAllPolicyEvaluator` 仅用于测试支持。

## 已实施的缓解措施（2026-08-10）

| 阻塞项             | 缓解措施                                                         |
| ------------------ | ---------------------------------------------------------------- |
| 伪造准入           | 内部 `AdmissionRegistry`；提交解析票据 + 锁 + head CAS           |
| 绑定上的 TOCTOU    | `normalizeCoordinationIntent` 深拷贝；targets 仅来自绑定         |
| 非原子提交         | `DurableCoordinator` 单事务内存实现；锁在 `finally` 中释放       |
| 浅层重放           | `snapshotsCanonicallyEqual`；配方携带新 link/session 引用        |
| 观察改写           | 每次观察经 `compareAndSwapHead` 分配新 `snapshotRef`             |
| 票据 ID 冲突       | 每个 gateway 实例的单调 admitted-id 序列                         |
| 观察源伪造         | `validateObservePrincipal`；`runtime.observe` 上要求 principal   |
| 非 controller 转移 | 准入 schema 处的 `session.controller_matches`                    |
| 跨进程锁缺口       | `FileResourceLockTable` + `createFileRuntimePersistence().locks` |
| 浅层快照编解码器   | 严格的 `parseSnapshotWire` 实体验证                              |
| 默认策略缺口       | 可选策略 → deny-by-default；导出 `templateAwarePolicyEvaluator`  |

## 残余风险（core/runtime 范围）

| 风险                      | 状态            | 备注                                                                         |
| ------------------------- | --------------- | ---------------------------------------------------------------------------- |
| 异步/多进程存储 + 锁      | **Closed (M2)** | `FileDurableCoordinator` + `FileResourceLockTable` + L7 cross-process/worker |
| 模板/处理器版本重放       | Closed          | 带版本注册表 + 测试                                                          |
| 编解码器严格验证          | Closed          | `parseChangeWire` + `parseSnapshotWire`                                      |
| Pack 消费者冒烟           | Closed          | CI `test:pack`                                                               |
| L7 并发/压力              | Closed          | `tests/system/l7/*`（76/76 通过）                                            |
| M2 原型 Stop-Ship         | **Lifted**      | Reviewer 裁定 2026-08-10；本地 runtime/core 工程可继续                       |
| ADR-0003 reviewer Accept  | **Accepted**    | Joker-of-Gotham (DRI)；2026-08-10                                            |
| External Security pre-FCP | Open            | 非 DRI 独立签核仍须                                                          |

**M2 范围之外（非 Stop-Ship，不阻塞 core/runtime 原型）：**

| 项                        | 原因                                  |
| ------------------------- | ------------------------------------- |
| 分布式 DB / 多副本持久化  | 未来 ADR；file durable 为单目录 CAS   |
| A2A / comms / 网络        | 外置 02G；须后续 ADR                  |
| Lean FCP / QA-L4 理论门禁 | 形式化验收链，与 runtime 工程边界分离 |

## 后果

**正面**

- 满足了 runtime 原型范围的 RFC-0001 §9 门禁
- 权限检查已文档化且可测试（`ticket-security`、`concurrent-admit-reconcile`）
- 工程原型与生产网络边界之间清晰分离

**负面**

- 适合单进程的内存持久化；**文件持久化**用于跨进程 CAS（非分布式 DB）
- 威胁模型不覆盖 A2A/comms（未来 ADR）
- 生产边界仍需本 ADR 的 reviewer Accept；FCP 前仍须外部安全签核

## 考虑过的备选方案

| 选项                            | 被否决的原因           |
| ------------------------------- | ---------------------- |
| 公开的 `AdmittedIntent` 构造器  | 轻易绕过策略           |
| 信任调用者提供的足迹用于加锁    | TOCTOU + 拓扑损坏      |
| 无 CAS 的独立 Store + ChangeLog | 部分失败时产生孤儿快照 |
| Map-size 重放相等               | 经验证重放的假阳性     |

## 实现任务

- [x] 不透明票据 + 内部注册表
- [x] deny-by-default 策略；allow-all 仅测试
- [x] DurableCoordinator 原子提交（内存）
- [x] 规范快照重放比较
- [x] 通过新引用的观察不可变性
- [x] 严格编解码器验证管线（`wireValidation`、`decode*FromUnknown`）
- [x] 冷启动重放 CI（`tests/system/l7/cold-start-replay`）
- [x] Pack 消费者冒烟（`scripts/pack-consumer-smoke.mjs`、CI `test:pack`）
- [x] 模板/处理器版本重放（`templateRegistry@revision`、`handlerRegistry@revision`）
- [x] L7 压力 / 崩溃重启 / 并发批处理（`tests/system/l7/*`）
- [x] 文件背书的事务持久化 + **跨进程资源锁**
- [x] Observe principal 验证；admission 处的 transfer_session controller
- [x] 严格快照 wire 验证；默认 deny + templateAware 策略导出
- [x] ADR-0003 reviewer Accept（2026-08-10，Joker-of-Gotham）
- [ ] FCP 前外部 Security reviewer 签核（招募开放）
