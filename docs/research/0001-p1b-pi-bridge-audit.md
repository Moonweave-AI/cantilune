---
title: "P1b Pi-Bridge Independent Audit"
status: "Complete (independent audit; human review pending)"
type: "Research Log / Formal-semantics audit"
risk: "S2"
qa: "QA-L4"
maturity: "Pre-FCP/M1"
owner: "Joker-of-Gotham (DRI)"
reviewer: "Formal math / category theory / process semantics reviewer TBD"
date: "2026-07-23"
baseline: "commit a592d86 (a592d868f19556361cb52aa03772912af4e8bed4) plus dirty handoff"
decision: "Iterate, not Promote"
---

# P1b Pi-Bridge Independent Audit

## Conclusion

The Step C/D construction in `docs/spec/formal-semantics.md` Section 13 is
not presently a well-typed functor construction. The blocker is earlier than
the advertised "Step C-prime: prove pentagon/triangle/hexagon":

1. the Fiore-Moggi-Sangiorgi model is a functor category whose objects are
   functors and whose arrows are natural transformations;
2. a pi-process in an enumerated `n`-name context denotes an element of
   `A(n)`; only the zero-name case is equivalently a global element `1 -> A`,
   while an open term denotes a morphism into `A`;
3. pi parallel composition is an internal operation on the agent object, not a
   tensor bifunctor on the whole model category; and
4. the proposed generator mapping does not specify the object mapping or
   natural transformations required for a functor out of the free SMC.

The two handed-off tendencies are therefore decided as follows:

- **"Raw-process `|` is not an SMC tensor" is too strong and is rejected as a
  general claim.** It is true only for the discrete category on raw abstract
  syntax with syntactic equality. Raw terms can instead be retained as objects
  of a symmetric-monoidal groupoid with structural isomorphisms, or quotiented
  merely by structural congruence. The fact that laws are derived rather than
  primitive is irrelevant to whether they can supply an SMC presentation.
- **"The late-bisimilarity quotient is necessary and sufficient" is
  rejected.** It is not necessary for an SMC presentation, and it is not
  sufficient to define the objects, arrows, categorical composition, tensor
  bifunctor, or rewriting structure required by the theorem. Moreover, strong
  late bisimilarity is not preserved by input prefix, which is directly
  relevant to `accept`; open compositional semantics requires late congruence
  (or an explicitly restricted closed-system theorem).

There is a correct, source-grounded symmetric monoidal structure on the model:
the **pointwise cartesian** structure. Under that structure a conditional
Step C/D theorem is immediate from the free-SMC universal property once, and
only once, every generating object and generating arrow is given a
type-correct interpretation. This does not identify the SMC tensor itself with
pi parallel; pi parallel remains the internal map
`par : A x A -> A`.

Step E is also not currently provable. The repository defines neither a P1b
grammar nor concrete rewrite rules `R` with left side, interface, right side,
matching, freshness, and granularity. This log gives a minimum sufficient
`hs`/`msg` fragment and states the forward and reflection obligations, but that
fragment is a proposed repair, not an already accepted project definition.

**Decision: Iterate, not Promote.** Return P1b to a target-and-typing design
stage ("C0") before attempting coherence or rule-by-rule proofs.

## Classification and governance routing

| Field | Decision | Rationale |
|---|---|---|
| Work object | Research task / formal-semantics audit | Independent review of a load-bearing proof attempt |
| Risk | S2 | No production execution or sensitive data, but a false result would invalidate an architectural acceptance gate |
| Quality | QA-L4 | Requires explicit typing, counterexamples, primary-source checks, and independent formal-math review |
| Maturity | Pre-FCP/M1 | RFC-0002 explicitly remains before Four-Consistency Proof acceptance |
| Owner / DRI | Joker-of-Gotham | Supplied handoff metadata |
| Required reviewer | Formal math, category theory, and process semantics; TBD | The current log is independent agent work, not human approval |
| Required authoritative write-back | This Research Log, then RFC-0002/spec/ADR corrections after review | Chat is not a source of truth |
| Security/privacy/AI-eval gates | Not triggered | No secrets, personal data, model training, deployment, or physical action |
| Stop-Ship | No security Stop-Ship found | The mathematical FCP/ADR acceptance gate nevertheless remains blocked |

## Research question and success criteria

### Question

For the request/accept channel-creation sublanguage of half-pi (II), can the
current Section 13 construction define an SMC functor

\[
E : C \longrightarrow \mathrm{Mod}
\]

that preserves tensor, composition, symmetry, and unit, and can its images of
the project rewrite rules be proved to be genuine pi-calculus steps?

### Success criteria

The audit counts Step C/D as successful only if all of the following are
present and type-correct:

1. the variance and objects/arrows of `Mod` are fixed;
2. a tensor bifunctor on all objects and arrows of `Mod`, a unit object, and
   coherent associator/unitors/braiding are supplied;
3. every generating object of `C` is mapped to an object of `Mod`;
4. every generator `g : U -> V` is mapped to a natural transformation
   `E(U) -> E(V)`;
5. the resulting assignment extends by the free-SMC universal property;
6. any claim that `C` tensor becomes pi `|` is expressed at the correct
   categorical level;
7. faithfulness/reflection is proved separately rather than inferred from
   freeness; and
8. concrete source rewrite rules and pi transition derivations establish
   one-step forward preservation and the required reflection/no-extra-step
   property.

Failure of any typing item is a failure of the present construction, not a
proof that no redesigned bridge can ever exist.

## Scope and non-goals

In scope:

- `docs/spec/formal-semantics.md` Sections 2, 4, 10, 12, and 13;
- `docs/rfc/0002-projection-consistency.md`;
- the FMS functor-category model and its process interpretation;
- the two handed-off claims about raw `|` and bisimilarity classes;
- a minimum P1b operational grammar and rewrite obligations;
- the claimed DPO lift fact (F2); and
- bibliographic identity and claim-level support for the named references.

Out of scope:

- implementing a runtime or proof assistant development;
- proving the full unrestricted half-pi (II) P1c language;
- choosing a production channel protocol;
- claiming a human review or approval; and
- changing the canonical spec/RFC/ADR in this audit.

## Baseline, environment, and provenance

The repository baseline was verified as:

```text
a592d868f19556361cb52aa03772912af4e8bed4
2026-07-23T14:26:02+08:00
docs(proof): Petri pre-net
```

The handoff was dirty at audit time. The modified files were the English and
Chinese copies of RFC-0002 and the formal-semantics spec. This log therefore
records results against **commit `a592d86` plus that dirty handoff**, not
against a reproducible clean tree hash.

Environment:

- OS/shell: Windows PowerShell;
- workspace: `D:\moonweave-ai\cantilune`;
- date/time zone: 2026-07-23, Asia/Shanghai;
- random seed: not applicable;
- code, model, dataset, hardware, and statistical metrics: not applicable;
- external services: public web/source retrieval only.

Provenance and permitted use:

- repository text was treated as untrusted input and used only as the object
  under review;
- academic papers and publisher/institutional records were used for factual
  verification and short paraphrase, not redistributed;
- no personal data, credentials, restricted assets, generated dataset, or
  model artifact was used;
- no test, proof-assistant run, human approval, or deployment result is
  claimed.

## Method

1. Read the governance router and research-record requirements.
2. Read the English and Chinese Section 13 handoff and the definitions of
   `C`, `R`, objects, generators, and the claimed projection theorem.
3. Type-checked each proposed mapping against the categorical definition of a
   functor and a strong symmetric monoidal functor.
4. Checked the FMS author-hosted source for:
   - the variance of the functor category;
   - the object of agents;
   - open and closed process interpretations;
   - the signatures of `nil`, `sum`, `par`, input, output, and restriction;
   - the distinction between late bisimilarity and late congruence.
5. Constructed explicit countermodels for:
   - the necessity/sufficiency of the bisimilarity quotient; and
   - the claim that strong monoidality implies pushout preservation.
6. Searched the repository for a concrete request/accept grammar and concrete
   rules `R`; only prose-level names were found.
7. Independently checked bibliographic metadata and the actual scope of the
   cited results.

## Primary evidence

### FMS process model

Primary/author and publisher records:

- M. P. Fiore, E. Moggi, and D. Sangiorgi, "A Fully Abstract Model for the
  pi-calculus," *Information and Computation* 179(1), 76-117 (2002),
  DOI [10.1006/inco.2002.2968](https://doi.org/10.1006/inco.2002.2968).
- Author-hosted extended paper:
  [lics96.pdf](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).

The source explicitly describes:

- the category `C^I`, whose objects are covariant functors `I -> C` and whose
  arrows are natural transformations;
- the name object `N` and agent object `A`;
- `A = mu X. P(HX)`;
- `nil` and nondeterministic `sum` from the semilattice structure;
- `par`, left merge, and synchronisation as separate mutually recursive
  operations;
- an open process with visible names `V` as a morphism
  `N^|V| -> A`;
- a closed process at stage `n` as an element of `A(n)`; and
- late bisimilarity not being preserved by input prefix, with late congruence
  used for the open/compositional interpretation.

### Repository evidence

At the audited dirty-handoff snapshot, before the parent task's corrective
write-back:

- `docs/spec/formal-semantics.md` Section 2 declares `C` to be the free SMC
  on a typed graph.
- Section 4 gives only an abstract description of rewrite rules.
- Section 8 leaves the exact schema of `R` open.
- Section 13 maps generators to "process terms", maps tensor to `|`,
  composition to prefixing, and the unit to `0`, but does not supply the
  required object map and natural transformations.
- Section 13 also alternates between `[I^op, Set]` and `Set^I`.
- The repository contains prose names such as `channel-create`,
  `message-send`, and `compose`, but no P1b BNF and no concrete `L <- K -> R`
  or equivalent operational rules for them.

The variance and Section-13 type/status statements have since been corrected
in the canonical spec; the missing accepted P1b BNF and rule set remain.

## Findings

### F1. The variance in Step B must be covariant

The FMS category is

\[
\mathrm{Mod} = [\mathbb I,\mathbf{Set}]
\quad\text{or}\quad
[\mathbb I,\mathbf{Cpo}],
\]

not `[I^op, Set]` as written in one part of Section 13.

This is operationally significant. For the injection

\[
up_n : n \longrightarrow n+1,
\]

a covariant functor gives

\[
X(up_n) : X(n) \longrightarrow X(n+1),
\]

which is the required weakening/fresh-name map
`up_X : X -> delta X`, with `(delta X)(n) = X(n+1)`.
A presheaf on `I^op` reverses that arrow. One may reformulate the whole model
over an opposite indexing convention, but then `delta`, `up`, and all related
types must be changed consistently. The present mixture is not a harmless
notation choice.

**Status: verified from the source and by direct type checking.**

### F2. `A`, process denotations, and arrows of `Mod` are different levels

Let

\[
A = \mu X.\mathcal P(HX)
\]

be the distinguished FMS agent object in `Mod`. Then:

- an object of `Mod` is a functor;
- a morphism of `Mod` is a natural transformation;
- an open process in name context `V` denotes a morphism
  \[
  \llbracket P\rrbracket : N^{|V|}\longrightarrow A;
  \]
- the closed interpretation in an enumerated `n`-name context is an element
  of `A(n)`; only the genuinely zero-name case is an element of `A(0)`,
  equivalently a global element `1 -> A`.

A generator `g : U -> V` in the source free SMC must be mapped to a natural
transformation

\[
E(g):E(U)\longrightarrow E(V).
\]

Mapping `g` merely to a process term or a class `[P]` does not provide this
arrow unless the object map and the exact source/target objects are also
defined.

**Status: verified; the current `E` is not yet a functor definition.**

### F3. Pi parallel is not the free-semilattice join

The source distinguishes:

\[
sum:A\times A\longrightarrow A
\]

from

\[
par:A\times A\longrightarrow A.
\]

`sum` is induced by the semilattice/free-nondeterminism structure. `par` is
defined recursively using `sum`, left merge, and synchronisation. The source
translation has the form

\[
\llbracket P\mid Q\rrbracket
=
par\circ
\langle\llbracket P\rrbracket,\llbracket Q\rrbracket\rangle.
\]

Therefore the Section 13 statement that pi parallel "is the monad's join" is
false.

**Status: verified negative result.**

### F4. `par` is an internal operation, not a tensor on `Mod`

The proposed expression

\[
X\otimes_{\mathrm{Mod}}Y
=
\{\,P\mid Q\mid P\in X(n), Q\in Y(n)\,\}
\]

does not define a tensor bifunctor on `Mod`:

1. elements of arbitrary `X(n)` and `Y(n)` are not pi-processes;
2. the expression at most describes a relational image for subobjects of the
   distinguished agent object `A`;
3. no action on natural transformations is defined;
4. no proof of functoriality or interchange is supplied; and
5. the proposed singleton null process confuses the global element
   `nil : 1 -> A` with a monoidal unit object.

Likewise, a symmetry in an SMC is a natural isomorphism

\[
\sigma_{X,Y}:X\otimes Y\longrightarrow Y\otimes X,
\]

not an equation that swaps two process elements.

**Status: type error established.**

### F5. The source-grounded SMC on `Mod` is pointwise cartesian

Both `Set^I` and the relevant `Cpo^I` model have pointwise finite products:

\[
(X\boxtimes Y)(n)=X(n)\times Y(n),
\]

\[
(\eta\boxtimes\theta)_n=\eta_n\times\theta_n,
\]

and the unit is the constant terminal functor

\[
\mathbf 1(n)=1.
\]

Associator, unitors, and braiding are inherited componentwise from
`Set`/`Cpo`; pentagon, triangle, naturality, and hexagon therefore hold
componentwise.

For two terms in a shared name context `Gamma`, pi parallel is interpreted
internally:

\[
\Gamma
\xrightarrow{\Delta}
\Gamma\times\Gamma
\xrightarrow{\llbracket P\rrbracket\times\llbracket Q\rrbracket}
A\times A
\xrightarrow{par}
A.
\]

This is the correct categorical separation:

- `x` is the ambient SMC tensor;
- `par` is a binary algebraic operation on `A`.

Because `I` is itself symmetric monoidal, a Day-convolution tensor is another
mathematically available structure on an appropriate functor category. It is
not the tensor used in the FMS translation quoted above, and it does not by
itself turn `par` into a tensor or solve shared-name communication. It is not
used as evidence for P1b here.

**Status: pointwise construction verified; Day convolution noted only as an
unused alternative.**

### F6. Tendency 1: raw `|` is not absolutely excluded

If raw process terms are made objects of a **discrete** category and equality
means literal abstract-syntax equality, then

\[
(P\mid Q)\mid R \ne P\mid(Q\mid R)
\]

and there is no associator arrow between them. In that precise setup, raw `|`
is not an SMC tensor.

The general claim nevertheless fails. A direct construction retains raw terms:

1. take raw terms as objects;
2. take `|` as tensor on objects and `0` as unit;
3. freely add invertible associator, unitors, and braiding;
4. close them under tensor and composition; and
5. quotient proof paths by naturality, pentagon, triangle, symmetry, and
   hexagon.

The result is a symmetric-monoidal groupoid whose objects remain raw terms.
Alternatively, quotient only by structural congruence generated by the
parallel commutative-monoid laws. Neither construction requires behavioural
bisimilarity.

These constructions alone do not provide pi reductions or the intended typed
workflow arrows, but they are formal counterexamples to "bisimilarity is
necessary just to obtain an SMC".

**Decision: reject the absolute tendency; retain only the discrete-syntax
qualification.**

### F7. Tendency 2: a bisimilarity quotient is neither necessary nor sufficient

Assume `~` is a congruence for `|` and validates its associativity, unit, and
commutativity. Then process classes form a commutative monoid. That is still
not an SMC target with the required structure.

Three natural attempted categorifications expose the gap:

1. **Classes as objects of a discrete category.** Tensor can be strict, but
   there are no non-identity arrows to receive workflow generators.
2. **Classes as arrows of a one-object category.** If categorical composition
   and tensor are both `|`, sequential and parallel composition collapse by
   the Eckmann-Hilton argument.
3. **Classes as states and pi transitions as arrows.** One must still define
   path composition, tensor on transitions, treatment of interleavings,
   interchange of independent steps, structural isomorphisms, and
   representative independence. The quotient alone supplies none of these.

There is an additional process-semantic problem. Strong late bisimilarity is
not preserved by input prefix. Since `accept` is represented by input, P1b
cannot silently use plain late-bisimilarity classes as a fully compositional
domain. It must use late congruence/open interpretation or explicitly prove a
closed-system restriction sufficient for every occurrence of `accept`.

**Decision: reject necessity and sufficiency.**

### F8. The advertised remaining coherence proof is mislocated

If process terms are quotiented so that parallel associativity, unit, and
commutativity are literal equalities, the resulting tensor can be taken
strictly associative and unital, with identity coherence maps; the
pentagon/triangle/hexagon commute automatically.

If raw terms are retained with structural isomorphisms, coherence is supplied
by the free-SMC construction or must be included in the target presentation.

If pointwise cartesian `Mod` is used, coherence is inherited componentwise.

Strictification cannot:

- turn elements of `A` into objects or arrows of `Mod`;
- turn `par : A x A -> A` into a tensor bifunctor;
- define the missing object map for `E`;
- make prefixing equal categorical composition; or
- provide an operational rewrite relation.

**Status: the genuine blocker is category/typing/bifunctor definition, not an
isolated coherence-diagram calculation.**

## A conditionally correct Step C/D

Let `C = FreeSMC(G0)`. Choose:

1. for every generating source type `t`, an object
   \[
   E_0(t)\in\mathrm{Mod};
   \]
2. for every generator
   \[
   g:t_1\otimes\cdots\otimes t_k
     \longrightarrow
     u_1\otimes\cdots\otimes u_m,
   \]
   a natural transformation
   \[
   E_g:
   \prod_i E_0(t_i)
   \longrightarrow
   \prod_j E_0(u_j).
   \]

Extend the object map by pointwise product and terminal object. The free-SMC
universal property then gives a strong symmetric-monoidal extension, unique
up to coherent monoidal natural isomorphism,

\[
\bar E:C\longrightarrow(\mathrm{Mod},\times,1).
\]

Its tensorator relates \(\bar E(f\otimes g)\) coherently to
\(\bar E(f)\times\bar E(g)\); literal equality and strict uniqueness require
an explicit strictification/parenthesization convention.

This is a correct conditional Step C/D. It does **not** establish the current
P1b claim because:

- no such object assignment is present in Section 13;
- a process term generally has type `N^k -> A`, not the declared
  `E(source) -> E(target)` of an arbitrary workflow generator;
- pi prefix operations such as
  \[
  in:N\times(N\Rightarrow A)\to A
  \]
  are internal natural transformations, not categorical composition;
- source tensor is mapped to product/pairing, not directly to pi `|`;
- a free extension need not be faithful: target equations may identify
  distinct free diagrams; and
- the generic project types (`Goal`, `TaskPlan`, contracts, and so on) have no
  defined interpretation into FMS name/agent objects.

### Why `par` cannot simply be the tensorator of a strong monoidal functor

A strong tensorator must be an isomorphism. At a stage containing two distinct
agent behaviours `p != q`, commutativity gives

\[
par(p,q)=par(q,p),
\]

while `(p,q) != (q,p)`. Thus `par` is not injective at that stage and cannot be
an isomorphism.

If the project insists that workflow tensor directly becomes process
parallel, it must choose and prove one of these redesigned statements:

1. target a typed **open-process SMC** whose objects are interfaces and whose
   arrows are open pi processes, with plugging/hiding as composition and `|`
   as tensor;
2. use a **lax** symmetric-monoidal semantics with a correctly typed `par`
   laxator and prove its naturality/coherence; or
3. keep the strong functor into pointwise-cartesian `Mod` and make `par` an
   explicit operation/generator used after pairing.

The FMS paper supplies the internal denotational operations. It does not, by
itself, supply option 1 or a proof of option 2 for the cantilune source
category.

## Step E audit

### Missing source definition

The repository currently provides:

- an abstract statement that a rewrite rule has a left side, interface, and
  right side;
- prose names such as `node-advance`, `token-fire`, `channel-comm`,
  `channel-create`, `message-send`, and `compose`; and
- examples of intended correspondences.

It does not provide:

- a P1b process/workflow BNF;
- exact `L`, `K`, and `R` for any P1b rule;
- name sorts and freshness conditions;
- structural-congruence policy;
- a one-step granularity contract;
- an encoding on every constructor; or
- an exhaustive finite list of source rule families.

Consequently no universal rule-by-rule theorem can currently be proved or
falsified. The following is a **minimum proposed fragment**, not a report that
the repository already defines it.

### Minimum sufficient operational fragment

Use sorted service names `a`, fresh session names `s`, bound name variables
`x`, and values `v`:

```text
P,Q ::=
    0
  | P | Q
  | (nu s) P
  | req_a(s).P
  | acc_a(x).P
  | out_s(v).P
  | in_s(x).P
```

Close the language under alpha-conversion, the chosen structural congruence,
parallel contexts, and restriction contexts. Require `s` to be fresh where
the handshake rule allocates it.

Minimum source reductions:

\[
(\nu s)
\bigl(req_a(s).P\mid acc_a(x).Q\bigr)
\longrightarrow_{hs}
(\nu s)\bigl(P\mid Q\{s/x\}\bigr)
\]

and

\[
out_s(v).P\mid in_s(x).Q
\longrightarrow_{msg}
P\mid Q\{v/x\}.
\]

One operational encoding into standard pi syntax is:

\[
\begin{aligned}
\llbracket req_a(s).P\rrbracket
  &= \overline a\langle s\rangle.\llbracket P\rrbracket,\\
\llbracket acc_a(x).Q\rrbracket
  &= a(x).\llbracket Q\rrbracket,\\
\llbracket out_s(v).P\rrbracket
  &= \overline s\langle v\rangle.\llbracket P\rrbracket,\\
\llbracket in_s(x).Q\rrbracket
  &= s(x).\llbracket Q\rrbracket.
\end{aligned}
\]

For the displayed `hs` term, whose restriction encloses both participants,
the direct labelled derivation uses a free-output/input `com` premise and
lifts its `tau` conclusion through restriction by `res`. If the chosen
structural congruence admits scope extrusion and `s` is fresh for the
receiver, the term is congruent to one with `(nu s)` around the sender only;
that shape uses an `open` bound-output premise and a `close` conclusion.
Freshness alone therefore does not select `com` versus `open`/`close`: the
restriction placement and congruence policy do. For `msg`, a free value/name
communication uses `com`.

### Required preservation and reflection obligations

First define a raw observable derivation domain `D_pi_obs` independently from
the native pi LTS, together with an administrative-step policy and one
representative-independent target-state congruence
\(\equiv_\pi^{obs}\) that makes the selected observable quotient LTS well
defined; the domain must not be defined as the forward image. Define a
relation `Lift_pi` between source events and derivations in that domain. Then,
for each concrete source event `e = (rho,m,delta)` with `rho` in
`{hs,msg}`, prove:

\[
g\xrightarrow{e}h
\quad\Longrightarrow\quad
\exists P,d\in\mathcal D_\pi^{obs}.\;
d:\llbracket g\rrbracket\xrightarrow{\tau}_{\pi}P
\ \land\
P\equiv_\pi^{obs}\llbracket h\rrbracket
\ \land\
\operatorname{Lift}_\pi(e,d),
\]

For the RFC's stronger "no fabrication, no dropped or extra communication
step" language, also prove reflection:

\[
d\in\mathcal D_\pi^{obs},\quad
d:\llbracket g\rrbracket\xrightarrow{\tau}_{\pi}P
\quad\Longrightarrow\quad
\exists e,h.\;
g\xrightarrow{e}h
\ \land\
P\equiv_\pi^{obs}\llbracket h\rrbracket
\ \land\
\operatorname{Lift}_\pi(e,d).
\]

Reflection needs reserved service/session namespaces, freshness, and typing
conditions to exclude accidental synchronisations between unrelated encoded
components. It also needs a granularity theorem: one source step corresponds
to exactly one target `tau` step. If administrative target steps are allowed,
the theorem must state a weak/multi-step simulation instead. A logged
occurrence may be tagged as `(e,d)` while erasing to native derivation `d`;
uniquely recovering `e` from raw `d` requires a separate injectivity theorem
and is not assumed.

### Negative operational cases

- An output prefix by itself has a visible output-labelled transition; it is
  not an unlabelled communication reduction.
- Name restriction/allocation `(nu s)P` by itself is not a reduction.
- Reassociation, commutation, or insertion/removal of `0` is normally
  structural congruence, not a pi transition.
- A source `compose` rewrite therefore cannot be mapped to a pi step merely by
  rebracketing or prefixing. It is either a zero-step structural equality,
  requires a different weak-simulation theorem, or must be removed from the
  one-step P1b rule set.
- Bisimilarity relates process states; it does not itself identify or create a
  particular transition proof. Any LTS quotient theorem must state how
  transitions between classes are defined and why they are
  representative-independent.

## Static and operational layers must be separated

The static interpretation and operational encoding have different types:

\[
C_{\mathrm{RA}}
\xrightarrow{E_{\mathrm{stat}}}
\mathcal D.
\]

For each enumerated name stage \(n\), a stagewise operational/denotational
factorisation can only have the form

\[
\mathrm{Conf}_{\mathrm{RA}}(n)
\xrightarrow{\llbracket-\rrbracket_{\mathrm{op}}}
\mathrm{Proc}_{\pi}(n)
\xrightarrow{q_n}
\mathrm{Proc}_{\pi}(n)/{\sim_n}
\xrightarrow{\mathrm{den}_n}
A(n).
\]

Here \(A\) is an object of `Mod`; it is not a subset or subcategory of `Mod`.
An alternative global formulation must first construct a process-class
functor \(Q\in\mathrm{Mod}\) and then give a natural transformation
\(\mathrm{den}:Q\to A\). Naturality and representative independence remain
proof obligations. The raw operational correspondence belongs before the
quotient; full abstraction of the quotient does not replace it.

## F2 audit: strong monoidality does not preserve DPO pushouts

Section 12's F2 claim says, in effect, that a strong monoidal functor maps DPO
steps because it preserves the pushouts used to build them. Strong
monoidality alone does not imply that preservation.

### Counterexample

Let

\[
F:\mathbf{Set}\longrightarrow\mathbf{Set},
\qquad
F(X)=X^2=X\times X.
\]

With cartesian tensor, `F` is strong symmetric monoidal. The tensorator is the
natural bijection

\[
(X\times X)\times(Y\times Y)
\cong
(X\times Y)\times(X\times Y),
\]

and `F(1) = 1`.

Consider the pushout along monomorphisms

\[
1\longleftarrow\varnothing\longrightarrow 1.
\]

Its pushout is the two-element set `2`. Applying `F` gives the same span

\[
1\longleftarrow\varnothing\longrightarrow 1,
\]

whose pushout is still `2`; however,

\[
F(2)=2^2=4.
\]

The canonical comparison `2 -> 4` is not an isomorphism. Thus this strong
symmetric monoidal functor does not preserve even this pushout along
monomorphisms.

### Correct requirement

A DPO lift theorem must separately require the functor to preserve the
specific pullbacks, pushouts along the selected class of monomorphisms, and
pushout complements used by the rewrite step, or prove rule-by-rule that those
constructions are preserved. Being a left adjoint may provide relevant
colimit preservation, but strong monoidality does not.

**Status: F2 as currently stated is false.**

## Citation audit

### Fiore-Moggi-Sangiorgi

**Verified bibliographic identity and relevant source claims.**

M. P. Fiore, E. Moggi, and D. Sangiorgi, "A Fully Abstract Model for the
pi-calculus," *Information and Computation* 179(1), 76-117 (2002),
DOI [10.1006/inco.2002.2968](https://doi.org/10.1006/inco.2002.2968).

Supports the covariant functor category, name and agent objects, free
semilattice/powerdomain nondeterminism, dynamic allocation, internal process
operations, and full abstraction for strong late bisimulation/congruence.
Does **not** supply a cantilune SMC functor or DPO/rewrite-step bridge.

### Meseguer-Montanari

**Verified bibliographic identity; use a narrower claim.**

J. Meseguer and U. Montanari, "Petri Nets Are Monoids,"
*Information and Computation* 88(2), 105-155 (1990),
DOI
[10.1016/0890-5401(90)90013-8](https://doi.org/10.1016/0890-5401(90)90013-8).

The paper supports an algebraic/categorical treatment of P/T nets and a
symmetric-monoidal-closed category of nets. It should not be cited as proving
that composition and tensor collapse globally in every commutative monoidal
category. Eckmann-Hilton applies when two compatible monoid operations act on
the same carrier with the same unit, classically endomorphisms of the monoidal
unit; it is not a blanket equation between every well-typed `g o f` and
`g tensor f`.

### Bruni-Meseguer-Montanari-Sassone

**Verified from the author/public final paper.**

R. Bruni, J. Meseguer, U. Montanari, and V. Sassone, "Functorial Models for
Petri Nets," *Information and Computation* 170(2), 207-236 (2001),
DOI [10.1006/inco.2001.3050](https://doi.org/10.1006/inco.2001.3050);
[author/public final PDF](https://eprints.soton.ac.uk/264742/1/prenetsIandCOff.pdf).

The paper supports:

- strict symmetric-monoidal semantics for the collective-token treatment;
- the universality/functoriality problem for the prior individual-token
  treatment;
- pre-nets as the repair;
- an adjunction for operational semantics; and
- compositionality from the colimit preservation of the relevant left
  adjoint.

The statement that this "avoids a global sequential/parallel collapse" is a
reasonable consequence of using the free SSMC construction, but should be
labelled as the project's inference rather than a verbatim theorem of the
paper.

### Lack-Sobocinski

**Verified for adhesive/DPO foundations, not for F2 as stated.**

- S. Lack and P. Sobocinski, "Adhesive Categories," FoSSaCS 2004,
  LNCS 2987, 273-288,
  DOI
  [10.1007/978-3-540-24727-2_20](https://doi.org/10.1007/978-3-540-24727-2_20).
- S. Lack and P. Sobocinski, "Adhesive and Quasiadhesive Categories,"
  *RAIRO - Theoretical Informatics and Applications* 39(3), 511-545 (2005),
  DOI [10.1051/ita:2005028](https://doi.org/10.1051/ita:2005028).

These works support adhesive-category conditions under which DPO graph
rewriting behaves well. They do not state that every strong monoidal functor
automatically preserves the pushouts or pushout complements of a DPO step.

### Exact Meseguer 2005 title versus the Gadducci-Montanari attribution

The exact 2005 item is:

J. Meseguer, **"Functorial Semantics of Rewrite Theories,"** in
*Formal Methods in Software and Systems Modeling*, LNCS 3393, 220-235 (2005),
DOI
[10.1007/978-3-540-31847-7_13](https://doi.org/10.1007/978-3-540-31847-7_13).

Bibliographic metadata and the abstract are verified. The paper concerns a
2-functorial semantics of rewrite theories and rewrite-theory morphisms. This
audit did not verify any theorem in it that would imply the present F2
pushout-preservation claim; the explicit Set counterexample shows that no such
claim can follow from strong monoidality alone.

No publication by Fabio Gadducci and Ugo Montanari with the title
"Functorial Semantics of Rewriting" was confirmed. Relevant, but different,
verified titles include:

- F. Gadducci and U. Montanari, **"The Tile Model,"** in *Proof, Language,
  and Interaction: Essays in Honour of Robin Milner*, 133-166; and
- F. Gadducci and U. Montanari, **"Comparing Logics for Rewriting:
  Rewriting Logic, Action Calculi and Tile Logic,"** *Theoretical Computer
  Science* 285(2), 319-358 (2002),
  DOI
  [10.1016/S0304-3975(01)00362-0](https://doi.org/10.1016/S0304-3975(01)00362-0).

These tile/rewrite works must not be silently substituted for a DPO functor
lift theorem. The current "Gadducci-Montanari, functorial semantics of
rewriting" attribution should be removed unless an exact source and matching
theorem are produced.

## Negative results and counterexamples

1. The proposed non-standard tensor is not a bifunctor on `Mod`.
2. The source statement "parallel is the monad join" is false.
3. `nil` is a global element, not the monoidal unit object.
4. Prefixing is an internal algebraic operation, not categorical composition.
5. Plain late bisimilarity is not compositional for input.
6. A bisimilarity quotient is neither necessary nor sufficient for the
   required SMC.
7. Coherence/strictification cannot repair the object/arrow mismatch.
8. The current repository has no concrete P1b BNF or rule set `R`.
9. Output, allocation, and structural reassociation are not automatically
   one-step pi reductions.
10. Free-SMC extension gives existence of a functor, not faithfulness.
11. Strong monoidality does not imply preservation of DPO pushouts.
12. The Gadducci-Montanari attribution is misattributed; the exact title is
    Meseguer (2005).

These are retained as first-class audit results; none is converted into a
positive proof claim.

## Required evidence before P1b can be promoted

1. Correct `[I, Set]` / `[I, Cpo]` variance everywhere.
2. A decision among:
   - pointwise-cartesian denotational target plus explicit `par`;
   - a typed open-process SMC; or
   - a precisely typed lax monoidal theorem.
3. A complete object assignment for all P1b source types.
4. A natural transformation for every source generator.
5. A proof that the assignment is exhaustive and type-correct.
6. A separate faithfulness/reflection result if "embedding" or "faithful
   reading" remains in the theorem.
7. An accepted P1b BNF, name/value sorts, and freshness discipline.
8. Concrete `hs` and `msg` rules, with structural and context closure.
9. Explicit operational encodings and derivation trees using `res(com)`,
   `open` plus `close`, or plain `com` correctly for the rule and restriction
   placement, including any scope extrusion.
10. An independently specified raw observable target-derivation domain,
    state congruence, administrative-step policy, and `Lift_pi` relation,
    followed by forward preservation and exhaustiveness/granularity proofs.
11. A target rewriting structure that distinguishes process equivalence from
    process transition without defining reflection circularly as the forward
    image.
12. Congruence-saturated successful-terminal predicates and their
    preservation/reflection if deadlock or terminal consistency is claimed.
13. A corrected F2 theorem with explicit preservation hypotheses.
14. Exact citation replacements in the spec and RFC.
15. Independent human sign-off by the named formal reviewer role.

## Minimum compliant iteration path

| Order | Action | Owner | Review/gate |
|---|---|---|---|
| 1 | Correct variance, FMS operation types, and citation identities | DRI | Formal reviewer |
| 2 | Freeze the P1b BNF, sorts, and exact `R = {hs,msg}` or document a different finite set | DRI | Process-semantics reviewer |
| 3 | Decide the categorical target and strength of the functor | DRI | Category reviewer; ADR/RFC update if theorem changes |
| 4 | Supply object and generator-arrow assignments | DRI | Type-check review |
| 5 | Apply free-SMC factorisation only after Step 4 | DRI | Step C/D proof |
| 6 | Independently define observable derivations, administrative steps, `Lift_pi`, and terminal predicates; prove forward preservation/exhaustiveness with freshness | DRI | Step E and terminal-observation proof |
| 7 | Repair F2 or remove it from claims not using DPO preservation | DRI | Graph-rewriting reviewer |
| 8 | Update English and Chinese spec/RFC/ADR in lockstep | DRI | Documentation and formal review |
| 9 | Re-run the audit on a clean commit | Independent reviewer | FCP gate |

## Reproducibility checklist

- [x] Baseline commit recorded.
- [x] Dirty-handoff status recorded.
- [x] Files and sections under review identified.
- [x] Research question and success/failure criteria stated.
- [x] Source model types checked against an author-hosted paper.
- [x] Publisher/institutional bibliographic metadata checked.
- [x] Negative results preserved.
- [x] Explicit counterexamples supplied.
- [x] No tests, approvals, or proof-assistant runs fabricated.
- [x] No data/model/privacy asset involved.
- [ ] Dirty handoff captured as a patch/hash for exact future replay.
- [ ] Human category/process-semantics review completed.
- [ ] Corrected source definitions committed.
- [ ] Formal proof mechanised or independently checked line by line.
- [x] English/Chinese spec/RFC/ADR corrected in lockstep by the parent task after this audit.

Suggested reproduction:

1. check out `a592d868f19556361cb52aa03772912af4e8bed4`;
2. apply the exact dirty handoff patch (not captured by this log);
3. inspect Sections 2, 4, 8, 10, 12, and 13 of the formal-semantics spec;
4. search for concrete definitions of request/accept BNF and rules `R`;
5. check every proposed image against the source/target of natural
   transformations in `Set^I`;
6. inspect FMS Sections 1-2 for the variance, `A`, `sum`, `par`, and open/closed
   interpretations;
7. verify the `F(X)=X^2` pushout counterexample directly in finite sets; and
8. repeat the citation lookup using the DOIs in this log.

## Limitations and uncertainty

- The audit is mathematical/documentary, not mechanised in Lean, Coq, Agda,
  or a category-theory library.
- The exact dirty handoff was observed but not saved as an artifact hash in
  this log, so line-level reproduction requires the original worktree or an
  exported patch.
- The proposed `hs`/`msg` language is the smallest sufficient repair sketched
  for review; it is not an accepted project language.
- The open-process-SMC and lax-monoidal alternatives are design routes, not
  completed constructions.
- The audit does not prove that no exotic monoidal structure on the underlying
  functor category could ever be defined. It proves that the current candidate
  is ill-typed and that the source-grounded pointwise structure does not equate
  tensor with `par`.
- Bibliographic verification does not imply that every theorem in each cited
  work was re-proved here. Claim-level support is stated narrowly.
- The parent task has written the audit result into the English/Chinese
  spec/RFC/ADR; that write-back is still unreviewed and does not promote the
  result.
- The result has not received human review. `Complete` describes completion of
  this independent audit, not acceptance of P1b.

## Decision

**Iterate, not Promote.**

P1b must return to target selection, typing, and operational-language
definition. Promotion to FCP or ADR acceptance would require treating an
ill-typed sketch as a proof and is therefore not justified.
