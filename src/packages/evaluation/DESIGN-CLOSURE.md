# @cantilune/evaluation — Design Closure

## Status: E0–E1 Prototype (Request Changes — Stop-Ship items addressed)

This module is an offline prototype/execution skeleton. It is NOT a production
evaluation system. Real external paid runs, public benchmarks, superiority
claims, and project termination gates remain blocked until E3–E6 complete.

| Item                                                         | Status                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| RFC-0004 (Evaluation Harness)                                | Draft                                                           |
| ADR-0011 (Evaluation Architecture)                           | Accepted                                                        |
| C4/C5 resolution                                             | Resolved — RFC-0001 C4 retained, C5 added                       |
| Naming namespace                                             | `evaluation.c1`–`evaluation.c5`                                 |
| Package scaffold                                             | Complete                                                        |
| Foundation types (IDs, violations, status, opaque tokens)    | Complete — tokens internal-only                                 |
| Domain models (16 entities)                                  | Complete                                                        |
| State machines (Claim, Suite, Dataset, Run, Attempt)         | Complete                                                        |
| ClaimStatus orthogonal axes (lifecycle/decision/publication) | Defined                                                         |
| Ports (40+ interfaces)                                       | Complete                                                        |
| Memory adapters (6 stores)                                   | Complete — hash-chain ledger                                    |
| File adapters (CAS, RunStore, ClaimLedger)                   | Complete — atomic write, corruption detection                   |
| Cantilune adapters (C9 Resolver, Replay)                     | Stub                                                            |
| Evaluation engine                                            | Prototype — full C9 resolve, UUID IDs, derived config           |
| Review validation                                            | Complete — dedup, COI, self-review, role check, signature       |
| isDecisionPublishable / supportsSuperiorityClaim             | Split (S1 fix)                                                  |
| Budget enforcement                                           | reserve-before / reconcile-after / fail-closed / negative guard |
| Data quarantine                                              | Strict — only `valid` observation, only `clean` dataset         |
| Theory Oracle Registry                                       | Complete — controlled LeanTheoremSymbol, typed premises         |
| CertifiedTraceEvidence                                       | Four independent projection views (DAG/Petri/π/Morphism)        |
| SuiteRegistry.registerCase                                   | Implemented                                                     |
| claimCode constrained                                        | `evaluation.c1`–`evaluation.c5` only                            |
| L2 type tests                                                | Complete (12 tests)                                             |
| L3 unit tests                                                | Complete (120+ tests)                                           |
| L4 integration tests                                         | Memory-only happy path + negative tests                         |
| L5 contract tests                                            | Baseline adapter TCK (mock)                                     |
| L6 system tests                                              | Pending                                                         |
| L7 crash/soak/cross-process                                  | Pending                                                         |
| CI workflow                                                  | Created — build, typecheck, test, coverage, pack smoke          |
| Package tarball                                              | `files: ["dist"]` — no src/test pollution                       |

## Coverage Targets

| Metric     | Target | Notes                               |
| ---------- | ------ | ----------------------------------- |
| Statements | 70%    | Post-exclusion-cleanup threshold    |
| Branches   | 65%    | Includes file/port/adapter coverage |
| Functions  | 70%    | Post-exclusion-cleanup threshold    |
| Lines      | 70%    | Post-exclusion-cleanup threshold    |

## Remaining Phases

| Phase | Scope                                                                        | Status                |
| ----- | ---------------------------------------------------------------------------- | --------------------- |
| E2    | Lease/fencing, transactional run store, cross-process recovery               | Pending               |
| E3    | Real sealed C9 integration, runtime replay, observability bridge             | Stub adapters created |
| E4    | Baseline adapters, C1–C4 corpus, paired execution parity                     | TCK created           |
| E5    | Model/human/LLM scoring, adversarial evaluation                              | Pending               |
| E6    | Statistical analysis, preregistered publication, signed reports, diagrams/07 | Pending               |

## Dependencies

- `@cantilune/core` — branded IDs, Footprint, EpochId, SnapshotRef, EvidenceRef, ContentDigest
- `@cantilune/conformance` — PackageConformanceCertificate, ArtifactSubject (sealed C9 consumption)
- `@cantilune/runtime` (optional peer) — replay adapter, trace collection
- `@cantilune/observability` (optional peer) — read-only observation evidence

## Key Constraints

1. Evaluation NEVER modifies runtime world or control-plane policy
2. Evaluation NEVER issues Product Conformance certificates
3. All published metric rows bind artifact subject + verifier build + policy version + evidence root digest
4. Theory oracles return `premiseMissing` when premises are not satisfied (never pass)
5. Retry creates new attempt — failed records are never overwritten
6. Budget: reserve before call, reconcile after, fail-closed on exhaustion
7. LLM judge must NOT hold tools, network, or secrets
8. Token factories are internal-only — no public API can mint opaque tokens
9. notSupported/inconclusive are publishable as negative/uncertain results (cannot support superiority claim)
10. Lean theorems are NOT direct product claims — C1/C3/C4 superiority requires preregistered paired experiments

## Blocking Items for Production Use

- [ ] Independent reviewers assigned (AI Eval, Statistics, Security, Privacy, QA-L5)
- [ ] RFC-0004 Accepted
- [ ] RFC-0003 C4/C5 amendment synchronized
- [ ] L6/L7 tests implemented
- [ ] diagrams/07-evaluation/ created (07A–07H)
- [ ] Full lint/format pass clean
- [ ] Real sealed C9 consumption (not stub)
- [ ] Real baseline adapter (not mock TCK)
