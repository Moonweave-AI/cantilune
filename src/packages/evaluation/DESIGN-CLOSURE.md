# @cantilune/evaluation — Design Closure

## Status: E1–E8 Engineering Landed (FCP open — Owner COI public claims)

This module provides an offline evaluation harness with file-durable stores,
fencing leases, conformance-backed C9 resolution, in-process baseline/corpus,
scoring paths, and signed report publication. Public claims are authorized
only via `OWNER_COI_PUBLIC_REVIEW_CONFIG` (Owner COI, 2026-08-16). Analysis
still cannot emit `supported`. RFC-0004 is FCP open, not Accepted. Lean
promotion form unused. Auto-signed release certificates remain forbidden.

| Item                                                         | Status                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| RFC-0004 (Evaluation Harness)                                | FCP open 2026-08-16 (not Accepted)                                     |
| ADR-0011 (Evaluation Architecture)                           | Accepted                                                               |
| C4/C5 resolution                                             | Resolved — RFC-0001 C4 retained, C5 added                              |
| Naming namespace                                             | `evaluation.c1`–`evaluation.c5`                                        |
| Package scaffold                                             | Complete                                                               |
| Foundation types (IDs, violations, status, opaque tokens)    | Complete — tokens internal-only                                        |
| Domain models (16 entities)                                  | Complete                                                               |
| State machines (Claim, Suite, Dataset, Run, Attempt)         | Complete                                                               |
| Ports (40+ interfaces)                                       | Complete                                                               |
| Memory adapters                                              | Complete — hash-chain ledger                                           |
| File adapters (CAS, RunStore, ClaimLedger, **LeaseCoordinator**) | Complete — atomic write, fencing, corruption detection             |
| File engine path                                             | `createFileEvaluationEngine` **requires** LeaseCoordinator             |
| Cantilune adapters (C9 Resolver, Replay)                     | Real — `createCantiluneC9Resolver` + conformance store; A54 checkpoint |
| Evaluation engine                                            | Production path — C9 resolve, lease fencing, UUID IDs                  |
| E4 Baseline + C1–C4 corpus                                   | `createInProcessBaselineRunner` + `createMinimalC1C4Corpus`            |
| L7-20 long-horizon swarm suite                               | `loadCantiluneL7TwentySuite` + `evaluateL7TwentyCheckpoint`（proposed，E7 不发 `supported`） |
| E5 Model/human scoring + adversarial                         | `scoringPaths` + `proofObligationsOracle` (premiseMissing)             |
| E6 Signed reports + encrypted credentials                    | `publishSignedEvaluationReport` + `createEncryptedCredentialStore`     |
| E7 Preregistered analysis + draft report                     | `analyzeMetricObservations` + `composeEvaluationReport` (never `supported`) |
| E8 Four-view + theory-oracle collection                      | `collectCertifiedTraceEvidence` + `collectTheoryOracleBundle`          |
| Review validation                                            | Complete — dedup, COI, self-review, role check, signature              |
| Budget enforcement                                           | reserve-before / reconcile-after / fail-closed                         |
| Theory Oracle Registry                                       | Complete — reads `formal/proof-obligations.json`                       |
| L2–L4 tests                                                  | Present                                                                |
| L6/L7 crash/soak                                             | Landed — `tests/system/l7/file-crash-recovery.test.ts` (attempt/lease/ledger) |
| Coverage gates                                               | statements/functions/lines ≥90%, branches ≥88%                         |

## Remaining / Honest Gaps

| Gap                                                              | Status        |
| ---------------------------------------------------------------- | ------------- |
| Independent reviewers (AI Eval, Statistics, Security, Privacy) | Owner-signed COI 2026-08-16 (independence waived) |
| RFC-0004 Accepted                                                | Open (FCP not closed) |
| Public superiority / termination-gate claims                     | Owner COI quorum only; analysis ≠ `supported` |
| diagrams/07-evaluation/                                          | Pending       |
| Auto-signed release certificates                                 | **Forbidden** |

## Key Constraints

1. Evaluation NEVER modifies runtime world or control-plane policy
2. Evaluation NEVER issues Product Conformance certificates
3. Published metric rows bind artifact subject + verifier build + policy version + evidence root digest
4. Theory oracles return `premiseMissing` when premises are not satisfied (never pass)
5. Retry creates new attempt — failed records are never overwritten
6. Budget: reserve before call, reconcile after, fail-closed on exhaustion
7. LLM judge must NOT hold tools, network, or secrets
8. Token factories are internal-only
9. CLI `/eval` must NOT use `allowLocalShim:true` — uses conformance-backed resolver
10. File engine path requires fencing LeaseCoordinator
