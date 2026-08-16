---
title: QA-0012 Independent L5 Architecture + Security Review Package
document_type: review-package
status: Owner-accepted / no-second-reviewer (COI 2026-08-16)
risk: S3
quality_target: QA-L5
maturity: M2–M3
owner: Joker-of-Gotham (DRI — COI disclosed; independence waived 2026-08-16)
updated: 2026-08-16
related: docs/qa/0012-agent-execution-continuity-qa.md, ADR-0014–0020, unfinished-items plan A1–A56
---

# QA-0012 Independent L5 Review Package

This package assembles materials for Architecture + Security review. Owner
(Joker-of-Gotham) signed all roles on 2026-08-16 with COI. **No second
reviewer** is assigned. Independence rows are **waived**, not pretended to be
independent.

> **COI disclosure.** The Owner is the DRI. This is a disclosed self-review
> for the 0.x engineering release, recorded in
> `docs/governance/fcp-entry-2026-08-16.md`.

## 1. Scope of this review (updated 2026-08-15)

Engineering closed or in flight against A1–A56 (hub mesh, File owner+pid,
S4 directory, JudgeBudget, CLI contract/judge adapters, eval file+C9
fail-closed, ObservationAccessContext, Azure deployments path, Petri
T-invariants, matchWitness required, evidence inventories). Owner gates
**C1–C8 remain unsigned**. This is not “only independent review left.”

| ADR      | Boundary                               | Gate   | Engineering status (honest)                         | Sign-off       |
| -------- | -------------------------------------- | ------ | --------------------------------------------------- | -------------- |
| ADR-0014 | Durable epoch journal atomic with head | SS-02  | Impl green                                          | Owner-accepted COI 2026-08-16 |
| ADR-0015 | Production swarm lifecycle             | SS-01  | Impl green                                          | Owner-accepted COI 2026-08-16 |
| ADR-0016 | External-tool exactly-once execution   | SS-03  | Impl green; AbortSignal on ToolExecutor             | Owner-accepted COI 2026-08-16 |
| ADR-0017 | Petri net executor                     | CLI #4 | S- + T-invariants                                   | Owner-accepted COI 2026-08-16 |
| ADR-0018 | Inter-agent transport                  | D1     | T0–T4 engineering; public A2A claim = C6            | Owner-accepted COI 2026-08-16 |
| ADR-0019 | Multi-agent CLI boot                   | D2     | S0–S4 directory + remote handle + CLI               | Owner-accepted COI 2026-08-16 |
| ADR-0020 | LLM judge verifier                     | C2     | J1–J4 budget hard-kill                              | Owner-accepted COI 2026-08-16 |
| ADR-0008 | Comms threat model                     | Sec    | File owner+pid STRIDE delta drafted                 | Owner-accepted COI 2026-08-16 |

## 2. Explicit non-claims

- No auto-signed Acceptance certificate
- No Lean re-proof inside TypeScript
- `/eval` no longer uses `allowLocalShim` on the TUI default path
- RFC-0001 Q1–Q6 are Owner-closed in the RFC; FCP remains open

## 3. Signature block

| Role                       | Name | Date | Verdict        |
| -------------------------- | ---- | ---- | -------------- |
| Architecture (Owner COI)   | Joker-of-Gotham | 2026-08-16 | Owner-accepted |
| Security (Owner COI)       | Joker-of-Gotham | 2026-08-16 | Owner-accepted |
| Formal / Process Semantics | Joker-of-Gotham | 2026-08-16 | Owner-accepted |

## 4. Current source / test pointers (engineering evidence, not sign-off)

### Epoch journal (SS-02 / B4)

- `src/packages/runtime/src/ports/durableCoordinator.ts` — `compareAndSwapHeadWithBinding`
- `src/packages/runtime/src/engine/memoryEpochAdministration.ts` — `recoverFromDurableBinding`
- `src/packages/runtime/src/codec/snapshotCodec.ts` — Map/DTO wire (B1)
- `src/packages/runtime/tests/system/l7/epoch-transition-crash-atomic.test.ts`

### Swarm / S4 (ADR-0019)

- `src/packages/boot/src/cluster/meshHostDirectory.ts`
- `src/packages/boot/src/cluster/directoryNetMesh.ts`
- `src/packages/boot/src/cluster/remoteRuntimeProxy.ts`
- `src/packages/boot/src/cluster/remoteAgentHandle.ts`
- `src/packages/boot/src/swarm/bootSwarmWorker.ts`
- `src/packages/boot/src/cluster/meshHubEndpoint.ts`
- `src/packages/boot/src/cluster/commsRuntimeBridge.ts`
- `src/packages/boot/src/cluster/swarmScheduler.ts`
- `src/packages/boot/tests/system/cluster/s4MeshDirectory.test.ts`
- `src/packages/boot/tests/integration/cluster/meshHubComms.test.ts`
- `src/packages/boot/tests/system/cluster/schedulingDynamics.test.ts`
- CLI: `src/packages/cli/src/commands/swarmCommands.ts` (`/swarm hosts`, `/swarm join`)
- Headless: `src/packages/cli/src/headless/headlessRunner.ts` (`--swarm-directory`)

### Comms T0–T4

- `src/packages/comms/src/engine/createCommsServices.ts`
- File / net transports under `src/packages/comms/src/transports/`
- `src/packages/comms/src/recovery/dlqAuthorizedReplay.ts`
- `src/packages/comms/tests/contract/a2a-conformance-harness.test.ts`
- `src/packages/comms/tests/unit/netFrame.properties.test.ts`
- `src/packages/comms/tests/ENGINEERING-COVERAGE.md` (gate 90/88; L2 types landed)

### Judge budget (ADR-0020 J4)

- `src/packages/boot/src/termination/judgeBudget.ts`
- `src/packages/boot/tests/system/termination/judgeBudgetHardKill.test.ts`

### Conformance trust (ADR-0009)

- `src/packages/conformance/src/adapters/file/fileTrustStore.ts`
- `src/packages/conformance/src/adapters/file/fileRevocationStore.ts`
- `src/packages/conformance/src/adapters/file/fileEvidenceStore.ts`
- `src/packages/conformance/src/lifecycle/sealedDecision.ts`
- `src/packages/conformance/src/verifier/humanReviewAttestationVerifier.ts`
- `src/packages/conformance/src/evidence/packageEvidenceManifests.ts`
- `src/packages/conformance/src/evidence/recomputeFromCommittedWorld.ts`
- Checklist: `docs/qa/conformance-l5-review-checklist.md` (Owner-signed COI; SS-01 lifted)

### Evaluation / observability

- `src/packages/evaluation/DESIGN-CLOSURE.md` (E1–E6 engineering; E7–E8 skeleton)
- `src/packages/observability/src/input/observationAccessContext.ts`

### CLI honesty (A23–A26 / A45–A53)

- Record: `docs/plans/cli4-advanced-commands.md` §6
- `src/packages/cli/src/wiring/observeControl.ts`
- `src/packages/cli/src/wiring/replayControl.ts`
- `src/packages/cli/src/wiring/worldDiff.ts`
- `src/packages/cli/src/wiring/toolApproval.ts`
- Residual still open: `src/packages/cli/src/wiring/controlPlaneControl.ts` (Memory store)

### Four-view admission (not SignatureAdmission)

- `@cantilune/conformance` `verifyFourViewEvidence` / `VerifiedFourViewEvidence`
- `@cantilune/control-plane` store field `fourView`

## 5. Owner decisions (2026-08-16)

RFC-0001 **Q1–Q6** are Owner-closed in the RFC. FCP is open, not Accepted.

| ID | Question | Status |
| -- | -------- | ------ |
| C1 | ADR 0012–0020 Acceptance | Owner-accepted COI 2026-08-16 |
| C2 | Architecture + Security | Owner-accepted COI; no second reviewer |
| C3 | Conformance Formal / Process / QA-L5 checklist | Owner-signed COI; SS-01 lifted |
| C4 | RFC-0001/0002/0004 FCP; RFC-0001 Q1–Q6 | FCP open; Q1–Q6 closed |
| C5 | Formal QA-L4 | `proved / Owner-accepted`; promotion unused |
| C6 | Public A2A interop claim | Authorized (ADR-0027 A2A 1.0.0) |
| C7 | External HSM, npm publish, API stability | No HSM (policy pass); npm 0.x after soak; no stable API |
| C8 | RFC-0004 §12 independent AI-Eval quorum claims | Owner COI quorum; analysis ≠ `supported` |
