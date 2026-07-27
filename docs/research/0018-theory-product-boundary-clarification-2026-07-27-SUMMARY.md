# Theory vs Product Boundary — Executive Summary

**Date:** 2026-07-27  
**Status:** Boundary correction / Decision support  
**DRI:** Joker-of-Gotham

## The Problem in One Sentence

Eight product packages that don't exist yet are blocking Core Theory FCP completion because theory obligations incorrectly require "all products provide certificates."

## Root Cause

**Current (incorrect) dependency chain:**
```
Core Theory FCP
  → requires "complete DAG/Petri rule maps"
  → requires "all admitted rules have certificates"
  → requires eight packages (Cantilune, Libretto, Cast, Baton, Cue, Chorus, Reprise, Notation)
  → packages don't exist (per research log 0008)
  → BLOCKED
```

**The confusion:** RFC-0002 and ADR-0001 mix two different things:

1. **Abstract meta-theorem** (theory): "For every rankable graph, there exists a strict DAG projection"
2. **Concrete instantiation** (product): "Rule R₇ in package Libretto preserves rank"

Theory should prove (1). Products should later provide (2).

## What's Actually Blocking Theory FCP

Analysis of RFC-0002 §11 and research logs shows:

| Blocker | Type | Status |
|---|---|---|
| P1b FMS complete inhabitant | **Theory gap** | Genuine blocker (Abramsky powerdomain absent) |
| P1b operational certificate | **Theory gap** | Implemented but unverified (needs review) |
| P1a "arbitrary DPO map" | **Product gap** | Generic theorem exists; product rules absent |
| P1c "full admitted rule set" | **Product gap** | Reference complete; product rules absent |
| Eight package certificates | **Product gap** | Packages don't exist |
| DAG rank preservation | **Product gap** | Generic rankable-DAG exists; product ranks absent |
| Petri firing maps | **Product gap** | Generic pre-net exists; product firings absent |
| Resource/authorization policies | **Product gap** | Generic gates exist; product policies absent |
| Fairness/ε evidence | **Product gap** | Generic bounds exist; product ε values absent |

**Result:** 7 out of 9 blockers are product gaps that shouldn't block theory FCP.

## The Correct Boundary

### Core Theory FCP (should close independently)

**Scope:** Prove the abstract conditions and generic interfaces exist.

**Includes:**
- ✓ FreeSMC universal property (kernel-built)
- ✓ Positional DPOI categorical closure (kernel-built)
- ✓ Generic projection certificate interfaces (kernel-built)
- ✓ 60/60 P1c reference matrix (kernel-built)
- ✓ Heterogeneous trajectory with admissions (kernel-built)
- ⚠ P1b request/accept operational (implemented_unverified)
- ✗ Complete FMS or accepted scope fallback (pending FCP decision)

**Excludes (moves to Product Conformance):**
- ❌ Product rule inventories
- ❌ Product rank functions
- ❌ Product pre-net semantics
- ❌ Product resource policies
- ❌ Product authorization predicates
- ❌ Product fairness windows
- ❌ Eight package existence

### Product Conformance (後續門, post-FCP)

**Scope:** Each package instantiates theory's generic interfaces for its concrete rules.

**Per-package obligations:**
- Package manifest and rule inventory
- `ProductRuleProofBundle` for each rule (using theory's reference as template)
- DAG rank functions and preservation proofs
- Petri pre-net semantics and firing derivations
- Resource/session policies
- Authorization predicates
- Fairness/ε evidence

**Key principle:** Packages instantiate in parallel, independently, after theory is stable.

## Specific Document Changes Needed

### RFC-0002 amendments

**§3.1 "Proof status by projection" — DAG row:**

Current (incorrect):
> "arbitrary typed-DPO map absent"

Corrected:
> "Generic rankable-graph projection complete. Product rule maps are Package Conformance obligations."

**§3.1 "Proof status by projection" — Petri row:**

Current (incorrect):
> "general rule-to-firing map absent"

Corrected:
> "Generic pre-net/SSMC construction complete. Product firing maps are Package Conformance obligations."

**§4.3 "P1c work" split into two gates:**

Theory FCP gate:
> "P1c reference matrix (60/60 cells, four event-indexed certificates) complete."

Product Conformance gate (new section):
> "Each package instantiates `ProductRuleProofBundle` for its admitted rules, using theory's reference as template."

### ADR-0001 amendments

**Remove from acceptance criteria:**
- Line ~167: "extend the implemented SMC/reference certificates to the full admitted rule set"
- Line ~173: "complete DAG/Petri direct rule-map proofs"

**Add to acceptance criteria:**
- "Generic interfaces demonstrated satisfiable via reference witnesses"

**Clarify:**
- Items 3 and 6 in current list are product obligations, not theory gates

### Research log 0008 reframing

Current title:
> "Product-package projection-certificate audit"

Corrected title:
> "Product-package conformance readiness audit (theory-independent)"

Add clarification:
> "Package absence does not block Core Theory FCP. Theory proves generic interfaces; packages later instantiate them."

## The One Genuine Theory Blocker

**Complete FMS powerdomain/domain/full-abstraction package**

What exists:
- Finite fragments (discrete CPO, finite strict power, Finset monad)
- Unseparated omega-Scott fixed point A ≅ P(H A)
- Support-level allocation/hiding retraction
- Recursive alpha/substitution congruence

What remains absent:
- All-ωCPO Abramsky/omega-ideal powerdomain
- Separated divergence/deadlock with commutative Fubini
- Algebraic compactness
- Agent restriction operation
- Adequacy and strong-late full abstraction

**Proposed resolution (RFC-0002 §16):**
> "P1's normative π projection is the typed, finite-control open-process presentation together with the native standard structural late-π LTS. `FMSGatedFourProjection` remains a separate optional conformance gate."

This would unblock theory FCP by making operational π normative and FMS optional.

**Requires:** FCP approval from DRI + process-semantics reviewer.

## Recommended Actions

### Immediate (documentation fixes)

1. **Amend RFC-0002:**
   - Split §3.1 status descriptions into "Theory complete" / "Product Conformance"
   - Add explicit "Product Conformance (後續門)" section after §9
   - Update §11 tracking table to separate theory/product gates

2. **Amend ADR-0001:**
   - Remove product-specific items from acceptance criteria
   - Add "Reference witnesses demonstrate interfaces satisfiable"

3. **Reframe research log 0008:**
   - Clarify package absence is expected and doesn't block theory
   - Rename to emphasize conformance readiness, not completion blocker

### Near-term (enable FCP)

1. **Resolve FMS scope** (RFC-0002 §16 decision):
   - DRI + process-semantics reviewer approve finite-control boundary, OR
   - Construct/import complete FMS powerdomain package

2. **Bind P1b to immutable commit:**
   - Commit `formal/` tree
   - Run complete evidence gate
   - Record aggregate for independent review

3. **Assign independent reviewers:**
   - Category/DPO/Petri reviewer
   - Process-semantics/FMS reviewer
   - Lean kernel-assumptions reviewer

### Post-FCP (product development)

1. **Create package structure:**
   - `packages/cantilune/` (first package)
   - `packages/cantilune-libretto/` etc.

2. **Document conformance requirements:**
   - `docs/conformance/product-certificate-requirements.md`
   - Template Lean files for certificate instantiation

3. **Enable incremental conformance:**
   - Packages provide certificates as ready
   - No "all eight at once" gate
   - Each package independent

## Visual Summary

```
┌────────────────────────────────────┐
│ CURRENT (incorrect)                │
│                                    │
│ Theory FCP                         │
│   ↓ requires                       │
│ Eight packages exist               │
│   ↓ provides                       │
│ All certificates                   │
│                                    │
│ BLOCKED (packages don't exist)    │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ CORRECTED (proposed)               │
│                                    │
│ Theory FCP                         │
│   ├─ Generic interfaces ✓          │
│   ├─ Reference witnesses ✓         │
│   ├─ P1b operational ⚠             │
│   └─ FMS scope decision ✗          │
│        ↓ closes                    │
│ Product Conformance (後續門)        │
│   ├─ Package 1 (independent)       │
│   ├─ Package 2 (independent)       │
│   └─ ... (parallel development)    │
│                                    │
│ UNBLOCKED (theory proceeds)        │
└────────────────────────────────────┘
```

## Key Insight

**Theory proves the certificates are *possible* (via reference witnesses).**

**Products prove they are *actual* (via concrete instantiation).**

The first gate does not block on the second.

## Decision Required

**From DRI:**

Accept this boundary clarification and authorize amendments to RFC-0002 and ADR-0001 that:
1. Remove product-specific obligations from theory FCP gates
2. Create explicit Product Conformance section
3. Allow theory FCP to close while packages are in development

**From DRI + process-semantics reviewer during FCP:**

Decide FMS scope (RFC-0002 §16):
- Option A: Adopt finite-control boundary (operational π normative, FMS optional)
- Option B: Retain complete FMS as mandatory (blocks until constructed)

## References

- Full analysis: `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md`
- Package audit: `docs/research/0008-product-package-certificate-audit-2026-07-26.md`
- Theory closure: `docs/research/0015-load-bearing-theory-closure-audit-2026-07-27.md`
- RFC-0002: `docs/rfc/0002-projection-consistency.md`
- ADR-0001: `docs/adr/0001-unified-formal-structure.md`
