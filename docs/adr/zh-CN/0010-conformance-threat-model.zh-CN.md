# ADR-0010：符合性威胁模型与验证边界

| 字段           | 值                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Status         | **Accepted**                                                                                                                         |
| Date           | 2026-08-11                                                                                                                           |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                |
| Reviewers      | Joker-of-Gotham（Architecture + Security；COI 已披露，2026-08-16）                                                                   |
| Related        | RFC-0003、ADR-0009、ADR-0006、ADR-0007、ADR-0003、`@cantilune/conformance`、`@cantilune/control-plane`、`diagrams/04-control-plane/` |

## 背景

RFC-0003 将 Product Conformance 确立为一个 S4 信任边界，当其接通 control-plane 激活或产品发布时生效。ADR-0009 定义信任生命周期规则。在将 `@cantilune/conformance` 视为超出 M2 原型之前，需要一个符合性专用的威胁模型 —— 与 ADR-0003（runtime）和 ADR-0007（control-plane）类似。

Stop-Ship 评审（2026-08-11）识别出符合性相关风险：摘要伪造、隐藏规则清单、reference→product 范围升级、缓存投毒、验证 TOCTOU、评审人利益冲突，以及签名密钥范围扩展。

## 威胁主体与资产

| 主体                     | 能力                              | 主要资产                       |
| ------------------------ | --------------------------------- | ------------------------------ |
| 外部证据提交者           | 提供 manifest、bundle、证书 JSON  | 证据 store、验证决策           |
| 被攻陷的包 owner         | 省略规则、夸大范围、自证评审      | 规则清单、声称范围、人工评审轴 |
| 被攻陷的 CI / 构建流水线 | 替换 artifact、未钉扎验证器       | 验证器构建摘要、SBOM/溯源      |
| 恶意下游消费者           | 在 control-plane 重放过期缓存决策 | 激活门禁完整性                 |
| 有 COI 的评审人          | 自我批准或无 quorum 批准          | 人工评审证明                   |
| 信任操作员               | 不当地轮换或扩展密钥范围          | 信任根集合、签名密钥           |
| 存储故障注入器           | 部分证据写入、过期缓存持久化      | 证据 CAS、缓存、吊销日志       |

## 信任边界

```
Untrusted manifest/bundle ──► policy scope check ──► inventory completeness gate
                                      │
EvidenceStore fetch ◄── digest verify ──► envelope verifier
                                      │
TrustStore + RevocationStore ◄── checkpoint ──► verification engine
                                      │
VerificationCache (key = f(evidence, policy, trust, verifier, checkpoint))
                                      │
VerificationDecision ──► admission/release gate ──► control-plane prepare (ADR-0006)
```

| 边界       | 规则                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| Ingress    | Manifest 的 `claimScope` 与 `requestedProfile` 在验证前对照 `VerificationPolicy` 检查 |
| Evidence   | 对 canonical JSON 计算 SHA-256 摘要；验证器侧无摘要填充                               |
| 主体绑定   | Bundle 主体 MUST 匹配 admission 主体（域、epoch、plan digest、head）                  |
| Inventory  | 闭规则集：无缺失、多余或重复的规则 ID                                                 |
| Cache      | 键包含吊销检查点；消费时重新检查吊销 + 过期                                           |
| Output     | 门禁仅消费引擎输出；无调用者伪造的 `VerificationDecision`（在密封类型落地之前）       |
| Downstream | Control-plane 不变更符合性状态轴                                                      |

## STRIDE 分析

### S — 欺骗（Spoofing）

| ID    | 威胁                               | 缓解措施                                                             | 模块 / 状态                     |
| ----- | ---------------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| T-S-1 | 伪造的人工评审证明                 | TrustStore 范围密钥；HR-3 COI 规则（ADR-0009）；外部签署工具（OPEN） | `ports/trustStore`、证明 schema |
| T-S-2 | 欺骗的包溯源（错误的 commit/tree） | C1 `ArtifactProvenanceEvidence` 摘要绑定；CI 溯源（OPEN）            | `evidenceFamilies`、CI          |
| T-S-3 | 证明中冒充的评审人 ID              | 按角色的信任根范围；quorum 强制执行（OPEN）                          | ADR-0009 HR-*                   |

### T — 篡改（Tampering）

| ID    | 威胁                                                          | 缓解措施                                                                | 模块 / 状态                                                      |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| T-T-1 | **伪造摘要** —— 看似合法的 SHA-256 并非基于 canonical content | `computeEvidenceDigest` + `assertSha256HexDigest`；信封验证器拒绝不匹配 | `canonical/evidenceDigest.ts`、`verifier/envelopeVerifier.ts` ✅ |
| T-T-2 | **隐藏规则** —— 在声称完整性的同时从清单中省略规则            | `verifyRuleInventoryCompleteness`（缺失/多余/重复）                     | `verifier/inventoryVerifier.ts` ✅                               |
| T-T-3 | 机器验证后证据 blob 替换                                      | 不可变证据 CAS + 内容寻址 fetch（内存 ✅；持久化 OPEN）                 | `ports/evidenceStore`                                            |
| T-T-4 | 颁发后篡改证书                                                | 不可变证书记录；仅通过 `supersedes` 变更                                | `certificate/packageConformanceCertificate.ts` ✅ schema         |

### R — 否认（Repudiation）

| ID    | 威胁             | 缓解措施                                                               | 模块 / 状态               |
| ----- | ---------------- | ---------------------------------------------------------------------- | ------------------------- |
| T-R-1 | 否认验证运行发生 | `AuditSink` append-only 事件，含 runId、profile、digest                | `ports/auditSink` ✅ 内存 |
| T-R-2 | 否认人工评审决策 | 已签署的 `HumanReviewAttestation` + 与 `machineDecisionRef` 的审计关联 | 证明 schema；签署 OPEN    |

### I — 信息泄露（Information disclosure）

| ID    | 威胁                     | 缓解措施                                                                | 模块 / 状态 |
| ----- | ------------------------ | ----------------------------------------------------------------------- | ----------- |
| T-I-1 | 通过仓库泄露签名密钥     | 密钥 NOT 存放于 `@cantilune/conformance`；仅外部工具（RFC-0003 非目标） | policy ✅   |
| T-I-2 | 缓存侧信道泄露未发布证据 | 缓存范围限于验证服务；无公开缓存 API                                    | engine ✅   |

### D — 拒绝服务（Denial of service）

| ID    | 威胁                     | 缓解措施                                                | 模块 / 状态                       |
| ----- | ------------------------ | ------------------------------------------------------- | --------------------------------- |
| T-D-1 | 超大规则清单 / 证据 blob | `VerificationPolicy` 中的 `maxRuleCount`（默认 10_000） | `policy/verificationPolicy.ts` ✅ |
| T-D-2 | 重复验证上的缓存踩踏     | 带键命中的验证缓存                                      | `ports/verificationCache` ✅      |
| T-D-3 | 吊销列表膨胀             | 检查点单调性；索引查找（持久化 OPEN）                   | ADR-0009 RV-*                     |

### E — 权限提升（Elevation of privilege）

| ID    | 威胁                                                                 | 缓解措施                                                             | 模块 / 状态                                                          |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| T-E-1 | **reference→product 升级** —— 将 reference 见证当作 product 证明引用 | `policyAllowsScope`；默认策略阻塞 `product`；`scope_escalation` 违规 | `policy/verificationPolicy.ts`、engine ✅                            |
| T-E-2 | **profile 不足** —— 较低 profile 满足较高门禁                        | `profilePermits` rank 检查；admission 门禁 profile 白名单            | `foundation/conformanceProfile.ts`、`admissionConformanceGate.ts` ✅ |
| T-E-3 | **密钥范围扩展** —— 信任根用于声明的范围之外                         | 对 `TrustStore.getRoots(scope)` 的 TR-2 范围过滤                     | `ports/trustStore.ts` ✅ interface                                   |
| T-E-4 | 将工程 admission 当作完整四投影发布                                  | 分离 profile；发布门禁要求更高 rank + 人工评审                       | `releaseConformanceGate.ts` ✅                                       |
| T-E-5 | 用手工构造的决策对象绕过门禁                                         | 密封决策类型（OPEN）；门禁记录仅引擎入口                             | ADR-0009 消费契约                                                    |

### 横切 —— 缓存投毒与 TOCTOU

| ID    | 威胁                                                            | 缓解措施                                                                             | 模块 / 状态                                |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| T-X-1 | **缓存投毒** —— 证据/策略/吊销变更后过期的正向结果              | 缓存键包含策略、信任版本、验证器构建、检查点（ADR-0009 CA-*）；轮换时刷新            | `verificationCache`、engine 部分 ✅        |
| T-X-2 | **TOCTOU** —— 验证通过后在 control-plane prepare 之前证据被吊销 | 在门禁消费时重新检查 `revocationCheckpoint` + 过期；无检查点则无长效 "verified" 令牌 | ADR-0009 CA-2；control-plane 接线审计 OPEN |
| T-X-3 | **评审人 COI** —— DRI 自我批准 product 证书                     | HR-3 独立性；治理 reviewer-assignments COI 披露；非 DRI quorum（OPEN）               | 治理 + ADR-0009                            |
| T-X-4 | 脑裂：机器在策略 A 下验证，在策略 B 下消费                      | `policyDigest` 绑定于证书与缓存键                                                    | 证书 schema ✅                             |

## 权限矩阵（符合性模块）

| 操作                               | 要求                                                          | 确保                                 |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `inspectCandidate`                 | 合法 manifest schema                                          | 无机器验证状态                       |
| `verifyEngineeringAdmission`       | 策略允许范围 + profile；完整 bundle；主体匹配                 | `machine: verified` 或结构化违规     |
| `verifyPackage`（形式路径）        | 更高 profile + C5 证据                                        | 形式投影检查（M2 脚手架）            |
| `evaluateAdmissionConformanceGate` | `engineeringAdmission` 或 `crossEpochProduct`；已验证；零违规 | `conditional`（人工/发布仍 pending） |
| `evaluateReleaseConformanceGate`   | `humanReview: approved`；`release: accepted`                  | 仅下游发布                           |
| 缓存读取                           | 合法键 + 新鲜吊销检查                                         | 缓存决策或未命中                     |
| 信任根使用                         | 范围 + 有效窗口                                               | 签名验证（当签署落地时）             |

策略省略时的默认值：**`DEFAULT_VERIFICATION_POLICY`** —— 范围仅 `[generic, reference]`；**`requireHumanReview: true`**。

## 已实现的缓解措施（2026-08-11）

| 阻塞项                 | 缓解措施                                               |
| ---------------------- | ------------------------------------------------------ |
| 伪造摘要               | canonical JSON + SHA-256；严格十六进制校验             |
| 隐藏规则               | 清单完整性验证器                                       |
| reference→product 升级 | 策略范围门禁 + `scope_escalation` 违规                 |
| profile 绕过           | rank + admission 门禁 profile 白名单                   |
| 主体替换               | `admissionSubjectsMatch` / engineering 验证器绑定      |
| 仅布尔 API             | `Result<VerificationDecision, ConformanceViolation[]>` |
| 工程/形式混淆          | 分离类型 + profile；弃用别名隔离                       |

## 残余风险

| 风险                              | 状态 | 记录 |
| --------------------------------- | ---- | ---- |
| 持久化重启下的缓存投毒            | File 适配器 + 检查点重检 | ADR-0009 |
| control-plane prepare 处的 TOCTOU | 密封决策类型 + 消费契约 | ADR-0009 |
| 评审人 COI                        | Owner COI；独立性已 waived（2026-08-16） | FCP 条目 |
| 无 HSM                            | 生产策略；不自动签 cert | FCP 条目 |
| 独立安全签署                      | Owner 兼任 Security；不设第二评审人 | FCP 条目 |
| 四投影 digest                     | C5 从已提交世界视图重算 | conformance |
| 篡改 / soak 证据                  | 8h soak + L7 | QA soak 证据 |

**M2 范围之外（对 core/runtime 原型非 Stop-Ship）：**

| 项目              | 原因                       |
| ----------------- | -------------------------- |
| 网络化证据 CDN    | M2 足够本地/引擎本地 store |
| 多租户信任域      | 未来 fleet ADR             |
| TS 中 Lean 重验证 | 显式非目标（RFC-0003）     |

## 后果

**正面**

- 符合性威胁映射到具体模块缓解措施
- 与 runtime（ADR-0003）和 control-plane（ADR-0007）威胁模型系列对齐
- S4 闭合的 Stop-Ship 标准明确

**负面**

- 若干缓解措施仍仅为脚手架（内存 store、无 quorum 代码）
- 完整投影验证尚未承重
- FCP 前仍需外部安全评审

## 考虑过的备选方案

| 选项                             | 被否决的原因                      |
| -------------------------------- | --------------------------------- |
| 复用 ADR-0007 作为符合性威胁模型 | 资产不同（证据链 vs catalog CAS） |
| 将测试通过当作符合性             | 违反四轴分离                      |
| 可选清单检查                     | 隐藏规则攻击面                    |
| 无键绑定的公开缓存               | 缓存投毒                          |

## 实现任务

- [x] 摘要 + 清单 + 范围 + profile 门禁
- [x] 工程 admission 验证器上的主体绑定
- [x] admission/release 门禁评估器
- [x] 威胁模型 ADR（本文档）
- [ ] 持久化证据 CAS + 篡改语料
- [ ] 密封决策类型
- [ ] control-plane 消费审计
- [ ] 验证器上的 L7 fuzz/变异
- [ ] 外部安全评审人 Accept

## 批准

**DRI 签署**：Joker-of-Gotham
**安全评审**：Joker-of-Gotham（临时，已披露 COI）—— 外部评审人 pending FCP
**日期**：2026-08-11
