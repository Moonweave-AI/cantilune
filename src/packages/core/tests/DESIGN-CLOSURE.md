# @cantilune/core 设计闭包清单

> 对照 `diagrams/00-naming-contract.md`、`docs/adr/0002-core-engineering-boundaries.md` 与 `formal/`。  
> 状态：**已测** | **部分** | **OPEN** | **RUNTIME** | **FORMAL**

---

## 1. 当前证据强度（2026-08-10 评审后）

| 含义      | 说明                                       |
| --------- | ------------------------------------------ |
| ✅ 已保证 | 已写入 L3–L5 测试且在 core 代码中成立      |
| ⚠️ 部分   | 有实现/测试但不构成闭包                    |
| ❌ 未成立 | 标签过高或依赖 simulateCommit / 手写 apply |

**结论：** `@cantilune/core` + `@cantilune/runtime` 已达 **L3–L7 stress 档**；工程设计覆盖矩阵见 [`ENGINEERING-COVERAGE.md`](./ENGINEERING-COVERAGE.md)。

---

## 2. 核心不变量（横切）

| ID  | 不变量                            | 状态        | 测试 / 代码                                                    |
| --- | --------------------------------- | ----------- | -------------------------------------------------------------- |
| I1  | Observation ≠ Change              | **已测**    | `integration/observation-vs-change`                            |
| I2  | Change 无 payload                 | **已测**    | `types/brands`, `coordination-change`                          |
| I3  | beforeRef 链连续                  | **已测**    | `validateBeforeRefChain`（生产代码）                           |
| I4  | derive 只读                       | **已测**    | `deriveDiagnosticSummary`                                      |
| I5  | 同链 epoch 一致                   | **已测**    | `validateEpochConsistent`                                      |
| I6  | auditTail ↔ history               | **已测**    | `consistency/validateAuditTailMatchesHistory`                  |
| I7  | footprint 覆盖 targets            | **已测**    | `validateCompositionIntentFootprint`                           |
| I8  | 并发用 effective footprint        | **已测**    | `review-regressions`, `compatibleConcurrently`                 |
| I9  | Snapshot Map 防御性复制           | **已测**    | `snapshot-immutability`                                        |
| I10 | session 切片含 createdSessionRefs | **已测**    | `session-slice`                                                |
| I11 | 世界完整性                        | **已测**    | `validateSnapshotIntegrity`（Map/ActorRef/reviewer/auditTail） |
| I12 | 独立重放                          | **RUNTIME** | Change 为 receipt；需 `@cantilune/runtime`                     |

---

## 3. Footprint 决策（已关闭 → ADR-0002）

**采纳 C 变体（C-prime）：**

- `CompositionIntent.footprint` = Agent 请求的隔离域（可更宽，须覆盖 targets）
- `effectiveFootprintOfCompositionIntent()` = 权威触达集（从 targets 派生）
- `compatibleConcurrently()` 只用 effective footprint
- Runtime admission 将来产出 opaque `AdmittedIntent` + template 计算的 effective footprint

---

## 4. 三柱闭包表

### coordination

| 项                                | 状态                                         |
| --------------------------------- | -------------------------------------------- |
| CollaborationSnapshot 防御性复制  | **已测**                                     |
| CoordinationChange + MatchBinding | **部分** — recipe 基础已加，apply 在 runtime |
| visibility 必填                   | **已测**                                     |
| validateBeforeRefChain / epoch    | **已测**                                     |

### structure

| 项                                          | 状态                          |
| ------------------------------------------- | ----------------------------- |
| effectiveFootprint / compatibleConcurrently | **已测**                      |
| interface + binds 共存                      | **已测**                      |
| Goal/Outcome 判别                           | **已测**                      |
| deriveDiagnosticSummary                     | **部分** — 仅诊断，非结构投影 |
| validateRunHistory                          | **部分**                      |

### consistency（新）

| 项                              | 状态     |
| ------------------------------- | -------- |
| validateAuditTailMatchesHistory | **已测** |
| validateSnapshotIntegrity       | **已测** |
| CoreViolation 错误模型          | **已测** |

---

## 5. 包边界

| 能力                             | 包                                  | 状态        |
| -------------------------------- | ----------------------------------- | ----------- |
| 类型 + 纯函数 + 校验             | `@cantilune/core` (`private: true`) | **当前**    |
| applyChange / replay / admission | `@cantilune/runtime`                | **RUNTIME** |

**Runtime 纵向闭环已落地。** core contract story 保留为非 L6 recipe 单测；`simulateCommit` 仅为 tests-only harness。

---

## 6. 测试层级诚实声明

| 层    | 状态                                                                 |
| ----- | -------------------------------------------------------------------- |
| L2    | typecheck 脚本含 `tsc`；Vitest types 测补充 compile-time             |
| L3–L5 | **成立**（基础规则 + 负向 + story fixture）                          |
| L6–L7 | **成立** — runtime admit/commit 为 L6 证据；core stress 100 agent / 200 trace |

完整对照见 `00-naming-contract.md` 附录 A 与 ADR-0002。
