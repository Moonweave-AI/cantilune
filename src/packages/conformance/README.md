# @cantilune/conformance

Cantilune 的**产品证据验证、形式化证明绑定、跨 epoch 一致性组合、独立审查与发布门禁**模块。

> **治理等级**：S4 / QA-L5（当用于 control-plane 激活或产品发布时）  
> **当前实现**：**M2 安全加固原型** — 不可作为生产 admission、formal conformance 或 release authority。

## 职责

本包回答五个彼此独立的问题：

1. 证据来自哪个精确源码、制品、规则、epoch 与 occurrence？
2. occurrence 能否由 runtime 规则确定性重放？
3. 在 DAG / Petri / π / Morphism 四投影中是否 sound、reflect、可重放且终态一致？
4. 跨 schema/epoch admission 是否严格单调并与业务 occurrence 精确衔接？
5. 机器结论是否经可信构建、独立人类复核，且未过期/撤销/被替代？

**不在 TS 中重证 Lean 定理**；只验证产品证据是否满足形式理论已定义的接口。

## 关键概念分离

| 工程概念                                                                     | 形式概念                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `EngineeringAdmissionEvidence` — dependency / resource / session / structure | `FormalFourProjectionCertificate` — DAG / Petri / π / Morphism |
| control-plane / observability admission 观察                                 | Product Conformance 四投影证书                                 |

二者可绑定同一 `AdmissionSubject`，**不可互相替代**，也**不可**都叫 `FourViewEvidence`。

## 四状态轴

- 理论证据：`missing` → `reviewed`
- 机器验证：`candidate` → `verified` / `unavailable`
- 人类复核：`unassigned` → `approved` / `rejected`
- 发布决定：`notEvaluated` → `accepted` / `revoked`

`kernel proved ≠ product verified ≠ human reviewed ≠ released`

## 公共 API（M2）

```typescript
import {
  createConformanceEngine,
  createConformanceEvidenceVerifier,
  computeEvidenceDigest,
} from "@cantilune/conformance";
import { createMemoryConformanceEngine } from "@cantilune/conformance/memory";
```

- `verifyEngineeringAdmissionEvidence` / `verifyFourViewEvidence`（deprecated 别名）
- `createConformanceEngine` → `inspectCandidate`, `verifyPackage`, `listMissingEvidence`, …
- 返回 `Result<VerificationDecision, ConformanceViolation[]>`，禁止 boolean-only

## 依赖边界

- **生产依赖**：仅 `@cantilune/core`
- runtime / control-plane / comms / observability 通过 **ports** 与各自 product-owned evidence producer 接入
- 产品专用证据（如 comms）位于各包 `src/conformance/`，不在中央包内

## 子路径

- `@cantilune/conformance/evidence`
- `@cantilune/conformance/profiles`
- `@cantilune/conformance/ports`
- `@cantilune/conformance/memory`
- `@cantilune/conformance/admission` — sealed prepare 消费（需签名 attestation）
- `@cantilune/conformance/release` — release gate（需 ReviewedDecision + certificate）
- `@cantilune/conformance/runtime` — 可选 DPO replay port（peer: `@cantilune/runtime`）
- `@cantilune/conformance/testing` — **仅测试 harness**，含 signed review builder

## 形式理论锚点

证书链 C0–C9 对应 `formal/Cantilune/` 与 `formal/proof-obligations.json`。  
CENTRAL-01～18 当前为 `proved` / `review-pending`，**不覆盖** TypeScript 产品包。

详见 [DESIGN-CLOSURE.md](./DESIGN-CLOSURE.md)。
