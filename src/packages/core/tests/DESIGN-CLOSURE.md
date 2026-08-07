# @cantilune/core 设计闭包清单

> 对照 `diagrams/00-naming-contract.md` 与 `formal/`。  
> 状态：**已测** | **部分** | **OPEN**（待设计决策） | **RUNTIME**（属 `@cantilune/runtime`） | **FORMAL**（属 Lean 证明层）

---

## 1. 测完 74+ 用例意味着什么

| 含义 | 说明 |
|---|---|
| ✅ 已保证 | 已写入 **L3–L7 测试** 的行为在代码里成立 |
| ⚠️ 未保证 | 未测路径、未实现模块、手工 `simulateCommit` 以外的 replay |
| ❌ 不替代 | `formal/` 数学证明、生产 runtime admission |

**结论：** 当前是 **「主故事 + 三柱基础规则」** 的工程验证，不是 **「设计闭包 / 可发布 runtime」**。

---

## 2. 核心不变量（横切）

| ID | 不变量 | 状态 | 测试 / 代码 |
|---|---|---|---|
| I1 | Observation ≠ Change；obs 不改 graph | **已测** | `integration/observation-vs-change`, `contract/story-t0-to-delegate` |
| I2 | Change 无 payload | **已测** | `unit/coordination/coordination-change`, `types/brands` |
| I3 | beforeRef 链连续 | **已测** | `contract/story-t0-to-delegate`, `validateBeforeRefChain` |
| I4 | derive 只读 | **已测** | `system/replay-invariants`, `assertDeriveReadOnly` |
| I5 | 同链 epoch 一致 | **已测** | `validateEpochConsistent`, story contract |
| I6 | auditTail ↔ history obs 一致 | **部分** | `validateAuditTailMatchesHistory` + `contract/negative/*` |
| I7 | footprint 覆盖 targets | **部分** | `validateCompositionIntentFootprint` — 见 §3 |

---

## 3. OPEN：footprint 与 targets「双源」问题（需你后续拍板）

### 现象

`CompositionIntent` 同时有：

- **`footprint`** — Agent 声明；`compatibleConcurrently` **用这个** 判断是否可并行
- **`targets`** — 转成 `CoordinationIntent` 后；`footprintOfCoordinationIntent` **从 targets 推导**

若两者不一致，会出现：

```
Agent 声明 footprint 只碰 {A}
但 targets 列出 artifact {task-T}
→ 并发判定以为「不占 task-T」
→ admission / replay 却认为「动 task-T」
→ 局部并行可能串台（设计断层）
```

### 三种处理方式（你之前未决）

| 选项 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A. core 校验（当前默认）** | `validateCompositionIntentFootprint`：footprint **必须覆盖** targets | 早失败、测试可写 | 不禁止 footprint 比 targets 宽 |
| **B. runtime 校验** | core 不 throw，admission 拒绝 | core 保持纯数据 | 断层推迟到 runtime |
| **C. targets 唯一真相** | footprint 从 targets 派生，去掉双源 | 语义最清 | **API 变更**，需 refactor |

**当前实现：** 采用 **A 的弱形式** — 仅拒绝「footprint 盖不住 targets」，不强制相等。  
**请你后续确认：** 是否要升级为「必须相等」（C 的方向）或下沉到 runtime（B）。

---

## 4. 三柱闭包表

### 4.1 primitives

| 项 | 状态 |
|---|---|
| Branded IDs | **已测** |
| Refs / targets / evidence | **已测** |
| Result / time | **已测** |

### 4.2 nodes

| 项 | 状态 |
|---|---|
| 9 类 entity factory | **已测** |
| WorkArtifact ≠ ScopedCapability | **已测** |
| ActorRef vs Participant 一致性 | **OPEN** — 未强制 kind 与 registry 一致 |
| 契约 story 中 reviewer 未注册 | **OPEN** — 故事测 change 形状，非世界完整性 |

### 4.3 coordination

| 项 | 状态 |
|---|---|
| appendObservation / auditTail | **已测** |
| observationStream 序号 | **已测** + **negative** |
| CoordinationChange 字段 | **已测** |
| ProposedChange / Intent | **部分** |
| 通用 ReplayVerifier | **RUNTIME** |
| Admission / OperationTemplate | **RUNTIME** |

### 4.4 structure

| 项 | 状态 |
|---|---|
| disjoint / footprint | **已测** |
| 7 operators 映射 | **已测** |
| trace slice / compose | **已测** |
| derive 读模型 | **部分** — 见 §5 |
| footprint 校验 | **已测**（新增 validation） |

---

## 5. OPEN：derive 与 operators 未闭合

| 写模型 (operators) | 读模型 (derive) | 差距 |
|---|---|---|
| nest / fork / parallel 并发 | 多 change → **serial** boxes | derive 不反映 nest/fork 树 |
| 无 history | 多 participant → parallel boxes | 与 footprint 并发语义不对齐 |

**状态：** **OPEN** — 需决定 derive 最小语义（仅诊断 vs 与 structure 同构）。  
**测试策略：** 在闭包前不假装 derive 已完整；`system/` 只断言只读 + 故事线可 derive 出 box/serial。

---

## 6. 包边界

| 能力 | 包 | 状态 |
|---|---|---|
| 类型 + 纯函数 + 校验辅助 | `@cantilune/core` | **当前** |
| applyChange / replay / admission | `@cantilune/runtime` | **RUNTIME** |
| 数学语义证明 | `formal/` | **FORMAL** |

**最大断层：** 测试里 `simulateCommit` + 手写 `apply` **不是** 产品行为。  
runtime 第一版应补：**同一 delegate change → 唯一 after snapshot**。

---

## 7. 负向测试（`contract/negative/`）

| # | 场景 | 期望 |
|---|---|---|
| N1 | observation 序号跳号 | throw |
| N2 | footprint 不覆盖 targets | throw |
| N3 | 共享 capability 并发 | `compatibleConcurrently === false` |
| N4 | auditTail 与 history 不一致 | throw |
| N5 | beforeRef 链断裂 | throw |
| N6 | epoch 链不一致 | throw |

---

## 8. 建议的下一里程碑

1. **你确认 §3 footprint 选项** A / B / C  
2. **`@cantilune/runtime`**：`applyChange` + 与 `story-t0-to-delegate` 同一 fixture 的 replay 测试  
3. **derive 语义 ADR**：读模型最小承诺  
4. **附录 A 映射表**：Lean ↔ TS 逐条 checkbox  

---

## 9. formal 对照（摘要）

| 数学 | 工程 | TS 状态 |
|---|---|---|
| Config σ | CollaborationSnapshot | **已测** |
| externalObservations | auditTail | **已测** |
| DPOEvent σ | CoordinationChange | **已测**（无 payload） |
| ruleId / admission | OperationTemplate | **RUNTIME** |

完整对照见 `00-naming-contract.md` 附录 A。
