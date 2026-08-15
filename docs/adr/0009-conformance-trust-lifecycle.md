# ADR-0009: Conformance Trust Lifecycle and Sealed Decision Consumption

| Field          | Value                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (M2–M3 engineering scope — trust ports scaffolded; durable CAS, external signing, and non-DRI review **pending**)                                              |
| Date           | 2026-08-11                                                                                                                                                                  |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                                                       |
| Reviewers      | Joker-of-Gotham (DRI interim Security + Formal); external independent review before FCP — see `docs/governance/reviewer-assignments.md`                                     |
| Related        | RFC-0003, ADR-0010, ADR-0006, ADR-0007, `@cantilune/conformance`, `@cantilune/control-plane`, `formal/proof-obligations.json`, `docs/qa/conformance-l5-review-checklist.md` |

## Context

RFC-0003 defines the C0–C9 certificate chain and five conformance questions. ADR-0006 binds control-plane schema activation to four-view evidence verification. Without explicit trust lifecycle rules, the following gaps remain in M2:

- Memory-only trust/revocation/cache adapters with no durable checkpoint semantics
- No non-forgeable sealed decision types (`Verified*` / `Reviewed*` still OPEN)
- Human review workflow unspecified (quorum, COI, conflict handling)
- Verifier build pinning present in types but not enforced as a rotation policy
- Control-plane could theoretically consume stale cached decisions if cache keys omit policy/revocation generation

This ADR records **trust root, certificate lifecycle, revocation, human review quorum, cache invalidation, verifier build pinning, and sealed decision consumption** rules for `@cantilune/conformance` and its downstream consumers.

Threat actors and STRIDE mapping live in **ADR-0010**. This ADR states **lifecycle invariants and consumption contracts**.

## Decision

Implement conformance trust as an **immutable evidence CAS + versioned trust policy + monotonic revocation checkpoint + pinned verifier attestation + quorum human review → sealed release decision** pipeline. Control-plane and release automation MAY consume conformance output **only** through the sealed consumption contract below.

### Trust roots (C0)

| Rule | Detail                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| TR-1 | `TrustStore` entries carry `keyId`, scoped `publicKey`, `scope[]`, `notBefore`, `expiresAt`                                      |
| TR-2 | Verifiers MUST reject attestations signed outside root scope or validity window                                                  |
| TR-3 | `trustRootSetVersion` MUST appear in every `PackageConformanceCertificate` and cache key                                         |
| TR-4 | Trust root rotation is **append-only**: new version adds roots; old roots remain valid until explicit expiry (no silent removal) |
| TR-5 | M2: memory trust store only; production requires durable trust manifest + CI verification (**OPEN**)                             |

### Certificate lifecycle (C1–C9)

```
draft manifest → evidence assembly → machine verify (C8) → human review (C9) → issued certificate
                                                      ↓                                    ↓
                                              blocked / invalid                   active → superseded / expired / revoked
```

| Phase            | State transitions                                             | Ensures                                   |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------- |
| Candidate        | `machine: candidate`, `release: notEvaluated`                 | Inspection only; not consumable           |
| Machine verified | `machine: verified`, `humanReview: pending`                   | C0–C8 pass; violations empty              |
| Human reviewed   | `humanReview: approved \| rejected \| conflict`               | Quorum rules below                        |
| Released         | `release: accepted` (requires approved + not expired/revoked) | C9 sealed                                 |
| Terminal         | `release: superseded \| expired \| revoked`                   | Never re-accepted without new certificate |

**Immutability:** Issued certificate content (digests, subject, profile, verifier build) is immutable. Changes require a new certificate with `supersedes` pointing to prior `certificateId`.

**Validity window:** `notBefore` / `expiresAt` enforced at consumption. Expired certificates transition to `release: expired` without retroactive mutation of audit history.

### Revocation

| Rule | Detail                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| RV-1 | `RevocationStore` records `CertificateRevocationRecord { certificateId, revokedAt, reason, checkpoint }`          |
| RV-2 | `revocationCheckpoint` is monotonic; consumers MUST track latest checkpoint seen                                  |
| RV-3 | Revocation lookup MUST precede cache hit and gate evaluation                                                      |
| RV-4 | Revoking C8 invalidates dependent C9; revoking trust root version invalidates all attestations under that version |
| RV-5 | M2: memory revocation store; durable revocation journal **OPEN**                                                  |

### Human review quorum

| Rule | Detail                                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HR-1 | Default policy: `requireHumanReview: true` for all scopes beyond diagnostic inspect                                                                               |
| HR-2 | **Minimum quorum (proposed M3):** ≥2 independent reviewers for `product` scope; ≥1 independent reviewer for `reference` scope at rank ≥ `fourProjection`          |
| HR-3 | Reviewer MUST NOT be the certificate proposer, package owner DRI alone, or verifier implementer for the same change (COI — mirrors ADR-0006 separation of duties) |
| HR-4 | `HumanReviewAttestation` binds `machineDecisionRef`, `reviewerId`, `roles[]`, `decision`, `reviewedAt`                                                            |
| HR-5 | Conflicting attestations (`decision: conflict`) block release (`release: blocked`) until resolved by new review round                                             |
| HR-6 | Agent/automated review does NOT satisfy human review axis                                                                                                         |
| HR-7 | M2: quorum not enforced in code; **Stop-Ship** for S4 until L5 checklist closed                                                                                   |

**Reviewer roles (informative):** formal-mathematics, process-semantics, security/threat-model, package-owner (non-voting for own package).

### Cache invalidation

| Cache key component                        | Invalidation trigger                         |
| ------------------------------------------ | -------------------------------------------- |
| `evidenceRootDigest`                       | Any evidence blob change                     |
| `policyDigest` / `policyVersion`           | Policy elevation or scope change             |
| `trustRootSetVersion`                      | Trust root rotation                          |
| `revocationCheckpoint`                     | Any revocation append                        |
| `verifierBuild` + `verifierArtifactDigest` | Verifier release or rebuild                  |
| `theoryBaselineRef`                        | New `proof-obligations.json` baseline commit |

**Rule CA-1:** Cache entries MUST NOT survive invalidation of any key component.  
**Rule CA-2:** Positive cache hits MUST still re-check revocation checkpoint and expiry at consumption time (TOCTOU mitigation — see ADR-0010).  
**Rule CA-3:** M2 `MemoryVerificationCache` implements key stringing via `cacheKeyString`; durable cache **OPEN**.

### Verifier build pinning

| Rule | Detail                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| VB-1 | Every machine attestation records `verifierBuild` (semver + commit) and `verifierArtifactDigest`                     |
| VB-2 | Policy MAY maintain an allowlist of verifier builds; default M2: single build `ENGINEERING_ADMISSION_VERIFIER_BUILD` |
| VB-3 | CI MUST publish verifier artifact digest alongside npm pack smoke                                                    |
| VB-4 | Verifier upgrade requires: new digest, regression corpus pass, policy version bump, cache flush                      |
| VB-5 | Control-plane MUST reject evidence verified by unknown or deprecated verifier builds when policy requires            |

### Sealed decision consumption by control-plane

Control-plane (`@cantilune/control-plane`) consumes conformance at **prepare admission** only through:

```
ConformanceEngine.verifyEngineeringAdmission(...)
  → VerificationDecision
  → evaluateAdmissionConformanceGate(decision)
  → "conditional" | "blocked"
```

**Consumption contract (binding on control-plane wiring):**

| Gate              | Requires                                                                                                                                                | MUST NOT                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Prepare admission | `profile ∈ {engineeringAdmission, crossEpochProduct}`; `machine === verified`; `violations.length === 0`; subject binding match; fresh revocation check | Accept formal-only C5 without C4 when engineering admission required    |
| Commit admission  | Prior prepare + authorization roles (ADR-0006)                                                                                                          | Re-verify from client-supplied digests without server-side bundle fetch |
| Release / fleet   | `evaluateReleaseConformanceGate → accepted`                                                                                                             | Treat `conditional` as accepted                                         |

**Sealed type target (OPEN):** Replace raw `VerificationDecision` pass-through with non-forgeable `VerifiedAdmissionDecision` / `ReviewedReleaseDecision` brands once implemented. Until then, gates MUST use engine entry points — not caller-constructed decision objects.

**Observability boundary:** Observability reads admission receipts and verification audit events; it does not perform conformance verification (ADR-0005 pattern).

## Mitigations implemented (M2 scaffold)

| Capability                                                                 | Status     |
| -------------------------------------------------------------------------- | ---------- |
| Port interfaces: trust, revocation, cache, audit, evidence store           | ✅         |
| Memory adapters                                                            | ✅         |
| `trustRootSetVersion`, `revocationCheckpoint` fields on certificate schema | ✅         |
| `verifierBuild` on machine attestation + engineering verifier constant     | ✅         |
| Cache key includes evidence root + profile                                 | ✅ Partial |
| `evaluateAdmissionConformanceGate` / `evaluateReleaseConformanceGate`      | ✅         |
| Quorum enforcement, durable stores, sealed types, external signing         | ❌ OPEN    |

## Residual risks

| Risk                                                              | Status   | Notes                              |
| ----------------------------------------------------------------- | -------- | ---------------------------------- |
| Memory-only trust/revocation survives process restart             | **OPEN** | Stop-Ship for S4                   |
| No sealed decision types — gate bypass via forged decision object | **OPEN** | ADR-0010 T-CP-1 mitigation planned |
| Quorum not code-enforced                                          | **OPEN** | HR-7                               |
| External Security non-DRI sign-off                                | **OPEN** | Pre-FCP                            |
| Lean attestation manual / CI gap                                  | **OPEN** | C7 bridge                          |

## Consequences

**Positive**

- Explicit lifecycle separates machine vs human vs release axes
- Control-plane consumption contract aligns with ADR-0006 evidence binding
- Cache/revocation/checkpoint model supports TOCTOU mitigation path

**Negative**

- M2 operators must treat conformance as prototype regardless of passing unit tests
- Quorum and durable CAS add operational overhead at S4 closure
- Verifier pinning requires release discipline on `@cantilune/conformance` itself

## Alternatives rejected

| Option                                                  | Why rejected                                      |
| ------------------------------------------------------- | ------------------------------------------------- |
| Single boolean `conformant: true`                       | Collapses four status axes; forbidden by RFC-0003 |
| Trust-on-first-use for product scope                    | Reference→product escalation risk                 |
| Client-supplied review attestations without trust store | Forgeable human review axis                       |
| Infinite cache TTL                                      | TOCTOU + revocation lag                           |
| Control-plane re-implements verification                | Duplicated logic; drift from conformance module   |

## Implementation tasks

- [x] Trust/revocation/cache/audit port definitions
- [x] Memory adapters
- [x] Certificate schema lifecycle fields
- [x] Admission/release gate evaluators
- [ ] Durable evidence + revocation CAS
- [ ] Quorum enforcement in human review workflow
- [ ] `Verified*` / `Reviewed*` sealed decision types
- [ ] External signing tool integration
- [ ] Control-plane wiring audit against consumption contract
- [ ] Independent Security + QA-L5 review (review-pending)

## Approval

**DRI Signature**: Joker-of-Gotham  
**Security / Formal Review**: Joker-of-Gotham (interim, COI disclosed) — external reviewer pending FCP  
**Date**: 2026-08-11
