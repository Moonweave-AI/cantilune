# Conformance Design Closure

**Status**: `@cantilune/conformance` is **0.x production release authority** (Owner 2026-08-16; SS-01 lifted). SemVer remains 0.x. Release Acceptance certificates are **not** auto-signed (production policy).  
**QA tier**: L1–L7 + mutation gated in CI；Formal / Security / QA-L5 为 Owner 签字并披露 COI（不设第二评审人；独立性项 waived）

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
- **覆盖率**：statements/functions/lines ≥90%、branches ≥88%（包内 vitest 门槛）
- **发布联动**：`conformance-release` job 依赖可复用 `formal.yml` **proved** gate + `verify:release-gate`（manifest + provenance gitCommit + SBOM）；**禁止**自动签署 release certificate

Owner 于 2026-08-16 批准本包为 0.x **生产发布权限**。无 HSM、不自动签 Acceptance cert 是已满足的生产策略，不是剩余缺口。Lean 义务行保持 `proved`；`ownerAccept` 另记。

## Closed (engineering + Owner grant)

- [x] Stop-Ship 1–6（见上轮）
- [x] DPO recipeRef 深度绑定（canonical chain digest + runtime port 校验）
- [x] diagrams/06-conformance/ 八视图
- [x] CI formal job：manifest 校验 + Lean CentralManifestSymbols clean build
- [x] vitest coverage thresholds
- [x] formal.yml `workflow_call` + conformance `formal-proved` / `conformance-release` 发布流水线
- [x] `verify:release-gate` + provenance `formalManifestDigest` 绑定
- [x] L2 package-exports 契约测试
- [x] QA-L5 Owner 签字 COI（独立性 waived；SS-01 lifted）
- [x] 无 HSM / 不自动签 cert：生产策略已保证

## Explicit non-goals

- 外部 HSM 签名工具（策略：不签 HSM）
- Lean promotion form / 把义务行改成 `reviewed`
- 第二评审人

## Governance references

| Document                                                                          | Role                            |
| --------------------------------------------------------------------------------- | ------------------------------- |
| [Trust rotation runbook](../../../docs/runbooks/conformance-trust-rotation.md)    | Operational rotation + CI gates |
| [RFC-0003 Product Conformance](../../../docs/rfc/0003-product-conformance.md)     | C0–C9 chain, profiles           |
| [ADR-0009 Trust lifecycle](../../../docs/adr/0009-conformance-trust-lifecycle.md) | Sealed decision consumption     |
| [QA-L5 checklist](../../../docs/qa/conformance-l5-review-checklist.md)            | Stop-Ship criteria              |
| [diagrams/06-conformance/](../../../diagrams/06-conformance/)                     | 八视图工程语义                  |
