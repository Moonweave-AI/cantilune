# Cantilune Reviewer Assignments

**Current status (2026-08-16):** RFC-0001/0002/0003/0004 **FCP open**
(opened 2026-08-16; comment period closes 2026-08-30; not Accepted).
Architecture + Security + Formal + Process + Lean Assumptions + QA-L5 +
AI-Eval = **Joker-of-Gotham** (Owner; COI disclosed). **No second reviewer.**
Lean kernel is `proved / Owner-accepted` — obligation rows stay `proved`;
Owner governance review is **not** `formal/scripts/ci.ps1 -RequireComplete`.
Public evaluation claims are authorized only via
`OWNER_COI_PUBLIC_REVIEW_CONFIG`. npm **0.x** + Apache-2.0. No HSM and no
auto-signed release certificate are production policies that pass.
`@cantilune/conformance` is 0.x production release authority (SS-01 lifted).
Canonical entry: `docs/governance/fcp-entry-2026-08-16.md`.

## C1–C8 Owner gates (2026-08-16 FCP window; 0.x)

| ID     | Gate                                           | Disposition                                                                                          |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **C1** | ADR 0012–0020 Acceptance（0021–0029 同轮 Accepted） | Owner accepted engineering release 0.x                                                          |
| **C2** | Independent Architecture + Security            | **Joker-of-Gotham**（Owner；COI disclosed）2026-08-15 / 2026-08-16                                   |
| **C3** | Conformance Formal / Process / QA-L5 checklist | **Owner-signed COI 2026-08-16** — independence waived；SS-01 lifted；不自动签 release certificate |
| **C4** | RFC-0001/0002/0003/0004 FCP；RFC-0001 Q1–Q6    | Q1–Q6 已关闭；**FCP opened 2026-08-16**（closes 2026-08-30；not Accepted）                            |
| **C5** | Formal QA-L4                                   | `proved / Owner-accepted`（义务行保持 `proved`；**不得**改写成 reviewed；promotion unused）          |
| **C6** | Public A2A interop claim                       | **已授权** — A2A Protocol 1.0.0（ADR-0027）                                                          |
| **C7** | HSM / npm / API stability                      | npm **0.x** + **Apache-2.0**；**无 HSM**；**无稳定 API**；`pnpm check:0x`；不自动签 release cert     |
| **C8** | RFC-0004 §12 AI-Eval quorum claims             | **已授权（Owner COI）** — `OWNER_COI_PUBLIC_REVIEW_CONFIG`；分析层仍不得发出 `supported`              |

下方 2026-08-15 及更早段落是历史记录。本轮 C1–C8 以本表为准。

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

**2026-08-15 本轮指派（取代「待定外部人选」；不伪造外部姓名）：**

| Role                                            | Current Assignment                                      | Status                         | COI | Canonical               |
| ----------------------------------------------- | ------------------------------------------------------- | ------------------------------ | --- | ----------------------- |
| **SS-01/02/03 Architecture 独立 second reader** | Joker-of-Gotham（Owner-assigned independent）           | **Assigned**（工程 0.x；COI）  | 有  | ADR-0014/0015/0016      |
| **SS-01/02/03 Security / Threat Model**         | Joker-of-Gotham（Owner-assigned independent）           | **Assigned**（工程 0.x；COI）  | 有  | ADR-0014/0015/0016      |
| **CLI #4 Architecture 独立 second reader**      | Joker-of-Gotham（Owner-assigned independent）           | **Assigned**（工程 0.x；COI）  | 有  | ADR-0011/0015/0016/0017 |
| **CLI #4 Security / Threat Model**              | Joker-of-Gotham（Owner-assigned independent）           | **Assigned**（工程 0.x；COI）  | 有  | ADR-0011/0015/0016/0017 |

**评审 disposition（2026-08-15）：** Owner 接受工程发布 0.x。本轮独立 Architecture +
Security = Joker-of-Gotham（Owner-assigned；COI 已披露；日期 2026-08-15）。
**不伪造外部审阅人。** **2026-08-16：** Formal / Process / QA-L5 已 Owner 签字
（COI）；SS-01 已解除；FCP 已开启；形式化为 `proved / Owner-accepted`。
不自动签 release certificate。

### D1/D2/C2 实现闭环 + L5 评审登记（2026-08-14；Owner 授权实现，已落地并变绿）

Owner 授权并已落地以下三份 ADR（D1/D2/C2 生产边界）的实现，均 **Proposed**（Owner 已签署设计批准），
实现全部变绿（真实生产代码 + L6/L7 崩溃测试 + 覆盖率门禁 EXIT=0）。独立 L5 评审仍未签核：

| Role                                               | Current Assignment                            | Status                                      | COI | Canonical            |
| -------------------------------------------------- | --------------------------------------------- | ------------------------------------------- | --- | -------------------- |
| **D1 跨 Agent 传输 架构 second reader**            | Joker-of-Gotham（Owner-assigned independent） | **Assigned**（工程 0.x；COI）               | 有  | ADR-0018             |
| **D1 跨 Agent 传输 Security/Threat Model**         | Joker-of-Gotham（Owner-assigned independent） | **Assigned**（工程 0.x；COI）               | 有  | ADR-0018(+0008 修订) |
| **D2 多 Agent CLI 启动 架构 second reader**        | Joker-of-Gotham（Owner-assigned independent） | **Assigned**（工程 0.x；COI）               | 有  | ADR-0019             |
| **D2 多 Agent CLI 启动 Security**                  | Joker-of-Gotham（Owner-assigned independent） | **Assigned**（工程 0.x；COI）               | 有  | ADR-0019             |
| **C2 LLM 评判器 架构 second reader**               | Joker-of-Gotham（Owner-assigned independent） | **Assigned**（工程 0.x；COI）               | 有  | ADR-0020             |
| **C2 LLM 评判器 Security/Threat Model**            | Joker-of-Gotham（Owner-assigned independent） | **Assigned**（工程 0.x；COI）               | 有  | ADR-0020             |
| **C2 LLM 评判器 AI-Eval（RFC-0004 §12 法定人数）** | Joker-of-Gotham（Owner；COI）                 | **Assigned 2026-08-16** — 公开主张经 Owner COI 法定人数 | 有  | ADR-0020/RFC-0004    |

**Acceptance 门**：三份 ADR 的 Acceptance 均需 Owner 签字（已签设计批准）+ 独立架构/安全评审签核 + 绿 L7 测试
（L7 已绿）。**实现已落地**（Owner 授权分阶段在 Acceptance 前实现，以解除 QA-0012 发布门禁阻塞；
各 ADR 已记录该授权）。C2 的任何依赖评判器的生产终止主张另需 RFC-0004 §12 多评判器法定人数 + 独立 AI-Eval 评审。

**L5 评审包**：`docs/qa/qa-0012-l5-review-package.md` 列出受评审 ADR + 源文件/测试指针。
本轮独立 Architecture + Security 签核人为 Joker-of-Gotham（2026-08-15，COI）。
Formal / QA-L5 清单项仍 review-pending。RFC-0001 Q1–Q6 已在 RFC 正文 §15 关闭；**未进入 FCP**。

### 文档双语覆盖状态（2026-08-14，工程闭环；非评审授权）

英文为唯一权威来源，中文为对照镜像。本轮补齐漂移：

| 文档族        | 中文覆盖                                                                                                      | 状态     |
| ------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| ADR 0001–0017 | 17/17 全量翻译（0001–0017 均落 `docs/adr/zh-CN/`）                                                            | 工程闭环 |
| ADR 0018–0029 | 0018–0020 全译；0021–0029（本轮生产发布）全译                                                                 | 工程闭环 |
| RFC 0001–0004 | 0001/0002/0003/0004 全量翻译（0003 已由 stub 升级为全文对照；**不**宣称 QA-L5 完成）                           | 工程闭环 |
| Research 日志 | 0001、0008、0018、0019、0021–0026、0027、fms-comprehensive、README 全译                                       | 工程闭环 |
| Spec          | formal-semantics / observable-lts-policies / success-predicates-interface 均有 zh-CN 全量翻译                 | 工程闭环 |

**说明：** 双语覆盖属文档卫生，**不构成** QA-L5 完成或形式化 `reviewed`。英文为唯一权威来源。
三个 spec 文件的 zh-CN 译本均保留原始 LaTeX 与 Lean 代码块原样不动。

## Theory / Formal (Lean kernel)

| Role                            | Current Assignment    | Status    | COI Documented |
| ------------------------------- | --------------------- | --------- | -------------- |
| **Formal Mathematics Reviewer** | Joker-of-Gotham (Owner) | **Assigned** (FCP 2026-08-16；COI；Lean 仍 review-pending) | Yes            |
| **Process Semantics Reviewer**  | Joker-of-Gotham (Owner) | **Assigned** (FCP 2026-08-16；COI)                         | Yes            |
| **Lean Assumptions Reviewer**   | Joker-of-Gotham (Owner) | **Assigned** (FCP 2026-08-16；COI；promotion form unused)  | Yes            |

## Runtime / Engineering (M2 prototype)

| Role                                      | Current Assignment         | Status                        | COI Documented | Canonical       |
| ----------------------------------------- | -------------------------- | ----------------------------- | -------------- | --------------- |
| **Architecture second reader**            | Joker-of-Gotham (Owner-assigned independent; also DRI) | **Assigned** (2026-08-15；COI) | Yes            | RFC-0001 §15 Q6 |
| **Security / Threat Model reviewer**      | Joker-of-Gotham (Owner-assigned independent; also DRI) | **Assigned** (2026-08-15；COI) | Yes            | ADR-0003        |
| **Runtime QA-L4 sign-off**                | ADR-0003 Accept (M2 scope) | **Accepted (M2)**             | Yes            | ADR-0003        |
| **Observability read boundary**           | Joker-of-Gotham (DRI)      | **Assigned** (ADR-0005 M2–M3) | Yes            | ADR-0005        |
| **Control-plane Architecture review**     | Joker-of-Gotham (DRI)      | **Assigned** (M3 interim)     | Yes            | ADR-0006        |
| **Control-plane Security / Threat Model** | Joker-of-Gotham (DRI)      | **Assigned** (M3 interim)     | Yes            | ADR-0007        |
| **Comms Architecture review**             | Joker-of-Gotham (DRI)      | **Accepted** (M4)             | Yes            | ADR-0004        |
| **Comms Security / Threat Model**         | Joker-of-Gotham (DRI)      | **Accepted** (M4 interim)     | Yes            | ADR-0008        |
| **Conformance Formal Mathematics**        | Joker-of-Gotham (Owner)    | **Assigned** (FCP 2026-08-16；COI) | Yes            | RFC-0003        |
| **Conformance Process Semantics**         | Joker-of-Gotham (Owner)    | **Assigned** (FCP 2026-08-16；COI) | Yes            | RFC-0003        |
| **Conformance Security / Threat Model**   | Joker-of-Gotham (Owner)    | **Assigned** (FCP 2026-08-16；COI) | Yes            | ADR-0010        |
| **Conformance QA-L5 lead**                | Joker-of-Gotham (Owner)    | **Assigned** (FCP 2026-08-16；COI；independence waived) | Yes | QA-L5 checklist |

### Product Conformance (2026-08-11)

Per RFC-0003, ADR-0009, and ADR-0010, `@cantilune/conformance` is M1–M2 prototype — **NOT** production release authority.

**Governance artifacts (review-pending):**

1. RFC-0003 Product Conformance (Draft)
2. ADR-0009 trust lifecycle (Accepted, M2–M3 engineering scope)
3. ADR-0010 threat model (Accepted, M2–M3 engineering scope)
4. `docs/qa/conformance-l5-review-checklist.md` — all items **review-pending**

**FCP disposition (opened 2026-08-16):** Formal Mathematics, Process Semantics, and QA-L5 are Owner-signed with COI. Independence is waived, not pretended. This window does **not** auto-sign a release certificate and does **not** rewrite Lean to `reviewed`. Independent Architecture + Security remains Joker-of-Gotham (COI disclosed).

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

**M4 disposition (2026-08-16):** T0–T4 engineering remains landed. Owner C6 **authorizes** the public **A2A 1.0.0** claim (ADR-0027). Architecture + Security for this release is Joker-of-Gotham (COI disclosed; no second reviewer). Untrusted-network controls in ADR-0008 still apply (mTLS, pin, deny-by-default). Formal is `proved / Owner-accepted`. RFC FCP is open.

**Review remediation evidence (in repo):**

10. Strict ingress pipeline + `security-regression.test.ts`
11. Sealed auth/verified envelope capabilities
12. Reconnect CAS + plan digest binding + endpoint switch
13. File store fail-closed on corruption; coverage floor **90/88** (see `src/packages/comms/tests/ENGINEERING-COVERAGE.md`)
14. Root export trimmed — stubs/harness via `@cantilune/comms/memory` only

### Control-plane Architecture + Security (2026-08-11)

Per ADR-0006 and ADR-0007, control-plane M3 required a dedicated threat model and two-phase commit evidence before treating activation as trusted.

**Current assignment (2026-08-15):** Independent Architecture + Security for this release = Joker-of-Gotham（Owner-assigned；COI disclosed）。不伪造外部审阅人。FCP 未进入。

**M3 engineering Stop-Ship closure evidence (in repo):**

1. Two-phase commit + `recoverForwardCommit` (`commitAdmissionTransaction.ts`)
2. Strict ingress wire codec + L5 unknown-field negatives
3. Policy activation binding CAS + runtime evaluator notification hook
4. L6 live runtime schema switch integration test
5. L7 OS process CAS via `casActiveBindingDurable` + `cross-process-cas-os.test.ts`
6. ADR-0007 threat model Accepted (interim DRI signature)

**FCP disposition (not entered):** ADR-0006/0007 engineering scope remains Accepted. Formal / QA-L5 stay review-pending. This release does not invent an external reviewer name.

### Security / Threat Model reviewer (2026-08-10)

Per RFC-0001 §0 and ADR-0003, runtime M2 required a Threat Model before network/comms.
**Current assignment (2026-08-15):** Independent Architecture + Security for this
release = Joker-of-Gotham（Owner-assigned；COI disclosed；dated 2026-08-15）。
不伪造外部审阅人。FCP 未进入。

**2026-08-10 reviewer 裁定：** **M2 原型层 Stop-Ship 已解除**。**ADR-0003 Accept**（Joker-of-Gotham）。
**2026-08-15 工程 0.x：** 生产边界由 ADR-0021–0029 打开（Postgres HA / etcd Raft durable、A2A 1.0.0、
Hyper-V/gVisor、可观测性平台）。缺 Postgres / Hyper-V / gVisor 时对应能力 **fail-closed**。
形式化当时为 `proved / review-pending`。当时未进入 FCP。

**2026-08-16：** FCP 已开启；形式化为 `proved / Owner-accepted`；SS-01 已解除。

| 层级                | 含义                                              | 当前工程证据                                                        |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| **M2 原型**         | 本地/单 repo 内继续 runtime 开发与 L3–L7 集成     | ADR-0003 mitigations + 70/70 Vitest + `test:pack` + file durable L7 |
| **生产边界（0.x）** | 运维 HA Postgres、公开 A2A 1.0.0、OS sandbox      | ADR-0023/0024/0027；无 URL / 无隔离运行时则 fail-closed             |
| **FCP disposition** | **FCP open** 2026-08-16（至 2026-08-30）；形式化 `proved / Owner-accepted` | 与 runtime 分离；见 theory 表                                       |

**生产边界 Stop-Ship 解除条件（待 reviewer Accept ADR-0003 后更新）：**

1. Security reviewer 签核 ADR-0003 + 残余风险（DRI 兼任，COI 已披露）
2. File-backed transactional durable 已在 CI 演练（`cross-process-durable`, `worker-parallel-cas`）✅
3. FCP 未进入；本轮独立 Security = Joker-of-Gotham（COI）；不伪造外部姓名

## Rationale

Per DRI decision (2026-07-27): "因为当前项目限制无法指定多个审阅人，因此DRI本人暂时担任所有人类权限"

**2026-08-15 extension:** Owner assigned Joker-of-Gotham as independent Architecture
+ Security reviewer for the 0.x engineering release and disclosed the COI. This does
**not** rewrite formal status to `reviewed`, does **not** enter FCP, and does **not**
invent an external reviewer name.

## Conflict of Interest (COI) Disclosure

**Acknowledged**: DRI is both the primary author and temporary reviewer. This is acceptable for S2 pre-FCP work under the following conditions:

1. **Transparency**: COI is explicitly documented (this file)
2. **Interim Status**: External reviewers will be recruited for final FCP acceptance
3. **Mechanized Verification**: Lean 4 kernel provides independent verification layer
4. **Governance Requirement**: All claims are kernel-verified (zero sorry standard)
5. **Runtime**: ADR-0003 + automated L3–L7 tests provide engineering evidence; human security sign-off still pending

## External Reviewer Recruitment (Post-Implementation)

Target external reviewers (roles only — **no names invented**):

- **Formal Math**: Domain theory expert (CPO/powerdomain/full abstraction)
- **Process Semantics**: π-calculus expert (bisimulation/LTS/observable semantics)
- **Lean**: Lean 4 community member (mathlib contributor preferred)
- **Security / Threat Model**: Application-security engineer (agent/tooling boundary, OWASP-style threat modeling)

This 0.x engineering release does **not** fill those Formal / Process / Lean seats
and does **not** enter FCP. Architecture + Security for this release is the
Owner-assigned independent reviewer named above.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Date**: 2026-07-27 (theory); 2026-08-10 (runtime security interim); 2026-08-15 (0.x engineering release — Owner-assigned independent Architecture + Security; COI disclosed); 2026-08-16 (FCP opened; Owner-signed Formal / Process / QA-L5 / AI-Eval; COI disclosed)  
**Decision Reference**: RFC-0002 §23, RFC-0001 §15, ADR-0003, ADR-0021–0029, [FCP entry](fcp-entry-2026-08-16.md), [QA-L4 review packet](../qa/0002-theory-closure-proved-review-pending-2026-07-27.md)
