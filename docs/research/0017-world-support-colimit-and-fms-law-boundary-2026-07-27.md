# World support, EP colimit, and the FMS law boundary — 2026-07-27

Status: mutable-working-tree kernel evidence; not an immutable proof release  
Governance: S2 / QA-L4 / M1, RFC-0002 Pre-FCP, ADR-0001 Proposed  
DRI: Joker-of-Gotham

## Result

This iteration adds four constructive results and one
representation-independent obstruction:

1. exact finite support is transported through arbitrary finite-world
   injections and bundled as a genuine world-indexed monad, with a faithful
   forgetful functor into the actual world-functor category and a natural
   power-functor comparison isomorphism;
2. weakening exact support preservation to support inclusion gives a total
   Cartesian Fubini map, an actual symmetric monoidal category, and a
   lax-braided monoidal-monad package with naturality, symmetry,
   associativity, unit, and multiplication laws;
3. the concrete embedding-projection tower has an explicit arbitrary-target
   embedding-cocone colimit universal property, a genuine mathlib
   `Cocone`/`IsColimit` presentation, and its implemented unseparated
   endofunctor now has an actual initial algebra and terminal coalgebra;
4. common-FMS segmented paths are now dependently indexed by an actual
   `EpochChain` and compose without duplicating the shared epoch; and
5. source-style strict `let`, zero-preserving `let`, and commutative exchange
   identify divergence and deadlock on every carrier.

The fifth result is not a finite-powerset counterexample. It quantifies over
an arbitrary computation type and mentions no order, topology, cardinality,
or concrete powerdomain representation.

## Kernel constructions

### World-indexed exact support

`FMSCpoOmegaScottWorldSupportTransport` constructs:

- reindexing morphisms over every injection `Fin m → Fin n`;
- exact direct-image support transport;
- identity and composition laws;
- a category of supported world models;
- the pointwise lower omega-Scott power functor, unit, multiplication, and
  `Monad` instance; and
- naturality of return, choice, and flattening with exact support
  pushforward.

This closes finite-world support transport for the implemented unseparated
lower omega-Scott construction. It does not identify that construction with
the complete FMS/Abramsky powerdomain.

`FMSCpoOmegaScottWorldSupportForgetful` additionally constructs the faithful
functor

```text
SupportedWorldModel ⥤ (World ⥤ ωCPO)
```

and a natural isomorphism comparing “take supported power, then forget” with
“forget, then take the actual pointwise omega-Scott power”. The comparison
also commutes with map, unit, and multiplication. Faithfulness means that the
support-refined arrows remain distinguishable after forgetting; fullness,
essential surjectivity, and categorical equivalence are neither assumed nor
proved. The comparison has not additionally been packaged as a monad
morphism or monad equivalence.

### Support-lax total Fubini

`FMSCpoOmegaScottSupportLaxMonad` replaces the exact equation
`support (f x) = support x` by the sound frame condition
`support (f x) ⊆ support x`. In that category the Cartesian Fubini operation
is total and satisfies the kernel-checked naturality, principal/unit,
symmetry, associativity, and multiplication-interchange equations.

`FMSCpoOmegaScottSupportLaxMonoidal` installs actual mathlib
`MonoidalCategory` and `SymmetricCategory` instances using Cartesian product
and support union. It packages the power functor as `LaxMonoidal` and
`LaxBraided`, and proves that both monad natural transformations are
monoidal. Thus the implemented support-lax power construction is now a
kernel-checked commutative monoidal monad in this precise category.

This category is formed for each fixed finite resource type. It is not the
cross-world exact-support category. Although its tensor is built from the
underlying Cartesian product, this module does not separately install or
claim mathlib's finite-product universal-property package.

This is a precise design fork:

- exact support gives the separation-aware partial tensor but rejects
  unrestricted empty-branch Fubini;
- support-lax morphisms admit total Cartesian Fubini but are not the exact
  separated tensor required by the strengthened acceptance target.

No document may silently identify the two categories.

### EP embedding colimit

`FMSCpoConcreteEmbeddingColimit` defines arbitrary-target embedding cocones
for the concrete finite approximation tower. Its mediator is the pointwise
supremum of the projection-followed-by-cocone-leg approximants. Every leg
factors through that mediator, and every candidate satisfying the cocone
equations is equal to it.

The result is an explicit universal property for this concrete tower. It is
not a claim that all locally continuous endofunctors on all ωCPOs are
algebraically compact.

`FMSCpoConcreteEmbeddingCategoricalColimit` bridges that explicit property to
a genuine mathlib diagram, cocone, and `IsColimit`. Its `desc`, `fac`, and
`uniq` fields quantify over every cocone and every candidate mediator in the
ordinary functor category `World ⥤ ωCPO`. This removes the earlier
“custom-only universal-property” gap. It does not produce an enriched
colimit, a `SolutionSetCondition` for every source object, or general
algebraic compactness for arbitrary locally continuous endofunctors.

### Concrete initial algebra, terminal coalgebra, and compactness witness

`FMSCpoConcreteInitialAlgebra` constructs, for every
`Algebra ActualAgentFunctor`, the recursively induced cocone, mediator, native
algebra square, and uniqueness proof. `FMSCpoConcreteTerminalCoalgebra`
dually constructs final-sequence observations for every coalgebra, takes the
projection-limit lift, proves the coalgebra square, and obtains uniqueness
from joint monicity of all finite projections.

`concreteActualAlgebraicCompactnessWitness` packages these two universal
properties with the existing continuous-natural fixed-point isomorphism.
This is genuine algebraic compactness evidence for the one implemented
unseparated `ActualAgentFunctor`. It is not general algebraic compactness and
does not identify that endofunctor with the separated Abramsky/FMS
powerdomain requested by the strengthened target.

### Epoch-indexed common FMS paths

`FMSCommonEpochSegmentedCrossEpochChain` indexes each exact operational/FMS
segment by a real `EpochChain`. Event segments carry their exact native
paths; admission boundaries carry their own native registration step. The
flattened positions, actions, prefixes, endpoints, and three-way
associativity are proved without duplicating a nonempty shared epoch.

The construction consumes a caller-supplied `ExactFMSAcceptancePackage`.
It does not construct a production FMS package, product Markov kernel, or
package-owned runtime fact.

The dependent index is real, but the semantic evidence is still supplied:
`eventAction` is not derived from `ProjectionCertificate.mapEvent`,
`admissionAction` is not derived from `AdjacentAdmission`, and every FMS state
is currently at `agent.obj 0`. The append is deliberately half-open: it drops
the head's terminal epoch segment and keeps the tail's copy. Its seam equates
the head terminal-entry state with the tail source; it does not compare two
completed executions of the shared epoch. The associativity theorem is for
the flattened action list, not equality of dependent proof objects or a
stochastic trajectory law.

## Direct FMS `let` obstruction

`FMSCpoFMSLetNoGo` assumes only:

```text
bind divergence k = divergence
bind deadlock   k = deadlock
bind x (λ _. bind y (λ _. r))
  = bind y (λ _. bind x (λ _. r))
```

Substituting `x = divergence` and `y = deadlock` makes the left side
`divergence` and the right side `deadlock`. Therefore:

```text
divergence = deadlock
```

`no_separated_commutative_let` consequently proves that no carrier can also
supply `divergence ≠ deadlock`.

`FMSCpoFMSLetPackageNoGo` connects this obstruction to the actual
`CpoPowerdomainPackage` fields. It proves that a package satisfying its
mandatory `divergence_ne_empty` field cannot be extended by all three
source-style `let` laws at even the one-point test object. The bridge stores
those `let` laws explicitly because the current package record contains
neither bind nor a multiplication-at-empty law from which they could be
derived.

Fiore–Moggi–Sangiorgi use a commutative monad, strict morphisms, and a
semilattice zero with `let(f, 0) = 0`; they do not require the bottom and zero
constants to be distinct. The strengthened Cantilune target adds that
separation requirement. Thus a complete source-compatible package and the
current strengthened separation interface cannot both be inhabited without
changing at least one of:

- divergence/deadlock separation;
- strictness at divergence;
- zero preservation at deadlock;
- commutative exchange; or
- the observation/tensor interpretation to which those equations apply.

This is an RFC/FCP decision, not an implementation detail.

## General bound-output alpha quotient

`OpenSMCActionAlpha.ActionAlpha.iff_orbit_eq_and_boundOutputAdmissible`
completely characterizes action-label alpha equivalence. The corresponding
`alphaAction_boundOutput_eq_iff` theorem proves:

- all admissible binder spellings on one observable subject are one class;
- the syntactically possible but operationally invalid self-bound label is
  not identified with a genuine `open` label; and
- the channel subject remains observable.

Together with the existing joint action/derivative quotient and genuine
native fresh-representative transitions, this closes general bound-output
label alpha conversion. It still does not select public boundary identity,
wire semantics, plug/hide equality, or a total named Open-π SMC.

Primary sources:

- [Fiore–Moggi–Sangiorgi, *A Fully Abstract Model for the π-Calculus*](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Fiore–Moggi–Sangiorgi, extended account](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf)
- [Abramsky–Jung, *Domain Theory*](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

## Remaining non-derivable inputs and decisions

The repository still does not contain:

- an RFC-selected total named-boundary Open-π representation with reusable
  wires, freshening, plug/hide/restriction, and the equality used for all
  coherence diagrams;
- a production inhabitant of the exact FMS package;
- two concrete production Markov kernels and a coupling;
- any of the eight package-owned rule inventories, four-view admissions,
  ranks, pre-nets, resource/session/deletion policies, authorization
  predicates, stable/fair windows, or positive-ε progress certificates; or
- independent QA-L4 approval, FCP approval, and ADR acceptance.

The generic projection and trajectory theorems correctly consume those
inputs. They cannot manufacture empirical runtime facts or public semantic
choices.

## Disposition

Keep CENTRAL-12 and CENTRAL-18 at `partial_scaffold`. The new declarations
are kernel-checkable evidence, but the working tree is mutable and no
independent review exists. The strict completion gate must continue to fail
until the RFC contradiction is resolved and the missing product facts and
governance approvals are supplied.

The exact mutable-tree build, integrity, dependency-audit, and strict-gate
results are recorded in
`formal/build-evidence/2026-07-27-world-support-ep-compactness-source-let-root.md`.
