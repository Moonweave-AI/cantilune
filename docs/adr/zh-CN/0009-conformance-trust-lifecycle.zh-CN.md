# ADR-0009：符合性信任生命周期与密封决策消费

| 字段           | 值                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted**（已接受）（M2–M3 工程范围 —— 信任端口已搭建；持久化 CAS、外部签署与非 DRI 评审 **pending**（待完成））                                                         |
| Date           | 2026-08-11                                                                                                                                                                  |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                                                       |
| Reviewers      | Joker-of-Gotham（DRI 临时安全 + 形式）；FCP 之前须进行外部独立评审 —— 见 `docs/governance/reviewer-assignments.md`                                                          |
| Related        | RFC-0003、ADR-0010、ADR-0006、ADR-0007、`@cantilune/conformance`、`@cantilune/control-plane`、`formal/proof-obligations.json`、`docs/qa/conformance-l5-review-checklist.md` |

## 背景

RFC-0003 定义了 C0–C9 证书链与五个符合性问题。ADR-0006 将 control-plane 的 schema 激活绑定到四视图证据验证。若无显式的信任生命周期规则，M2 中仍存在以下缺口：

- 仅内存的 trust/revocation/cache 适配器，无持久化检查点语义
- 无不可伪造的密封决策类型（`Verified*` / `Reviewed*` 仍 OPEN）
- 人工评审工作流未规定（quorum、COI、冲突处理）
- 验证器构建钉扎存在于类型中，但未作为轮换策略强制执行
- 若 cache 键省略 policy/revocation generation，control-plane 理论上可能消费过期的缓存决策

本 ADR 记录 `@cantilune/conformance` 及其下游消费者的**信任根、证书生命周期、吊销、人工评审 quorum、缓存失效、验证器构建钉扎与密封决策消费**规则。

威胁主体与 STRIDE 映射见 **ADR-0010**。本 ADR 陈述**生命周期不变量与消费契约**。

## 决策

将符合性信任实现为一条 **不可变证据 CAS + 版本化信任策略 + 单调吊销检查点 + 钉扎验证器证明 + quorum 人工评审 → 密封发布决策**流水线。Control-plane 与发布自动化**仅**可通过下述密封消费契约消费符合性输出。

### 信任根（C0）

| 规则 | 详情                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------- |
| TR-1 | `TrustStore` 条目携带 `keyId`、有范围的 `publicKey`、`scope[]`、`notBefore`、`expiresAt`       |
| TR-2 | 验证器 MUST 拒绝在根范围或有效窗口之外签署的证明                                               |
| TR-3 | `trustRootSetVersion` MUST 出现在每个 `PackageConformanceCertificate` 与缓存键中               |
| TR-4 | 信任根轮换为 **append-only**（仅追加）：新版本添加根；旧根在显式过期前保持有效（不得静默移除） |
| TR-5 | M2：仅内存信任 store；生产环境需要持久化信任清单 + CI 验证（**OPEN**）                         |

### 证书生命周期（C1–C9）

```
draft manifest → evidence assembly → machine verify (C8) → human review (C9) → issued certificate
                                                      ↓                                    ↓
                                              blocked / invalid                   active → superseded / expired / revoked
```

| 阶段       | 状态迁移                                             | 确保                      |
| ---------- | ---------------------------------------------------- | ------------------------- |
| Candidate  | `machine: candidate`、`release: notEvaluated`        | 仅检视；不可消费          |
| 机器已验证 | `machine: verified`、`humanReview: pending`          | C0–C8 通过；违规为空      |
| 人工已评审 | `humanReview: approved \| rejected \| conflict`      | 见下文 quorum 规则        |
| 已发布     | `release: accepted`（要求 approved 且未过期/未吊销） | C9 已密封                 |
| 终态       | `release: superseded \| expired \| revoked`          | 无新证书则永不再 accepted |

**不可变性：** 已颁发证书内容（摘要、主体、profile、验证器构建）不可变。变更需以 `supersedes` 指向先前 `certificateId` 的新证书。

**有效窗口：** 在消费时强制 `notBefore` / `expiresAt`。过期证书迁移至 `release: expired`，不追溯修改审计历史。

### 吊销

| 规则 | 详情                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------- |
| RV-1 | `RevocationStore` 记录 `CertificateRevocationRecord { certificateId, revokedAt, reason, checkpoint }` |
| RV-2 | `revocationCheckpoint` 为单调；消费者 MUST 追踪已见最新检查点                                         |
| RV-3 | 吊销查询 MUST 先于缓存命中与门禁评估                                                                  |
| RV-4 | 吊销 C8 使依赖的 C9 无效；吊销信任根版本使该版本下所有证明无效                                        |
| RV-5 | M2：内存吊销 store；持久化吊销日志 **OPEN**                                                           |

### 人工评审 quorum

| 规则 | 详情                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| HR-1 | 默认策略：对所有超出 diagnostic inspect 的范围 `requireHumanReview: true`                                                  |
| HR-2 | **最小 quorum（提议 M3）：** `product` 范围 ≥2 名独立评审人；`reference` 范围在 rank ≥ `fourProjection` 时 ≥1 名独立评审人 |
| HR-3 | 评审人 MUST NOT 是证书提议者、单独的包 owner DRI，或同一变更的验证器实现者（COI —— 与 ADR-0006 职责分离镜像）              |
| HR-4 | `HumanReviewAttestation` 绑定 `machineDecisionRef`、`reviewerId`、`roles[]`、`decision`、`reviewedAt`                      |
| HR-5 | 冲突证明（`decision: conflict`）阻塞发布（`release: blocked`），直至新一轮评审解决                                         |
| HR-6 | Agent/自动化评审不满足人工评审轴                                                                                           |
| HR-7 | M2：quorum 未在代码中强制执行；L5 checklist 关闭前对 S4 为 **Stop-Ship**                                                   |

**评审人角色（信息性）：** formal-mathematics、process-semantics、security/threat-model、package-owner（对自有包非投票）。

### 缓存失效

| 缓存键组件                                 | 失效触发器                             |
| ------------------------------------------ | -------------------------------------- |
| `evidenceRootDigest`                       | 任何证据 blob 变更                     |
| `policyDigest` / `policyVersion`           | 策略提升或范围变更                     |
| `trustRootSetVersion`                      | 信任根轮换                             |
| `revocationCheckpoint`                     | 任何吊销追加                           |
| `verifierBuild` + `verifierArtifactDigest` | 验证器发布或重建                       |
| `theoryBaselineRef`                        | 新的 `proof-obligations.json` 基线提交 |

**规则 CA-1：** 缓存条目 MUST NOT 在任一键组件失效后存续。
**规则 CA-2：** 正向缓存命中 MUST 仍在消费时重新检查吊销检查点与过期（TOCTOU 缓解 —— 见 ADR-0010）。
**规则 CA-3：** M2 `MemoryVerificationCache` 通过 `cacheKeyString` 实现键字符串化；持久化缓存 **OPEN**。

### 验证器构建钉扎

| 规则 | 详情                                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| VB-1 | 每条机器证明记录 `verifierBuild`（semver + commit）与 `verifierArtifactDigest`                |
| VB-2 | 策略 MAY 维护一个验证器构建允许列表；M2 默认：单一构建 `ENGINEERING_ADMISSION_VERIFIER_BUILD` |
| VB-3 | CI MUST 在 npm pack smoke 旁发布验证器 artifact 摘要                                          |
| VB-4 | 验证器升级要求：新摘要、回归语料通过、策略版本提升、缓存刷新                                  |
| VB-5 | 当策略要求时，control-plane MUST 拒绝由未知或已弃用验证器构建验证的证据                       |

### control-plane 的密封决策消费

control-plane（`@cantilune/control-plane`）仅在 **prepare admission** 时通过以下路径消费符合性：

```
ConformanceEngine.verifyEngineeringAdmission(...)
  → VerificationDecision
  → evaluateAdmissionConformanceGate(decision)
  → "conditional" | "blocked"
```

**消费契约（对 control-plane 接线有约束力）：**

| 门禁              | 要求                                                                                                                                 | MUST NOT                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Prepare admission | `profile ∈ {engineeringAdmission, crossEpochProduct}`；`machine === verified`；`violations.length === 0`；主体绑定匹配；新鲜吊销检查 | 当要求 engineering admission 时接受仅有形式 C5 而无 C4 |
| Commit admission  | 先前 prepare + 授权角色（ADR-0006）                                                                                                  | 不经服务端 bundle fetch 而从客户端提供的摘要重新验证   |
| Release / fleet   | `evaluateReleaseConformanceGate → accepted`                                                                                          | 将 `conditional` 当作 accepted                         |

**密封类型目标（OPEN）：** 一旦实现，将原始 `VerificationDecision` 透传替换为不可伪造的 `VerifiedAdmissionDecision` / `ReviewedReleaseDecision` brand。在此之前，门禁 MUST 使用引擎入口点 —— 而非调用者构造的决策对象。

**可观察性边界：** 可观察性读取 admission 回执与验证审计事件；它不执行符合性验证（ADR-0005 模式）。

## 已实现的缓解措施（M2 脚手架）

| 能力                                                                  | 状态    |
| --------------------------------------------------------------------- | ------- |
| 端口接口：trust、revocation、cache、audit、evidence store             | ✅      |
| 内存适配器                                                            | ✅      |
| 证书 schema 上的 `trustRootSetVersion`、`revocationCheckpoint` 字段   | ✅      |
| 机器证明上的 `verifierBuild` + engineering verifier 常量              | ✅      |
| 缓存键包含 evidence root + profile                                    | ✅ 部分 |
| `evaluateAdmissionConformanceGate` / `evaluateReleaseConformanceGate` | ✅      |
| Quorum 强制执行、持久化 store、密封类型、外部签署                     | ❌ OPEN |

## 残余风险

| 风险                                       | 状态     | 备注                       |
| ------------------------------------------ | -------- | -------------------------- |
| 仅内存的 trust/revocation 在进程重启后存续 | **OPEN** | 对 S4 为 Stop-Ship         |
| 无密封决策类型 —— 通过伪造决策对象绕过门禁 | **OPEN** | ADR-0010 T-CP-1 缓解计划中 |
| Quorum 未在代码中强制执行                  | **OPEN** | HR-7                       |
| 外部安全非 DRI 签署                        | **OPEN** | Pre-FCP                    |
| Lean 证明人工/CI 缺口                      | **OPEN** | C7 桥接                    |

## 后果

**正面**

- 显式生命周期分离机器、人工与发布三个轴
- Control-plane 消费契约与 ADR-0006 证据绑定对齐
- 缓存/吊销/检查点模型支持 TOCTOU 缓解路径

**负面**

- M2 操作员必须将符合性视为原型，无论单元测试是否通过
- Quorum 与持久化 CAS 在 S4 闭合时增加运维开销
- 验证器钉扎要求 `@cantilune/conformance` 自身具备发布纪律

## 考虑过的备选方案

| 选项                                   | 被否决的原因                  |
| -------------------------------------- | ----------------------------- |
| 单一布尔值 `conformant: true`          | 坍缩四个状态轴；RFC-0003 禁止 |
| 对 product 范围采用 trust-on-first-use | reference→product 升级风险    |
| 无信任 store 的客户端提供评审证明      | 可伪造的人工评审轴            |
| 无限缓存 TTL                           | TOCTOU + 吊销滞后             |
| Control-plane 重新实现验证             | 逻辑重复；与符合性模块漂移    |

## 实现任务

- [x] trust/revocation/cache/audit 端口定义
- [x] 内存适配器
- [x] 证书 schema 生命周期字段
- [x] admission/release 门禁评估器
- [ ] 持久化 evidence + revocation CAS
- [ ] 人工评审工作流中的 quorum 强制执行
- [ ] `Verified*` / `Reviewed*` 密封决策类型
- [ ] 外部签署工具集成
- [ ] 针对消费契约的 control-plane 接线审计
- [ ] 独立安全 + QA-L5 评审（review-pending）

## 批准

**DRI 签署**：Joker-of-Gotham
**安全 / 形式评审**：Joker-of-Gotham（临时，已披露 COI）—— 外部评审人 pending FCP
**日期**：2026-08-11
