# CantiluneGraph v0.1 — Formal Semantics Specification

| Field | Value |
|---|---|
| Status | **Draft** (awaiting RFC-0002 consistency proof + second reviewer) |
| Type | Normative specification (formal semantics) |
| Risk | S2 |
| Owner | Joker-of-Gotham (DRI) |
| Reviewers | TBD (governance gap — see RFC-0001 metadata / governance note) |
| Created | 2026-07-23 |
| Updated | 2026-07-23 (mechanized-boundary reconciliation) |
| Related | RFC-0001, ADR-0001, RFC-0002, `docs/research/0001-p1b-pi-bridge-audit.md` |

> **Governance note:** This spec defines the formal object that RFC-0002 must prove consistent. Claims marked **待证 / unverified** are not yet proven; claims marked **按构造 (by construction)** follow directly from the definitions here. The π-projection is **待证** by design decision (half-π (II)) — see §6.4 and RFC-0002.

---

## 1. Purpose and scope

This document defines `CantiluneGraph` v0.1: the **single formal object** that is the cantilune formal orchestration substrate. It specifies:

- The static structure $C$ (a symmetric monoidal category).
- The dynamics $R$ (string-diagram rewriting).
- The four projections (DAG, Petri, π, morphism) and their relationship to $(C, R)$.
- What is guaranteed **by construction** vs. what is **待证** (esp. the π-projection).

**Non-goals:** no runtime, no LLM, no I/O, no tool/network integration in this spec. This is pure formal core.

## 2. Core definition

$$\text{CantiluneGraph} := (C, R)$$

where:
- **$C$** — a **symmetric monoidal category (SMC)**, presented by a typed graph. $C$ is the *static structure*: what counts as a legal composition (sequential $\circ$) and parallel ($\otimes$) combination of operations.
- **$R$** — a set of **string-diagram rewriting rules** over $C$. $R$ is the *dynamics*: execution is rewriting; a step is one concrete rule application; a trace records those application events; replay re-applies the recorded events. Normal forms follow from $R$, but successful termination versus deadlock additionally requires a separately supplied success predicate.

### 2.1 Objects and morphisms of $C$

- **Objects** = types / states. Every object is built from base types via the monoidal product $\otimes$ and the unit $I$.
- **Morphisms** = operations / transitions. A morphism $f : A \to B$ is a typed operation taking input of type $A$ and producing output of type $B$.
- **Composition $\circ$** = sequential dependency (the DAG facet's "edge").
- **Tensor $\otimes$** = parallel composition (the Petri facet's concurrency; the morphism facet's parallel agents).
- **Symmetry $\sigma_{A,B} : A \otimes B \to B \otimes A$** = reordering (token interchangeability / channel rerouting).

### 2.2 Presentation by a typed graph

$C$ is **presented** by a typed graph $G_0 = (N, E, \tau)$:
- $N$ — nodes (generators): each is a typed morphism with declared `in`/`out` types.
- $E$ — typed contract edges (see §3.2): typed data dependencies, not untyped arrows.
- $\tau$ — type assignment.

$C$ is the **free SMC** on $G_0$ (modulo the equations that define $\otimes$, $\circ$, $\sigma$). This makes the **static DAG presentation** by construction; the rewrite lift still requires the identity/direct rule-map condition in §6.1.

**Current mechanization boundary.** `FreeSMCQuotient.lean` defines the
generated compatible equivalence containing category, tensor-bifunctor,
associator/unitor/symmetry naturality, inverse, pentagon, triangle, and
hexagon equations, and forms the hom-wise quotient.
`FreeSMCUniversal.lean` equips that quotient with actual mathlib
`Category`, `MonoidalCategory`, and `SymmetricCategory` instances and
constructs the interpretation for arbitrary target object, generator,
explicit-copy, and explicit-discard data. `FreeSMCStrongUniversal.lean`
packages this interpretation as an actual mathlib `Monoidal` and `Braided`
functor. `FreeSMCArbitraryUniversal.lean` now recursively constructs the
word-wise comparison from atomic object isomorphisms, derives quotient-arrow
naturality from generator/copy/discard compatibility, proves that the
resulting natural isomorphism and its inverse are monoidal, and proves
uniqueness among monoidal comparisons with the prescribed singleton
components. Thus the arbitrary-target universal comparison is kernel checked
relative to the chosen generator interpretation. It is still
`implemented_unverified`: no immutable commit-bound build or independent
QA-L4 review has promoted it. Projection rewrite preservation is a separate
obligation and remains open.

## 3. Syntactic layer (concrete forms)

### 3.1 Node (typed computational actor)

A node is not "a node in a graph"; it is a typed generator:

```yaml
node:
  id: planner
  type: AgentOperation          # Agent | Tool | Human | Environment | ...
  in:  [Goal]
  out: [TaskPlan]
  contract:
    pre:  [goal.exists]
    post: [plan.valid]
```

### 3.2 Edge (typed contract edge)

An edge is a typed data dependency carrying a contract:

```yaml
edge:
  source: planner
  target: executor
  artifact: TaskPlan
  schema:   TaskPlan/v1
  guarantees: [complete, validated]
```

Edges wire the output ports of generating operation nodes to compatible input
ports and thereby present composition in $C$; they do not independently
generate morphisms. The contract on a wire becomes a typing obligation.

### 3.3 String diagram (presentation form)

The canonical **presentation** of a `CantiluneGraph` is a **string diagram**: boxes (morphisms) connected by wires (objects/types). The same string diagram admits four readings (DAG / Petri / π / morphism) — this is the formal content of "four theories are four observation dimensions, not four modules" (RFC-0001 §5.1).

## 4. Dynamics: string-diagram rewriting $R$

### 4.1 Rewriting rules

A rule $\rho\in R$ has the DPO-style shape used in §10.6,

$$\rho=\left(L\xleftarrow{l}K\xrightarrow{r}R,\ \mathrm{cond}_\rho\right),$$

where $K$ is the preserved interface and $\mathrm{cond}_\rho$ contains the
matching/application conditions. The implementation now has two deliberately
separate ambient layers: an executable finite typed-open-hypergraph DPOI
fragment with inclusion matches and checked dangling/boundary conditions, and
an actual adhesive slice of a presheaf category for categorical DPO squares.
In the slice, a derivation still carries its pushout complement as evidence;
adhesivity does not prove that every proposed match admits one. A checked
bridge now exists for the fixed-host inclusion fragment: finite active-support
views form a thin inclusion category with a faithful functor into the typed
slice, and every executable event satisfying `InterfaceLocal` yields two
genuine intersection/union pushout squares there. This fixed-host bridge is no
longer the only transport result: active-support normalization maps each
concrete structure-preserving hypergraph morphism to an intrinsic typed-slice
morphism, preserves identity and composition, and sends globally injective
concrete matches to monomorphisms in both the intrinsic and ambient slice
categories. The normalized occurrence is now packaged as the general
`AdhesiveDPOI.Match`, and the ordinary presheaf gluing condition constructs a
full DPO derivation. Thus this transport does not assume `InterfaceLocal`; it
is not an equivalence with all slice objects. Separately,
the intrinsic finite positional category records ordered `Fin` incidence, is
full and faithful in the typed slice, and is equivalent to its precise
essential image.
For an arbitrary monic incidence-presheaf match, the explicit gluing condition
is now proved equivalent to existence of a pushout complement; the canonical
retained-subpresheaf complement is unique up to a map-compatible isomorphism,
and its second adhesive pushout gives a complete DPO derivation. Standard
factorisation-based parallel independence now gives both residual derivations
and a canonical concurrency isomorphism. A fixed-boundary open-cospan category
additionally proves that this isomorphism preserves both boundary legs when
they factor through the joint retained context. Moreover, any ambient DPO
witness whose interface, left, right, host, complement, and result all lie in
the positional essential image now lifts to a DPO witness in that full
subcategory and transports across the established equivalence to the
intrinsic finite category. For a span between intrinsic finite positional
graphs, gluing plus explicit retention of every distinguished input/output
port now constructs a finite positional retained graph and a typed natural
isomorphism from its encoding to the canonical componentwise complement.
Thus complement membership is automatic under exactly those two hypotheses;
boundary retention itself is not inferred from gluing. For these intrinsic
ambient-monic legal matches, the second pushout result is also proved to remain
in the positional essential image. For two supplied parallel-independent
canonical derivations, the joint pullback, both residual contexts, both
sequential results, and both residual DPO witnesses are likewise closed in
the finite positional presentation. What remains open is an unconditional
M-adhesive/Van-Kampen transfer for the intrinsic category, closure under every
categorical construction needed by such a transfer, critical-pair
completeness, and global confluence. Kernel-checked counterexamples also rule
out replacing this obligation by a whole-slice equivalence: the unrestricted
typed slice contains both infinite-carrier objects and finite
incidence-incomplete objects that cannot be isomorphic to positional
encodings.
The earlier shorthand pair “$L\to R$” is not a second rule type. **Execution
step** = applying one rule to a particular redex in the
current diagram. A concrete application event

$$e=(\rho,m,\delta)$$

records at least the rule $\rho$, the selected match/redex $m$, and any
derivation, representative, fresh-name, or allocation data $\delta$ needed to
identify the result under the chosen rewriting formalism. Write
$g\xrightarrow{e}h$. A rule name $\rho$ alone does not identify a step when
several matches are available.

### 4.2 Derived properties

Let $\equiv_R$ be the selected state equality/congruence for rewriting and let
$\mathcal T_{\mathrm{ok}}$ be a separately supplied success predicate,
saturated under $\equiv_R$. These are not determined by $(C,R)$ alone and
remain open operational configuration until §8 fixes them. The state space
below is the quotient by $\equiv_R$; “no outgoing event” is therefore
representative-independent.

| Property | Formal expression |
|---|---|
| Trace | concrete event sequence $g_0 \xrightarrow{e_1} g_1 \xrightarrow{e_2}\cdots\xrightarrow{e_n}g_n$ |
| Replay | given $g_0$ and the complete event/derivation sequence, re-derive $g_n$ up to the explicitly selected equality/isomorphism; rule names alone are insufficient |
| Termination | no infinite reduction (a property to be **checked**, not automatic) |
| Normal form / stuck | the class $[g]_{\equiv_R}$ has no outgoing concrete event |
| Successful termination | $[g]_{\equiv_R}$ is a normal form and $\mathcal T_{\mathrm{ok}}([g])$ |
| Deadlock | $[g]_{\equiv_R}$ is a normal form and $\neg\mathcal T_{\mathrm{ok}}([g])$ |

### 4.3 What rewriting does **not** give

- **Wall-clock time bounds**: rewriting is discrete; time bounds require *cost-annotated* rewriting or a timed extension (out of scope for v0.1).
- **Numerical resource caps**: $\text{token} \le 3$ is a **marking invariant** on the Petri projection (§6.2), not a bare-category property.

These limits are declared explicitly so RFC-0001 §8's C2 (predictability) is stated as **step-bounded**, not time-bounded.

## 5. The four projections

Each projection $P_i : (C, R) \to \text{Target}_i$ maps the unified object to a target formalism. **Consistency** means each $P_i$ is a **structure-preserving functor that lifts to rewriting** (a rewriting functor / simulation): it maps a rewrite step in $C$ to a rewrite step in the target.

### 5.1 DAG projection $P_{DAG}$

$P_{DAG}$ = the underlying presentation graph / free-category generators.

- **By construction**: $C$ is free on $G_0$, so $P_{DAG}(C)$ is just $G_0$'s data-dependency view.
- **Rewrite lift:** trivial only if the DAG target and rule derivations are formally the same as the source presentation. That identity has not yet been specified for the open rule schema $R$.
- **Status:** a reusable operational construction now turns an independently
  specified `ObservableLTSIso` into a sound/reflecting
  `ProjectionCertificate`, and a three-view P1a family composes such
  certificates. This is a general theorem over supplied LTS isomorphisms, not
  a construction of the intended DAG rule map from arbitrary typed DPOI
  rules. The static and concrete rewrite clauses remain incomplete.

### 5.2 Petri projection $P_{Petri}$

$P_{Petri}$ = the place/transition reading, using the **pre-net / free-SSMC semantics** of Bruni–Meseguer–Montanari–Sassone because cantilune elects to preserve ordered interfaces and individual-token provenance.

- Places = generating objects; transitions = morphisms $\text{in} \otimes \cdots \otimes \text{in} \to \text{out} \otimes \cdots \otimes \text{out}$; markings = objects.
- **Clause (1), conditional:** after the §5.2.1 pre-net choice, the free-SSMC universal property gives the static SMC interpretation once the generator map is type-correct.
- **Clause (2), unverified:** Petri firing does not follow from SMC-functoriality alone. It requires the concrete rule set $R$ and a direct rule map (or a functor proved to preserve the DPO constructions); neither is yet specified.
- **Caveat:** boundedness / liveness / reachability are net-level properties checked on this projection, not consequences of the bare SMC.
- **Mechanized operational family:** the same reusable P1a layer accepts an
  independently specified Petri observable-LTS isomorphism and produces
  native-step soundness/reflection, path coverage, terminal classification,
  and signature-version preservation. It does not manufacture enabling,
  markings, or a Petri derivation from a general source DPO rule.

### 5.2.1 Pre-net choice for individual-token semantics (load-bearing)

The source audit corrects an earlier rationale. Meseguer–Montanari's collective-token semantics is a symmetric monoidal categorical semantics in which arrows are firing computations; sequential composition is concatenation and tensor is parallel composition. The cited sources do **not** establish a global Eckmann–Hilton collapse $\circ=\otimes$. Such a collapse only follows under additional one-object/shared-unit hypotheses and cannot be used here as a general objection to collective Petri semantics.

The **pre-net** construction (Bruni–Meseguer–Montanari–Sassone, *Functorial Models for Petri Nets*) remains a valid design choice for a different reason:
- a pre-net replaces the free commutative monoid of places with the free word monoid, equipping each transition's input/output with an ordering;
- the adjunction **PreNet ⇄ SSMC** generates a **free strict symmetric monoidal category** in which permutations are represented by non-trivial symmetry morphisms rather than strict object equality (individual-token philosophy);
- symmetries are added in a second step (compose the PreNet⇄SMC adjunction with the "freely add symmetries" adjunction), recovering token permutation without collapsing $\circ$ and $\otimes$;
- ordinary Petri nets are recovered by **abelianization** (forget the ordering); conversely, for a Petri net $P$, one chooses a pre-net $Q$ that abelianizes to $P$ and takes the free SSMC $L(Q)$ as the semantics.

**Declared design decision (pinned 2026-07-23):** the pre-net choice $Q$ is extra structure. cantilune fixes the order of each transition's input/output list to the declaration order of the node's `in`/`out` lists in the graph definition API (RFC-0001 §6.4). For $\mathrm{in}(n)=[t_1,\ldots,t_k]$ and $\mathrm{out}(n)=[u_1,\ldots,u_m]$, the transition has ordered source $t_1\otimes\cdots\otimes t_k$ and target $u_1\otimes\cdots\otimes u_m$. This makes the choice reproducible but does not by itself prove rewriting preservation.

This choice supplies the free-SSMC target needed for clause (1) and records individual-token/order information. Clause (2) remains a separate proof obligation (§12).

### 5.3 Morphism projection $P_{Mor}$

$P_{Mor}$ = $C$ itself.

- Composition = $\circ$; parallel = $\otimes$; symmetry = $\sigma$. Orchestration = morphism composition (RFC-0001 §6 morphism facet).
- **By construction** (it is the identity view).
- **Status: 按构造一致 (by construction).**

### 5.4 π projection $P_\pi$ — **待证 (to be proven)**

Per the half-π (II) decision: channels are created dynamically via **request/accept** (dynamic addressing, runtime-decided), and **post-handshake conversation is untyped/free** (full π mobility, no session types).

- **Selected operational/denotational architecture:** a finite-control typed open-process π SMC (request/accept as a structured channel-creation presentation) plus the **covariant functor-category semantics** of Fiore–Moggi–Sangiorgi. The two routes require an explicit commuting theorem; see §13.9.
- **Mechanized support, not completion:** a finite-control late-π module now
  includes free/all-name analysis, deterministic freshening,
  capture-avoiding substitution, alpha equivalence, structural congruence,
  freshness-guarded native strong late steps, and structural closure.
  Separately, actual nonconstant covariant objects exist in
  `World ⥤ Type` and `World ⥤ ωCPO`, with natural inactive/parallel support
  operations and allocation along $n\to n+1$. A concrete support
  `ExternalFMS`, non-vacuous bridge obligations, and a boundary-agnostic
  `OpenInterpretation` now give an unconditional pointwise commuting theorem.
  This is not the FMS powerdomain/domain equation or an adequate hiding
  semantics. A checked swap counterexample shows that strict natural
  denotation next requires supported-process contexts and process renaming.
- **Consistency is NOT by construction:** the static and operational bridges are theorems to be formulated and proven in RFC-0002, with a phased plan (see §6.4 / RFC-0002 §4).
- **Status: 待证 (to be proven).** Any unproven claim here is marked **unverified**.

## 6. Status summary and proof obligations

### 6.1 By-construction or conditional

- The morphism projection is the identity SMC-functor and preserves $R$ identically.
- The DAG static view is essentially the presentation identity; its exact target still needs to be fixed.
- The Petri static SMC-functor is conditional on the typed generator map into the chosen pre-net/free-SSMC target.
- No non-identity projection lifts $R$ merely because it is strong monoidal.

### 6.2 To be proven in RFC-0002

- Each projection has an independently specified observable quotient LTS,
  event-lift relation $\operatorname{Lift}_i$, and forward/exhaustiveness
  proof; this operational data is not implied by the SMC-functor.
- **Cross-projection event consistency**: one source event has tagged legal
  target derivations in all four projections, with every relevant observable
  target derivation accounted for.
- Each projection preserves and reflects the separately supplied successful
  terminal predicate, so normal form, successful termination, and deadlock do
  not drift. All three obligations remain open for every non-identity
  projection; π additionally has a target/typing blocker.

### 6.3 Phased proof (per DRI decision)

| Phase | Prove | Status |
|---|---|---|
| P1a | DAG/Petri/morphism consistency | **Reusable operational certificate family and finite fixtures kernel-build; intended static/DPO/resource/admission instances remain incomplete** |
| P1b | π-projection consistency **for the request/accept channel-creation sublanguage** | **Finite closed certificate and late-π infrastructure kernel-build; general certificate and FMS bridge remain incomplete** |
| P1c (deferred) | π-projection consistency for **free conversation / unrestricted mobility** | **The finite 60-cell reference matrix is 60/60 native and has four event-indexed operational certificates inside their declared restricted target relations. This does not yet give full standard-late-LTS reflection: the current open reconnect/delete encodings have extra environmental transitions, and the general admitted-rule/static/resource layers remain incomplete** |

### 6.4 Fallback (per ADR-0001)

If P1b/P1c cannot be proven, fall back to the largest consistent sublanguage of π and **document the reduction** in RFC-0002. Per governance, no "consistent" claim stands for π beyond what is actually proven; unproven parts are marked **unverified**.

## 7. What this spec guarantees and does not

| Guarantee | Source | Scope |
|---|---|---|
| Legal composition / parallelism | SMC $C$ | static, by construction |
| Unified execution step = rewrite | $R$ | by definition |
| Trace / normal-form definitions (discrete) | $R$ + state congruence $\equiv_R$ | conditional on both being fixed |
| Successful termination / deadlock classification | separately supplied, congruence-saturated $\mathcal T_{\mathrm{ok}}$ | **conditional/open** |
| Deterministic replay | complete event/derivation records + canonicalization policy | **conditional; not implied by rule names** |
| Cross-projection consistency (3 projections) | SMC-functors + independent observable LTSs + event lifts/exhaustiveness + terminal predicates | **unverified except the identity view** |
| Cross-projection consistency (π) | typed static target + independently specified operational/terminal bridge theorems | **待证** |
| Boundedness / liveness | Petri net-level checkers | **checked, not given** |
| Time bounds | — | **not provided** (step-bounded only) |

## 8. Open questions for v0.1

1. Promote the finite signature/type syntax and FreeSMC quotient into the
   intended projection categories; the internal quotient is present, but the
   complete static functors are not.
2. Package the correct well-formed active-support source category and
   transport arbitrary parallel-independence/concurrency witnesses through
   its normalization bridge. The general presheaf-side mono/gluing/complement
   and concurrency theorems are present; equivalence with the unrestricted
   slice is false. Fix the complete rule schema $R$, state
   congruence $\equiv_R$, and success predicate $\mathcal T_{\mathrm{ok}}$.
3. **π architecture resolved; integration proofs open.** Connect the
   finite-control late-π semantics and nonconstant `Set^I`/`Cpo^I` support
   objects to the typed open-process/FMS commuting theorem and complete the
   native rule matrix without weak-step substitution.
4. Marking-invariant / resource-cap formalization on the Petri projection.
5. Cost-annotation extension (if C2 step-bounds prove insufficient for predictability claims).
6. **Petri projection target.** **Resolved by design:** use the declaration-order pre-net/free-SSMC target to retain ordered interfaces and individual-token provenance. **Correction:** the earlier global Eckmann–Hilton-collapse rationale was not supported by the primary sources. **Still open:** the concrete $R$-to-firing rule map and review. See §5.2.1, §10.8, §12.
7. **π bridge.** The Fiore–Moggi–Sangiorgi model ingredients and $\mathbb I$
   are source-verified. The former Step-C tensor remains rejected as
   ill-typed: $|$ is an internal operation on the agent object, not a
   bifunctor on $\mathrm{Mod}$. The replacement architecture is now fixed:
   tensor lives in the typed open-process SMC, while the FMS category retains
   pointwise cartesian tensor and internal `par`. The open obligation is the
   explicit commuting theorem and full P1b/P1c certificates, not target
   selection. See §10.9 and §13.

## 9. References

- RFC-0001 (`docs/rfc/0001-cantilune-architecture.md`)
- ADR-0001 (`docs/adr/0001-unified-formal-structure.md`)
- RFC-0002 (`docs/rfc/0002-projection-consistency.md`) — maintained in lockstep with this spec
- Meseguer–Montanari, *Petri Nets Are Monoids* (1990), doi:10.1016/0890-5401(90)90013-8
- Bruni–Meseguer–Montanari–Sassone, *Functorial Models for Petri Nets* (2001), doi:10.1006/inco.2001.3050
- Fiore–Moggi–Sangiorgi, *A Fully Abstract Model for the π-calculus* (2002), doi:10.1006/inco.2002.2968
- Lack–Sobociński, *Adhesive Categories* (2004), doi:10.1007/978-3-540-24727-2_20
- Meseguer, *Functorial Semantics of Rewrite Theories* (2005), doi:10.1007/978-3-540-31847-7_13
- Selinger (survey of string diagrams for SMCs)

## 10. Concept glossary (normative definitions, with citations)

This section gives rigorous definitions for the core concepts used above, with authoritative references. Definitions are paraphrased from the cited sources (treated as untrusted input — only their content is used); the citations are to be verified by the reviewer before FCP. **Concept attributions below are unverified until the cited works are checked against this spec's usage.**

### 10.1 Monoidal category

A **monoidal category** $(\mathcal{C}, \otimes, I, \alpha, \lambda, \rho)$ is a category $\mathcal{C}$ equipped with:
- a **tensor product** functor $\otimes : \mathcal{C} \times \mathcal{C} \to \mathcal{C}$;
- a **unit object** $I \in \mathcal{C}$ (the tensor unit);
- an **associator** natural isomorphism $\alpha_{x,y,z} : (x \otimes y) \otimes z \xrightarrow{\sim} x \otimes (y \otimes z)$;
- **left/right unitors** $\lambda_x : I \otimes x \xrightarrow{\sim} x$ and $\rho_x : x \otimes I \xrightarrow{\sim} x$;

satisfying the **triangle** and **pentagon** coherence axioms (which ensure the associator and unitors are mutually coherent). A monoidal category is **strict** when $\alpha, \lambda, \rho$ are identities. By Mac Lane's coherence theorem, every monoidal category is monoidally equivalent to a strict one.

Ref: nLab, *monoidal category* ([ncatlab.org/nlab/show/monoidal+category](https://ncatlab.org/nlab/show/monoidal+category)).

### 10.2 Symmetric monoidal category (SMC)

A **symmetric monoidal category (SMC)** is a monoidal category additionally equipped with a **symmetry** (braiding that squares to the identity) natural isomorphism

$$\sigma_{x,y} : x \otimes y \xrightarrow{\sim} y \otimes x$$

satisfying the **hexagon** axioms (coherence of the symmetry with the associator) and the symmetry axiom $\sigma_{y,x} \circ \sigma_{x,y} = \mathrm{id}_{x \otimes y}$. In `cantilune`, $\sigma$ models reordering of parallel resources/channels (token interchangeability, channel rerouting).

Ref: nLab, *symmetric monoidal category* ([ncatlab.org/nlab/show/symmetric+monoidal+category](https://ncatlab.org/nlab/show/symmetric+monoidal+category)).

### 10.3 Free symmetric monoidal category

The **free symmetric monoidal category** on a typed graph $G_0 = (N, E, \tau)$ is the SMC obtained by taking the nodes (generators) of $G_0$ as generating morphisms and freely closing under $\otimes$ (juxtaposition), $\circ$ (composition along matching types), $\sigma$ (permutation), and $I$ (empty tensor), quotienting only by the SMC axioms (associativity, unitality, symmetry, functoriality) — i.e. *no* equations beyond the SMC axioms and the declared input/output types of generators.

In PRO/PROP terminology: the free **symmetric** monoidal category on a signature is the corresponding **PROP** (a strict SMC whose objects are generated under tensor from a single object). The SMC presentation used here (typed many-sorted) is the many-sorted PROP generalization.

Ref: nLab, *PRO* and *PROP* ([ncatlab.org/nlab/show/PRO](https://ncatlab.org/nlab/show/PRO), [ncatlab.org/nlab/show/PROP](https://ncatlab.org/nlab/show/PROP)).

### 10.4 Monoidal product ($\otimes$)

The **monoidal product** (tensor) $\otimes$ is the bifunctor of a monoidal category. In `cantilune`, $\otimes$ is **parallel composition** — placing two operations side by side with no sequential dependency. Its unit $I$ is the empty parallel composition.

### 10.5 String diagram

A **string diagram** is the graphical syntax for morphisms in a monoidal category: **wires** represent objects (types); **boxes** represent morphisms (operations); **juxtaposition** of wires denotes $\otimes$ (parallel composition); **plugging** the output wire of one box into the input wire of another denotes $\circ$ (sequential composition); **crossing wires** denotes the symmetry $\sigma$; **no wire** denotes $I$.

By the coherence theorem (Joyal–Street, "The geometry of tensor calculus I"), the graphical calculus is **sound and complete**: two string diagrams denote the same morphism iff one can be deformed into the other up to planar/topological isotopy (respecting the symmetry). This is why a string diagram is the canonical *presentation* of a `CantiluneGraph` and admits four readings (DAG/Petri/π/morphism): each reading is a different interpretation of the same graphical syntax.

Ref: nLab, *string diagram* ([ncatlab.org/nlab/show/string+diagram](https://ncatlab.org/nlab/show/string+diagram)); Selinger, *A survey of graphical languages for monoidal categories* (2009); Joyal–Street, *The geometry of tensor calculus I* (1991).

### 10.6 Dynamics $R$ — string-diagram rewriting

**String-diagram rewriting** is the algebraic-approach rewriting of string diagrams. A **rewrite rule** $\rho$ is a span

$$L \xleftarrow{l} K \xrightarrow{r} R$$

where $L$ is the **left-hand side** (pattern to match), $K$ is the **invariant interface** (preserved sub-diagram), and $R$ is the **right-hand side** (replacement). A concrete **rewrite event** $e=(\rho,m,\delta)$ and step $g\xrightarrow{e}h$ are given by:
1. **matching** $L$ as a sub-diagram of $g$ via a match $f : L \to g$;
2. **deleting** the matched $L \setminus K$ (constructing a pushout complement);
3. **adding** $R \setminus K$ (taking the pushout along $r$),

yielding the derived diagram $h$. Here $m$ records the concrete match and
$\delta$ records any further witness/choice data required by the selected
rewriting formalism. Execution is rewriting; a **trace** is a sequence
$g_0\xrightarrow{e_1}g_1\xrightarrow{e_2}\cdots\xrightarrow{e_n}g_n$;
**replay** removes the stored endpoints from a complete event record and
re-executes the resulting recipe against the claimed source with a
deterministic kernel; a verified record proves that this computation recovers
its recorded target. Merely reading the stored target is not replay. Normal
form is defined in the selected quotient LTS:
$[g]_{\equiv_R}$ has no outgoing concrete event.
**Successful termination** additionally satisfies the separately supplied,
$\equiv_R$-saturated predicate $\mathcal T_{\mathrm{ok}}$; **deadlock** does
not. These classifications do not follow from $(C,R)$ alone. A sequence of
rule names alone is not a deterministic replay log when a rule has multiple
matches.

Ref: nLab, *graph rewriting* / DPO ([ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)); Ehrig–Pfender–Schneider (1973); Lack–Sobociński, *Adhesive Categories* (2004); nLab, *labelled transition system* ([ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)). **Correction:** the earlier “Gadducci–Montanari, functorial semantics of rewriting” attribution is mis-stated; see §10.10/§11.

### 10.7 Labelled transition system (LTS)

An **LTS** is a structure $T = (S, i, E, \mathrm{Tran})$ with a set $S$ of **states**, initial state $i \in S$, a set $E$ of **events** (labels), and a **transition relation** $\mathrm{Tran} \subseteq S \times E \times S$; $s \to_a s'$ denotes $(s, a, s') \in \mathrm{Tran}$. Once the rule formalism is fixed, the dynamics $R$ of `cantilune` induces an LTS with $S=$ string diagrams and $E=\operatorname{App}(R)$, the complete rule-application/derivation records $e=(\rho,m,\delta)$. Projecting $e$ to its rule name $\rho$ gives a coarser trace but loses replay identity.

Ref: nLab, *labelled transition system* ([ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)).

### 10.8 Petri projection — collective and individual-token semantics

Meseguer–Montanari model Petri-net computations categorically; Bruni–Meseguer–Montanari–Sassone distinguish collective-token and individual-token interpretations. In the cited functorial model, composition concatenates computations and tensor represents parallel composition. The primary sources therefore do not support the earlier blanket statement that commutativity globally forces $\circ=\otimes$.

Pre-nets replace multisets at transition boundaries with ordered lists and generate free strict symmetric monoidal categories. cantilune selects this semantics to retain declaration order, token histories, and causal provenance. This is a design choice, not a consequence of Eckmann–Hilton and not a proof that source rewrites become Petri firings.

Refs: Meseguer–Montanari, *Petri Nets Are Monoids*, Information and Computation 88(2):105–155 (1990), doi:10.1016/0890-5401(90)90013-8; Bruni–Meseguer–Montanari–Sassone, *Functorial Models for Petri Nets*, Information and Computation 170(2):207–236 (2001), doi:10.1006/inco.2001.3050.

### 10.9 π projection — functor-category semantics (source-verified 2026-07-23)

Fiore–Moggi–Sangiorgi use the **covariant** functor categories

$$\mathrm{Mod}=\mathbf{Set}^{\mathbb I}=[\mathbb I,\mathbf{Set}]
\quad\text{or}\quad
\mathbf{Cpo}^{\mathbb I}.$$

Objects are functors and arrows are natural transformations. The category has pointwise finite products. The agent denotation is one distinguished object $A\in\mathrm{Mod}$. In the closed interpretation, a process with an enumerated $n$-name context denotes an element of $A(n)$; the genuinely name-closed case is an element of $A(0)$, equivalently a global element $1\to A$ because $0$ is initial in $\mathbb I$. The open interpretation of $k$ name variables is a natural transformation such as $N^k\to A$. The operations

$$\mathrm{sum}:A\times A\to A,\qquad
\mathrm{par}:A\times A\to A,\qquad
\mathrm{nil}:1\to A$$

are internal operations on $A$. `sum`, not `par`, is induced by the free-semilattice/powerdomain structure. `par` is built with left-merge and synchronisation. Hence $\mathrm{par}$ is not a tensor bifunctor on all of $\mathrm{Mod}$.

$\mathbb I$ is the category of finite ordinals and injections, generated monoidally by $1$, $up:0\to1$, and $swap:2\to2$ with the stated relations. Covariance matters: $up_n:n\to n+1$ induces $X(n)\to X(n+1)$, matching dynamic allocation. The paper proves full abstraction/equational results, not a DPO bridge. It also distinguishes strong late bisimilarity from the input-preserving late congruence, which matters for request/accept encodings containing input.

Ref: Fiore–Moggi–Sangiorgi, *A Fully Abstract Model for the π-calculus*, Information and Computation 179(1):76–117 (2002), doi:10.1006/inco.2002.2968.

### 10.10 Rewriting functor / functorial consistency

A projection is a rewriting functor only after its action on rules/derivations is defined and shown to produce legal target derivations. **Strong monoidality alone is insufficient.** In a DPO construction, one must additionally prove preservation of the relevant pushouts, pushout complements, matches, and application conditions, or give a direct rule-by-rule derivation map.

A concrete counterexample to the former F2 is the cartesian strong monoidal functor $F:\mathbf{Set}\to\mathbf{Set}$, $F(X)=X^2$. It does not preserve the pushout of $1\leftarrow0\rightarrow1$: applying $F$ after the pushout gives $F(2)=4$, while the pushout after applying $F$ still has two elements. Lack–Sobociński establish well-behaved DPO rewriting in adhesive categories; they do not assert that every strong monoidal functor preserves DPO steps.

The previously cited title *Functorial Semantics of Rewrite Theories* is a 2005 work by **José Meseguer**, not Gadducci–Montanari. A real Gadducci–Montanari paper is *Comparing logics for rewriting: rewriting logic, action calculi and tile logic* (2002); neither source supplies the missing preservation hypothesis for this RFC.

## 11. Citation verification record (2026-07-23)

| Citation | Result relevant to this spec |
|---|---|
| Fiore–Moggi–Sangiorgi (2002), doi:10.1006/inco.2002.2968 | **Verified.** Supports $\mathbb I$, covariant $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$, the agent object, allocation, and π operations. Does not supply C–E. |
| Meseguer–Montanari (1990), doi:10.1016/0890-5401(90)90013-8 | **Verified.** Supports categorical Petri computations; does not support the spec's former global $\circ=\otimes$ claim. |
| Bruni–Meseguer–Montanari–Sassone (2001), doi:10.1006/inco.2001.3050 | **Verified.** Supports pre-nets and the free strict SMC/functorial semantics used for the individual-token choice. |
| Lack–Sobociński (2004), doi:10.1007/978-3-540-24727-2_20 | **Verified.** Supports adhesive-category DPO foundations; does not imply former F2. |
| “Gadducci–Montanari, Functorial Semantics of Rewriting” | **Rejected as misattributed.** The exact title *Functorial Semantics of Rewrite Theories* is Meseguer (2005), doi:10.1007/978-3-540-31847-7_13. |

The detailed source trail and negative results are recorded in `docs/research/0001-p1b-pi-bridge-audit.md`.

## 12. P1a — corrected status after source audit

### 12.1 Static factorization

**(F1) Free-SMC factorization remains valid:** a type-correct map from the
generators of $G_0$ into an SMC has a strong symmetric-monoidal extension,
unique up to coherent monoidal natural isomorphism. Lean now implements the
generated SMC-equation quotient and the arbitrary-target comparison: atomic
object isomorphisms plus compatibility on generators, explicit copy, and
explicit discard determine a monoidal natural isomorphism from the canonical
interpretation, unique once its singleton components are fixed. This is the
required chosen-generator universal property, but it has not received an
immutable commit-bound verification record or independent QA-L4 review. It
establishes only the static free structure, not a projection rule map.

**Former (F2) is rejected:** a strong monoidal functor need not preserve pushouts. A DPO lift is conditional on additional preservation hypotheses or a direct derivation map. Since §4.1 still leaves the exact rule schema $R$ open, those hypotheses cannot yet be checked.

### 12.2 Projection status

| Projection | Static clause (1) | Rewrite clause (2) |
|---|---|---|
| Morphism | **Established:** identity SMC-functor | **Established:** identity on the same rule derivation |
| DAG | Internal free-SMC quotient exists; intended DAG static functor is not yet packaged as a complete certificate | A generic LTS-isomorphism-to-certificate theorem and finite fixture exist. A checked self-loop counterexample proves that an incidence-preserving strict-DAG map cannot cover every typed open hypergraph; the production source must carry acyclicity/rankability. The corresponding restricted typed-DPO rule map remains **unverified** |
| Petri | Internal free-SMC quotient and declaration-order finite pre-net fixture exist; general static target remains conditional | The generic operational family and finite firing fixture exist; every general source rule-to-enabled-firing map remains **unverified** |

For Petri, a transition morphism in the free SSMC describes a computation, but “source rewrite = legal firing” is not automatic. The proof must specify markings, enabling, LHS/RHS, matches, and how every $\rho\in R$ becomes a Petri derivation.

### 12.3 Consequence

P1a is not a completed three-projection rewriting proof. It now has a reusable
general **operational** family over supplied independent LTS isomorphisms and
nonempty finite DAG/pre-net/morphism fixtures. It still lacks the concrete
static SMC/resource/admission packages and the derivation map from the
intended typed-open DPOI calculus. The family cannot be used to infer that
those inputs exist. This boundary is load-bearing before clause (3), “the same
event in all views,” can be claimed.

## 13. P1b — π projection bridge: independent audit (2026-07-23)

This section is the authoritative result of the independent review requested for Steps C–E. Governance classification: formal-research task, **S2**, **QA-L4**, **Pre-FCP/M1**; owner Joker-of-Gotham (DRI), formal-math/category/process-semantics reviewer still TBD. The disposition is **Iterate, not Promote**. Detailed evidence is in `docs/research/0001-p1b-pi-bridge-audit.md`.

### 13.1 Verified baseline: Steps A–B

**Step A is verified.** $\mathbb I$ is the category of finite ordinals and injections; equivalently it is generated monoidally by $1$, $up:0\to1$, and $swap:2\to2$ with the three relations stated in the source.

**Step B is verified with a variance correction.**

$$\mathrm{Mod}=\mathbf{Set}^{\mathbb I}=[\mathbb I,\mathbf{Set}]
\quad\text{or}\quad
\mathbf{Cpo}^{\mathbb I},$$

not $[\mathbb I^{op},\mathbf{Set}]$. The objects of $\mathrm{Mod}$ are functors and its arrows are natural transformations. The category has the pointwise cartesian SMC structure and contains a distinguished agent object $A$ carrying the π operations.

### 13.2 Independent verdict on the two handed-off inclinations

| Inclination | Verdict |
|---|---|
| “Raw-process parallel is not an SMC tensor.” | **Too broad; the stated reason is invalid.** Raw syntax trees are not associative by literal syntactic equality, but an SMC may use coherent associators, structural congruence, or a free symmetric-monoidal completion. The fact that laws are derived rather than primitive does not rule out an SMC. |
| “A bisimulation quotient is necessary and sufficient.” | **False in both directions.** It is not necessary for coherence, and quotient classes alone do not provide a category, morphisms, composition, or a tensor bifunctor. |

If a quotient makes associativity, unit, and symmetry literal equalities, the corresponding coherence diagrams are automatic; C′ is then not the missing hard theorem. Conversely, strong late bisimilarity is not preserved by input prefix in the cited model, so an unspecified “bisimulation quotient” is not even a compositional target for request/accept without selecting and proving the appropriate congruence.

### 13.3 Type audit: why the Step-C candidate is rejected

In the source model:

- $A$ is one object of $\mathrm{Mod}$;
- an $n$-name closed interpretation denotes an element of $A(n)$; only the
  zero-name case is equivalently a global element $1\to A$, while an open
  interpretation denotes $N^k\to A$;
- $\mathrm{nil}:1\to A$ and $\mathrm{par}:A\times A\to A$ are internal morphisms;
- categorical composition is composition of natural transformations, not π prefixing.

Therefore

$$X\otimes_{\mathrm{Mod}}Y
=\{P\mid Q\mid P\in X(n),Q\in Y(n)\}$$

is not defined for arbitrary functors $X,Y$, has no action on natural transformations, and is not a bifunctor $\mathrm{Mod}\times\mathrm{Mod}\to\mathrm{Mod}$. A bisimulation quotient of process elements does not repair this.

The proposed generator assignment is also incomplete. For $g:U\to V$, a functor requires a natural transformation $E(g):E(U)\to E(V)$. “Map $g$ to a process” only supplies a term or a map into $A$ and does not define $E(U)$, $E(V)$, or a graph morphism. Thus F1 cannot yet be applied. **Step C is rejected at the type level, and Step D has not begun.**

### 13.4 The correct ambient SMC and the conditional Step D

The source-supported SMC on $\mathrm{Mod}$ is pointwise cartesian:

$$(X\boxtimes Y)(n)=X(n)\times Y(n),\qquad
\mathbf1(n)=\{*\}.$$

π parallel remains internal to $A$. For two open interpretations $p,q:\Gamma\to A$,

$$\Gamma\xrightarrow{\Delta}\Gamma\times\Gamma
\xrightarrow{p\times q}A\times A
\xrightarrow{\mathrm{par}}A$$

interprets $P\mid Q$.

There is a valid **conditional** SMC construction: choose an object $E_0(t)\in\mathrm{Mod}$ for every base type and, for every generator

$$g:\bigotimes_i t_i\longrightarrow\bigotimes_j u_j,$$

give a natural transformation

$$E_g:\prod_iE_0(t_i)\longrightarrow\prod_jE_0(u_j).$$

The free-SMC universal property then yields a strong symmetric-monoidal
extension, unique up to coherent monoidal natural isomorphism,

$$E_{\mathrm{stat}}:C\longrightarrow(\mathrm{Mod},\times,\mathbf1).$$

The tensorator coherently relates $E(f\otimes g)$ to $E(f)\times E(g)$; this
need not be a literal equality unless a strictification and bracketing
convention are selected. This proves only a conditional theorem: $C$'s tensor
is interpreted as product/pairing; it is **not** literally π `|`. If literal
tensor-to-parallel is mandatory, the target must instead be redesigned as a
typed open-process SMC (interfaces as objects, processes as arrows,
plugging/hiding as composition, parallel as tensor), or the theorem must be
weakened to a separately proved lax semantics. Because
$\mathrm{par}:A\times A\to A$ is generally not invertible, it cannot simply
serve as a strong tensorator.

No target choice is promoted here. Selecting one is an RFC/ADR-level decision after its objects, arrows, composition, tensor, and operational relation are specified.

### 13.5 Step E audit: finite rule surface exists; total theorem remains incomplete

The historical audit found no enumerable request/accept or P1c rule surface.
The repository now defines finite typed/raw process syntax, native transitions,
a stricter freshness-guarded late-π relation, finite closed request/accept and
delegation certificates, and an explicit fifteen-event P1c audit vocabulary.
Thus selected rules can now be enumerated and type-checked.

This does not complete Step E. The typed erasure theorem targets the existing
raw native kernel, whose freshness premises are weaker than the newer
`Late.NativeStep`; no theorem identifies every typed step with that stricter
late relation. The P1c matrix contains four target columns for each event, but
most cells are typed pending obligations rather than derivations, and it is
not yet derived from the typed-open DPOI execution package or the FMS
interpretation.

The FMS LTS also rules out three shortcuts: an output prefix alone is a visible output transition rather than an internal reduction; restriction $\nu$ alone is not a reduction; and reassociation/`compose` is structural congruence or contextual closure, not necessarily a one-step reduction.

### 13.6 Minimal operational witness, not yet the project definition

The following two rules demonstrate a viable granularity, but they are **proposed witnesses**, not a completed definition of $R$:

$$
(\nu s)(\operatorname{req}_a(s).P\mid\operatorname{acc}_a(x).Q)
\to_{\mathrm{hs}}
(\nu s)(P\mid Q\{s/x\}),
$$

$$
\operatorname{out}_s(v).P\mid\operatorname{in}_s(x).Q
\to_{\mathrm{msg}}
P\mid Q\{v/x\}.
$$

Here $s$ must be fresh for the receiver and surrounding context, and substitution is capture-avoiding. Standard untyped π transmits names, so the source sort `Value` must either be encoded injectively as names or moved to an explicitly typed/value-passing π variant; the current repository has not chosen that layer.

Under the direct π macros, they have legitimate $\tau$ witnesses:

$$
(\nu s)(\overline a\,s.\llbracket P\rrbracket\mid
a(x).\llbracket Q\rrbracket)
\xrightarrow{\tau}_{\mathrm{res}\circ\mathrm{com}}
(\nu s)(\llbracket P\rrbracket\mid
\llbracket Q\rrbracket\{s/x\}),
$$

For the displayed scope, the direct FMS derivation synchronises a free-output
and input premise by `com`, then lifts that $\tau$ through the outer
restriction by `res`. If the selected structural congruence includes scope
extrusion and $s$ is fresh for the receiver, the source is also congruent to
$$
((\nu s)\overline a\,s.\llbracket P\rrbracket)\mid
a(x).\llbracket Q\rrbracket.
$$
That shape instead uses an `open` bound-output premise and a `close`
conclusion. These are two derivation shapes for one legal $\tau$ transition,
not two runtime steps; the project must fix its scope/congruence policy before
claiming either shape as canonical.

$$
\overline s\,v.\llbracket P\rrbracket\mid
s(x).\llbracket Q\rrbracket
\xrightarrow{\tau}_{com}
\llbracket P\rrbracket\mid
\llbracket Q\rrbracket\{v/x\}.
$$

`compose` should be excluded from the atomic source rules unless the target theorem explicitly allows zero-step structural congruence. The static and operational maps should be separated:

$$E_{\mathrm{stat}}:C_{\mathrm{RA}}\to\mathcal D,\qquad
\llbracket-\rrbracket_{\mathrm{op}}:\mathrm{Conf}_{\mathrm{RA}}\to Proc_\pi.$$

Before stating soundness/reflection, independently define from the native π
LTS a raw observable derivation domain $\mathcal D_\pi^{\mathrm{obs}}$, an
administrative-step policy, and one representative-independent target-state
congruence $\equiv_\pi^{\mathrm{obs}}$ that makes the selected observable
quotient LTS well defined. The domain must not be defined as the forward
image. Then define a relation

$$\operatorname{Lift}_\pi\subseteq
\operatorname{App}(R_{\mathrm{RA}})\times\mathcal D_\pi^{\mathrm{obs}}.$$

For a concrete source event $e=(\rho,m,\delta)$, soundness requires

$$g\xrightarrow{e}h\Longrightarrow
\exists P,d\in\mathcal D_\pi^{\mathrm{obs}}.\
d:\llbracket g\rrbracket_{\mathrm{op}}\xrightarrow{\tau}_\pi P
\land P\equiv_\pi^{\mathrm{obs}}\llbracket h\rrbracket_{\mathrm{op}}
\land\operatorname{Lift}_\pi(e,d).$$

To justify “neither fabricates nor drops steps” and “the same run,” forward simulation is insufficient. A reflection/completeness direction is also required:

$$d\in\mathcal D_\pi^{\mathrm{obs}},\
d:\llbracket g\rrbracket_{\mathrm{op}}\xrightarrow{\tau}_\pi P
\Longrightarrow
\exists e,h.\ g\xrightarrow{e}h
\land P\equiv_\pi^{\mathrm{obs}}\llbracket h\rrbracket_{\mathrm{op}}
\land\operatorname{Lift}_\pi(e,d).$$

The logged projected occurrence may be tagged as $\widehat d=(e,d)$; erasing
the tag leaves the native legal π derivation $d$. The relation need not recover
$e$ uniquely from raw $d$ unless a separate injectivity/uniqueness theorem is
proved. Because `res(com)`, `close`, and `com` all expose $\tau$, the standard
trace label alone cannot distinguish them.

### 13.7 Required next work

1. Complete the bridge from the typed-kernel relation to the typed
   open-process boundary composition. The finite P1c witnesses already erase
   to the independently defined alpha/structural standard late relation, but
   general plug/hide operational adequacy remains a separate theorem.
2. Connect the concrete nonconstant `Set^I`/`Cpo^I` support functors to
   `OpenInterpretation`; add the required FMS powerdomain/domain equation,
   quotient descent, and observational bridge without claiming a new
   full-abstraction proof.
3. Generalize the finite reference matrix to every admitted source rule. The
   reference calculus now has native mismatch decision, reconnect by ordinary
   delegation, quiescent shutdown, and all 60 four-projection cells; this does
   not itself construct a product-wide rule family.
4. Use the intrinsic positional-hypergraph equivalence with its typed-slice
   essential image and the now explicit finite positional closure of canonical
   complements, second pushouts, joint contexts, residual contexts, and both
   parallel-independent sequential results to package static SMC, resources,
   admission, terminal classification, and operational reflection for the
   same source. Equivalence with the whole unrestricted (including infinite)
   slice is false; an abstract M-adhesive/van-Kampen class theorem for the
   intrinsic category remains a separate obligation.
5. Obtain independent formal-math/category/process-semantics review at QA-L4.

### 13.8 Status summary for P1b

| Item | Status |
|---|---|
| Step A: $\mathbb I$ | **Verified** |
| Step B: functor-category model | **Verified; covariance corrected** |
| Handed-off Step-C tensor | **Rejected: not a bifunctor and generator map is ill-typed** |
| “Raw process vs quotient” decision | **Neither option is necessary/sufficient for the missing category structure** |
| Correct ambient SMC | **Pointwise cartesian structure identified** |
| Step D | **The FreeSMC arbitrary-target universal comparison and actual mathlib symmetric-monoidal structures, the genuine finite-powerset monad on `Type` and pointwise on `Type^I`, a locally nameless supported-process functor, nonconstant `Set^I`/`Cpo^I` support models, CPO world shift/allocation, continuous support hiding and support-level retraction equations, the discrete-CPO finite-power monad, and finite `P_f(H-)` approximants exist. `CompleteExternalFMSTheoremPackage` now states the exact world/action, strong-commutative powerdomain, coherent restriction, domain-equation, and full-abstraction acceptance interface, but `CompleteFMSAvailable` has no inhabitant. The support equations do not inhabit that package; the actual Abramsky/enriched model therefore remains unproven** |
| Step E | **The finite P1c reference surface is 60/60 native and has four event-indexed operational certificates that are exact only inside their separately declared restricted target relations; every π witness erases to an independent standard late derivation. This is not reflection of the whole raw standard-late LTS: the current open reconnect/delete encodings have additional environmental transitions. General DPO/Petri-derived admitted-rule and five-layer certificates remain open** |
| Overall P1b | **dual architecture selected; proof incomplete; Pre-FCP/M1; Iterate, not Promote** |

No C′, D, or E proof is claimed. The negative result is useful: it removes the wrong tensor/quotient branch and identifies the exact definitions needed before proof work can resume.

### 13.9 Selected implementation architecture (2026-07-23)

The subsequent implementation decision closes the earlier target-selection
branch without changing its proof status. P1b/P1c must construct both:

1. a typed open-process SMC, with interfaces as objects, plug/hide as
   composition, and native π parallel as tensor; and
2. the covariant FMS route with pointwise cartesian tensor, retaining
   $\mathrm{par}:A\times A\to A$ as an internal operation.

The two routes must commute through typed erasure and the pinned native late-π
semantics. Every source event must map to one native target derivation; weak
$\tau^*$ replacement requires a new RFC/ADR decision. The finite-control scope
includes request/accept, finite message passing, free/bound output,
delegation, choice/match, dynamic partners, and epoch-boundary admission, but
excludes internal recursion and replication.

The architecture now has kernel-built finite witnesses: the generated
FreeSMC equation quotient, actual mathlib symmetric-monoidal structures for
the quotient and the presented open-process category, one-step typed
erasure, finite-control alpha/structural late-π infrastructure, finite closed
request/accept and delegation `ProjectionCertificate`s whose mapped states
reflect every native target action, one four-view signature extension
connected to an unfiltered native π input, concrete nonconstant covariant
support functors in `Set^I` and `Cpo^I`, and a conditional FMS commutation
theorem. A concrete support instance now discharges that theorem pointwise,
with reference plug/hide interpreted as support union. It is not the FMS
powerdomain/domain solution. Separately, the repository now constructs the
actual `Finset` free-semilattice monad and its pointwise `Type^I` monad, a
locally nameless process functor with natural support, an ACUI finite-agent
quotient, and exact finite stages $A_0=0$ and
$A_{d+1}=P_f(H A_d)$. Those stages do not yet have the full world-injection
action, connecting maps, colimit, or initiality. The strengthened
`CompleteExternalFMSTheoremPackage` is now the acceptance certificate: it
requires the strong-commutative powerdomain coherence, exact model- and
world-natural action shape, coherent name-abstraction restriction, enriched
agent-domain solution, and operational strong-late full abstraction pinned to
the journal source. `CompleteFMSAvailable` is only the proposition that this
structure is inhabited; no such inhabitant is defined. Consumer theorems
therefore remain conditional and do not turn `mechanizedCpoFragment` into the
FMS model.

The CPO route additionally constructs a real finite-injection world shift and
allocation natural transformation, a continuous support-hiding map, and
support-level allocation/hiding retraction equations as equalities of
continuous natural transformations, together with the finite-powerset monad
and Fubini laws on the equality-ordered discrete-CPO subcategory and finite
recursive agent fold/unfold isomorphisms. These are the contents of
`mechanizedCpoFragment`; they do not inhabit the full external FMS theorem
package. In particular, support deletion and its retraction law are not the
FMS agent restriction operation or its full
alpha/substitution/scope/action coherence.

The P1c audit matrix is mechanically fixed at
$15\text{ events}\times4\text{ projections}=60$ cells. The amended finite
reference calculus now carries 60 native, non-reflexive derivations. Standard
proof-guarded mismatch propagates a real body transition; reconnect is an
ordinary delegation communication; quiescent deletion is a shutdown
communication with zero continuations. The DAG column uses a strict-rank
acyclic rewrite, Petri uses an identity-bearing individual-token firing, and
the morphism column is the total identity view. Four event-indexed operational
certificates prove soundness, reflection, terminal classification, and
signature-version preservation with respect to their separately declared
restricted target relations. Each π derivation also erases to the
independently defined alpha/structural late semantics. These facts do not
provide full reflection for the whole raw standard-late LTS: the open
reconnect and quiescent-delete handshakes expose additional visible
environmental transitions. A separate closed redesign now supplies genuine
strong native $\tau$ steps for communication, open/close, reconnect, and
quiescent delete, and Lean now proves exact label/endpoint classification for
every native transition from those four closed sources. A complete
fifteen-event reflection certificate nevertheless remains open: the closed
open/close endpoint has a further payload $\tau$ step, so the existing
two-state-per-event source LTS still fails reflection by a separate
kernel-checked impossibility theorem. This is a
nonempty reference theorem, not a claim that arbitrary admitted product rules
already have those four derivations; weakening to $\tau^*$ remains
prohibited.

For mismatch, reconnect, and quiescent delete, the stronger
`P1cAdmittedOperations` bridge no longer uses the ready/completed fixture. A
concrete admitted `Occurrence` computes its target `Config`; finite-support
DPO node/edge updates, Petri enabling/firing, a native standard-late step, the
morphism update, and endpoint-free replay are derived from that same
occurrence. The replay interpreter checks the finite recipe and match
embedding before recomputation. This is the executable ordinary-node/edge
fragment of `Config`, not yet the general typed-open-hypergraph DPOI bridge,
and the other twelve event families are not yet covered by this stronger
construction.

`P1cAdmittedTrajectory` instantiates the event/epoch probability layer for
each such occurrence. Its deterministic kernel assigns probability one to
the admitted business event from pending to completed and then uses an
explicit external hold. At every business-labelled trajectory position Lean
recovers the exact event record, endpoint replay, both endpoint epochs, and
the same four-view `CommonDerivation`; the almost-sure common-trajectory
theorem is instantiated. `EventTrajectorySupport` additionally proves from
the actual Ionescu--Tulcea law that every sampled edge has strictly positive
matrix mass almost surely, so labels used only to totalize null state pairs
cannot occur almost surely.

Runtime execution epochs are formalized separately in
`ExecutionEpochTrace`: one epoch is an arbitrary finite list of verified
package events at one `Config.signatureVersion`, with endpoint-free replay of
the complete list. Heterogeneous epochs can be joined only by a replayed
four-view `SignatureAdmissionEvent`, which strictly advances the version.
`P1cExecutionEpoch` instantiates a two-event epoch containing the business
event and completed-state external hold, plus the reference admission
boundary. `ExecutionEpochTrajectory` and its randomized counterpart now prove,
on the same deterministic or state/seed probability space, that every finite
prefix is an exact native `ObservableLTS.Path`. They additionally identify the
stored source and target of every event and prove endpoint-free replay plus
fixed runtime-signature alignment for every finite subsegment, not merely for
the whole prefix. The concrete P1c package instantiates this fixed-signature
event/epoch/replay theorem. The probabilistic `opportunityEpoch` is
still an observation/fairness schedule, not the runtime signature epoch.
One fixed-signature sample has not been lifted across heterogeneous admission
boundaries into a stochastic `EpochChain`, so this remains a single-occurrence
package rather than a general stochastic multi-signature scheduler.

The feedback probability layer starts from a genuine mathlib Markov kernel
and constructs an Ionescu--Tulcea path measure, measurable decreasing not-hit
events, and the bridge to the almost-sure hitting theorem. For finite
discrete execution packages, positive off-diagonal mass must have a native
observable step and the geometric miss recurrence is derived from row sums
plus a supplied pointwise $\varepsilon$ stable-mass bound. A finite-cylinder
induction identifies killed-chain miss mass with the not-hit cylinder
probability. The concrete Boolean execution package additionally constructs a
separate probability space of event-labelled paths: every step has a native
label, a replayable `DPOEvent`, exact source/target configuration endpoints,
and alignment with one stable/fair observation-opportunity window. Forgetting
events recovers the original state trajectory law exactly. A second,
seed-randomized coupling allows the selected native event to depend on
source, target, and an auxiliary probability stream; its state marginal is
again exactly the Ionescu--Tulcea law, and almost-sure hitting holds on the
joint event space. Both couplings now also carry finite-prefix event identity,
native-step, endpoint-free replay, opportunity-window, and runtime-signature
epoch agreement. This solves the abstract same-endpoint/multiple-label
coupling and fixed-signature common-trajectory problem. It does not construct
a heterogeneous-signature runtime joint transition kernel. The three admitted
P1c operations provide one concrete deterministic kernel and executable
request-level replay, but replay does not yet re-execute an arbitrary
presheaf-DPO match, complement, freshness, policy, and evidence check. That
general obligation, plus derivation of
stable-window/fairness/positive-$\varepsilon$ premises from each shared
product `ExecutionPackage`, remain open.

Exact scope is governed by `formal/proof-obligations.json`; the total
P1b/P1c/four-projection theorem remains incomplete and the project remains
Pre-FCP/M1.
