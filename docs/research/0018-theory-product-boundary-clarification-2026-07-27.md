# Theory vs Product Boundary Clarification — 2026-07-27

Status: Analysis / Boundary Correction  
Governance: S2 / QA-L4 / M1  
DRI: Joker-of-Gotham

## Executive Summary

**Problem identified:** Eight product packages (Cantilune, Cantilune Notation, Libretto, Cast, Baton, Cue, Chorus, Reprise) are incorrectly blocking Core Theory FCP completion. Theory obligations currently require "all products provide certificates," which conflates two distinct gates:

1. **Core Theory FCP** — abstract meta-theorems, generic interfaces, reference witnesses
2. **Product Conformance** — concrete package instantiations, runtime facts, authorization policies

**Root cause:** The current RFC-0002 and ADR-0001 acceptance criteria mix abstract theory completion with concrete product instantiation, creating a false dependency where theory cannot close until all eight product packages exist with their runtime evidence.

**Correct boundary:** Theory proves the generic certificate interfaces are *satisfiable* (via reference witnesses). Products later instantiate those interfaces with concrete operational facts. Theory FCP should not block on product existence.

## Current State Analysis

### What blocks Core Theory FCP today

From RFC-0002 §11 tracking table and research audit 0008:

| Blocking item | Current status | Nature |
|---|---|---|
| P1a DAG/Petri rule maps | Generic operational family exists; no production rule inventory | **Product-specific** |
| P1b FMS complete inhabitant | Finite fragments exist; full Abramsky powerdomain absent | **Theory gap** |
| P1c general admitted rules | 60/60 reference matrix complete; no product `Config` rules | **Product-specific** |
| Eight package certificates | No package trees, manifests, or rule inventories exist | **Product-specific** |
| DAG rank preservation | Generic rankable-DAG theorem exists; no product rank functions | **Product-specific** |
| Petri pre-net semantics | Generic pre-net construction exists; no product firing maps | **Product-specific** |
| Resource/session policies | Generic resource layer exists; no product policies | **Product-specific** |
| Authorization predicates | Generic authorization gate exists; no product predicates | **Product-specific** |
| Fairness/stable windows | Generic scheduler theorem exists; no product windows | **Product-specific** |
| Positive-ε progress | Generic kernel bound exists; no product ε values | **Product-specific** |

**Analysis:** 8 out of 10 blockers are product-specific instantiation gaps, not theory gaps. The only genuine theory gap is the complete FMS powerdomain/full-abstraction package.

### Where the confusion originates

**RFC-0002 §3.1 Proof status table** states:

> "DAG: [...] intended static target certificate incomplete [...] arbitrary typed-DPO map absent"  
> "Petri: [...] intended static target incomplete [...] general rule-to-firing map absent"

This language conflates:
- **Generic theorem**: "Every rankable graph has a strict DAG view" (theory, complete)
- **Product fact**: "Rule R₇ in package Libretto preserves rank" (product, absent)

**RFC-0002 §4.3 P1c work** requires:

> "Lift the closed finite multi-state P1c reference protocol to all 15 admitted non-fixture `Config` occurrences, with the product resource, quiescence, admission, and static layers"

This mixes:
- **Reference witness**: Mismatch/reconnect/delete have four-view certificates (theory, complete)
- **Product rules**: Packages Baton, Cue, etc. supply their rule inventories (product, absent)

**Research log 0008 Product-package audit** conclusion:

> "No production-package `ProductRuleProofBundle` can be instantiated from the current repository. All eight package names are planned distributions, while their package source trees, manifests, product rules, and package-owned proof inputs do not yet exist."

The audit finds that **packages don't exist**, yet theory FCP blocks on their certificates.

## Correct Boundary Definition

### Core Theory FCP scope (should close independently)

Core Theory proves the **abstract conditions** and **generic interfaces** for projection consistency. It establishes:

1. **Meta-theorems** (universal quantification over satisfying inputs):
   - "For every rankable typed graph G, there exists a strict DAG projection"
   - "For every execution package with fairness evidence, expected hitting ≤ H/ε"
   - "For every four-projection family sharing one source, cross-view events agree"

2. **Generic certificate interfaces** (types with well-defined semantics):
   - `ProjectionCertificate`: soundness, reflection, terminal preservation
   - `ProductRuleProofBundle`: static/operational/resource/admission layers
   - `ExecutionPackage`: native steps, replay, epochs, probability kernels

3. **Reference witnesses** (non-vacuity proofs):
   - 60/60 P1c reference matrix with all four projections
   - Mismatch/reconnect/delete with executable graph updates
   - Finite heterogeneous runtime with admission crossing

4. **Counterexamples** (boundary clarifications):
   - Unrestricted slice ≠ positional DPOI (finite boundary-duplicate counterexample)
   - Discrete finite power ≠ FMS powerdomain (no continuous singleton unit)
   - Two-state protocol ≠ full late reflection (environmental transitions exist)

### What belongs in Core Theory (abstract)

**Static layer:**
- FreeSMC quotient and arbitrary-target universal property ✓ (kernel-built)
- Typed positional DPOI equivalence with exact essential image ✓ (kernel-built)
- Generic pre-net/free-SSMC declaration-order construction ✓ (kernel-built)
- Typed open-process SMC presentation ✓ (kernel-built)

**Operational layer:**
- Generic `ProjectionFamily` indexed over finite signatures ✓ (kernel-built)
- Reusable operational certificate constructor from supplied LTS isomorphism ✓ (kernel-built)
- P1c 60/60 reference matrix with four independent native derivations ✓ (kernel-built)
- P1b request/accept unfiltered structural strong-late certificate ✓ (implemented_unverified)

**Stochastic layer:**
- Generic Ionescu–Tulcea trajectory constructor ✓ (kernel-built)
- Event-labelled coupling with DPO replay ✓ (kernel-built)
- Finite heterogeneous `EpochChain` with admission boundaries ✓ (kernel-built)
- Expected-hitting bound from supplied fairness/ε ✓ (kernel-built)

**Denotational layer (genuine gap):**
- Complete FMS powerdomain on all ωCPO ✗ (absent; finite fragments only)
- Recursive agent domain solution A ≅ P(H A) ✗ (unseparated fixed point exists; full package absent)
- Agent restriction/hiding with coherence ✗ (support-level retraction exists; agent operation absent)
- Strong-late full abstraction ✗ (conditional interface exists; no inhabitant)

### What belongs in Products (concrete)

**Product Conformance Gate** (후속门, separate from theory FCP):

Each product package (Cantilune, Libretto, Cast, etc.) supplies:

1. **Package manifest and rule inventory**:
   - `packages/cantilune/cantilune.yaml` (package metadata)
   - `packages/cantilune/rules/` (enumerable rule set)
   - Package owner and conformance contact

2. **Per-rule certificates** (instantiating generic interfaces):
   - `dag_certificate: ProductRuleProofBundle` for each rule
   - Rank function and rank-preservation proof
   - Pre-net token semantics and firing derivation
   - π native derivation (using theory's P1c reference as template)
   - Morphism view (usually identity or direct composition)

3. **Runtime operational facts** (cannot be inferred from rule names):
   - Resource/session policies (e.g., "context window ≤ 200k tokens")
   - Deletion/quiescence predicates
   - Authorization predicates (e.g., "human approval required for deploy")
   - Conflict resolution policies

4. **Stochastic evidence** (per-package execution characteristics):
   - Fairness/stable-window definitions
   - Positive-ε progress bounds
   - Opportunity-epoch alignment strategy
   - Production Markov kernel construction

## Incorrect Dependencies to Remove

### From RFC-0002 §3.1 "Proof status by projection"

**Current (incorrect):**
> "DAG: [...] arbitrary typed-DPO map absent"

**Corrected:**
> "DAG: Generic rankable-graph projection complete. Product rule maps (ranks, derivations) are Package Conformance obligations."

---

**Current (incorrect):**
> "Petri: [...] general rule-to-firing map absent"

**Corrected:**
> "Petri: Generic pre-net/SSMC construction complete. Product firing maps (enabling, token semantics) are Package Conformance obligations."

### From RFC-0002 §4.3 "P1c work"

**Current (incorrect):**
> "Lift the closed finite multi-state P1c reference protocol to all 15 admitted non-fixture `Config` occurrences, with the product resource, quiescence, admission, and static layers"

**Corrected:**
> "P1c reference matrix (60/60 cells) complete. Product packages instantiate `ProductRuleProofBundle` using theory's reference witnesses as templates. Resource/quiescence policies are Package Conformance inputs."

### From RFC-0002 §11 Tracking table

**Current (incorrect):**
> "Lift the closed finite multi-state P1c reference protocol to all 15 admitted non-fixture `Config` occurrences, with the product resource, quiescence, admission, and static layers and no weak steps | DRI + process-semantics reviewer | Pre-FCP"

**Corrected (split into two gates):**

**Theory FCP gate:**
> "P1c reference operational certificates (60/60 native cells, four event-indexed restricted-relation certificates) | DRI + process-semantics reviewer | Pre-FCP"

**Product Conformance gate (post-FCP):**
> "Each package supplies ProductRuleProofBundle for its admitted rules, using theory's reference construction as template | Package owners | Product-release"

### From ADR-0001 acceptance criteria

**Current (incorrect, line 161-174):**

> Required evidence before acceptance:
> 1. define exact source syntax, configurations, rules, freshness, and granularity;
> 2. construct and independently check an inhabitant of the now-explicit complete FMS [...]
> 3. extend the implemented SMC/reference certificates to the full admitted rule set;
> 4. independently define observable target derivations [...]
> 5. define and prove preservation/reflection of successful-terminal predicates;
> 6. complete DAG/Petri direct rule-map proofs; and
> 7. obtain independent formal-math/category/process-semantics review.

**Items 3 and 6 are product obligations, not theory gates.**

**Corrected:**

**Theory FCP gates:**
1. Define exact source syntax, configurations, rules, freshness, granularity ✓ (complete)
2. Complete FMS powerdomain/domain/full-abstraction or accepted scope fallback ✗ (genuine blocker)
3. Define observable target derivations, congruences, admin policies ✓ (complete)
4. Define and prove preservation/reflection of terminal predicates in reference ✓ (complete)
5. Obtain independent formal-math/category/process-semantics review ✗ (governance blocker)

**Product Conformance gates (post-FCP):**
1. Each package extends reference certificates to its admitted rule set
2. Each package provides DAG rank functions and Petri firing maps for its rules

## Proposed Corrected FCP Criteria

### RFC-0002 FCP Entry (Theory completion)

**Sufficient conditions for RFC-0002 FCP entry:**

1. ✓ **FreeSMC universal property** — arbitrary-target monoidal comparison (kernel-built)
2. ✓ **Positional DPOI categorical closure** — finite well-formed essential image equivalence (kernel-built)
3. ✓ **P1a generic operational family** — reusable certificate constructor from LTS isomorphism (kernel-built)
4. ⚠ **P1b request/accept operational** — unfiltered structural strong-late certificate (implemented_unverified; needs immutable commit + independent review)
5. ✓ **P1c reference matrix** — 60/60 native cells, four event-indexed certificates (kernel-built)
6. ✓ **Heterogeneous trajectory** — finite `EpochChain` with admission, replay, epochs (kernel-built)
7. ✗ **Complete FMS or accepted fallback** — RFC-0002 §16 proposes finite-control boundary; requires FCP decision
8. ✗ **Independent review** — category/DPO, process-semantics, Lean-assumptions reviewers unassigned

**Product-specific items removed from FCP gates:**
- ❌ "arbitrary typed-DPO map" (product rule inventories)
- ❌ "general rule-to-firing map" (product pre-net semantics)
- ❌ "product resource, quiescence, admission layers" (product runtime facts)
- ❌ "eight package certificates" (packages don't exist yet)

### ADR-0001 Acceptance (Theory architecture decision)

**Sufficient conditions for ADR-0001 Acceptance:**

1. ✓ **Unified object (C, R) defined** — SMC + string-diagram rewriting (normative)
2. ✓ **Four projections specified** — DAG, Petri, π, morphism with SMC-functor clauses (normative)
3. ✓ **Generic consistency interfaces** — `ProjectionCertificate`, `ProjectionFamily`, event lift relations (kernel-built)
4. ✓ **Reference non-vacuity witnesses** — 60/60 P1c matrix, heterogeneous runtime (kernel-built)
5. ⚠ **P1b operational closure** — structural strong-late certificate (implemented_unverified)
6. ✗ **Complete FMS or accepted scope** — (pending FCP decision)
7. ✗ **Independent review + RFC-0002 FCP** — (governance)

**Product-specific items removed from acceptance gates:**
- ❌ "extend to full admitted rule set" (each package instantiates for its rules)
- ❌ "complete DAG/Petri direct rule-map proofs" (per-package certificates)

## The Eight-Package Confusion

### Current incorrect framing (Research log 0008)

> "All eight package names are planned distributions, while their package source trees, manifests, product rules, and package-owned proof inputs do not yet exist here."

**Packages blocking theory FCP:**
1. Cantilune — Missing
2. Cantilune Notation — Missing
3. Cantilune Libretto — Missing
4. Cantilune Cast — Missing
5. Cantilune Baton — Missing
6. Cantilune Cue — Missing
7. Cantilune Chorus — Missing
8. Cantilune Reprise — Missing

**The problem:** Theory FCP requires "all eight packages provide certificates," but packages are planned future distributions that don't block the theory's correctness.

### Correct framing (Theory vs Product separation)

**Core Theory FCP** proves:
- "There exists a generic `ProductRuleProofBundle` interface"
- "The 60-cell reference matrix satisfies this interface"
- "Any package supplying (rank, pre-net, resource, authorization, ε) can instantiate it"

**Product Conformance** (each package, independently, post-FCP):
- Package Cantilune supplies its rule inventory and certificates
- Package Libretto supplies its rule inventory and certificates
- ...etc.

**Why separation matters:**
- Theory can close and be reviewed while packages are in development
- Package teams can instantiate certificates in parallel
- New packages can be added without re-opening theory FCP
- Reference witnesses demonstrate the interface is implementable

## Recommended Actions

### Immediate (clarify existing documents)

1. **RFC-0002 §3.1 amendment:**
   - Change DAG/Petri status from "arbitrary map absent" to "generic construction complete; product instantiation is Package Conformance"
   - Add explicit "Product Conformance (後續門)" section after Theory FCP

2. **RFC-0002 §4 amendment:**
   - Split P1c work into:
     - **P1c Theory**: Reference matrix complete (FCP gate)
     - **P1c Product**: Packages instantiate for their rules (post-FCP)

3. **ADR-0001 amendment:**
   - Remove "extend to full admitted rule set" from acceptance criteria
   - Remove "complete DAG/Petri direct rule-map proofs" from acceptance criteria
   - Add "Generic interfaces support product instantiation (reference witnesses exist)"

4. **Research log 0008 reframing:**
   - Change title from "Product-package projection-certificate audit" to "Product-package conformance readiness audit"
   - Clarify: "Packages are future work; their absence does not block Core Theory FCP"

### Near-term (enable FCP entry)

1. **Resolve FMS scope decision** (RFC-0002 §16):
   - Option A: Adopt finite-control boundary (makes native π the normative projection)
   - Option B: Retain complete FMS as mandatory (blocks until Abramsky powerdomain constructed)
   - **Decision authority:** DRI + process-semantics reviewer during FCP

2. **Bind P1b to immutable commit:**
   - Current status: `implemented_unverified` in mutable worktree
   - Action: Commit `formal/` tree, run complete evidence gate, record aggregate
   - Enables: promotion to `implemented` (pending independent review)

3. **Assign independent reviewers:**
   - Category/DPO/Petri reviewer (for DPOI/FreeSMC/pre-net)
   - Process-semantics/FMS reviewer (for P1b/P1c operational)
   - Lean kernel-assumptions reviewer (for axiom audit)

### Post-FCP (product conformance)

1. **Create package boundaries:**
   - `packages/cantilune/` (first package)
   - `packages/cantilune-libretto/` etc.
   - Each with `package.yaml`, `rules/`, `tests/`

2. **Package conformance specification:**
   - Document: `docs/conformance/product-certificate-requirements.md`
   - Template: `packages/_template/rule-certificate-template.lean`
   - Tooling: `scripts/validate-package-conformance.ps1`

3. **Incremental instantiation:**
   - Packages provide certificates as they're ready
   - No "all eight at once" gate
   - Theory remains stable during product development

## The Genuine Theory Blocker

**Only one item genuinely blocks Core Theory FCP completion:**

**Complete FMS powerdomain/domain/full-abstraction package**

From research log 0015:

> "The remaining gap is not one undifferentiated implementation task. It consists of:
> 1. exact mathematical inhabitants still absent from the Lean tree;
> 2. public semantic choices reserved for RFC/FCP; and
> 3. production facts and kernels absent from the repository.
>
> No theorem, package name, or generic interface can manufacture items in groups 2 or 3."

**What exists today (theory fragments):**
- Finite `Finset` free-semilattice monad ✓
- Equality-ordered discrete-CPO finite strict power ✓
- Unseparated omega-Scott fixed point A ≅ P(H A) ✓
- Support-level allocation/hiding retraction ✓
- Recursive alpha/substitution congruence ✓

**What remains absent (foundational mathematics):**
- All-ωCPO Abramsky/omega-ideal powerdomain ✗
- Separated divergence/deadlock with commutative Fubini ✗
- Algebraic compactness or checked bilimit for `World ⥤ ωCPO` ✗
- Agent restriction operation (not just support hiding) ✗
- Adequacy (semantic transitions = native steps) ✗
- Strong-late full abstraction for finite-control π ✗

**RFC-0002 §16 proposes resolution:**
> "P1's normative π projection is the typed, finite-control open-process presentation together with the native standard structural late-π LTS. [...] `FMSGatedFourProjection` remains a separate optional conformance gate."

This would:
- ✓ Unblock theory FCP (operational π is complete)
- ✓ Preserve honesty (no false FMS claim)
- ✓ Enable future extension (FMS becomes optional conformance)
- ⚠ Requires FCP approval (not automatic)

## Summary: Corrected Gate Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Core Theory FCP (P0 - blocks project)                      │
│                                                             │
│ ✓ Generic certificate interfaces (kernel-built)            │
│ ✓ Reference witnesses (60/60 P1c, heterogeneous runtime)   │
│ ⚠ P1b operational (implemented_unverified → needs review)  │
│ ✗ FMS scope decision (§16 proposal pending FCP approval)   │
│ ✗ Independent review (reviewers unassigned)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Theory FCP accepted
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Product Conformance (P1 - per-package, parallel)           │
│                                                             │
│ Package Cantilune:                                          │
│   □ Rule inventory                                          │
│   □ DAG rank functions + preservation proofs                │
│   □ Petri pre-net semantics + firing derivations           │
│   □ Resource/authorization policies                         │
│   □ Fairness/ε evidence                                     │
│                                                             │
│ Package Libretto: (same structure, independent timing)      │
│ Package Cast: ...                                           │
│ [... remaining six packages ...]                            │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Theory proves the certificates are *possible* (via reference witnesses). Products prove they are *actual* (via concrete instantiation). The first gate does not block on the second.

## References

- ADR-0001 §Open questions (lines 161-174): current mixed theory/product criteria
- RFC-0002 §3.1: current projection status conflating generic/product
- RFC-0002 §4.3: current P1c work mixing reference/product
- RFC-0002 §16: proposed FMS scope resolution
- Research log 0008: eight-package conformance audit (negative result)
- Research log 0015: load-bearing theory closure (three-category gap analysis)
- Research log 0006 §Boundaries that remain binding: explicit theory vs external vs governance separation
