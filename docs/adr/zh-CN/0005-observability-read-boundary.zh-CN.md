# ADR-0005：可观察性读边界与访问策略

| 字段           | 值                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted**（0.x；ObservationAccessContext + 平台出口已落地，ADR-0025）                                                              |
| Date           | 2026-08-11                                                                                                                            |
| Revised        | 2026-08-16 — 生产读路径必须带 ObservationAccessContext；OTel/AG-UI/OTLP 平台（ADR-0025）                                              |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                 |
| Reviewers      | Joker-of-Gotham (DRI，兼任 Architecture second reader；COI 见 `reviewer-assignments.md`)；形式化 ProjectionCertificate 独立审查仍开放 |
| Related        | RFC-0001 §7、RFC-0002、ADR-0002、ADR-0003、`docs/spec/observable-lts-policies.md`、`@cantilune/observability`                         |

## 背景

2026-08-11 的一次代码评审发现 `@cantilune/observability` 尚不能被冻结为受信任的只读观察边界。除其他缺口外，该包未定义**访问策略**：公开 API 返回完整终态快照（私有会话、capability、内部变更），不带 principal、scope 或字段遮蔽。

本 ADR 记录 M2–M3 原型范围内的**可观察性本地读边界**。形式化 `ProjectionCertificate` 验证仍由 `@cantilune/conformance`（规划中）负责。

## 决策

**M2–M3 默认：**`@cantilune/observability` 是一个**受信任的内部读 API**。

| 方面              | M2–M3 规则                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- |
| 调用方            | 与 runtime 同进程 / 同信任区（dashboard、调试工具、集成测试、control-plane）       |
| Principal / scope | `observeCommitted()` 上**不要求**；假设调用方对其所读取的 runtime 存储拥有完全授权 |
| 返回数据          | 完整终态 `CollaborationSnapshot`、完整变更窗口、完整四个读视角                     |
| 写路径            | **禁止**——可观察性不得调用 runtime 的 admit/commit/apply                           |
| 输出不可变性      | 返回的 `FourViewBundle` 必须在包边界处深拷贝 + 冻结（见 `immutableBoundary.ts`）   |
| 证据              | `ReadModelDerivationEvidence` 是可选的工程自检；**不是**形式化投影证书             |

**面向生产（2026-08-15 已落地 / ADR-0025）：**稳定 facade 必须带 `ObservationAccessContext`。本包是**可观测性平台**（committed-world 四角 + OTel OTLP + AG-UI）。`ProjectionCertificate` 仍属 `@cantilune/conformance`；本包只持 digest。

```typescript
interface ObservationAccessContext {
  readonly principal: ActorRef;
  readonly scope: Footprint; // or policy-derived readable scope
  readonly visibilityPolicy: ObservableLtsPolicy; // external vs administrative
}
```

一旦超出信任区暴露，面向生产的 SDK/UI 不得在无该上下文的情况下调用可观察性。

## 可观察 vs 管理性可见性

核心已在变更上标记 `ChangeVisibility`（`external` | `administrative`）。可观察性必须：

1. 保持 **Raw EventSpine** 完整（窗口内所有已提交变更）。
2. 应用**读视角过滤器**，使 dependency/resource/communication/coordination-structure 视图按 `observable-lts-policies.md` 隐藏或标记管理性变更。
3. 记录哪些不变量（E1–E7、O6 证据）适用于过滤后的切片 vs 原始切片。

M2–M3 在引擎内交付过滤；策略表仅通过内部选项可配置，不通过公开 principal API 暴露。

## 信任边界

```
Runtime durable store (authoritative)
        │ read-only ports: head · getSnapshot · changesSince · runHistory
        ▼
ObservationCut (atomic sinceRef→headRef validation)
        ▼
ObservationWorld + EventSpine + four read angles
        ▼
CrossViewInvariants + optional ReadModelDerivationEvidence
        ▼
Frozen FourViewBundle (consumer MUST NOT mutate)
```

| 边界       | 规则                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| 输入       | 仅通过 `ObservationReadPorts`；无直接存储变更                           |
| 历史快照   | 每个 `beforeRef`/`afterRef` 严格解析；无终态回退                        |
| 并发提交   | Cut 读取器双重读取 head，对撕裂窗口重试或失败关闭                       |
| 输出       | 深拷贝 + `Object.freeze`；对返回 bundle 的变更不得影响 runtime 存储     |
| 形式化证书 | `ProjectionCertificate` 保留给 `@cantilune/conformance`；此处不重新导出 |

## 后果

### 正面

- 清晰分离：工程读模型 vs 形式化一致性证明。
- 内部工具可消费完整快照，无需过早引入 RBAC 复杂性。
- 不可变输出关闭了评审中发现的"TypeScript-only readonly"绕过。

### 负面 / 推迟

- 在 `ObservationAccessContext` 落地前，外部/多租户 dashboard 不能仅依赖可观察性进行遮蔽。
- 管理性过滤策略尚不可在公开 API 面上由用户配置。
- L7 持久化/跨进程 observe-cut 测试仍是 runtime + 可观察性的联合工作。

## 合规清单（M2–M3）

- [x] 公开导出面收窄至 facade + 不变量类型
- [x] `ReadModelDerivationEvidence` 取代非正式的"certificate"命名
- [x] 原子 observation cut + since→head 闭合
- [x] 不可变 bundle 边界
- [x] 读视角中的管理性可见性过滤器
- [ ] 公开 API 上的 `ObservationAccessContext`（推迟）
- [ ] `@cantilune/conformance` 负责形式化 `ProjectionCertificate`（推迟）

## 批准

**DRI 签字**：Joker-of-Gotham
**日期**：2026-08-11
**决策参考**：可观察性 Request Changes 评审（2026-08-11）、RFC-0001 §7、`observable-lts-policies.md`
