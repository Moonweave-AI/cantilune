# Post-`09f9476` Kernel Recovery — 2026-07-27

Status: Verified mutable-tree recovery; Pre-FCP
Governance: S2 / QA-L4 target / M1
Branch: `codex/theory-foundation`
Audited HEAD: `09f9476846a54cea3fa7b97a970ec599d1d4c96d`

## Decision

The earlier reports that all ten FCP gates were complete are retracted.
Commits `90e9eba`, `b164408`, and `36bdddd` contain no tracked `formal/`
source. Commit `09f9476` contains only the ten newly added Gate 5/7 files and
does not contain a reproducible complete Lean project. The new files had not
been compiled before their completion reports were written.

The current mutable tree has now been repaired and actually checked by the
pinned Lean kernel. This establishes useful implementation evidence, but it
does not satisfy immutable provenance, independent QA-L4 review, the complete
FMS semantic bridge, or the strict completion gate.

## Immutable audit findings

- The claimed Gate 4 binding at `b164408` cannot bind P1b Lean sources because
  that commit contains none.
- The original `P1cMultiState/Matrix.lean` did not compile and encoded status
  labels rather than 3,600 native operational proofs.
- The original `P1cMultiState/Reflection.lean` used an unconstrained transition
  record and asserted false arbitrary surjectivity.
- The original `PowerdomainUnseparated` files did not compile, contained
  explicit placeholders/postulates, mixed incompatible carriers, and included
  false strict-bottom Fubini claims for a nonempty Hoare carrier.
- A DRI self-assignment is not an independent QA-L4 review.
- `formal/proof-obligations.json` remains the authoritative status ledger:
  11 `implemented_unverified`, 7 `partial_scaffold`, 0 `proved`, and
  0 `reviewed`.

## P1c recovery

The repaired P1c reference layer now:

- provides a proof-carrying total index `Fin 60 -> P1cOperation`;
- defines a total `Fin 60 x Fin 60` table;
- proves actual guarded independence lemmas where their hypotheses justify
  independence;
- proves `matrix_cell_protocol_completion` for every table position;
- defines a total morphism-to-process syntax translation;
- proves exact round-trip only for `InTranslationImage`; and
- removes the false claim that every arbitrary pi transition is the image of
  a morphism rewrite.

The strongest honest statement is a generic request/acknowledge/complete
protocol and a syntax-translation-image correspondence. It is not a proof of
3,600 native late-pi reductions, per-cell commutation, DPO reflection, or a
production P1c package. The separately existing
`P1cFullNativeRefinement.certificate` remains the stronger native 15-family
candidate and remains `implemented_unverified`.

## Unseparated powerdomain recovery

The broken nonempty-Hoare draft was removed. The repaired facade reuses the
already constructed all-omega-CPO lower omega-Scott closed-set line:

- empty closed set as bottom, hence effect-layer
  `divergence = deadlock = bottom`;
- a continuous choice operation;
- the pointwise power functor, unit, multiplication, bind, and monad laws;
- continuous Fubini naturality, unit/principal law, symmetry, associativity,
  and the existing chosen-product strong commutative monad package; and
- a concrete continuous-natural solution, initial algebra, terminal
  coalgebra, and algebraic-compactness witness for the implemented
  `ActualAgentFunctor`.

This is a real construction for one unseparated lower omega-Scott endofunctor.
It is not a separated divergence/deadlock Abramsky powerdomain and not a
general algebraic-compactness theorem for every locally continuous
endofunctor.

`AdequacyPackage`, `FullAbstractionPackage`, and `DefinabilityPackage` are
proof-carrying interfaces. Their derived theorems are valid once a concrete
language supplies their fields, but no native standard late-pi inhabitant is
constructed. Consequently adequacy, definability, and full abstraction remain
open, and `CENTRAL-12` remains `partial_scaffold`.

## Reproducible checks actually executed

From `formal/`, with `leanprover/lean4:v4.32.0`:

```powershell
lake build Cantilune.Pi.P1cMultiState
lake build Cantilune.Tests.P1cMultiState `
  Cantilune.Tests.PowerdomainUnseparated Cantilune.Pi
powershell -ExecutionPolicy Bypass -File .\scripts\ci.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\ci.ps1 -RequireComplete
```

Observed ordinary CI result:

- 485 project Lean sources;
- source aggregate
  `c21eb3dccf06d3c431d49592d6a0ef433cc5fc474b571d0863f6db176445a1f4`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root build successful: 9,139 jobs;
- 1,377 audited declarations;
- only `propext`, `Classical.choice`, and `Quot.sound` in the dependency
  allowlist; and
- ordinary evidence-gate exit code 0.

Observed strict completion result: expected exit code 1. Every one of the
18 central obligations is still below `reviewed`.

The successful run is evidence for the mutable tree only. It is not bound to
a clean immutable candidate commit and is not an independent review.

## Remaining load-bearing obligations

1. Construct a concrete native late-pi adequacy package and the associated
   definability/full-abstraction inhabitant, or formally change the Gate 7
   scope through RFC/FCP.
2. Prove or review the stronger native P1c certificate on an exact immutable
   source snapshot; the repaired `P1cMultiState` facade is not a substitute.
3. Create one clean proof-sensitive candidate commit containing the complete
   formal tree, toolchain, dependency lock, source-integrity record, audit
   list, and manifest.
4. Bind each promoted central symbol to that commit and a build-evidence
   record.
5. Obtain three independent non-author QA-L4 reviews, including Lean kernel
   assumptions and process-semantics review.
6. Reconcile RFC-0002, ADR-0001, English/Chinese specifications, and all FCP
   reports before opening FCP.
7. Keep product conformance separate: the eight planned packages still have
   no rule inventories or package-owned rank, pre-net, resource,
   authorization, fairness, stable-window, or positive-epsilon facts.

## Controlling conclusion

The repaired mutable tree is kernel-buildable and free of forbidden Lean
placeholders. The earlier Gate 5/7 completion reports are not valid evidence.
Cantilune remains Pre-FCP: the strict proof manifest, immutable provenance,
concrete native-pi FMS semantic theorems, and independent QA-L4 review are not
closed.
