# RFC-0003：产品符合性 —— 证据、证书与发布门禁

| 字段                | 值                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态                | **FCP**（2026-08-16 开启；评论期至 2026-08-30；尚未 Accepted）                                                                               |
| 类型                | 架构 / 治理                                                                                                                                  |
| 风险                | 用于 control-plane 激活或产品发布时为 S4；起草阶段为 S2                                                                                      |
| 提案人 / 决策负责人 | Joker-of-Gotham（DRI）                                                                                                                       |
| 必需评审人          | 形式数学、进程语义、安全/威胁建模、QA-L5 —— **Joker-of-Gotham**（Owner；COI 已披露，2026-08-16）                                              |
| 创建日期            | 2026-08-11                                                                                                                                   |
| 更新日期            | 2026-08-11                                                                                                                                   |
| 相关                | RFC-0001 §8、RFC-0002 §7.1、ADR-0001、ADR-0006、ADR-0009、ADR-0010、`@cantilune/conformance`、`formal/proof-obligations.json`、`docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` |

> **治理说明：** 本 RFC 是**产品符合性**的权威来源——核心理论之后的门禁，由具体包提供操作证据、机器验证、人类评审与密封发布决策。聊天讨论不具备权威性。本 RFC **不**宣称 QA-L5 完成、独立评审已签署或生产发布权限。英文正文为唯一权威来源：[`docs/rfc/0003-product-conformance.md`](../0003-product-conformance.md)。

> **边界校正（继承 RFC-0002 §7.1）：** 核心理论（QA-L4 上的 `proved / Owner-accepted`；promotion 未走）证明通用证书接口可经由参考见证满足。**产品符合性是另一道门。** Owner 于 2026-08-16 授予 `@cantilune/conformance` 0.x 生产发布权限（SS-01 已解除）。Release Acceptance cert 仍不自动签。

---

## 1. 摘要

`@cantilune/conformance` 是**产品证据验证与发布门禁**模块。它回答关于一个包或准入主体的五个彼此独立的问题，经 **C0–C9 证书链**绑定证据，从有序矩阵中选择**验证 profile**，并输出密封的 `VerificationDecision`，仅供授权的下游门禁消费（control-plane schema 激活、fleet rollout、产品发布）。

产品符合性验证所提供的产品证据满足核心理论已定义、并记录在 `formal/proof-obligations.json` 中的接口。

**当前实现状态：** M1–M2 工程原型。在 ADR-0009、ADR-0010 与 QA-L5 评审关闭之前，**不是**生产准入或发布权限。

## 2. 动机

### 2.1 问题

若没有显式的产品符合性门禁，三种失败模式会反复出现：

| 失败模式           | 症状                                                          | 根因                                                                          |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 理论/产品混同      | 「CENTRAL-18 已 proved」被当成「`@cantilune/runtime` 已交付」 | 内核证明状态被折叠成产品发布布尔值                                            |
| 工程/形式视图混同  | 控制面把依赖/资源 digest 当作四投影证明                       | `EngineeringAdmissionEvidence` 与 `FormalFourProjectionCertificate` 被当作可互换 |
| 范围升级           | 参考见证被引用为未经测试规则的产品主张                        | `generic` / `reference` / `product` 主张范围未被强制                          |

研究日志 0018 与 RFC-0002 §7.1 确立了理论/产品分裂。本 RFC 操作化**产品一侧**：每个包必须提供什么证据、如何验证、下游系统可以信任什么。

### 2.2 受益人 / 为何现在 / 不做的代价

- **受益人：** 包所有者、控制面运维、发布工程师、需要可证伪证据契约的独立评审人。
- **为何现在：** `@cantilune/control-plane`（ADR-0006）已在 prepare/commit 消费四视图证据；`@cantilune/comms` 已有产品自有证书脚手架。没有 RFC-0003，这些集成缺少治理契约。
- **不做的代价：** 虚假发布主张；reference→product 升级；缓存投毒或伪造 digest 的证据在激活边界被接受。

## 3. 目标

1. 定义 **C0–C9 证书链**及其到证据族、理论基线与发布产物的映射。
2. 将**五个符合性问题**形式化为彼此独立的验证义务，并给出显式通过/失败语义。
3. 发布 **profile 矩阵**（`ConformanceProfile` × `ClaimScope`）与升级规则。
4. **永久分离**工程准入证据与形式四投影证书，同时允许主体绑定。
5. 用策略强制的上限界定 **generic**、**reference** 与 **product** 主张。
6. 记录**非目标**，并显式交接给 RFC-0001 评测 harness（独立的未来 ADR；不复用 ADR-0005）。
7. 为 ADR-0009（信任生命周期）与 ADR-0010（威胁模型）提供治理挂钩。

## 4. 非目标

- 从产品代码改写 `formal/proof-obligations.json` 状态。
- 在 `@cantilune/conformance` 内做 runtime commit、控制面目录变更，或持有私有签名密钥。
- 把 Vitest 通过、非空证书字段或 DRI 自评当作产品符合性。
- 取代 QA-L4 理论评审（`docs/qa/0002-theory-closure-proved-review-pending-2026-07-27.md`）。
- 定义基准指标或基线比较 harness（按 RFC-0001 §8 交接给评测 ADR）。
- 自动批准人类评审，或绕过吊销 / 过期检查。

## 5. 背景

### 5.1 与核心理论的关系

| 层                       | 权威                            | 状态轴                                | 阻塞                             |
| ------------------------ | ------------------------------- | ------------------------------------- | -------------------------------- |
| 核心理论（Lean）         | `formal/proof-obligations.json` | `theory`                              | 通用接口可满足性                 |
| 产品符合性（TS）         | `@cantilune/conformance`        | `machine` + `humanReview` + `release` | 包激活 / 发布                    |
| 评测 harness（未来）     | RFC-0001 §8 可证伪主张          | 基准证据                              | 相对基线的优越性主张             |

**不变量：** `kernel proved ≠ product verified ≠ human reviewed ≠ released`（`ConformanceStatusAxes` 中四条分离的状态轴）。

### 5.2 工程 vs 形式四投影分裂

| 工程概念                                                                              | 形式概念                                                                                       | 使用者                                                         |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `EngineeringAdmissionEvidence` — 依赖 / 资源 / 会话 / 结构 digest                     | `FormalFourProjectionCertificate` — DAG / Petri / π / 态射 digest + 共享执行 digest            | 控制面 prepare（工程）；产品发布（形式）                       |
| Profile：`engineeringAdmission`                                                       | Profile：`fourProjection`、`crossEpochProduct`、`fullProductTrajectory`、…                     | ADR-0006 准入；包发布门禁                                      |

两者可以绑定同一 `AdmissionSubject`（域、epoch、plan digest、runtime head）。**它们不是可互换类型**，新代码不得共用已弃用的伞名 `FourViewEvidence`（别名仅在 M2 为控制面 harness 兼容而保留）。

### 5.3 主张范围

| 范围        | 含义                                                                | 默认策略（M2）                             |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `generic`   | 接口级或跨包模式；无产品特定规则                                    | 允许                                       |
| `reference` | 实质性参考执行（例如重连矩阵、comms harness）                       | 允许                                       |
| `product`   | 具体包规则清单 + 运行时操作事实                                     | **阻塞**，直到策略提升 + QA-L5             |

未经策略变更的范围升级是 **Stop-Ship** 违规（`scope_escalation`）。

## 6. 提案

### 6.1 五个符合性问题

每次验证运行 MUST 独立回答全部五个问题。单一布尔值 MUST NOT 把它们折叠。

| #   | 问题                                                                                                                                                   | 主证据                                                                  | 证书阶段  | 失败码（示例）                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| Q1  | **来源：** 这份证据描述的是哪一棵精确源树、产物、规则清单、epoch 与 occurrence？                                                                       | C1 产物来源，C2 规则清单 + occurrence                                   | C0–C2     | `inventory_incomplete`、`subject_mismatch`、`digest_invalid`     |
| Q2  | **重放：** 该 occurrence 能否在运行时规则下被确定性重放？                                                                                              | C3 重放证据                                                             | C2–C3     | `replay_nondeterministic`、`recipe_mismatch`                     |
| Q3  | **四投影：** 该运行在 DAG / Petri / π / 态射上是否健全、反射、重放一致且终态兼容？                                                                     | C5 形式四投影（适用时加 C4 工程准入）                                   | C4–C5     | `projection_incomplete`、`terminal_drift`                        |
| Q4  | **跨 epoch：** schema/epoch 准入是否严格单调，并在边界与业务 occurrence 对齐？                                                                         | C6 跨 epoch + 形式准入                                                  | C6        | `epoch_chain_break`、`admission_non_monotone`                    |
| Q5  | **信任链：** 验证是否由钉死的 verifier 构建执行、处于当前信任根下、人类评审有效、且无吊销/过期？                                                       | C7–C9 证明链                                                            | C0, C7–C9 | `verifier_unpinned`、`revoked`、`review_insufficient`、`expired` |

**Q3 分裂：** 控制面 schema 激活（ADR-0006）要求经 `engineeringAdmission` profile 的 **Q1 + Q2 + 工程 Q3 子集**。产品发布与 `fourProjection` profile 要求**完整形式 Q3**，并按 profile 要求加上 Q4–Q5。

### 6.2 C0–C9 证书链

该链是**有序且可组合的**：后续阶段 MUST 引用更早阶段的 digest。C0 是策略/信任锚；C1–C9 是证据与证明层。

```
C0 Policy + TrustRootSet + theoryBaselineRef
 │
 ├─► C1 ArtifactProvenance (commit, tree, lockfile, toolchain)
 │    │
 │    ├─► C2 RuleInventory + SourceOccurrence
 │    │    │
 │    │    ├─► C3 ReplayEvidence (deterministic recipe)
 │    │    │    │
 │    │    │    ├─► C4 EngineeringAdmissionEvidence (dep/resource/session/structure)
 │    │    │    │    │
 │    │    │    │    └─► C5 FormalFourProjectionCertificate (DAG·Petri·π·Morphism)
 │    │    │    │              │
 │    │    │    │              └─► C6 CrossEpoch + Trajectory + FormalAdmission
 │    │    │    │                        │
 │    │    │    │                        └─► C7 LeanBuildAttestation (proof manifest bridge)
 │    │    │    │                                  │
 │    │    │    │                                  └─► C8 MachineVerificationAttestation
 │    │    │    │                                            │
 │    │    │    │                                            └─► C9 HumanReview + PackageConformanceCertificate
```

| 阶段   | 产物                                                                        | 绑定                                                                    | 理论锚点（信息性）                            |
| ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| **C0** | `VerificationPolicy`、`TrustStore` 版本、`theoryBaselineRef`                | 允许的 profile/范围、信任根、proof-obligations 基线 commit              | 策略门                                        |
| **C1** | `ArtifactProvenanceEvidence`                                                | 不可变源身份                                                            | —                                             |
| **C2** | 封闭的 `RuleInventory` + `SourceOccurrenceEvidence`                         | 可枚举规则；occurrence 前后引用                                         | 完整性门                                      |
| **C3** | `ReplayEvidence`                                                            | 在已声明规则下的确定性重放                                              | CENTRAL-06 对齐                               |
| **C4** | `EngineeringAdmissionEvidence`                                              | 准入主体的操作四视图 digest                                             | 控制面 ADR-0006                               |
| **C5** | `FormalFourProjectionCertificate`                                           | DAG / Petri / π / 态射 + 共享执行 digest                                | CENTRAL-07–10，generic P1a 范围               |
| **C6** | `CrossEpochEvidence`、`CommonTrajectoryEvidence`、`FormalAdmissionEvidence` | epoch 链、轨迹一致、准入扩展                                            | CENTRAL-18 / 跨 epoch 族                      |
| **C7** | `LeanBuildAttestation`                                                      | 钉死的 Lean 工具链 + 证明清单 digest                                    | `proof-obligations.json` 基线                 |
| **C8** | `MachineVerificationAttestation`                                            | 钉死的 `verifierBuild` + `decisionDigest`                               | `@cantilune/conformance` 发布产物             |
| **C9** | `HumanReviewAttestation` + `PackageConformanceCertificate`                  | 法定人数评审 + 密封发布决策                                             | QA-L5 签核                                    |

**PackageConformanceCertificate**（C9 信封）聚合：profile、产物主体、证据根 digest、证明清单 digest、verifier 构建/digest、策略/信任/吊销检查点、机器决策引用、人类评审引用、有效窗口、可选 supersedes 链接，以及四轴状态。

产品自有证书（例如 `@cantilune/comms/conformance` 的 `CommsProductCertificate`）MUST 经包本地生产者嵌入 C2–C5 证据；中央引擎验证结构与 digest 绑定，而不是 comms 特定语义。

### 6.3 Profile 矩阵

Profile 是**有序的**（`PROFILE_RANK`）。持有 profile MUST ≥ 所需 profile。每个 profile MAY 只主张现行 `VerificationPolicy` 允许的范围。

| Profile                    | 秩  | 典型范围            | 最小链                    | 主消费者                             |
| -------------------------- | --- | ------------------- | ------------------------- | ------------------------------------ |
| `operationalProjection`    | 1   | generic             | C0–C3                     | 诊断                                 |
| `completeProjection`       | 2   | generic / reference | C0–C4                     | 部分准入审计                         |
| `engineeringAdmission`     | 3   | generic / reference | C0–C4                     | **控制面 prepare**（ADR-0006）       |
| `fourProjection`           | 3   | reference / product | C0–C5                     | 形式投影发布                         |
| `fixedEpochRule`           | 4   | reference / product | C0–C5                     | 单 epoch 规则闭环                    |
| `crossEpochProduct`        | 5   | reference / product | C0–C6                     | 跨 epoch 准入                        |
| `canonicalProtocol`        | 6   | reference / product | C0–C6 + 产品扩展          | Comms / 协议包                       |
| `canonicalProtocolWithFms` | 7   | reference / product | C0–C6 + FMS 对齐          | π/FMS 对齐的产品                     |
| `fullProductTrajectory`    | 8   | **product**         | C0–C9 完整                | 完整产品发布                         |

**M2 默认策略**（`DEFAULT_VERIFICATION_POLICY`）：`allowedClaimScopes = [generic, reference]`，`minimumProfile = engineeringAdmission`，`requireHumanReview = true`。product 范围与秩 ≥ 6 需要显式策略提升与 QA-L5 评审。

### 6.4 验证引擎契约

公开入口（M2）：

- `createConformanceEngine` — 编排 store/trust/revocation/cache/audit 端口
- `verifyEngineeringAdmissionEvidence` / 已弃用的 `verifyFourViewEvidence` 别名
- `inspectCandidate`、`verifyPackage`、`listMissingEvidence`
- 门禁：`evaluateAdmissionConformanceGate`、`evaluateReleaseConformanceGate`

**返回类型规则：** `Result<VerificationDecision, ConformanceViolation[]>` — 门禁决策禁止仅布尔 API。

**密封消费规则：** 下游系统（控制面、发布自动化）MUST 只接受同时满足以下条件的决策：

- `status.machine === "verified"` 且 `violations.length === 0`
- Profile 匹配门禁（准入用 `engineeringAdmission` 或 `crossEpochProduct`；发布门禁另外要求 `humanReview === "approved"` 且 `release === "accepted"`）
- 决策未按 ADR-0009 过期/吊销

M2 原型对多数产品路径返回 `conditional` / `blocked`；这是预期的。

### 6.5 端口与适配器

| 端口                | 职责                                                |
| ------------------- | --------------------------------------------------- |
| `EvidenceStore`     | 内容寻址证据 blob（不可变 CAS 目标）                |
| `TrustStore`        | 带有效窗口的作用域信任根                            |
| `RevocationStore`   | 证书与检查点吊销                                    |
| `VerificationCache` | 以证据根 + 策略 + verifier 构建为键                 |
| `AuditSink`         | 只追加的验证审计尾                                  |

内存适配器随 M2 交付；文件/耐久 CAS 仍为 **open**（S4 的 Stop-Ship）。

### 6.6 产品包义务（post-FCP，按包）

每个真实包（Cantilune、Libretto、Cast、Baton、Cue、Chorus、Reprise、Cantilune Notation）MUST 提供：

1. `ConformanceTargetManifest` + 封闭的 `RuleInventory`
2. 填满 C2–C5 的按规则证据（以及 profile 要求的 C6+）
3. 运行时操作事实（资源/会话、授权、公平性、ε）——不能从包名推断
4. 领域特定时在 `src/conformance/` 下的产品本地符合性模块（模式：`@cantilune/comms/conformance`）
5. L5–L7 测试：篡改语料、否定契约、pack CLI smoke

当前否定发现见 `docs/research/0008-product-package-certificate-audit-2026-07-26.md`（尚无生产包居民）。

## 7. 评测 harness 交接

RFC-0001 §8 定义五条**可证伪优越性主张**（C1 表达力、C2 步数有界可预知性、C3 控制面精简度、C4 工程精简度、C5 可观测性即结构），在公开基准主张之前需要评测 harness。**注意：** 按 RFC-0004 §1，C4 已从「可观测性即结构」改定义为「工程精简度」；可观测性即结构现为 C5。评测命名空间 `evaluation.c1`–`evaluation.c5` 与详细主张定义见 RFC-0004。

**边界：**

| 关切                                              | 所属模块                                                                        | 本 RFC           |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| 证据正确性、证书链、发布门禁                      | `@cantilune/conformance`                                                        | **范围内**       |
| 基线比较运行、指标收集、基准可证伪性              | **RFC-0004** + **ADR-0011**（不是 ADR-0005 可观测性读边界）                     | **仅交接**       |

**交接契约：**

1. 评测 harness 在把基准结果归因到产品版本之前，MUST 消费**密封 C9 `PackageConformanceCertificate`**（或等价发布决策）。
2. 符合性 MUST NOT 嵌入基准逻辑或发出优越性主张。
3. 评测 harness MUST 在每一行已发布指标旁记录：产物主体、verifier 构建、策略版本与证据根 digest。
4. RFC-0001 §8 主张在独立评审法定人数 + 冻结协议（RFC-0004）之前仍为 **unverified**。ADR-0011 为 Accepted；E1–E6 已工程落地 —— **不是**公开主张 Acceptance。

**下一产物：** RFC-0004（草案）+ ADR-0011（Accepted）。评测主张保持命名空间 `evaluation.c1`–`evaluation.c5`；符合性仍为 C0–C9。

## 8. 安全 / 正确性含义

- 产品符合性在接到控制面或发布自动化时是**信任边界**（S4）。
- 威胁模型：**ADR-0010**（STRIDE 映射到符合性模块）。
- 信任生命周期：**ADR-0009**（根、吊销、法定人数、缓存失效、verifier 钉扎）。
- 无论测试通过率如何，M2 原型 MUST NOT 被描述为生产就绪。

## 9. 测试 / QA 计划

| 层级  | 范围                                                                                     | 状态                                                              |
| ----- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| L2–L4 | digest 绑定、清单完整性、工程准入验证器的单元/契约测试                                   | 部分（仓库内）                                                    |
| L5    | 形式 + 安全 + QA-L5 评审                                                                 | Owner 签字 COI 2026-08-16 — `docs/qa/conformance-l5-review-checklist.md` |
| L6    | 与控制面 prepare/commit 否定路径的集成                                                   | 部分                                                              |
| L7    | 篡改语料、fuzz、mutation、崩溃恢复、pack CLI                                             | 已工程落地（见 `@cantilune/conformance` DESIGN-CLOSURE）          |
| CI    | 带 SBOM/来源的专用符合性工作流                                                           | 已工程落地（`.github/workflows/conformance.yml`；不自动签）       |

## 10. 兼容性 / 迁移

- 已弃用的 `FourViewEvidence*` 别名保留到控制面 harness 完成命名迁移。
- 新代码 MUST 显式使用 `EngineeringAdmissionEvidence` vs `FormalFourProjectionCertificate`。
- 策略版本上调会使验证缓存条目失效（ADR-0009）。

## 11. 开放问题

1. **人类评审法定人数：** 最低角色与独立性规则（ADR-0009 已提案；需 FCP 决议）。
2. **文件/耐久证据 CAS：** 单写者布局 vs 共享对象存储（实现 ADR 后续）。
3. **外部签名工具：** HSM vs sigstore vs 人工法定人数（M3+）。
4. **Lean 桥自动化：** 由 CI 生成证明 vs 人工上传（M3+）。
5. **产品符合性 RFC/ADR 的第二评审人指派** — **已关闭。** 不设第二评审人。DRI / Formal / QA-L5 / Security = Joker-of-Gotham（Owner COI，2026-08-16）。

## 12. FCP 摘要（2026-08-16 已开启）

**已进入。** Owner 于 2026-08-16 开启 FCP（至 2026-08-30）。这不是 RFC Accepted。Formal + Security + QA-L5 为 Owner 签字并披露 COI；独立性项已弃权。Lean 内核为 `proved / Owner-accepted`（promotion 未走）。`@cantilune/conformance` 为 0.x 生产发布权限（SS-01 已解除）。Release cert 不自动签。见 `docs/governance/fcp-entry-2026-08-16.md`。

## 13. 决策记录

- **Triage：** 按研究 0018 / RFC-0002 §7.1，产品符合性与核心理论分离。
- **RFC 状态：** FCP 于 2026-08-16 开启（至 2026-08-30）；尚未 Accepted。
- **实现状态：** `@cantilune/conformance` 为 0.x 生产发布权限（Owner 2026-08-16）。仍不自动签 Acceptance cert。

## 14. 实现 / ADR 跟踪

| 产物                                 | 状态                                                            | 阻塞               |
| ------------------------------------ | --------------------------------------------------------------- | ------------------ |
| ADR-0009 符合性信任生命周期          | **Accepted**（M2–M3 工程范围；Owner COI 2026-08-16）            | S4 闭环            |
| ADR-0010 符合性威胁模型              | **Accepted**（M2–M3 工程范围；Owner COI 2026-08-16）            | S4 闭环            |
| QA-L5 清单                           | Owner 签字 COI 2026-08-16；独立性弃权；SS-01 已解除             | FCP 关闭           |
| 不可变证据 CAS                       | 已工程落地（file）                                              | S4                 |
| Verified/Reviewed 密封类型           | 已工程落地                                                      | S4                 |
| 评测 harness RFC-0004 + ADR-0011     | RFC FCP；ADR Accepted；E1–E8 已工程落地；Owner COI 公开主张     | 公开主张           |

## 下一步

| 行动                               | 负责人                            | 到期/评审 | 权威链接                                     |
| ---------------------------------- | --------------------------------- | --------- | -------------------------------------------- |
| QA-L5 Owner 签字 COI               | Joker-of-Gotham                   | 2026-08-16 已完成 | `docs/qa/conformance-l5-review-checklist.md` |
| Accept ADR-0009 / ADR-0010         | DRI + Security（Owner COI）       | 已完成      | `docs/adr/0009-*`、`docs/adr/0010-*`         |
| 文件耐久证据存储                   | 工程                              | 已完成（file） | `@cantilune/conformance` 端口             |
| FCP 评论期                         | 决策负责人                        | 2026-08-30  | `docs/governance/fcp-entry-2026-08-16.md`    |
