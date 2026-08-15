---
title: Conformance QA-L5 independent review checklist
document_type: quality-evidence-and-review-packet
status: review-pending
risk: S4
quality_target: QA-L5
maturity: M2 / pre-FCP
owner: Pending formal DRI assignment
dri: Joker-of-Gotham (interim)
updated: 2026-08-11
review_cycle: on every conformance-sensitive change
related: RFC-0003, ADR-0009, ADR-0010, @cantilune/conformance
---

# Conclusion

This is the **QA-L5 independent review checklist** for Cantilune Product Conformance (`@cantilune/conformance`). It is **not** an independent review signature.

**Aggregate governance state:** `review-pending` — no item below is marked complete by an independent reviewer. DRI implementation, agent review, and unit test pass do **not** satisfy this checklist.

Nothing in this document declares QA-L5 complete, RFC-0003 Accepted through FCP, or production release authority for conformance-gated activation.

## Classification and authority

| Field              | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Work object        | Product evidence verification, C0–C9 certificate chain, trust lifecycle, control-plane consumption          |
| Risk               | S4 when wired to activation/release; S2 for prototype-only use                                              |
| Quality target     | QA-L5: machine verification + independent formal/security review + tamper/fuzz L7                           |
| Maturity           | M2 prototype                                                                                                |
| Owner / DRI        | Pending / Joker-of-Gotham (interim)                                                                         |
| Decision authority | RFC-0003, ADR-0009, ADR-0010                                                                                |
| Review authority   | Independent formal, process-semantics, and security reviewers **not identical to verifier implementer DRI** |

## How to use this checklist

- Each item has: **ID**, **Requirement**, **Evidence expected**, **Reviewer role**, **Status**.
- Status values: `review-pending` | `pass` | `fail` | `waived` (waived requires Decision Owner written rationale — none recorded yet).
- **Stop-Ship:** Any `fail` on a Stop-Ship item blocks S4 closure and FCP entry for conformance-gated activation.

---

## A. Governance and documentation

| ID   | Requirement                                                                         | Evidence expected                                                  | Reviewer           | Status             |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ | ------------------ |
| A-01 | RFC-0003 accurately describes C0–C9, five questions, profile matrix, scope split    | `docs/rfc/0003-product-conformance.md` + code alignment spot-check | Architecture       | **review-pending** |
| A-02 | ADR-0009 trust lifecycle matches implemented ports and gate contracts               | ADR + `@cantilune/conformance/src/ports/*`                         | Security           | **review-pending** |
| A-03 | ADR-0010 STRIDE threats mapped to mitigations with honest OPEN residual disclosure  | ADR-0010 residual table                                            | Security           | **review-pending** |
| A-04 | Theory/product boundary not regressed (no CENTRAL proof → product release collapse) | RFC-0003 §5 + RFC-0002 §7.1 cross-read                             | Formal Mathematics | **review-pending** |
| A-05 | Engineering vs formal four-projection naming enforced in new code paths             | Grep / API review; deprecated alias isolated                       | Architecture       | **review-pending** |
| A-06 | Non-DRI reviewers assigned and COI documented                                       | `docs/governance/reviewer-assignments.md` updated                  | Governance         | **review-pending** |

## B. Five conformance questions (functional)

| ID   | Requirement                                                                                           | Evidence expected                       | Reviewer           | Status             |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------ | ------------------ |
| B-01 | **Q1 Provenance:** subject + inventory binding rejects mismatch/tamper                                | Negative unit/contract tests            | Formal / QA        | **review-pending** |
| B-02 | **Q2 Replay:** nondeterministic replay rejected with structured violation                             | Test corpus entry                       | Process Semantics  | **review-pending** |
| B-03 | **Q3 Engineering:** control-plane path uses `engineeringAdmission` only                               | ADR-0006 + engine integration test      | Architecture       | **review-pending** |
| B-04 | **Q3 Formal:** four-projection path requires C5 digests; no engineering-only shortcut at release rank | Verifier + release gate tests           | Formal Mathematics | **review-pending** |
| B-05 | **Q4 Cross-epoch:** monotone epoch chain violations surfaced                                          | Cross-epoch test scaffold (when landed) | Process Semantics  | **review-pending** |
| B-06 | **Q5 Trust chain:** expired/revoked/unpinned verifier rejected at consumption                         | Revocation + policy tests               | Security           | **review-pending** |

## C. Certificate chain C0–C9

| ID   | Requirement                                                         | Evidence expected                       | Reviewer              | Status             |
| ---- | ------------------------------------------------------------------- | --------------------------------------- | --------------------- | ------------------ |
| C-01 | C0 policy/trust baseline recorded in certificate + cache key        | Schema + ADR-0009 TR-*                  | Security              | **review-pending** |
| C-02 | C1–C2 closed inventory gate (missing/extra/duplicate)               | `inventoryVerifier` tests               | Formal                | **review-pending** |
| C-03 | C3 replay digest bound to occurrence                                | Evidence family + tests                 | Process Semantics     | **review-pending** |
| C-04 | C4 engineering admission digests verified without padding           | `engineeringAdmissionVerifier` tests    | Architecture          | **review-pending** |
| C-05 | C5 formal four-projection completeness checks                       | `formalFourProjectionCertificate` tests | Formal Mathematics    | **review-pending** |
| C-06 | C6 cross-epoch/trajectory evidence scaffold matches RFC-0003        | Types + manifest refs                   | Formal                | **review-pending** |
| C-07 | C7 Lean attestation references immutable proof-obligations baseline | CI attestation record (when landed)     | Lean/Provenance       | **review-pending** |
| C-08 | C8 machine attestation pins verifier build + artifact digest        | Pack smoke + digest publication         | Security              | **review-pending** |
| C-09 | C9 human review + certificate envelope immutability                 | Attestation schema + ADR-0009 HR-*      | Security / Governance | **review-pending** |

## D. Profile matrix and scope

| ID   | Requirement                                                                 | Evidence expected                            | Reviewer     | Status             |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------- | ------------ | ------------------ |
| D-01 | `PROFILE_RANK` monotonic; insufficient profile blocked                      | Unit tests                                   | QA           | **review-pending** |
| D-02 | Default policy blocks `product` scope (`scope_escalation`)                  | Policy + engine tests                        | Security     | **review-pending** |
| D-03 | `reference` cannot satisfy `fullProductTrajectory` without elevation        | Negative test                                | Security     | **review-pending** |
| D-04 | Product-owned certificates (comms) integrate without central semantic bleed | `@cantilune/comms/conformance` contract test | Architecture | **review-pending** |

## E. Trust lifecycle (ADR-0009)

| ID   | Requirement                                                  | Evidence expected              | Reviewer   | Status             |
| ---- | ------------------------------------------------------------ | ------------------------------ | ---------- | ------------------ |
| E-01 | Revocation checked before cache hit at consumption           | Code path audit + test         | Security   | **review-pending** |
| E-02 | Cache invalidates on policy/trust/verifier/checkpoint change | Cache key test matrix          | Security   | **review-pending** |
| E-03 | Human review quorum rules documented and enforced in code    | ADR-0009 HR-* + workflow       | Governance | **review-pending** |
| E-04 | Certificate supersession / expiry semantics correct          | Schema + lifecycle tests       | QA         | **review-pending** |
| E-05 | Durable evidence + revocation CAS (not memory-only)          | File store + crash recovery L7 | Security   | **review-pending** |

## F. Threat model (ADR-0010)

| ID   | Requirement                                             | Evidence expected            | Reviewer   | Status             |
| ---- | ------------------------------------------------------- | ---------------------------- | ---------- | ------------------ |
| F-01 | Fake digest attack mitigated (canonical JSON + SHA-256) | Tamper corpus                | Security   | **review-pending** |
| F-02 | Hidden rules attack mitigated                           | Inventory negative tests     | Formal     | **review-pending** |
| F-03 | Reference→product escalation blocked                    | Policy negative tests        | Security   | **review-pending** |
| F-04 | Cache poisoning mitigated per ADR-0010 T-X-1            | Key composition audit        | Security   | **review-pending** |
| F-05 | TOCTOU mitigated at control-plane prepare               | Integration audit + test     | Security   | **review-pending** |
| F-06 | Reviewer COI / self-approval blocked                    | Governance + future workflow | Governance | **review-pending** |
| F-07 | Key scope expansion prevented                           | TrustStore scope tests       | Security   | **review-pending** |

## G. Control-plane consumption

| ID   | Requirement                                                                        | Evidence expected                    | Reviewer     | Status             |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------ | ------------ | ------------------ |
| G-01 | Prepare uses `evaluateAdmissionConformanceGate` contract only                      | ADR-0009 + control-plane wiring read | Architecture | **review-pending** |
| G-02 | Subject binding matches admission record (domain, epochs, plan, head)              | L5/L6 contract negatives             | Architecture | **review-pending** |
| G-03 | No client-forged `VerificationDecision` accepted (until sealed types: engine-only) | Code audit                           | Security     | **review-pending** |
| G-04 | Observability does not perform verification                                        | ADR-0005 boundary spot-check         | Architecture | **review-pending** |

## H. Test pyramid L5–L7

| ID   | Requirement                                           | Evidence expected                | Reviewer | Status             |
| ---- | ----------------------------------------------------- | -------------------------------- | -------- | ------------------ |
| H-01 | L5 contract negatives for every public verifier entry | `tests/contract/*`               | QA       | **review-pending** |
| H-02 | Tamper corpus (digest, inventory, subject, scope)     | Dedicated corpus dir + CI        | Security | **review-pending** |
| H-03 | Fuzz on canonical encoder / envelope parser           | Fuzz job in CI                   | Security | **review-pending** |
| H-04 | Mutation testing on auth/gate branches                | Mutation CI threshold            | QA       | **review-pending** |
| H-05 | Pack CLI smoke publishes verifier digest              | Root `test:pack` + digest record | Release  | **review-pending** |
| H-06 | Crash recovery on durable evidence store              | L7 system test                   | QA       | **review-pending** |

## I. CI / supply chain

| ID   | Requirement                             | Evidence expected                   | Reviewer | Status             |
| ---- | --------------------------------------- | ----------------------------------- | -------- | ------------------ |
| I-01 | Dedicated conformance CI workflow       | `.github/workflows/conformance.yml` | Release  | **review-pending** |
| I-02 | SBOM + provenance for verifier artifact | CI attestation artifacts            | Security | **review-pending** |
| I-03 | Trust/policy rotation runbook           | Ops doc (when landed)               | Security | **review-pending** |

---

## Stop-Ship criteria

**Stop-Ship active** for any of the following until independently reviewed and closed:

| Stop-Ship ID | Condition                                                                  | Lift requires                           |
| ------------ | -------------------------------------------------------------------------- | --------------------------------------- |
| SS-01        | Conformance described as production release authority while M2 prototype   | RFC-0003 FCP + QA-L5 pass on A-01..A-06 |
| SS-02        | `product` scope accepted under default M2 policy                           | D-02 pass + policy elevation record     |
| SS-03        | Control-plane activation without subject-bound engineering verification    | G-01, G-02 pass                         |
| SS-04        | Human review axis satisfied by DRI self-review or agent alone              | E-03, F-06 pass                         |
| SS-05        | Cached decision consumed without revocation re-check                       | E-01, F-05 pass                         |
| SS-06        | Verifier unpinned or digest unpublished in release path                    | C-08, H-05 pass                         |
| SS-07        | Reference witness cited as product certificate (theory/product conflation) | A-04, F-03 pass                         |
| SS-08        | Memory-only trust/revocation/evidence for S4 activation                    | E-05 pass                               |
| SS-09        | No independent Security reviewer sign-off on ADR-0010                      | A-06 + external Security Accept         |
| SS-10        | Missing tamper/fuzz L7 corpus for verifier                                 | H-02, H-03 pass                         |

**Current disposition:** **Stop-Ship active** — all SS-* lift conditions remain open; aggregate status **`review-pending`**.

---

## Reviewer sign-off block (intentionally empty)

| Role                    | Name                          | Date | Commit / artifact reviewed | Signature                                   |
| ----------------------- | ----------------------------- | ---- | -------------------------- | ------------------------------------------- |
| Formal Mathematics      | _unassigned_                  | —    | —                          | **review-pending**                          |
| Process Semantics       | _unassigned_                  | —    | —                          | **review-pending**                          |
| Security / Threat Model | _unassigned_                  | —    | —                          | **review-pending**                          |
| QA-L5 lead              | _unassigned_                  | —    | —                          | **review-pending**                          |
| Decision Owner          | Joker-of-Gotham (interim DRI) | —    | —                          | **not a substitute for independent review** |

---

## Related artifacts

- RFC-0003: `docs/rfc/0003-product-conformance.md`
- ADR-0009: `docs/adr/0009-conformance-trust-lifecycle.md`
- ADR-0010: `docs/adr/0010-conformance-threat-model.md`
- Design closure: `src/packages/conformance/DESIGN-CLOSURE.md`
- Theory QA-L4 (separate gate): `docs/qa/0002-theory-closure-proved-review-pending-2026-07-27.md`
