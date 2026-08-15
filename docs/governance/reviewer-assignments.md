# Cantilune Reviewer Assignments

**Current status (2026-08-14):** DRI 兼任 Architecture second reader 与 Security /
Threat Model reviewer（COI 已披露）；control-plane M3 Stop-Ship 工程项已在仓库闭环（ADR-0006/0007）。
QA-0012 四项 Stop-Ship / CLI 高级命令工程项已全部闭环（SS-01/02/03 + CLI#4，见下节与
`docs/qa/0012-agent-execution-continuity-qa.md`），独立 Architecture + Security 评审仍为 FCP 前硬阻塞。
FCP 前仍计划招募外部独立审阅人。Theory QA-L4 与 runtime 生产边界 Stop-Ship 裁定见 ADR-0003 与用户签核记录。

## QA-0012 Stop-Ship + CLI 高级命令 (2026-08-14)

四项工程项已在仓库闭环（ADR + 实现并行，每项独立 ADR；证据见
`docs/qa/0012-agent-execution-continuity-qa.md`）：

1. **SS-01 生产集群生命周期 — 工程闭环**（ADR-0015）。`activate_participant` 操作 +
   handler、`Participant.manifestRef` + 线 codec、`ClusterSupervisor` 重写为消费
   `runtime.changes(cursor)` feed、durable `signal_done`、liveness-expiry retire、
   manifest 从 `participant.manifestRef` 解析；L6 闭环测试 + L7 跨进程崩溃测试
   （file-backed durable world）；start() 增 `reconcileLivenessFromWorld(head)`
   修复孤立 active 参与者收敛缺陷。boot 覆盖率门禁 green。
2. **SS-02 epoch 切换崩溃原子性 — 工程闭环**（ADR-0014）。`DurableWireBundle` 增可选
   `schemaBinding`；`compareAndSwapHeadWithBinding`；`commitEpochTransition` head+binding
   原子；`recoverEpochTransition` 从 durable bundle 读 binding。跨进程崩溃测试通过。
3. **SS-03 外部工具 exactly-once — 工程闭环**（ADR-0016）。分层契约
   （read/idempotent/non-idempotent）、durable 预调用 journal、`executor.reconcile`、
   四边界崩溃测试；`@cantilune/syscall` `ToolExecutor` 扩 `tier`/`tierFor`/`reconcile`，
   `useTool` 重写预写 `dispatched`、按 tier 分支恢复、post-write `completed`；
   `@cantilune/tools` 工具 tier 声明（filesystem=read/idempotent/non-idempotent、
   shell=non-idempotent、web=read、mcp=non-idempotent fail-safe）。覆盖率门禁 green。
4. **CLI #4 高级命令（content/cluster/eval/schema/petri）— 4/4 闭环**。
   - content：`ContentStore` 扩 `list()`+`remove()`（GC-only，`--confirm` 门），`/content *` 真实 store。
   - cluster：`/cluster *` 接真实 `ClusterSupervisor`（ADR-0015）。
   - eval/schema：`/eval *` 接真实 `EvaluationEngine`（ADR-0011）；`/schema *` 接真实 `ControlPlaneService`（ADR-0006）+ `computeMonotoneExtensionPlan`。
   - petri+ADR-0017：新 `@cantilune/petri` 无依赖包（真实令牌游戏发射、有界 BFS 可达性、Martinez–Silva S-不变量）；`/petri *` 接真实引擎替换 cosmetic stub。petri 53 测试 96.92/88.33 门禁 green；CLI 542 测试 93.91/88.17 门禁 green。

**当前评审缺口（FCP 前硬阻塞，_unassigned_）：**

| Role                                            | Current Assignment             | Status             | COI | Canonical               |
| ----------------------------------------------- | ------------------------------ | ------------------ | --- | ----------------------- |
| **SS-01/02/03 Architecture 独立 second reader** | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0014/0015/0016      |
| **SS-01/02/03 Security / Threat Model**         | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0014/0015/0016      |
| **CLI #4 Architecture 独立 second reader**      | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0011/0015/0016/0017 |
| **CLI #4 Security / Threat Model**              | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0011/0015/0016/0017 |

**评审 disposition（仍 open）：** 工程闭环不等于 release 授权。按治理基线，QA-L5 出口
须有**非 DRI 独立** Architecture + Security 签核。SS-01/02/03 与 CLI #4 共享同一评审 gate
（均 S3/QA-L5，同一批生产边界）。Owner（Joker-of-Gotham，亦为这些 ADR 的 DRI）已声明
承担 A1 推进全部责任，将协调招募外部 application-security 工程师 + 架构 second reader。
**COI 约束仍然有效**：Owner 作为 DRI 不得自评其 DRI 工作；独立评审须由非 DRI 的外部
评审人签署。review-ready 评审包（本 QA-0012 + formal proof-obligations.json）已完整，
待外部评审人取用。

### D1/D2/C2 实现闭环 + L5 评审登记（2026-08-14；Owner 授权实现，已落地并变绿）

Owner 授权并已落地以下三份 ADR（D1/D2/C2 生产边界）的实现，均 **Proposed**（Owner 已签署设计批准），
实现全部变绿（真实生产代码 + L6/L7 崩溃测试 + 覆盖率门禁 EXIT=0）。独立 L5 评审仍未签核：

| Role                                               | Current Assignment             | Status             | COI | Canonical            |
| -------------------------------------------------- | ------------------------------ | ------------------ | --- | -------------------- |
| **D1 跨 Agent 传输 架构 second reader**            | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0018             |
| **D1 跨 Agent 传输 Security/Threat Model**         | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0018(+0008 修订) |
| **D2 多 Agent CLI 启动 架构 second reader**        | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0019             |
| **D2 多 Agent CLI 启动 Security**                  | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0019             |
| **C2 LLM 评判器 架构 second reader**               | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0020             |
| **C2 LLM 评判器 Security/Threat Model**            | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0020             |
| **C2 LLM 评判器 AI-Eval（RFC-0004 §12 法定人数）** | Owner 协调招募（待定外部人选） | **review-pending** | 有  | ADR-0020/RFC-0004    |

**Acceptance 门**：三份 ADR 的 Acceptance 均需 Owner 签字（已签设计批准）+ 独立架构/安全评审签核 + 绿 L7 测试
（L7 已绿）。**实现已落地**（Owner 授权分阶段在 Acceptance 前实现，以解除 QA-0012 发布门禁阻塞；
各 ADR 已记录该授权）。C2 的任何依赖评判器的生产终止主张另需 RFC-0004 §12 多评判器法定人数 + 独立 AI-Eval 评审。

**L5 评审包**：`docs/qa/qa-0012-l5-review-package.md` 已就绪，列出受评审的全部 ADR + 源文件 + 测试 +
覆盖率证据 + 架构/安全评审检查清单，供外部评审人逐项签署。

### 文档双语覆盖状态（2026-08-14，工程闭环；非评审授权）

英文为唯一权威来源，中文为对照镜像。本轮补齐漂移：

| 文档族        | 中文覆盖                                                                                                      | 状态     |
| ------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| ADR 0001–0017 | 17/17 全量翻译（0001–0017 均落 `docs/adr/zh-CN/`）                                                            | 工程闭环 |
| RFC 0001–0004 | 0001/0002/0004 全量翻译；0003 为 stub 导读（按其自身 §13 声明，非全译）                                       | 工程闭环 |
| Research 日志 | 0001、0008、0018、0019、0021–0026、0027、fms-comprehensive、README 全译                                       | 工程闭环 |
| Spec          | formal-semantics / observable-lts-policies / success-predicates-interface 均有 zh-CN 全量翻译                 | 工程闭环 |
| ADR 0018–0020 | 0018（D1 跨 Agent 传输）/ 0019（D2 多 Agent CLI 启动）/ 0020（C2 LLM 评判器）均落 `docs/adr/zh-CN/`，全量翻译 | 工程闭环 |

**说明：** 双语覆盖属文档卫生，**不构成** QA-L5 评审或 release 授权。RFC-0003.zh-CN 的
stub 导读模式是其 ADR 作者的既定选择（仅作阅读引导，不宣称 QA-L5 完成），与全译的
0001/0002/0004 并行存在。三个 spec 文件（formal-semantics、observable-lts-policies、
success-predicates-interface）的 zh-CN 译本均保留原始 LaTeX 与 Lean 代码块原样不动。

## Theory / Formal (Lean kernel)

| Role                            | Current Assignment    | Status    | COI Documented |
| ------------------------------- | --------------------- | --------- | -------------- |
| **Formal Mathematics Reviewer** | DRI (Joker-of-Gotham) | Temporary | Yes            |
| **Process Semantics Reviewer**  | DRI (Joker-of-Gotham) | Temporary | Yes            |
| **Lean Assumptions Reviewer**   | DRI (Joker-of-Gotham) | Temporary | Yes            |

## Runtime / Engineering (M2 prototype)

| Role                                      | Current Assignment         | Status                        | COI Documented | Canonical       |
| ----------------------------------------- | -------------------------- | ----------------------------- | -------------- | --------------- |
| **Architecture second reader**            | Joker-of-Gotham (DRI)      | **Assigned**                  | Yes            | RFC-0001 §0     |
| **Security / Threat Model reviewer**      | Joker-of-Gotham (DRI)      | **Assigned** (FCP 前暂代外部) | Yes            | ADR-0003        |
| **Runtime QA-L4 sign-off**                | ADR-0003 Accept (M2 scope) | **Accepted (M2)**             | Yes            | ADR-0003        |
| **Observability read boundary**           | Joker-of-Gotham (DRI)      | **Assigned** (ADR-0005 M2–M3) | Yes            | ADR-0005        |
| **Control-plane Architecture review**     | Joker-of-Gotham (DRI)      | **Assigned** (M3 interim)     | Yes            | ADR-0006        |
| **Control-plane Security / Threat Model** | Joker-of-Gotham (DRI)      | **Assigned** (M3 interim)     | Yes            | ADR-0007        |
| **Comms Architecture review**             | Joker-of-Gotham (DRI)      | **Accepted** (M4)             | Yes            | ADR-0004        |
| **Comms Security / Threat Model**         | Joker-of-Gotham (DRI)      | **Accepted** (M4 interim)     | Yes            | ADR-0008        |
| **Conformance Formal Mathematics**        | _unassigned_               | **review-pending**            | —              | RFC-0003        |
| **Conformance Process Semantics**         | _unassigned_               | **review-pending**            | —              | RFC-0003        |
| **Conformance Security / Threat Model**   | Joker-of-Gotham (DRI)      | **Assigned** (M2 interim)     | Yes            | ADR-0010        |
| **Conformance QA-L5 lead**                | _unassigned_               | **review-pending**            | —              | QA-L5 checklist |

### Product Conformance (2026-08-11)

Per RFC-0003, ADR-0009, and ADR-0010, `@cantilune/conformance` is M1–M2 prototype — **NOT** production release authority.

**Governance artifacts (review-pending):**

1. RFC-0003 Product Conformance (Draft)
2. ADR-0009 trust lifecycle (Accepted, M2–M3 engineering scope)
3. ADR-0010 threat model (Accepted, M2–M3 engineering scope)
4. `docs/qa/conformance-l5-review-checklist.md` — all items **review-pending**

**FCP disposition (open):** non-DRI Formal Mathematics, Process Semantics, Security, and QA-L5 sign-off per checklist Stop-Ship SS-01..SS-10.

### Comms Architecture + Security (2026-08-11)

Per ADR-0004 and ADR-0008, comms M4 Stop-Ship required file durable store, messaging saga, crypto identity, observability bridge, conformance certificate, L7 OS CAS, and dedicated CI.

**M4 engineering Stop-Ship closure evidence (in repo):**

1. FileCommsStore + cross-process session CAS (`cross-process-session-cas-os.test.ts`)
2. MessagingSagaCoordinator (persist → observe → commit → dispatch)
3. HmacIdentityVerifier + binding material contract tests
4. A2A pinned-profile interop harness
5. ObservabilityCommsEventBridge redaction tests
6. `@cantilune/conformance` CommsProductCertificate verifier
7. diagrams/05-comms eight-view series (05A–05H)
8. `.github/workflows/comms.yml` (coverage / fuzz / mutation / pack)
9. ADR-0004 Accepted · ADR-0008 Accepted (interim DRI signature)

**M4 disposition:** **Request Changes / Stop-Ship** — comms remains M2–M3 prototype until Security + runtime/control-plane + protocol reviewers sign off.

**Review remediation evidence (in repo):**

10. Strict ingress pipeline + `security-regression.test.ts`
11. Sealed auth/verified envelope capabilities
12. Reconnect CAS + plan digest binding + endpoint switch
13. File store fail-closed on corruption; coverage floor 55%
14. Root export trimmed — stubs/harness via `@cantilune/comms/memory` only

### Control-plane Architecture + Security (2026-08-11)

Per ADR-0006 and ADR-0007, control-plane M3 required a dedicated threat model and two-phase commit evidence before treating activation as trusted.

**Current assignment:** DRI（Joker-of-Gotham）正式兼任 Architecture + Security reviewer；FCP 前仍须外部 application-security 与 architecture second reader **非 DRI** 独立签核。

**M3 engineering Stop-Ship closure evidence (in repo):**

1. Two-phase commit + `recoverForwardCommit` (`commitAdmissionTransaction.ts`)
2. Strict ingress wire codec + L5 unknown-field negatives
3. Policy activation binding CAS + runtime evaluator notification hook
4. L6 live runtime schema switch integration test
5. L7 OS process CAS via `casActiveBindingDurable` + `cross-process-cas-os.test.ts`
6. ADR-0007 threat model Accepted (interim DRI signature)

**FCP disposition (still open):** external Security reviewer independent sign-off on ADR-0007 residual risks; external Architecture second reader on ADR-0006 epoch activation invariants.

### Security / Threat Model reviewer (2026-08-10)

Per RFC-0001 §0 and ADR-0003, runtime M2 required a Threat Model before network/comms.
**Current assignment:** DRI（Joker-of-Gotham）正式兼任 Security reviewer；FCP 前仍计划
招募外部 application-security 审阅人。COI 见下文。

**2026-08-10 reviewer 裁定：** **M2 原型层 Stop-Ship 已解除**。**ADR-0003 Accept**（Joker-of-Gotham）。
**生产边界层**仍禁止：真实生产 Agent 写入、comms/网络、分布式多副本 DB。

| 层级                | 含义                                              | 当前工程证据                                                        |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| **M2 原型**         | 本地/单 repo 内继续 runtime 开发与 L3–L7 集成     | ADR-0003 mitigations + 70/70 Vitest + `test:pack` + file durable L7 |
| **生产边界**        | 真实 Agent/工具写入、网络/comms、多副本分布式存储 | 仍禁止；comms 外置 02G；distributed DB 未做                         |
| **FCP disposition** | 形式化理论 QA-L4 独立签核                         | 与 runtime 分离；见 theory 表                                       |

**生产边界 Stop-Ship 解除条件（待 reviewer Accept ADR-0003 后更新）：**

1. Security reviewer 签核 ADR-0003 + 残余风险（DRI 兼任，COI 已披露）
2. File-backed transactional durable 已在 CI 演练（`cross-process-durable`, `worker-parallel-cas`）✅
3. FCP 前仍须外部 Security reviewer 独立签核（非 DRI）

## Rationale

Per DRI decision (2026-07-27): "因为当前项目限制无法指定多个审阅人，因此DRI本人暂时担任所有人类权限"

**2026-08-10 extension:** same constraint applies to runtime security review; interim
DRI coverage is explicit and does **not** substitute for external sign-off at FCP.

## Conflict of Interest (COI) Disclosure

**Acknowledged**: DRI is both the primary author and temporary reviewer. This is acceptable for S2 pre-FCP work under the following conditions:

1. **Transparency**: COI is explicitly documented (this file)
2. **Interim Status**: External reviewers will be recruited for final FCP acceptance
3. **Mechanized Verification**: Lean 4 kernel provides independent verification layer
4. **Governance Requirement**: All claims are kernel-verified (zero sorry standard)
5. **Runtime**: ADR-0003 + automated L3–L7 tests provide engineering evidence; human security sign-off still pending

## External Reviewer Recruitment (Post-Implementation)

Target external reviewers (to be recruited):

- **Formal Math**: Domain theory expert (CPO/powerdomain/full abstraction)
- **Process Semantics**: π-calculus expert (bisimulation/LTS/observable semantics)
- **Lean**: Lean 4 community member (mathlib contributor preferred)
- **Security / Threat Model**: Application-security engineer (agent/tooling boundary, OWASP-style threat modeling)

Recruitment trigger: now, against the immutable S/E/P chain in PR #1 and before
FCP disposition.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Date**: 2026-07-27 (theory); 2026-08-10 (runtime security interim)  
**Decision Reference**: RFC-0002 §23, RFC-0001 §0, ADR-0003, [QA-L4 review packet](../qa/0002-theory-closure-proved-review-pending-2026-07-27.md)
