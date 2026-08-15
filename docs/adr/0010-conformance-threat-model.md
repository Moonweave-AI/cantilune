# ADR-0010: Conformance Threat Model and Verification Boundaries

| Field          | Value                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (M2–M3 engineering scope — mitigations partially scaffolded; independent Security review **pending**)                             |
| Date           | 2026-08-11                                                                                                                                     |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                          |
| Reviewers      | Joker-of-Gotham (DRI interim Security); external Security reviewer recruitment open before FCP — see `docs/governance/reviewer-assignments.md` |
| Related        | RFC-0003, ADR-0009, ADR-0006, ADR-0007, ADR-0003, `@cantilune/conformance`, `@cantilune/control-plane`, `diagrams/04-control-plane/`           |

## Context

RFC-0003 establishes Product Conformance as an S4 trust boundary when wired to control-plane activation or product release. ADR-0009 defines trust lifecycle rules. A conformance-specific threat model is required before treating `@cantilune/conformance` as more than an M2 prototype — analogous to ADR-0003 (runtime) and ADR-0007 (control-plane).

Stop-Ship review (2026-08-11) identified conformance-adjacent risks: digest forgery, hidden rule inventories, reference→product scope escalation, cache poisoning, verification TOCTOU, reviewer conflict of interest, and signing key scope expansion.

## Threat actors and assets

| Actor                           | Capability                                       | Primary assets                                 |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| External evidence submitter     | Supplies manifests, bundles, certificate JSON    | Evidence store, verification decisions         |
| Compromised package owner       | Omits rules, inflates scope, self-attests review | Rule inventory, claim scope, human review axis |
| Compromised CI / build pipeline | Substitutes artifacts, unpinned verifier         | Verifier build digest, SBOM/provenance         |
| Malicious downstream consumer   | Replays stale cached decision at control-plane   | Activation gate integrity                      |
| Reviewer with COI               | Self-approves or approves without quorum         | Human review attestations                      |
| Trust operator                  | Rotates or expands key scope improperly          | Trust root set, signing keys                   |
| Storage fault injector          | Partial evidence writes, stale cache persistence | Evidence CAS, cache, revocation journal        |

## Trust boundaries

```
Untrusted manifest/bundle ──► policy scope check ──► inventory completeness gate
                                      │
EvidenceStore fetch ◄── digest verify ──► envelope verifier
                                      │
TrustStore + RevocationStore ◄── checkpoint ──► verification engine
                                      │
VerificationCache (key = f(evidence, policy, trust, verifier, checkpoint))
                                      │
VerificationDecision ──► admission/release gate ──► control-plane prepare (ADR-0006)
```

| Boundary        | Rule                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Ingress         | Manifest `claimScope` and `requestedProfile` checked against `VerificationPolicy` before verify     |
| Evidence        | SHA-256 digests over canonical JSON; no verifier-side digest padding                                |
| Subject binding | Bundle subject MUST match admission subject (domain, epochs, plan digest, head)                     |
| Inventory       | Closed rule set: no missing, extra, or duplicate rule IDs                                           |
| Cache           | Key includes revocation checkpoint; consumption re-checks revocation + expiry                       |
| Output          | Gates consume engine output only; no caller-forged `VerificationDecision` (until sealed types land) |
| Downstream      | Control-plane does not mutate conformance status axes                                               |

## STRIDE analysis

### S — Spoofing

| ID    | Threat                                         | Mitigation                                                                      | Module / status                        |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| T-S-1 | Forged human review attestation                | TrustStore scoped keys; HR-3 COI rules (ADR-0009); external signing tool (OPEN) | `ports/trustStore`, attestation schema |
| T-S-2 | Spoofed package provenance (wrong commit/tree) | C1 `ArtifactProvenanceEvidence` digest binding; CI provenance (OPEN)            | `evidenceFamilies`, CI                 |
| T-S-3 | Impersonated reviewer ID in attestation        | Trust root scope per role; quorum enforcement (OPEN)                            | ADR-0009 HR-*                          |

### T — Tampering

| ID    | Threat                                                                   | Mitigation                                                                            | Module / status                                                  |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| T-T-1 | **Fake digest** — valid-looking SHA-256 not over canonical content       | `computeEvidenceDigest` + `assertSha256HexDigest`; envelope verifier rejects mismatch | `canonical/evidenceDigest.ts`, `verifier/envelopeVerifier.ts` ✅ |
| T-T-2 | **Hidden rules** — omit rules from inventory while claiming completeness | `verifyRuleInventoryCompleteness` (missing/extra/duplicate)                           | `verifier/inventoryVerifier.ts` ✅                               |
| T-T-3 | Evidence blob swap after machine verify                                  | Immutable evidence CAS + content-addressed fetch (memory ✅; durable OPEN)            | `ports/evidenceStore`                                            |
| T-T-4 | Mutate certificate after issuance                                        | Immutable certificate record; changes via `supersedes` only                           | `certificate/packageConformanceCertificate.ts` ✅ schema         |

### R — Repudiation

| ID    | Threat                         | Mitigation                                                                  | Module / status                  |
| ----- | ------------------------------ | --------------------------------------------------------------------------- | -------------------------------- |
| T-R-1 | Deny verification run occurred | `AuditSink` append-only events with runId, profile, digest                  | `ports/auditSink` ✅ memory      |
| T-R-2 | Deny human review decision     | Signed `HumanReviewAttestation` + audit correlation to `machineDecisionRef` | attestation schema; signing OPEN |

### I — Information disclosure

| ID    | Threat                                         | Mitigation                                                                         | Module / status |
| ----- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| T-I-1 | Leak signing keys via repo                     | Keys NOT held in `@cantilune/conformance`; external tool only (RFC-0003 non-goals) | policy ✅       |
| T-I-2 | Cache side channel reveals unreleased evidence | Cache scoped to verification service; no public cache API                          | engine ✅       |

### D — Denial of service

| ID    | Threat                                   | Mitigation                                              | Module / status                   |
| ----- | ---------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| T-D-1 | Oversized rule inventory / evidence blob | `maxRuleCount` in `VerificationPolicy` (default 10_000) | `policy/verificationPolicy.ts` ✅ |
| T-D-2 | Cache stampede on repeated verify        | Verification cache with keyed hits                      | `ports/verificationCache` ✅      |
| T-D-3 | Revocation list blowout                  | Checkpoint monotonicity; indexed lookup (durable OPEN)  | ADR-0009 RV-*                     |

### E — Elevation of privilege

| ID    | Threat                                                                     | Mitigation                                                                         | Module / status                                                      |
| ----- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| T-E-1 | **Reference→product escalation** — cite reference witness as product proof | `policyAllowsScope`; default policy blocks `product`; `scope_escalation` violation | `policy/verificationPolicy.ts`, engine ✅                            |
| T-E-2 | **Profile insufficient** — lower profile satisfies higher gate             | `profilePermits` rank check; admission gate profile whitelist                      | `foundation/conformanceProfile.ts`, `admissionConformanceGate.ts` ✅ |
| T-E-3 | **Key scope expansion** — trust root used outside declared scope           | TR-2 scope filter on `TrustStore.getRoots(scope)`                                  | `ports/trustStore.ts` ✅ interface                                   |
| T-E-4 | Engineering admission accepted as full four-projection release             | Separate profiles; release gate requires higher rank + human review                | `releaseConformanceGate.ts` ✅                                       |
| T-E-5 | Bypass gate with hand-built decision object                                | Sealed decision types (OPEN); gates document engine-only entry                     | ADR-0009 consumption contract                                        |

### Cross-cutting — Cache poisoning & TOCTOU

| ID    | Threat                                                                              | Mitigation                                                                                                      | Module / status                                |
| ----- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| T-X-1 | **Cache poisoning** — stale positive result after evidence/policy/revocation change | Cache key includes policy, trust version, verifier build, checkpoint (ADR-0009 CA-*); flush on rotation         | `verificationCache`, engine partial ✅         |
| T-X-2 | **TOCTOU** — verify pass then evidence revoked before control-plane prepare         | Re-check `revocationCheckpoint` + expiry at gate consumption; no long-lived "verified" token without checkpoint | ADR-0009 CA-2; control-plane wiring audit OPEN |
| T-X-3 | **Reviewer COI** — DRI self-approves product certificate                            | HR-3 independence; governance reviewer-assignments COI disclosure; non-DRI quorum (OPEN)                        | governance + ADR-0009                          |
| T-X-4 | Split-brain: machine verified under policy A, consumed under policy B               | `policyDigest` bound in certificate and cache key                                                               | certificate schema ✅                          |

## Permission matrix (conformance module)

| Operation                          | Requires                                                                 | Ensures                                      |
| ---------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| `inspectCandidate`                 | Valid manifest schema                                                    | No machine verified status                   |
| `verifyEngineeringAdmission`       | Policy allows scope + profile; complete bundle; subject match            | `machine: verified` or structured violations |
| `verifyPackage` (formal path)      | Higher profile + C5 evidence                                             | Formal projection checks (scaffold M2)       |
| `evaluateAdmissionConformanceGate` | `engineeringAdmission` or `crossEpochProduct`; verified; zero violations | `conditional` (human/release still pending)  |
| `evaluateReleaseConformanceGate`   | `humanReview: approved`; `release: accepted`                             | Downstream release only                      |
| Cache read                         | Valid key + fresh revocation check                                       | Cached decision or miss                      |
| Trust root use                     | Scope + validity window                                                  | Signature verification (when signing lands)  |

Default when policy omitted: **`DEFAULT_VERIFICATION_POLICY`** — scopes `[generic, reference]` only; **`requireHumanReview: true`**.

## Mitigations implemented (2026-08-11)

| Blocker                       | Mitigation                                              |
| ----------------------------- | ------------------------------------------------------- |
| Fake digest                   | Canonical JSON + SHA-256; strict hex validation         |
| Hidden rules                  | Inventory completeness verifier                         |
| Reference→product escalation  | Policy scope gate + `scope_escalation` violation        |
| Profile bypass                | Rank + admission gate profile whitelist                 |
| Subject swap                  | `admissionSubjectsMatch` / engineering verifier binding |
| Boolean-only API              | `Result<VerificationDecision, ConformanceViolation[]>`  |
| Engineering/formal conflation | Separate types + profiles; deprecated alias isolated    |

## Residual risks (Stop-Ship until closed)

| Risk                                  | Status | Lift condition                            |
| ------------------------------------- | ------ | ----------------------------------------- |
| Cache poisoning under durable restart | OPEN   | Durable cache + checkpoint re-check tests |
| TOCTOU at control-plane prepare       | OPEN   | Consumption contract audit + sealed types |
| Reviewer COI / no quorum enforcement  | OPEN   | HR-7 + L5 checklist                       |
| Key scope expansion (no HSM)          | OPEN   | External signing + scope manifest         |
| Independent Security sign-off         | OPEN   | Non-DRI reviewer Accept                   |
| Full four-projection verifier         | OPEN   | C5 replay verifiers per projection        |
| Tamper corpus / fuzz L7               | OPEN   | QA-L5 checklist                           |

**Out of M2 scope (non Stop-Ship for core/runtime prototype):**

| Item                       | Reason                                     |
| -------------------------- | ------------------------------------------ |
| Networked evidence CDN     | Local/engine-local store sufficient for M2 |
| Multi-tenant trust domains | Future fleet ADR                           |
| Lean re-verification in TS | Explicit non-goal (RFC-0003)               |

## Consequences

**Positive**

- Conformance threats mapped to concrete module mitigations
- Aligns with runtime (ADR-0003) and control-plane (ADR-0007) threat model series
- Stop-Ship criteria explicit for S4 closure

**Negative**

- Several mitigations remain scaffold-only (memory stores, no quorum code)
- Full projection verification not yet load-bearing
- External Security review still required pre-FCP

## Alternatives rejected

| Option                                     | Why rejected                                     |
| ------------------------------------------ | ------------------------------------------------ |
| Reuse ADR-0007 as conformance threat model | Different assets (evidence chain vs catalog CAS) |
| Trust test pass as conformance             | Violates four-axis separation                    |
| Optional inventory check                   | Hidden rules attack surface                      |
| Public cache without key binding           | Cache poisoning                                  |

## Implementation tasks

- [x] Digest + inventory + scope + profile gates
- [x] Subject binding on engineering admission verifier
- [x] Admission/release gate evaluators
- [x] Threat model ADR (this document)
- [ ] Durable evidence CAS + tamper corpus
- [ ] Sealed decision types
- [ ] Control-plane consumption audit
- [ ] L7 fuzz/mutation on verifier
- [ ] External Security reviewer Accept

## Approval

**DRI Signature**: Joker-of-Gotham  
**Security Review**: Joker-of-Gotham (interim, COI disclosed) — external reviewer pending FCP  
**Date**: 2026-08-11
