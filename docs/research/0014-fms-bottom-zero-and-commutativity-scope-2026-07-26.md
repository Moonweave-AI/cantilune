---
superseded_by: fms-domain-theory-comprehensive.md
superseded_date: 2026-07-27
---

# FMS bottom/zero and commutativity scope correction

Date: 2026-07-26  
Status: source-audited and kernel-supported; architecture decision pending  
Governance: RFC-0002 Pre-FCP; ADR-0001 Proposed  
Risk / quality / maturity: S2 / QA-L4 / M1

## Question

Does the Fiore--Moggi--Sangiorgi construction require the powerdomain's
order-theoretic least element and nondeterministic zero to be observably
distinct while also requiring a commutative monad?

## Primary-source result

No such disequality appears in the audited source.

Section 2.1 of the
[FMS LICS extended abstract](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
requires:

- `P` to carry the laws of a commutative monad;
- `(P X, 0, union)` to be a semilattice;
- Kleisli extension to preserve `0` and binary union;
- `ND(D)` objects to carry both a least element and semilattice structure;
  and
- arrows of `ND(D)` to be strict semilattice homomorphisms.

The source then obtains the powerdomain monad from the enriched
free/forgetful adjunction and lifts it pointwise to the finite-world functor
category. It does **not** state `bottom != 0`.

The source calculus contains guarded replication. Its full-abstraction
statement compares denotations of process terms with strong late
bisimilarity. It does not identify the denotation of an infinite native tau
run with the order-theoretic bottom of the powerdomain carrier.

## Kernel consequence

The current Lean theorem
`no_commutative_first_strict_pairing` proves the general algebraic
consequence. If a pairing:

1. is available on every pair;
2. is symmetric;
3. is strict at order bottom in the first argument; and
4. preserves semilattice zero in the first argument,

then bottom and zero are equal.

The theorem is not limited to a finite powerset candidate. Therefore the
additional Cantilune acceptance condition

```text
bottom != zero
  + all-pairs commutative sequencing
  + strict preservation of both constants
```

is inconsistent. This is an incompatibility in Cantilune's strengthened
target, not a refutation of the source FMS construction.

Operationally, `LateGuardedReplicationDivergence` separately proves that
replicated tau has a genuine infinite native run while raw zero is
deadlocked. That result does not require, and does not prove, that these
processes denote the two distinguished constants of the powerdomain.

## Decision boundary

The source-compatible route is:

- retain the commutative powerdomain law;
- do not require an effect-layer proof that order bottom differs from
  semilattice zero; and
- prove process-level distinction through the recursive agent and the
  source-pinned full-abstraction theorem.

Retaining the additional effect-layer disequality instead requires changing
at least one of:

- all-pairs commutativity;
- strict preservation of both constants; or
- the algebra/morphism category.

A support-separated tensor is a possible changed semantics, not an automatic
escape: if both constants have empty support, they are still compatible, so
the same two-constant exchange argument applies at that pair.

`FMSCpoFiniteSupportStrictConstantsNoGo` now checks that last statement in
Lean for supported omega-CPOs: empty-supported constants compose at the
separation unit support, and a continuous symmetric first-strict pairing
collapses them. The theorem deliberately does not quantify over, identify,
or refute the Abramsky powerdomain; it rejects only the listed combination
of compatibility, exchange, strictness, and distinctness.

## Current boundary

The mutable Lean tree now constructs the all-source ordinary and enriched
free/forgetful adjunction and a canonical **sequential** Fubini operation.
Naturality, both unitors, reassociation, left multiplication, and the
pure-left right-multiplication law are kernel-checked. Symmetry is
kernel-refuted for the separated two-constant interpretation; a general
two-effect multiplication/interchange law is not claimed.

This correction does not construct the recursive domain solution, FMS
hiding, adequacy, definability, full abstraction, total named Open-pi SMC,
or any production package. RFC-0002 remains Pre-FCP and ADR-0001 remains
Proposed.

## 2026-07-27 coherence refinement

The “FMS hiding” sentence above now has a narrower interpretation. For the
already constructed **unseparated** omega-Scott world monad, Lean now
constructs `powerHiding` and proves its allocation, unit, multiplication, and
chosen-Fubini diagrams. The support model also has an effectful
allocate/denote/hide retraction.

This does not resolve the semantic fork. The unseparated monad still lacks
the free separated nondeterministic universal property used by the stronger
Cantilune package, while the separated free construction still lacks a
symmetric all-effects Fubini. Neither line currently supplies the recursive
agent, agent-level restriction, adequacy, definability, or full abstraction.
The source-scope correction and the RFC/FCP decision requirement therefore
remain unchanged.
