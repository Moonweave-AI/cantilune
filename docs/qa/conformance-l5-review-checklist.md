---
title: Conformance QA-L5 independent review checklist
document_type: quality-evidence-and-review-packet
status: owner-signed-coi
risk: S4
quality_target: QA-L5
maturity: M2 / FCP-open
owner: Joker-of-Gotham
dri: Joker-of-Gotham
updated: 2026-08-16
review_cycle: on every conformance-sensitive change
related: RFC-0003, ADR-0009, ADR-0010, @cantilune/conformance, docs/governance/fcp-entry-2026-08-16.md
---

# Conclusion

This is the **QA-L5 review checklist** for Cantilune Product Conformance (`@cantilune/conformance`).

**Aggregate governance state (2026-08-16):** Owner-signed with disclosed COI. Functional rows are **pass**. Independence rows that require a reviewer distinct from the implementer DRI are **waived**, not pretended to be independent. Waiver rationale: `docs/governance/fcp-entry-2026-08-16.md`.

This sign-off does **not**:

- rewrite Lean `formal/proof-obligations.json` from `proved / review-pending` to `reviewed`
- close FCP (opened 2026-08-16; scheduled close 2026-08-30)
- grant SemVer 1.0.0 or a stable API
- auto-sign a release Acceptance certificate
- invent an external reviewer name

## Classification and authority

| Field              | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Work object        | Product evidence verification, C0–C9 certificate chain, trust lifecycle, control-plane consumption          |
| Risk               | S4 when wired to activation/release; S2 for prototype-only use                                              |
| Quality target     | QA-L5: machine verification + review + tamper/fuzz L7                                                       |
| Maturity           | M2 engineering; RFC-0003 **FCP open** (not Accepted)                                                        |
| Owner / DRI        | Joker-of-Gotham                                                                                             |
| Decision authority | RFC-0003, ADR-0009, ADR-0010                                                                                |
| Review authority   | Owner-signed COI 2026-08-16; independence waived (A-06, E-03, F-06, SS-04, SS-09)                           |

## How to use this checklist

- Each item has: **ID**, **Requirement**, **Evidence expected**, **Reviewer role**, **Status**.
- Status values: `review-pending` | `pass` | `fail` | `waived` (waived requires Decision Owner written rationale).
- **Stop-Ship:** Any `fail` on a Stop-Ship item blocks S4 closure and FCP **close**. FCP **open** is allowed with waived independence.

---

## A. Governance and documentation

| ID   | Requirement                                                                         | Evidence expected                                                  | Reviewer           | Status                             |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ | ---------------------------------- |
| A-01 | RFC-0003 accurately describes C0–C9, five questions, profile matrix, scope split    | `docs/rfc/0003-product-conformance.md` + code alignment spot-check | Architecture       | **pass** (Owner COI 2026-08-16)    |
| A-02 | ADR-0009 trust lifecycle matches implemented ports and gate contracts               | ADR + `@cantilune/conformance/src/ports/*`                         | Security           | **pass** (Owner COI 2026-08-16)    |
| A-03 | ADR-0010 STRIDE threats mapped to mitigations with honest OPEN residual disclosure  | ADR-0010 residual table                                            | Security           | **pass** (Owner COI 2026-08-16)    |
| A-04 | Theory/product boundary not regressed (no CENTRAL proof → product release collapse) | RFC-0003 §5 + RFC-0002 §7.1 cross-read                             | Formal Mathematics | **pass** (Owner COI 2026-08-16)    |
| A-05 | Engineering vs formal four-projection naming enforced in new code paths             | Grep / API review; deprecated alias isolated                       | Architecture       | **pass** (Owner COI 2026-08-16)    |
| A-06 | Non-DRI reviewers assigned and COI documented                                       | `docs/governance/reviewer-assignments.md` updated                  | Governance         | **waived** (Owner self-review COI) |

## B. Five conformance questions (functional)

| ID   | Requirement                                                                                           | Evidence expected                       | Reviewer           | Status                          |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------ | ------------------------------- |
| B-01 | **Q1 Provenance:** subject + inventory binding rejects mismatch/tamper                                | Negative unit/contract tests            | Formal / QA        | **pass** (Owner COI 2026-08-16) |
| B-02 | **Q2 Replay:** nondeterministic replay rejected with structured violation                             | Test corpus entry                       | Process Semantics  | **pass** (Owner COI 2026-08-16) |
| B-03 | **Q3 Engineering:** control-plane path uses `engineeringAdmission` only                               | ADR-0006 + engine integration test      | Architecture       | **pass** (Owner COI 2026-08-16) |
| B-04 | **Q3 Formal:** four-projection path requires C5 digests; no engineering-only shortcut at release rank | Verifier + release gate tests           | Formal Mathematics | **pass** (Owner COI 2026-08-16) |
| B-05 | **Q4 Cross-epoch:** monotone epoch chain violations surfaced                                          | Cross-epoch test scaffold (when landed) | Process Semantics  | **pass** (Owner COI 2026-08-16) |
| B-06 | **Q5 Trust chain:** expired/revoked/unpinned verifier rejected at consumption                         | Revocation + policy tests               | Security           | **pass** (Owner COI 2026-08-16) |

## C. Certificate chain C0–C9

| ID   | Requirement                                                         | Evidence expected                       | Reviewer              | Status                          |
| ---- | ------------------------------------------------------------------- | --------------------------------------- | --------------------- | ------------------------------- |
| C-01 | C0 policy/trust baseline recorded in certificate + cache key        | Schema + ADR-0009 TR-*                  | Security              | **pass** (Owner COI 2026-08-16) |
| C-02 | C1–C2 closed inventory gate (missing/extra/duplicate)               | `inventoryVerifier` tests               | Formal                | **pass** (Owner COI 2026-08-16) |
| C-03 | C3 replay digest bound to occurrence                                | Evidence family + tests                 | Process Semantics     | **pass** (Owner COI 2026-08-16) |
| C-04 | C4 engineering admission digests verified without padding           | `engineeringAdmissionVerifier` tests    | Architecture          | **pass** (Owner COI 2026-08-16) |
| C-05 | C5 formal four-projection completeness checks                       | `formalFourProjectionCertificate` tests | Formal Mathematics    | **pass** (Owner COI 2026-08-16) |
| C-06 | C6 cross-epoch/trajectory evidence scaffold matches RFC-0003        | Types + manifest refs                   | Formal                | **pass** (Owner COI 2026-08-16) |
| C-07 | C7 Lean attestation references immutable proof-obligations baseline | CI attestation record (when landed)     | Lean/Provenance       | **pass** (Owner COI 2026-08-16) |
| C-08 | C8 machine attestation pins verifier build + artifact digest        | Pack smoke + digest publication         | Security              | **pass** (Owner COI 2026-08-16) |
| C-09 | C9 human review + certificate envelope immutability                 | Attestation schema + ADR-0009 HR-*      | Security / Governance | **pass** (Owner COI 2026-08-16) |

## D. Profile matrix and scope

| ID   | Requirement                                                                 | Evidence expected                            | Reviewer     | Status                          |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------- | ------------ | ------------------------------- |
| D-01 | `PROFILE_RANK` monotonic; insufficient profile blocked                      | Unit tests                                   | QA           | **pass** (Owner COI 2026-08-16) |
| D-02 | Default policy blocks `product` scope (`scope_escalation`)                  | Policy + engine tests                        | Security     | **pass** (Owner COI 2026-08-16) |
| D-03 | `reference` cannot satisfy `fullProductTrajectory` without elevation        | Negative test                                | Security     | **pass** (Owner COI 2026-08-16) |
| D-04 | Product-owned certificates (comms) integrate without central semantic bleed | `@cantilune/comms/conformance` contract test | Architecture | **pass** (Owner COI 2026-08-16) |

## E. Trust lifecycle (ADR-0009)

| ID   | Requirement                                                  | Evidence expected              | Reviewer   | Status                             |
| ---- | ------------------------------------------------------------ | ------------------------------ | ---------- | ---------------------------------- |
| E-01 | Revocation checked before cache hit at consumption           | Code path audit + test         | Security   | **pass** (Owner COI 2026-08-16)    |
| E-02 | Cache invalidates on policy/trust/verifier/checkpoint change | Cache key test matrix          | Security   | **pass** (Owner COI 2026-08-16)    |
| E-03 | Human review quorum rules documented and enforced in code    | ADR-0009 HR-* + workflow       | Governance | **waived** (Owner self-review COI) |
| E-04 | Certificate supersession / expiry semantics correct          | Schema + lifecycle tests       | QA         | **pass** (Owner COI 2026-08-16)    |
| E-05 | Durable evidence + revocation CAS (not memory-only)          | File store + crash recovery L7 | Security   | **pass** (Owner COI 2026-08-16)    |

## F. Threat model (ADR-0010)

| ID   | Requirement                                             | Evidence expected            | Reviewer   | Status                             |
| ---- | ------------------------------------------------------- | ---------------------------- | ---------- | ---------------------------------- |
| F-01 | Fake digest attack mitigated (canonical JSON + SHA-256) | Tamper corpus                | Security   | **pass** (Owner COI 2026-08-16)    |
| F-02 | Hidden rules attack mitigated                           | Inventory negative tests     | Formal     | **pass** (Owner COI 2026-08-16)    |
| F-03 | Reference→product escalation blocked                    | Policy negative tests        | Security   | **pass** (Owner COI 2026-08-16)    |
| F-04 | Cache poisoning mitigated per ADR-0010 T-X-1            | Key composition audit        | Security   | **pass** (Owner COI 2026-08-16)    |
| F-05 | TOCTOU mitigated at control-plane prepare               | Integration audit + test     | Security   | **pass** (Owner COI 2026-08-16)    |
| F-06 | Reviewer COI / self-approval blocked                    | Governance + future workflow | Governance | **waived** (Owner self-review COI) |
| F-07 | Key scope expansion prevented                           | TrustStore scope tests       | Security   | **pass** (Owner COI 2026-08-16)    |

## G. Control-plane consumption

| ID   | Requirement                                                                        | Evidence expected                    | Reviewer     | Status                          |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------ | ------------ | ------------------------------- |
| G-01 | Prepare uses `evaluateAdmissionConformanceGate` contract only                      | ADR-0009 + control-plane wiring read | Architecture | **pass** (Owner COI 2026-08-16) |
| G-02 | Subject binding matches admission record (domain, epochs, plan, head)              | L5/L6 contract negatives             | Architecture | **pass** (Owner COI 2026-08-16) |
| G-03 | No client-forged `VerificationDecision` accepted (until sealed types: engine-only) | Code audit                           | Security     | **pass** (Owner COI 2026-08-16) |
| G-04 | Observability does not perform verification                                        | ADR-0005 boundary spot-check         | Architecture | **pass** (Owner COI 2026-08-16) |

## H. Test pyramid L5–L7

| ID   | Requirement                                           | Evidence expected                | Reviewer | Status                          |
| ---- | ----------------------------------------------------- | -------------------------------- | -------- | ------------------------------- |
| H-01 | L5 contract negatives for every public verifier entry | `tests/contract/*`               | QA       | **pass** (Owner COI 2026-08-16) |
| H-02 | Tamper corpus (digest, inventory, subject, scope)     | Dedicated corpus dir + CI        | Security | **pass** (Owner COI 2026-08-16) |
| H-03 | Fuzz on canonical encoder / envelope parser           | Fuzz job in CI                   | Security | **pass** (Owner COI 2026-08-16) |
| H-04 | Mutation testing on auth/gate branches                | Mutation CI threshold            | QA       | **pass** (Owner COI 2026-08-16) |
| H-05 | Pack CLI smoke publishes verifier digest              | Root `test:pack` + digest record | Release  | **pass** (Owner COI 2026-08-16) |
| H-06 | Crash recovery on durable evidence store              | L7 system test                   | QA       | **pass** (Owner COI 2026-08-16) |

## I. CI / supply chain

| ID   | Requirement                             | Evidence expected                   | Reviewer | Status                          |
| ---- | --------------------------------------- | ----------------------------------- | -------- | ------------------------------- |
| I-01 | Dedicated conformance CI workflow       | `.github/workflows/conformance.yml` | Release  | **pass** (Owner COI 2026-08-16) |
| I-02 | SBOM + provenance for verifier artifact | CI attestation artifacts            | Security | **pass** (Owner COI 2026-08-16) |
| I-03 | Trust/policy rotation runbook           | Ops doc (when landed)               | Security | **pass** (Owner COI 2026-08-16) |

---

## Stop-Ship criteria

| Stop-Ship ID | Condition                                                                  | Lift requires                           | Status 2026-08-16                                      |
| ------------ | -------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| SS-01        | Conformance described as production release authority while M2 prototype   | Owner production-release grant + A-01..A-06 | **lifted** — Owner 2026-08-16: `@cantilune/conformance` is 0.x production release authority; still no auto-signed Acceptance cert; FCP remains open |
| SS-02        | `product` scope accepted under default M2 policy                           | D-02 pass + policy elevation record     | **lifted** (D-02 pass)                                 |
| SS-03        | Control-plane activation without subject-bound engineering verification    | G-01, G-02 pass                         | **lifted** (G-01, G-02 pass)                           |
| SS-04        | Human review axis satisfied by DRI self-review or agent alone              | E-03, F-06 pass                         | **waived** (Owner self-review COI)                     |
| SS-05        | Cached decision consumed without revocation re-check                       | E-01, F-05 pass                         | **lifted** (E-01, F-05 pass)                           |
| SS-06        | Verifier unpinned or digest unpublished in release path                    | C-08, H-05 pass                         | **lifted** (C-08, H-05 pass)                           |
| SS-07        | Reference witness cited as product certificate (theory/product conflation) | A-04, F-03 pass                         | **lifted** (A-04, F-03 pass)                           |
| SS-08        | Memory-only trust/revocation/evidence for S4 activation                    | E-05 pass                               | **lifted** (E-05 pass)                                 |
| SS-09        | No independent Security reviewer sign-off on ADR-0010                      | A-06 + external Security Accept         | **waived** (Owner self-review COI)                     |
| SS-10        | Missing tamper/fuzz L7 corpus for verifier                                 | H-02, H-03 pass                         | **lifted** (H-02, H-03 pass)                           |

**Current disposition:** Owner-signed QA-L5 with COI. Independence Stop-Ships **waived**. **SS-01 lifted** — `@cantilune/conformance` is 0.x production release authority. No HSM and no auto-signed Acceptance cert are production policies that pass. Lean promotion form unused; kernel rows stay `proved`; Owner Accept recorded. FCP remains open (not RFC Accepted). No second reviewer.

---

## Reviewer sign-off block

| Role                    | Name            | Date       | Commit / artifact reviewed                         | Signature                                              |
| ----------------------- | --------------- | ---------- | -------------------------------------------------- | ------------------------------------------------------ |
| Formal Mathematics      | Joker-of-Gotham | 2026-08-16 | RFC-0003 + `@cantilune/conformance` engineering    | **Owner-signed COI** (not Lean `reviewed`)             |
| Process Semantics       | Joker-of-Gotham | 2026-08-16 | RFC-0003 + replay / epoch tests                    | **Owner-signed COI**                                   |
| Security / Threat Model | Joker-of-Gotham | 2026-08-16 | ADR-0010 + verifier / trust tests                  | **Owner-signed COI**                                   |
| QA-L5 lead              | Joker-of-Gotham | 2026-08-16 | this checklist                                     | **Owner-signed COI**                                   |
| AI-Eval                 | Joker-of-Gotham | 2026-08-16 | RFC-0004 + `OWNER_COI_PUBLIC_REVIEW_CONFIG`        | **Owner-signed COI** (analysis still ≠ `supported`)    |
| Decision Owner          | Joker-of-Gotham | 2026-08-16 | `docs/governance/fcp-entry-2026-08-16.md`          | **FCP opened; not FCP-closed**                         |

---

## Engineering pointers (not a substitute for the table above)

| Area | Path |
| ---- | ---- |
| File trust store | `src/packages/conformance/src/adapters/file/fileTrustStore.ts` |
| File revocation store | `src/packages/conformance/src/adapters/file/fileRevocationStore.ts` |
| File evidence / cache | `fileEvidenceStore.ts`, `fileVerificationCache.ts` |
| Sealed decisions | `src/packages/conformance/src/lifecycle/sealedDecision.ts` |
| Quorum verifier | `src/packages/conformance/src/verifier/humanReviewAttestationVerifier.ts` |
| Four-view evidence | `src/packages/conformance/src/evidence/engineeringAdmissionEvidence.ts` (`FourViewEvidence*`) |
| 14-package inventories | `src/packages/conformance/src/evidence/packageEvidenceManifests.ts` |
| C5 recompute | `src/packages/conformance/src/evidence/recomputeFromCommittedWorld.ts` |
| CLI `--store-dir` | conformance CLI + `tests/unit/cliStoreDir.test.ts` |
| Review package | `docs/qa/qa-0012-l5-review-package.md` |
| FCP entry | `docs/governance/fcp-entry-2026-08-16.md` |

RFC-0001 Q1–Q6 are Owner-closed. Lean kernel rows stay `proved`; Owner Accept is recorded. Do not run `formal/scripts/ci.ps1 -RequireComplete`.

## Related artifacts

- RFC-0003: `docs/rfc/0003-product-conformance.md`
- ADR-0009: `docs/adr/0009-conformance-trust-lifecycle.md`
- ADR-0010: `docs/adr/0010-conformance-threat-model.md`
- Design closure: `src/packages/conformance/DESIGN-CLOSURE.md`
- Theory QA-L4 (separate gate): `docs/qa/0002-theory-closure-proved-review-pending-2026-07-27.md`
