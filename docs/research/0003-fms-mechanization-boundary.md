# FMS mechanization boundary and implemented Set/discrete-CPO fragments

Status: implementation research log  
Date: 2026-07-23  
Owner/DRI: unassigned; repository maintainer must assign before promotion  
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Decision authority: RFC-0002 and ADR-0001; this log grants no approval

> **Current-scope note (2026-07-24):** this log captures the initial external
> interface. `CompleteExternalFMSTheoremPackage` has since strengthened the
> acceptance boundary with full world/action, powerdomain, restriction,
> domain-solution, and pinned strong-late full-abstraction fields, and the
> implemented support model now proves allocation/hiding retraction equations
> as continuous natural transformations. No inhabitant of the complete
> package exists. These additions therefore do not change this log's central
> conclusion: the real FMS CPO model, adequate agent hiding, and full
> abstraction remain unmechanized. See research log 0006 for the current
> boundary.

## Question

How much of the Fiore--Moggi--Sangiorgi (FMS) route can be checked in the
current Lean/mathlib environment without presenting an abstract record as if
it were the actual FMS model?

The audit focused on:

1. supported processes and finite-world renaming;
2. the free finite-semilattice monad and its pointwise lift to `Set^I`;
3. the finite Set-side agent equation;
4. the Abramsky CPO powerdomain, the initial solution of
   `A ≅ P(H A)`, restriction/hiding, operational adequacy, and full
   abstraction.

## Primary source and local dependency audit

Primary source:

- M. Fiore, E. Moggi, and D. Sangiorgi, “A fully abstract model for the
  pi-calculus,” LICS 1996, DOI `10.1109/LICS.1996.561302`,
  [author-hosted PDF](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).
- M. Fiore, E. Moggi, and D. Sangiorgi, “A Fully Abstract Model for the
  pi-calculus,” *Information and Computation* 179(1), 2002, pp. 76–117,
  DOI `10.1006/inco.2002.2968`.  This complete journal revision, rather than
  the LICS extended abstract alone, is the acceptance pin for any supplied
  `ExternalFMSTheoremPackage`.

The checked source states the covariant finite-injection category, pointwise
lifting of the nondeterminism monad, the finite-Set free-semilattice instance,
the dynamic allocation shift, and the action equation

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X).
```

For finite Set, the free-semilattice monad is finite powerset. For the domain
model, the paper relies on an Abramsky powerdomain/free-nondeterminism
construction and a domain-equation/full-abstraction development.

The local mathlib tree was searched for omega-CPOs, continuous maps,
powerdomains, monads, endofunctor initial algebras, and FMS-specific
developments. Mathlib provides `ωCPO`, continuous maps, limits,
category-theoretic monads, and endofunctor algebras. No Abramsky powerdomain,
FMS domain-equation solution, or late-pi full-abstraction theorem was found.
QPF initial fixes do not by themselves supply the required CPO-enriched
partial-map/powerdomain construction.

## Kernel-checked implementation

The following pieces are internal Lean constructions, not external claims:

- `FMSFinitePower.lean` constructs the actual `Finset` monad on `Type`,
  proves its free join-semilattice-with-bottom universal property, and lifts
  it pointwise to a genuine monad on every functor category `Type^I`.
- `FMSContext.lean` uses locally nameless processes. Free names are
  `Fin world`; bound names are separate `Fin bound` indices. Free-name
  renaming proves identity and composition, yields an actual
  `processModel : I ⥤ Type`, and makes finite support and set support natural.
- `FMSFiniteAgent.lean` constructs finite recursive prefix/choice trees,
  a structural fold/unfold, an ACUI congruence quotient for choice, and the
  exact finite approximants
  `A_0 = 0`, `A_(d+1)(n) = P_f(ActionShape(A_d,n))`.

These results establish real Set-side algebra and finite stages. They do not
yet construct the complete finite-injection action of the exponential
`N ⇒ X`, connecting maps between stages, a colimit, or initiality of that
colimit in `Set^I`.

The continuation also constructs a real CPO-valued fragment:

- `FMSCpoWorld.lean` gives the covariant finite-injection world shift, the
  allocation natural transformation, and continuous support hiding;
- `FMSCpoFinitePower.lean` gives the `Finset` monad on the equality-ordered
  discrete-CPO subcategory, its Fubini/coherence laws, the pointwise world
  lift, and shift compatibility;
- `FMSCpoFiniteAgent.lean` gives continuous finite recursive fold/unfold
  isomorphisms and a finite-height cocone universal property; and
- `FMSCpoContext.lean` gives a nonconstant CPO-valued supported-syntax functor
  and natural support denotation.

`FMSExternalPackage.mechanizedCpoFragment` is an actual inhabitant aggregating
exactly those results. It stops before `CpoPowerdomainPackage`: finite powerset
on equality-ordered discrete CPOs is not an Abramsky powerdomain on all
`ωCPO`, and the finite fold/unfold/height result is not an enriched initial
solution of the FMS recursive domain equation.

## Explicit external theorem boundary

`FMSExternalPackage.lean` defines, but does not inhabit:

- `CpoPowerdomainPackage`, including continuous ACUI choice, the free
  universal property, and natural/unit/symmetric Fubini obligations;
- `AgentDomainSolution`, including the exact four action summands, an
  isomorphism `P(H A) ≅ A`, categorical initiality, and a continuous `res`;
- `AdequateHiding`, connecting capture-avoiding syntactic restriction to
  `res`; and
- `StrongLateFullAbstraction`, restricted to closed raw processes and tied to
  an independently defined operational strong late bisimilarity. The latter
  now requires fresh bound actions and, for input, relation of both
  derivatives after capture-avoiding substitution of every received name.

The aggregate `ExternalFMSTheoremPackage` has a fixed journal-revision source
pin and proof fields. There is no axiom, default instance, opaque witness, or
constructor call in the repository. Its consumer theorem is conditional on an
explicit package argument.

Several important obligations are still intentionally exposed:

- `actionShape` supplies a carrier equivalence at each world and naturality in
  the model argument, but no compatibility with finite-world injections and
  no order/continuity isomorphism in `ωCPO`;
- `res` is only a family of continuous maps, without world naturality,
  alpha/substitution/scope-extrusion coherence, or identification of
  `restrictSyntax` with the repository's existing restriction;
- the Fubini fields do not yet encode every associativity and multiplication
  coherence of the required strong commutative monad; and
- full abstraction is only a closed-world-zero specialization, not an open
  `A(n)` interpretation theorem.

Consequently the record is an uninhabited aggregate of enumerated proof
inputs, not yet an acceptance certificate for the full FMS construction.

## Conclusions and stop condition

Verified:

- supported renaming and natural support denotation;
- genuine finite-powerset/free-semilattice monad on `Type` and pointwise on
  `Type^I`;
- finite recursive Set agent syntax, choice quotient laws, and finite
  `P_f(H-)` approximants;
- a typechecked, versioned, non-vacuous shape of the external CPO obligations.

Unverified and not supplied:

- full world-natural `H` including the `N ⇒ X` injection action;
- the Set initial-chain colimit and initiality in `Set^I`;
- an Abramsky powerdomain instance in `ωCPO`;
- a constructed CPO solution of `A ≅ P(H A)`;
- adequate FMS restriction/hiding;
- strong-late operational adequacy and full abstraction;
- the intended OpenPi-to-FMS commuting theorem.

No central proof status may be promoted from this work alone. Promotion must
stop until the package interface itself is strengthened with the missing
world/action, hiding, and monad coherences; then a concrete inhabitant (or an
entirely internal mechanization) must be built, its world naturality proved,
the pinned source and assumptions independently reviewed, and QA-L4 evidence
recorded.
