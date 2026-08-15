# RFC-0003: Product Conformance — Evidence, Certificates, and Release Gates

| Field                     | Value                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                    | **Draft** (pre-FCP)                                                                                                                                                                                     |
| Type                      | Architecture / Governance                                                                                                                                                                               |
| Risk                      | S4 when used for control-plane activation or product release; S2 for drafting scope                                                                                                                     |
| Champion / Decision Owner | Joker-of-Gotham (DRI)                                                                                                                                                                                   |
| Required Reviewers        | Formal Mathematics, Process Semantics, Security/Threat Model, QA-L5 (all **TBD / review-pending**; interim DRI with COI — see `docs/governance/reviewer-assignments.md`)                                |
| Created                   | 2026-08-11                                                                                                                                                                                              |
| Updated                   | 2026-08-11                                                                                                                                                                                              |
| Related                   | RFC-0001 §8, RFC-0002 §7.1, ADR-0001, ADR-0006, ADR-0009, ADR-0010, `@cantilune/conformance`, `formal/proof-obligations.json`, `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` |

> **Governance note:** This RFC is the canonical source for **Product Conformance** — the post–Core-Theory gate where concrete packages supply operational evidence, machine verification, human review, and sealed release decisions. Chat discussion is not authoritative. Nothing in this RFC claims QA-L5 complete, independent review signed, or production release authority.

> **Boundary correction (inherits RFC-0002 §7.1):** Core Theory FCP (`proved / review-pending` at QA-L4) proves generic certificate interfaces are satisfiable via reference witnesses. **Product Conformance is a separate gate.** Eight planned product distributions do not block theory closure; their absence is expected until post-FCP package work begins.

---

## 1. Summary

`@cantilune/conformance` is the **product evidence verification and release-gate module**. It answers five independent questions about a package or admission subject, binds evidence through a **C0–C9 certificate chain**, selects a **verification profile** from a ranked matrix, and emits **sealed `VerificationDecision` values** consumable only by authorized downstream gates (control-plane schema activation, fleet rollout, product release).

Product Conformance **does not re-prove Lean theorems in TypeScript**. It verifies that supplied product evidence satisfies the interfaces already defined in Core Theory and recorded in `formal/proof-obligations.json`.

**Current implementation status:** M1–M2 engineering prototype. **NOT** production admission or release authority until ADR-0009, ADR-0010, and QA-L5 review close.

## 2. Motivation

### 2.1 Problem

Without an explicit Product Conformance gate, three failure modes recur:

| Failure mode                       | Symptom                                                                    | Root cause                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Theory/product conflation          | "CENTRAL-18 proved" treated as "@cantilune/runtime shipped"                | Kernel proof status collapsed into product release boolean                                      |
| Engineering/formal view conflation | Control-plane accepts dependency/resource digests as four-projection proof | `EngineeringAdmissionEvidence` and `FormalFourProjectionCertificate` treated as interchangeable |
| Scope escalation                   | Reference witness cited as product claim for untested rules                | `generic` / `reference` / `product` claim scopes not enforced                                   |

Research log 0018 and RFC-0002 §7.1 established the theory/product split. This RFC operationalizes the **product side**: what evidence each package must supply, how it is verified, and what downstream systems may trust.

### 2.2 Who benefits / why now / cost of inaction

- **Beneficiaries:** package owners, control-plane operators, release engineers, independent reviewers needing a falsifiable evidence contract.
- **Why now:** `@cantilune/control-plane` (ADR-0006) already consumes four-view evidence at prepare/commit; `@cantilune/comms` ships a product-owned certificate scaffold. Without RFC-0003, those integrations lack a governing contract.
- **Cost of inaction:** false release claims; reference→product escalation; cache-poisoned or digest-forged evidence accepted at activation boundaries.

## 3. Goals

1. Define the **C0–C9 certificate chain** and its mapping to evidence families, theory baselines, and release artifacts.
2. Formalize the **five conformance questions** as independent verification obligations with explicit pass/fail semantics.
3. Publish the **profile matrix** (`ConformanceProfile` × `ClaimScope`) and escalation rules.
4. **Permanently separate** engineering admission evidence from formal four-projection certificates while allowing subject binding.
5. Scope **generic**, **reference**, and **product** claims with policy-enforced ceilings.
6. Document **non-goals** and explicit handoff to the RFC-0001 evaluation harness (separate future ADR; not ADR-0005 reuse).
7. Provide governance hooks for ADR-0009 (trust lifecycle) and ADR-0010 (threat model).

## 4. Non-goals

- Re-proving Lean theorems or mutating `formal/proof-obligations.json` status from TypeScript.
- Runtime commit, control-plane catalog mutation, or holding private signing keys inside `@cantilune/conformance`.
- Treating Vitest pass, non-empty certificate fields, or DRI self-review as product conformance.
- Replacing QA-L4 theory review (`docs/qa/0002-theory-closure-proved-review-pending-2026-07-27.md`).
- Defining benchmark metrics or baseline comparison harnesses (handoff to eval ADR per RFC-0001 §8).
- Auto-approving human review or bypassing revocation / expiry checks.

## 5. Background

### 5.1 Relationship to Core Theory

| Layer                    | Authority                       | Status axis                           | Blocks                           |
| ------------------------ | ------------------------------- | ------------------------------------- | -------------------------------- |
| Core Theory (Lean)       | `formal/proof-obligations.json` | `theory`                              | Generic interface satisfiability |
| Product Conformance (TS) | `@cantilune/conformance`        | `machine` + `humanReview` + `release` | Package activation / release     |
| Eval harness (future)    | RFC-0001 §8 falsifiable claims  | benchmark evidence                    | Superiority claims vs baselines  |

**Invariant:** `kernel proved ≠ product verified ≠ human reviewed ≠ released` (four separated status axes in `ConformanceStatusAxes`).

### 5.2 Engineering vs formal four-projection split

| Engineering concept                                                                  | Formal concept                                                                                   | Used by                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `EngineeringAdmissionEvidence` — dependency / resource / session / structure digests | `FormalFourProjectionCertificate` — DAG / Petri / π / Morphism digests + shared execution digest | Control-plane prepare (engineering); product release (formal) |
| Profile: `engineeringAdmission`                                                      | Profiles: `fourProjection`, `crossEpochProduct`, `fullProductTrajectory`, …                      | ADR-0006 admission; package release gates                     |

Both may bind the same `AdmissionSubject` (domain, epochs, plan digest, runtime head). **They are not interchangeable types** and must not share the deprecated umbrella name `FourViewEvidence` in new code (alias retained M2 for control-plane harness compatibility only).

### 5.3 Claim scopes

| Scope       | Meaning                                                                | Default policy (M2)                        |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| `generic`   | Interface-level or cross-package pattern; no product-specific rules    | Allowed                                    |
| `reference` | Substantive reference execution (e.g. reconnect matrix, comms harness) | Allowed                                    |
| `product`   | Concrete package rule inventory + runtime operational facts            | **Blocked** until policy elevation + QA-L5 |

Scope escalation without policy change is a **Stop-Ship** violation (`scope_escalation`).

## 6. Proposal

### 6.1 Five conformance questions

Each verification run MUST answer all five questions independently. A single boolean MUST NOT collapse them.

| #   | Question                                                                                                                                                   | Primary evidence                                                        | Certificate stages | Failure codes (examples)                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| Q1  | **Provenance:** Which exact source tree, artifact, rule inventory, epoch, and occurrence does this evidence describe?                                      | C1 artifact provenance, C2 rule inventory + occurrence                  | C0–C2              | `inventory_incomplete`, `subject_mismatch`, `digest_invalid`     |
| Q2  | **Replay:** Can the occurrence be deterministically replayed under runtime rules?                                                                          | C3 replay evidence                                                      | C2–C3              | `replay_nondeterministic`, `recipe_mismatch`                     |
| Q3  | **Four-projection:** Is the run sound, reflecting, replay-consistent, and terminal-compatible across DAG / Petri / π / Morphism?                           | C5 formal four-projection (+ C4 engineering admission where applicable) | C4–C5              | `projection_incomplete`, `terminal_drift`                        |
| Q4  | **Cross-epoch:** Is schema/epoch admission strictly monotone and aligned with business occurrences at boundaries?                                          | C6 cross-epoch + formal admission                                       | C6                 | `epoch_chain_break`, `admission_non_monotone`                    |
| Q5  | **Trust chain:** Was verification performed by a pinned verifier build, under current trust roots, with valid human review, and without revocation/expiry? | C7–C9 attestation chain                                                 | C0, C7–C9          | `verifier_unpinned`, `revoked`, `review_insufficient`, `expired` |

**Q3 split:** Control-plane schema activation (ADR-0006) requires **Q1 + Q2 + engineering Q3-subset** via `engineeringAdmission` profile. Product release and `fourProjection` profiles require **full formal Q3** plus Q4–Q5 as profile demands.

### 6.2 C0–C9 certificate chain

The chain is **ordered and compositional**: later stages MUST reference digests from earlier stages. C0 is the policy/trust anchor; C1–C9 are evidence and attestation layers.

```
C0 Policy + TrustRootSet + theoryBaselineRef
 │
 ├─► C1 ArtifactProvenance (commit, tree, lockfile, toolchain)
 │    │
 │    ├─► C2 RuleInventory + SourceOccurrence
 │    │    │
 │    │    ├─► C3 ReplayEvidence (deterministic recipe)
 │    │    │    │
 │    │    │    ├─► C4 EngineeringAdmissionEvidence (dep/resource/session/structure)
 │    │    │    │    │
 │    │    │    │    └─► C5 FormalFourProjectionCertificate (DAG·Petri·π·Morphism)
 │    │    │    │              │
 │    │    │    │              └─► C6 CrossEpoch + Trajectory + FormalAdmission
 │    │    │    │                        │
 │    │    │    │                        └─► C7 LeanBuildAttestation (proof manifest bridge)
 │    │    │    │                                  │
 │    │    │    │                                  └─► C8 MachineVerificationAttestation
 │    │    │    │                                            │
 │    │    │    │                                            └─► C9 HumanReview + PackageConformanceCertificate
```

| Stage  | Artifact                                                                    | Binds                                                                   | Theory anchor (informative)               |
| ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| **C0** | `VerificationPolicy`, `TrustStore` version, `theoryBaselineRef`             | Allowed profiles/scopes, trust roots, proof-obligations baseline commit | Policy gate                               |
| **C1** | `ArtifactProvenanceEvidence`                                                | Immutable source identity                                               | —                                         |
| **C2** | Closed `RuleInventory` + `SourceOccurrenceEvidence`                         | Enumerable rules; occurrence before/after refs                          | Completeness gate                         |
| **C3** | `ReplayEvidence`                                                            | Deterministic replay under declared rules                               | CENTRAL-06 alignment                      |
| **C4** | `EngineeringAdmissionEvidence`                                              | Operational four-view digests for admission subjects                    | Control-plane ADR-0006                    |
| **C5** | `FormalFourProjectionCertificate`                                           | DAG / Petri / π / Morphism + shared execution digests                   | CENTRAL-07–10, generic P1a scope          |
| **C6** | `CrossEpochEvidence`, `CommonTrajectoryEvidence`, `FormalAdmissionEvidence` | Epoch chains, trajectory agreement, admission extension                 | CENTRAL-18 / cross-epoch family           |
| **C7** | `LeanBuildAttestation`                                                      | Pinned Lean toolchain + proof manifest digest                           | `proof-obligations.json` baseline         |
| **C8** | `MachineVerificationAttestation`                                            | Pinned `verifierBuild` + `decisionDigest`                               | `@cantilune/conformance` release artifact |
| **C9** | `HumanReviewAttestation` + `PackageConformanceCertificate`                  | Quorum review + sealed release decision                                 | QA-L5 sign-off                            |

**PackageConformanceCertificate** (C9 envelope) aggregates: profile, artifact subject, evidence root digest, proof manifest digest, verifier build/digest, policy/trust/revocation checkpoints, machine decision ref, human review refs, validity window, optional supersedes link, and four-axis status.

Product-owned certificates (e.g. `@cantilune/comms/conformance` `CommsProductCertificate`) MUST embed into C2–C5 evidence via package-local producers; the central engine verifies structure and digest binding, not comms-specific semantics.

### 6.3 Profile matrix

Profiles are **ranked** (`PROFILE_RANK`). A holder profile MUST be ≥ required profile. Each profile MAY only claim scopes permitted by active `VerificationPolicy`.

| Profile                    | Rank | Typical scope       | Minimum chain             | Primary consumer                     |
| -------------------------- | ---- | ------------------- | ------------------------- | ------------------------------------ |
| `operationalProjection`    | 1    | generic             | C0–C3                     | Diagnostics                          |
| `completeProjection`       | 2    | generic / reference | C0–C4                     | Partial admission audits             |
| `engineeringAdmission`     | 3    | generic / reference | C0–C4                     | **Control-plane prepare** (ADR-0006) |
| `fourProjection`           | 3    | reference / product | C0–C5                     | Formal projection release            |
| `fixedEpochRule`           | 4    | reference / product | C0–C5                     | Single-epoch rule closure            |
| `crossEpochProduct`        | 5    | reference / product | C0–C6                     | Cross-epoch admission                |
| `canonicalProtocol`        | 6    | reference / product | C0–C6 + product extension | Comms / protocol packages            |
| `canonicalProtocolWithFms` | 7    | reference / product | C0–C6 + FMS alignment     | π/FMS-aligned products               |
| `fullProductTrajectory`    | 8    | **product**         | C0–C9 complete            | Full product release                 |

**M2 default policy** (`DEFAULT_VERIFICATION_POLICY`): `allowedClaimScopes = [generic, reference]`, `minimumProfile = engineeringAdmission`, `requireHumanReview = true`. Product scope and ranks ≥ 6 require explicit policy elevation and QA-L5 review.

### 6.4 Verification engine contract

Public entry points (M2):

- `createConformanceEngine` — orchestrates store/trust/revocation/cache/audit ports
- `verifyEngineeringAdmissionEvidence` / deprecated `verifyFourViewEvidence` alias
- `inspectCandidate`, `verifyPackage`, `listMissingEvidence`
- Gates: `evaluateAdmissionConformanceGate`, `evaluateReleaseConformanceGate`

**Return type rule:** `Result<VerificationDecision, ConformanceViolation[]>` — boolean-only APIs are forbidden for gate decisions.

**Sealed consumption rule:** Downstream systems (control-plane, release automation) MUST accept only decisions where:

- `status.machine === "verified"` AND `violations.length === 0`
- Profile matches gate (`engineeringAdmission` or `crossEpochProduct` for admission; release gate additionally requires `humanReview === "approved"` and `release === "accepted"`)
- Decision not expired/revoked per ADR-0009

M2 prototype returns `conditional` / `blocked` for most product paths; this is expected.

### 6.5 Ports and adapters

| Port                | Responsibility                                          |
| ------------------- | ------------------------------------------------------- |
| `EvidenceStore`     | Content-addressed evidence blobs (immutable CAS target) |
| `TrustStore`        | Scoped trust roots with validity window                 |
| `RevocationStore`   | Certificate and checkpoint revocation                   |
| `VerificationCache` | Keyed by evidence root + policy + verifier build        |
| `AuditSink`         | Append-only verification audit trail                    |

Memory adapters ship M2; file/durable CAS is **open** (Stop-Ship for S4).

### 6.6 Product package obligations (post-FCP, per-package)

Each real package (Cantilune, Libretto, Cast, Baton, Cue, Chorus, Reprise, Cantilune Notation) MUST supply:

1. `ConformanceTargetManifest` + closed `RuleInventory`
2. Per-rule evidence filling C2–C5 (and C6+ as profile requires)
3. Runtime operational facts (resource/session, authorization, fairness, ε) — not inferable from package name
4. Product-local conformance module under `src/conformance/` when domain-specific (pattern: `@cantilune/comms/conformance`)
5. L5–L7 tests: tamper corpus, negative contracts, pack CLI smoke

See `docs/research/0008-product-package-certificate-audit-2026-07-26.md` for current negative finding (no production package inhabitants yet).

## 7. Evaluation harness handoff

RFC-0001 §8 defines five **falsifiable superiority claims** (C1 expressiveness, C2 step-bounded predictability, C3 control-plane slimness, C4 engineering parsimony, C5 observability-as-structure) requiring an eval harness before public benchmark claims. **Note:** C4 was redefined from "observability-as-structure" to "engineering parsimony" per RFC-0004 §1; observability-as-structure is now C5. See RFC-0004 for the evaluation.c1–evaluation.c5 namespace and detailed claim definitions.

**Boundary:**

| Concern                                                               | Owner module                                                                    | This RFC         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| Evidence correctness, certificate chain, release gate                 | `@cantilune/conformance`                                                        | **In scope**     |
| Baseline comparison runs, metric collection, benchmark falsifiability | Future **eval harness ADR** (new; **not** ADR-0005 observability read boundary) | **Handoff only** |

**Handoff contract:**

1. Eval harness MUST consume **sealed C9 `PackageConformanceCertificate`** (or equivalent release decision) before attributing benchmark results to a product version.
2. Conformance MUST NOT embed benchmark logic or issue superiority claims.
3. Eval harness MUST record: artifact subject, verifier build, policy version, and evidence root digest alongside every published metric row.
4. RFC-0001 §8 claims remain **unverified** until eval ADR Accepted + harness CI exists.

**Next artifact:** Eval Harness RFC/ADR pair (tracked separately; referenced from RFC-0001 implementation table).

## 8. Security / correctness implications

- Product Conformance is a **trust boundary** when wired to control-plane or release automation (S4).
- Threat model: **ADR-0010** (STRIDE mapping to conformance module).
- Trust lifecycle: **ADR-0009** (roots, revocation, quorum, cache invalidation, verifier pinning).
- M2 prototype MUST NOT be described as production-ready regardless of test pass rate.

## 9. Test / QA plan

| Tier  | Scope                                                                                    | Status                                                            |
| ----- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| L2–L4 | Unit/contract for digest binding, inventory completeness, engineering admission verifier | Partial (in repo)                                                 |
| L5    | Independent formal + security + QA-L5 review                                             | **review-pending** — `docs/qa/conformance-l5-review-checklist.md` |
| L6    | Integration with control-plane prepare/commit negative paths                             | Partial                                                           |
| L7    | Tamper corpus, fuzz, mutation, crash recovery, pack CLI                                  | **OPEN**                                                          |
| CI    | Dedicated conformance workflow with SBOM/provenance                                      | **OPEN**                                                          |

## 10. Compatibility / migration

- Deprecated `FourViewEvidence*` aliases remain until control-plane harness migrates naming.
- New code MUST use `EngineeringAdmissionEvidence` vs `FormalFourProjectionCertificate` explicitly.
- Policy version bumps invalidate verification cache entries (ADR-0009).

## 11. Open questions

1. **Human review quorum:** minimum roles and independence rules (proposed in ADR-0009; FCP resolution required).
2. **File/durable evidence CAS:** single-writer layout vs shared object store (implementation ADR follow-up).
3. **External signing tool:** HSM vs sigstore vs manual quorum (M3+).
4. **Lean bridge automation:** attestation generation from CI vs manual upload (M3+).
5. **Second reviewer assignment** for Product Conformance RFC/ADRs (governance gap).

## 12. FCP summary (not yet entered)

**Pre-FCP.** Draft complete for governance review. Entry requires:

- Independent Formal + Security + QA-L5 review per checklist (all items review-pending)
- ADR-0009 and ADR-0010 external Security + Formal independent Accept (engineering scope Accepted; FCP sign-off pending)
- Resolution of open questions Q1–Q5
- Non-DRI second reader assigned

## 13. Decision record

- **Triage:** Product Conformance separated from Core Theory per research 0018 / RFC-0002 §7.1.
- **RFC status:** Draft, 2026-08-11.
- **Implementation status:** M1–M2 prototype in `@cantilune/conformance`; NOT release authority.

## 14. Implementation / ADR tracking

| Artifact                             | Status                                                          | Blocks             |
| ------------------------------------ | --------------------------------------------------------------- | ------------------ |
| ADR-0009 Conformance trust lifecycle | **Accepted** (M2–M3 engineering scope; external review pending) | S4 closure         |
| ADR-0010 Conformance threat model    | **Accepted** (M2–M3 engineering scope; external review pending) | S4 closure         |
| QA-L5 checklist                      | **review-pending**                                              | FCP                |
| Immutable evidence CAS               | OPEN                                                            | S4                 |
| Verified/Reviewed sealed types       | OPEN                                                            | S4                 |
| Eval harness ADR                     | Not started                                                     | RFC-0001 §8 claims |

## Next Steps

| Action                               | Owner                             | Due/Review | Canonical Link                               |
| ------------------------------------ | --------------------------------- | ---------- | -------------------------------------------- |
| Independent QA-L5 review kickoff     | Formal + Security reviewers (TBD) | Pre-FCP    | `docs/qa/conformance-l5-review-checklist.md` |
| Accept ADR-0009 / ADR-0010           | DRI + Security                    | Pre-FCP    | `docs/adr/0009-*`, `docs/adr/0010-*`         |
| File durable evidence store          | Engineering                       | M3         | `@cantilune/conformance` ports               |
| Assign non-DRI conformance reviewers | DRI                               | Pre-FCP    | `docs/governance/reviewer-assignments.md`    |
