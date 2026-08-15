# Conformance Design Closure (M2 — security-hardened prototype)

**Status**: M2 工程原型 + Stop-Ship 安全加固已落地 — **NOT** production release authority until QA-L5 human sign-off  
**QA tier**: L1–L7 + mutation gated in CI；独立 Formal/Security/QA-L5 签核 **review-pending**

## 用户摘要（简体中文）

`@cantilune/conformance` 已按评审结论完成 Stop-Ship 工程加固与本轮闭包项：

- 生产 API **不再**导出自审批 helper（`@cantilune/conformance/testing` 仅供 harness）
- prepare 门禁消费 **签名** `SignedHumanReviewAttestation` + TrustStore 验证
- `verifyPackage` 必须提供 EvidenceStore 中真实 artifact digest，禁止空 inventory 自报 verified
- 四投影 / canonical protocol 必须完整语义证据；Lean attestation v2 绑定 git/toolchain/signature
- release gate 只接受 `ReviewedDecision` + `PackageConformanceCertificate`
- CAS：atomic write + file lock + get/has 复算 digest；decision log hash chain
- profile 改为 evidence requirement set（非整数 rank）
- **DPO replay**：`recipe-chain:sha256:` 绑定 durable `ReplayRecipe` 链；`computeDpoReplayExecutionDigest` 绑定 changeCount/endpoints
- **diagrams/06-conformance/** 八视图（06A–06H）
- **CI formal-manifest**：manifest 结构 + evidence SHA-256 + Lean `CentralManifestSymbols` clean build
- **覆盖率**：实测 **94.93%** lines/statements、**92.37%** branches、**100%** functions（175 tests）；CI 门槛 **94/92/95/94**（branches 受 sealed 守卫 throw 与 file/runtime 集成路径制约，目标 95% 下一迭代）
- **发布联动**：`conformance-release` job 依赖可复用 `formal.yml` **proved** gate（4h）+ `verify:release-gate`（manifest + provenance gitCommit + SBOM）

**仍不可**作为生产 admission / formal conformance / release authority，直至 QA-L5 清单人工签核。

## Closed (engineering)

- [x] Stop-Ship 1–6（见上轮）
- [x] DPO recipeRef 深度绑定（canonical chain digest + runtime port 校验）
- [x] diagrams/06-conformance/ 八视图
- [x] CI formal job：manifest 校验 + Lean CentralManifestSymbols clean build
- [x] vitest coverage thresholds（94/92/95/94；实测 lines 94.93%）
- [x] formal.yml `workflow_call` + conformance `formal-proved` / `conformance-release` 发布流水线
- [x] `verify:release-gate` + provenance `formalManifestDigest` 绑定
- [x] L2 package-exports 契约测试
- [x] 175 tests pass

## Open (human / fleet ops)

- [ ] QA-L5 独立 Formal + Security 签核（`docs/qa/conformance-l5-review-checklist.md`）
- [ ] 外部 HSM 签名工具部署（私钥不进 verifier 包）
- [ ] branch coverage 95%+（当前 ~92.4%，需 sealed/file 集成补测或 istanbul 精化 exclude）
- [ ] lines/statements 95%+ CI 硬门槛（当前 94.93%）

## Governance references

| Document                                                                          | Role                            |
| --------------------------------------------------------------------------------- | ------------------------------- |
| [Trust rotation runbook](../../../docs/runbooks/conformance-trust-rotation.md)    | Operational rotation + CI gates |
| [RFC-0003 Product Conformance](../../../docs/rfc/0003-product-conformance.md)     | C0–C9 chain, profiles           |
| [ADR-0009 Trust lifecycle](../../../docs/adr/0009-conformance-trust-lifecycle.md) | Sealed decision consumption     |
| [QA-L5 checklist](../../../docs/qa/conformance-l5-review-checklist.md)            | Stop-Ship criteria              |
| [diagrams/06-conformance/](../../../diagrams/06-conformance/)                     | 八视图工程语义                  |
