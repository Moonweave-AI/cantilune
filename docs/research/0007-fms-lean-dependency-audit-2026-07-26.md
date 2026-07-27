---
superseded_by: fms-domain-theory-comprehensive.md
superseded_date: 2026-07-27
---

# Lean dependency audit for a complete FMS model

Status: dependency research log; no dependency admitted  
Date: 2026-07-26  
Owner/DRI: Joker-of-Gotham / project DRI  
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Decision authority: RFC-0002 and ADR-0001; this log grants no approval

## Decision

No publicly indexed Lean 4 package found in this audit supplies the complete
Fiore--Moggi--Sangiorgi (FMS) dependency stack:

1. an Abramsky/free-nondeterminism powerdomain on the required CPO category;
2. a domain-equation theorem applicable to
   `A ≅ P (H A)` in `Cpo^I`;
3. continuous, world-natural allocation and hiding with the required
   coherences; and
4. operational adequacy and full abstraction for strong late pi
   bisimilarity.

The minimum credible **direct dependency** therefore remains the repository's
already pinned mathlib revision. Selected Scott inverse-limit proofs may be
ported from `catskillsresearch/scott1972`, but that is a source-port project,
not an import that closes the FMS theorem package. `iris-lean` is mechanically
available for Lean 4.32 and has a genuine COFE fixed-point solver, but replacing
FMS CPO semantics by guarded, step-indexed OFE semantics would be an
architectural change requiring a new RFC decision. It is not an implementation
shortcut for the current FMS claim.

Consequently `CompleteExternalFMSTheoremPackage` must remain uninhabited and
all claims of complete hiding, a solved FMS domain equation, or full abstraction
must remain blocked/unverified.

## Question and acceptance criterion

The audit asked for the minimum mechanically importable Lean 4 dependency that
could justify the repository's intended complete FMS instance. A candidate
counts as directly importable only when:

- an exact revision or release, license, Lean version, and dependency versions
  are available;
- the relevant declarations exist in source, rather than only in a README;
- the package can target the pinned Lean 4.32 line without silently replacing
  the semantic category; and
- its theorems discharge an identified FMS obligation.

This was a read-only source audit. No candidate was installed and no candidate
was built against Cantilune. Compatibility statements below therefore
distinguish upstream build evidence from an unverified Cantilune integration.

## Pinned local baseline

The current formal project pins:

- Lean `leanprover/lean4:v4.32.0`;
- mathlib commit
  `81a5d257c8e410db227a6665ed08f64fea08e997`, requested as `v4.32.0`; and
- mathlib's Apache-2.0 license.

At that exact source revision mathlib provides, among other foundations:

- `OmegaCompletePartialOrder`, `ωScottContinuous`, `ContinuousHom`;
- dependent-function and product omega-CPO instances;
- the concrete category `ωCPO`, products, equalizers, and ordinary limits;
- complete partial orders with bottom;
- lawful fixed-point facts for partial computations; and
- order ideals, including a complete-lattice instance under suitable
  semilattice assumptions.

The exact tree did not contain declarations for an Abramsky, Plotkin, Hoare, or
Smyth powerdomain; Egli--Milner order; domain-theoretic bilimits or algebraic
compactness; the FMS domain equation; or pi-calculus full abstraction.
Mathlib's declarations named `IsBilimit` concern biproduct diagrams in additive
categories, not the embedding--projection-chain bilimits needed here.

Primary links:

- [exact mathlib tree](https://github.com/leanprover-community/mathlib4/tree/81a5d257c8e410db227a6665ed08f64fea08e997)
- [omega-CPO category documentation](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Category/OmegaCompletePartialOrder.html)
- [Scott continuity documentation](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/ScottContinuity.html)
- [lawful fixed-point documentation](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Control/LawfulFix.html)

## Importability and theorem-coverage matrix

| Candidate | Version / license evidence | Actual relevant declarations | Mechanical status for Cantilune | FMS coverage |
|---|---|---|---|---|
| Pinned mathlib | Lean 4.32.0; exact commit above; Apache-2.0 | omega-CPOs, continuous maps, products, equalizers, limits, lawful fixed-point foundations | **Already imported** | Foundation only; no powerdomain, general domain solver, FMS semantics, or full abstraction |
| [`leanprover-community/iris-lean`](https://github.com/leanprover-community/iris-lean) | release `v4.32.0`, commit `3e2b759dd3e928f4a31535afd07ea571325f0b8a`; Lean/Qq/Batteries 4.32.0; Apache-2.0 | `OFE`, `COFE`, non-expansive/contractive maps; `COFESolver.Fix`; `Fix.fold_unfold` and `Fix.unfold_fold` for locally contractive OFunctors | **Package is version-compatible in principle; Cantilune import unverified** | Does not model the FMS unpointed CPO category or powerdomain. Its guarded, step-indexed equivalence is not the required continuous natural isomorphism. Not an FMS dependency without an RFC-level semantic change |
| [`catskillsresearch/scott1972`](https://github.com/catskillsresearch/scott1972) | commit `36bf01f99f00fcb78b999052212372ba026521ba`; Lean/mathlib 4.30.0; Apache-2.0; no release/package | inverse limits of continuous-lattice projection systems; `proposition_4_1`; `inverseLimit_eq_iSup`; `corollary_4_3`; specific function-space tower; `theorem_4_4` and `theorem_4_4_orderIso` giving a Scott-map isomorphism `D∞ ≅ [D∞ → D∞]` | **Conditional source-port only**. Upstream CI succeeded at the exact commit on its own 4.30 lock; no 4.32/Cantilune build was run | Useful for one inverse-limit construction. It is neither general algebraic compactness for locally continuous mixed-variance endofunctors nor a solution of `A ≅ P(H A)` |
| [`catskillsresearch/scott_models`](https://github.com/catskillsresearch/scott_models) | Lean/mathlib 4.30.0; Apache-2.0; no release/package | equivalences among the author's Scott-formalization packages | **Not a standalone dependency**: its lakefile uses sibling path dependencies on `scott1972`, `scott1980`, and `scott1982` | No powerdomain or FMS pi model found; does not close the missing chain |
| [`zilberstein/domain-theory`](https://github.com/zilberstein/domain-theory) | commit `7f3b7547510931118ffe22631410fcd5f4556360`; Lean/mathlib 4.31.0; Apache-2.0; no release/package | `DCPO`, directed-set Scott continuity, function spaces, way-below/compactness, and the Markowsky chain-complete/DCPO bridge | **Conditional port, not direct at the pinned version** | Basic DCPO foundation only; no powerdomain, Egli--Milner construction, or domain-equation solver |
| [`jonsterling/lean4-sgdt`](https://github.com/jonsterling/lean4-sgdt) | Lean nightly `2021-05-28`; no repository license found | guarded synthetic domain-theory primitives, many declared as axioms; at least one source `sorry` was observed | **Not admissible/importable** | Different guarded semantics and fails the repository's proof and licensing gates |
| [`joewatt95/DomainTheory`](https://github.com/joewatt95/DomainTheory) | Lean 4.17.0; no repository license found; very small source tree | fixed-point comparison and a Kleene fixed-point theorem over existing mathlib notions | **Not admissible/importable** | No powerdomain or domain-equation construction |
| Public pi-calculus Lean code located in this audit | no released FMS package found | small operational-syntax/bisimulation developments, including an unofficial `cslib` fork | **Not a complete dependency** | No located implementation connected late pi operational semantics to an FMS denotation or proved full abstraction |

The `scott1972` source searches for `sorry`, `admit`, `axiom`, and `unsafe`
returned zero indexed Lean files on 2026-07-26. The two directly relevant files
were also inspected and contained none of those tokens. This is evidence about
the checked source, not a substitute for a Cantilune-side kernel assumption
audit after any port.

## Exact theorem evidence

### `scott1972`

The current split repository is active rather than archived. At commit
`36bf01f99f00fcb78b999052212372ba026521ba`, its upstream GitHub Actions build
completed successfully under Lean/mathlib 4.30.0.

[`InverseLimits.lean`](https://github.com/catskillsresearch/scott1972/blob/36bf01f99f00fcb78b999052212372ba026521ba/Scott1972/ContinuousLattice/InverseLimits.lean)
constructs the inverse limit of a countable system of continuous-lattice
projections and proves continuous projection/embedding facts, the directed
approximation identity `inverseLimit_eq_iSup`, and a cocone universal property
`corollary_4_3`.

[`FunctionSpaceTower.lean`](https://github.com/catskillsresearch/scott1972/blob/36bf01f99f00fcb78b999052212372ba026521ba/Scott1972/ContinuousLattice/FunctionSpaceTower.lean)
constructs a particular function-space tower. Its `theorem_4_4` proves the two
Scott-map inverse equations, and `theorem_4_4_orderIso` packages the resulting
order isomorphism.

These are substantive proofs, but their conclusion is a particular reflexive
domain. FMS requires the initial solution of a different equation whose
endofunctor includes the nondeterminism powerdomain, name-indexed
continuations, allocation shift, and world action. No theorem inspected here
turns the Scott construction into that solution automatically.

### `iris-lean`

[`COFESolver.lean`](https://github.com/leanprover-community/iris-lean/blob/v4.32.0/Iris/Iris/Algebra/COFESolver.lean)
defines towers for locally contractive OFunctors, `Fix`, `Fix.fold`,
`Fix.unfold`, and proves `Fix.fold_unfold` and `Fix.unfold_fold` with OFE
equivalence. The file contained no `sorry`, `admit`, `axiom`, or `unsafe`
tokens in this audit.

This is a real and currently versioned fixed-point library. It is nevertheless
not a theorem about the FMS category. In particular:

- COFE equivalence is step-indexed; it is not equality or a continuous
  isomorphism in the FMS `Cpo^I`;
- the solver assumes local contractiveness, while the FMS construction uses
  an enriched CPO powerdomain/domain-equation argument;
- no Abramsky powerdomain, Egli--Milner order, FMS world functor, or late-pi
  full-abstraction theorem was found in the repository.

Using this package is reasonable only if the project explicitly chooses a
guarded Iris-style semantics and restates the projection and full-abstraction
goals. That choice cannot certify the currently stated FMS obligations.

## Negative search evidence and limits

Authenticated GitHub code search was performed over public indexed Lean files
with identifier and phrase variants. At the time of the audit:

- `powerdomain`, `Plotkin powerdomain`, `Smyth powerdomain`,
  `Hoare powerdomain`, `PowerDomain`, `EgliMilner`, and `Egli-Milner`
  produced no Lean code result;
- `algebraic compactness`, `AlgebraicallyCompact`, and
  `recursive domain equations` produced no relevant Lean code result;
- `Fiore Moggi Sangiorgi`, `late bisimulation`, and the combined
  pi-calculus/full-abstraction phrases produced no FMS formalization; and
- Reservoir package metadata searches for powerdomain, CPO/domain theory,
  pi calculus, and FMS produced no package supplying the missing stack.

Search-engine absence is not a mathematical proof that private, unindexed, or
differently named code does not exist. The audit therefore supports the
bounded statement: no publicly indexed, identifiable, versioned Lean package
was found after these query variants and candidate source inspections.

Official package index:

- [Reservoir packages](https://reservoir.lean-lang.org/packages)

## Primary FMS obligations

The source pin for semantic acceptance remains:

- M. Fiore, E. Moggi, and D. Sangiorgi, “A Fully Abstract Model for the
  Pi-Calculus,” *Information and Computation* 179(1), 2002,
  DOI [`10.1006/inco.2002.2968`](https://www.sciencedirect.com/science/article/pii/S0890540102929688);
  see also the
  [author-hosted LICS paper](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).

The paper's domain-side route uses:

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X)
```

in a world-indexed CPO setting. The paper's full-abstraction theorem also
depends on operational approximants, expansion laws, normal forms, mismatch,
continuity, and the finite-to-domain embedding/projection argument. A bare
fold/unfold equivalence, even a kernel-checked one, is not the full theorem.

## Minimum credible dependency chain

### Recommended current route

1. Keep the exact Lean 4.32/mathlib pin as the only admitted external
   foundation.
2. Define the FMS-compatible CPO/enrichment layer that mathlib lacks:
   the chosen unpointed CPO category, continuous hom order, the required
   products/coproducts/exponentials, and pointwise functor-category structure.
3. Construct the free pointed continuous semilattice/Abramsky
   nondeterminism powerdomain with its enriched adjunction, monad, strict
   semilattice universal property, and commutative/Fubini coherences.
4. Prove an embedding--projection-chain theorem sufficient for the exact
   locally continuous functor `P ∘ H`, or a more general algebraic-compactness
   theorem. A reviewed Lean 4.32 port of selected `scott1972` inverse-limit
   modules may reduce this step, but it cannot replace Steps 2--3.
5. Lift the construction pointwise to `Cpo^I`; prove the finite-injection
   action, allocation `δ`, name object, exponentials, and naturality of all
   four `H` summands.
6. Construct `A`, its continuous natural fold/unfold isomorphism and
   categorical initiality; then construct the finite-agent embedding with its
   partial projection.
7. Define adequate capture-avoiding hiding/restriction and prove alpha,
   substitution, scope extrusion, allocation, and world-change coherences.
8. Complete the standard strong-late operational development, including
   mismatch, approximants, expansion/normal-form lemmas, adequacy, and both
   directions of full abstraction.
9. Prove the OpenPi-to-untyped-to-FMS commuting result and only then inhabit
   `CompleteExternalFMSTheoremPackage`.

### Optional source-port decision

If `scott1972` is used, the dependency must be pinned to the exact audited
commit and either:

- ported upstream to Lean/mathlib 4.32 with a release suitable for a Lake git
  dependency; or
- vendored as selected, attribution-preserving modules under an explicit RFC
  decision and independent proof/assumption review.

The port acceptance test must build in Cantilune, enumerate kernel assumptions,
map each imported theorem to an FMS obligation, and reproduce the source
license and revision. Upstream CI on Lean 4.30 is not evidence of that
integration.

## RFC and ADR impact

RFC-0002 cannot advance on the claim that a complete FMS dependency is
available. The architecture has three honest choices:

1. **Internal FMS completion:** keep the present semantics and fund the missing
   powerdomain, domain-equation, hiding, and full-abstraction proofs.
2. **Reviewed Scott source port plus internal completion:** reuse only the
   inverse-limit/function-space material that actually matches an obligation;
   still build the powerdomain and FMS-specific layers internally.
3. **Semantic replacement:** adopt a guarded COFE/Iris model. This changes the
   target category, equality/equivalence, fixed-point hypotheses, and the
   statement of the projection/full-abstraction theorem, so it requires a new
   RFC/ADR decision rather than an implementation note.

The following are stop conditions:

- treating `ωCPO.HasLimits` as algebraic compactness;
- treating `scott1972.theorem_4_4` as a solution of `A ≅ P(H A)`;
- treating `iris-lean`'s OFE equivalence as a continuous natural isomorphism
  in `Cpo^I`;
- calling finite powerset on discrete CPOs the Abramsky powerdomain on all
  required CPOs; or
- declaring full abstraction from fold/unfold, operational soundness, or a
  closed finite fragment alone.

Before any dependency admission, QA-L4 must independently review exact
revision and license provenance, the Lean 4.32 integration build, kernel
assumptions, semantic-category alignment, and a theorem-by-obligation map.

## Research disposition

Disposition: **Iterate; do not promote the complete-FMS claim.**

This audit narrows the implementation choice but does not close the theoretical
obligation. It identifies one potentially reusable Scott source layer and one
mechanically mature but semantically different COFE solver. Neither supplies a
complete FMS model, hiding theorem, or strong-late full-abstraction instance.
