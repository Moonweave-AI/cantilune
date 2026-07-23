# CantiluneGraph v0.1 — Formal Semantics Specification

| Field | Value |
|---|---|
| Status | **Draft** (awaiting RFC-0002 consistency proof + second reviewer) |
| Type | Normative specification (formal semantics) |
| Risk | S2 |
| Owner | Joker-of-Gotham (DRI) |
| Reviewers | TBD (governance gap — see RFC-0001 §0) |
| Created | 2026-07-23 |
| Related | RFC-0001, ADR-0001, RFC-0002 (projection consistency) |

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
- **$R$** — a set of **string-diagram rewriting rules** over $C$. $R$ is the *dynamics*: execution is rewriting; a step is one rewrite; a trace is a reduction sequence; replay is re-running the sequence; deadlock is "no redex but not in normal form".

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

$C$ is the **free SMC** on $G_0$ (modulo the equations that define $\otimes$, $\circ$, $\sigma$). This makes the **DAG projection by-construction** (§6.1).

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

Edges generate morphisms in $C$; the contract becomes the typing obligation.

### 3.3 String diagram (presentation form)

The canonical **presentation** of a `CantiluneGraph` is a **string diagram**: boxes (morphisms) connected by wires (objects/types). The same string diagram admits four readings (DAG / Petri / π / morphism) — this is the formal content of "four theories are four observation dimensions, not four modules" (RFC-0001 §5.1).

## 4. Dynamics: string-diagram rewriting $R$

### 4.1 Rewriting rules

A rule $\rho \in R$ is a pair $\rho : L \to R$ of string diagrams (LHS pattern → RHS pattern), with a matching condition. **Execution step** = applying one rule to a redex in the current diagram.

### 4.2 Derived properties

| Property | Formal expression |
|---|---|
| Trace | reduction sequence $g_0 \to_\rho g_1 \to_{\rho'} \cdots \to g_n$ |
| Replay | given $g_0$ and the rule sequence, deterministically re-derive $g_n$ |
| Termination | no infinite reduction (a property to be **checked**, not automatic) |
| Deadlock | no redex matches, but $g$ is not a normal form |
| Normal form | no redex matches and $g$ is a terminal (intended) diagram |

### 4.3 What rewriting does **not** give

- **Wall-clock time bounds**: rewriting is discrete; time bounds require *cost-annotated* rewriting or a timed extension (out of scope for v0.1).
- **Numerical resource caps**: $\text{token} \le 3$ is a **marking invariant** on the Petri projection (§6.2), not a bare-category property.

These limits are declared explicitly so RFC-0001 §8's C2 (predictability) is stated as **step-bounded**, not time-bounded.

## 5. The four projections

Each projection $P_i : (C, R) \to \text{Target}_i$ maps the unified object to a target formalism. **Consistency** means each $P_i$ is a **structure-preserving functor that lifts to rewriting** (a rewriting functor / simulation): it maps a rewrite step in $C$ to a rewrite step in the target.

### 5.1 DAG projection $P_{DAG}$

$P_{DAG}$ = the underlying presentation graph / free-category generators.

- **By construction**: $C$ is free on $G_0$, so $P_{DAG}(C)$ is just $G_0$'s data-dependency view.
- **Rewrite lift**: a node-advance = a local rewrite; trivially a rewriting functor.
- **Status: 按构造一致 (by construction).**

### 5.2 Petri projection $P_{Petri}$

$P_{Petri}$ = the place/transition reading, taken under the **pre-net / free-SSMC semantics** (Bruni–Meseguer–Montanari–Sassone), NOT the naive commutative-monoidal reading (see §5.2.1 for why this resolution is load-bearing).

- Places = generating objects; transitions = morphisms $\text{in} \otimes \cdots \otimes \text{in} \to \text{out} \otimes \cdots \otimes \text{out}$; markings = objects; firing = rewrite.
- **By construction** (after the §5.2.1 resolution): Petri nets admit a free strict **symmetric** monoidal category semantics via pre-nets, preserving the $\circ$/$\otimes$ distinction.
- **Caveat (declared, not a defect)**: boundedness / liveness / reachability are **net-level properties checked on this projection**, not given by bare SMC. RFC-0002 lists the checker obligations.
- **Status: 按构造一致 (by construction), modulo net-level property checkers and the §5.2.1 pre-net resolution.**

### 5.2.1 Pre-net resolution of the Eckmann–Hilton collapse (load-bearing)

The classical correspondence "Petri nets are commutative monoidal categories" (Meseguer–Montanari, 1990) places places as a *free commutative monoid*, which generates **commutative** monoidal categories. In a commutative monoidal category an Eckmann–Hilton argument forces $g \circ f + 1_a = g + f$, i.e. **sequential composition $\circ$ and parallel composition $\otimes$ coincide** — the "collective-token philosophy" where tokens carry no individual identity. This is unacceptable for cantilune: the entire point of the DAG/Petri distinction is that $\circ$ (data dependency) and $\otimes$ (parallelism) are *different*, and collapse would erase the C2 (predictability) and C3 (control-plane) stories that depend on that distinction.

The resolution is the **pre-net** construction (Bruni–Meseguer–Montanari–Sassone, *Functorial Models for Petri Nets*):
- a pre-net replaces the free *commutative* monoid of places with a free (non-commutative) monoid, equipping each transition's input/output with an ordering;
- the adjunction **PreNet ⇄ SSMC** generates a **free strict symmetric monoidal category** (non-commutative, with non-trivial symmetry morphisms), which preserves the $\circ$/$\otimes$ distinction (individual-token philosophy);
- symmetries are added in a second step (compose the PreNet⇄SMC adjunction with the "freely add symmetries" adjunction), recovering token permutation without collapsing $\circ$ and $\otimes$;
- ordinary Petri nets are recovered by **abelianization** (forget the ordering); conversely, for a Petri net $P$, one chooses a pre-net $Q$ that abelianizes to $P$ and takes the free SSMC $L(Q)$ as the semantics.

**Declared design decision (not hidden):** the pre-net choice $Q$ is *extra structure* — different orderings on the same multiset transitions can yield different semantics. cantilune therefore commits to a **canonical pre-net choice convention** (to be specified in the P1a write-up: likely the order in which a node declares its inputs/outputs in the graph definition API of RFC-0001 §6.4). This convention is a design input, not a theorem; it must be documented so the Petri semantics is reproducible. **Attribution unverified beyond nLab's statement — the Bruni–Meseguer–Montanari–Sassone citation must be confirmed against the source before FCP (see §11).**

This resolution is what makes "$P_{Petri}$ is an SMC-functor by construction" a defensible claim: without it, the Petri projection lands in a *commutative* monoidal category, which is not even in the right family for an SMC-functor that must preserve $\circ \ne \otimes$. §8.6 records this as resolved-by-decision-pending-writeup.

### 5.3 Morphism projection $P_{Mor}$

$P_{Mor}$ = $C$ itself.

- Composition = $\circ$; parallel = $\otimes$; symmetry = $\sigma$. Orchestration = morphism composition (RFC-0001 §6 morphism facet).
- **By construction** (it is the identity view).
- **Status: 按构造一致 (by construction).**

### 5.4 π projection $P_\pi$ — **待证 (to be proven)**

Per the half-π (II) decision: channels are created dynamically via **request/accept** (dynamic addressing, runtime-decided), and **post-handshake conversation is untyped/free** (full π mobility, no session types).

- **Target**: full π-calculus (request/accept as a structured channel-creation presentation), with **presheaf / functor-category semantics** (Fiore–Moggi–Sangiorgi style) — not a bare SMC.
- **Consistency is NOT by construction**: bridging SMC+rewriting to π presheaf semantics is a **theorem to be proven** in RFC-0002, with a **phased plan** (see §6.4 / RFC-0002 §4).
- **Status: 待证 (to be proven).** Any unproven claim here is marked **unverified**.

## 6. Status summary and proof obligations

### 6.1 By-construction (unverified until RFC-0002 formalizes the functors, but follows from definitions)

- DAG, Petri, morphism projections as SMC-functors that preserve $\otimes$ and lift $R$.

### 6.2 To be proven in RFC-0002

- Each projection functor $P_i$ is a **rewriting functor** (preserves rewrite steps).
- **Cross-projection step consistency**: a single rewrite step in $C$ has consistent images across all four projections. (Three projections: expected clean. π: the hard part.)

### 6.3 Phased proof (per DRI decision)

| Phase | Prove | Status |
|---|---|---|
| P1a | DAG/Petri/morphism by-construction consistency + rewrite-functoriality | **按构造 (to be written up)** |
| P1b | π-projection consistency **for the request/accept channel-creation sublanguage** | **待证** |
| P1c (deferred) | π-projection consistency for **free conversation / unrestricted mobility** | **待证, possibly out of P1** |

### 6.4 Fallback (per ADR-0001)

If P1b/P1c cannot be proven, fall back to the largest consistent sublanguage of π and **document the reduction** in RFC-0002. Per governance, no "consistent" claim stands for π beyond what is actually proven; unproven parts are marked **unverified**.

## 7. What this spec guarantees and does not

| Guarantee | Source | Scope |
|---|---|---|
| Legal composition / parallelism | SMC $C$ | static, by construction |
| Unified execution step = rewrite | $R$ | by definition |
| Trace / replay / deadlock (discrete) | rewriting | by construction |
| Cross-projection consistency (3 projections) | SMC-functors | by construction (write-up pending) |
| Cross-projection consistency (π) | presheaf bridge theorem | **待证** |
| Boundedness / liveness | Petri net-level checkers | **checked, not given** |
| Time bounds | — | **not provided** (step-bounded only) |

## 8. Open questions for v0.1

1. Concrete type-system syntax for $G_0$ (nodes/edges/contracts).
2. Exact rewriting-rule schema $R$ (which rule families: node-advance, token-fire, channel-comm, compose).
3. The π presheaf bridge construction and its rewriting-functor proof (RFC-0002 §4).
4. Marking-invariant / resource-cap formalization on the Petri projection.
5. Cost-annotation extension (if C2 step-bounds prove insufficient for predictability claims).
6. **Petri projection: commutative-monoidal vs pre-net/SSMC semantics.** The classical "Petri nets are commutative monoidal categories" reading collapses $\circ$ and $\otimes$ via Eckmann–Hilton (collective-token philosophy), conflicting with cantilune's need to keep sequential dependency and parallelism distinct. P1a must adopt the pre-net / free-SSMC semantics (Bruni–Meseguer–Montanari–Sassone) or justify the collapse. See §10.8.

## 9. References

- RFC-0001 (`docs/rfc/0001-cantilune-architecture.md`)
- ADR-0001 (`docs/adr/0001-unified-formal-structure.md`)
- RFC-0002 (`docs/rfc/0002-projection-consistency.md`) — to be authored with this spec
- Meseguer–Montanari (Petri nets as commutative monoidal categories)
- Fiore–Moggi–Sangiorgi (π-calculus presheaf semantics)
- Gadducci–Montanari (functorial rewriting semantics)
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

where $L$ is the **left-hand side** (pattern to match), $K$ is the **invariant interface** (preserved sub-diagram), and $R$ is the **right-hand side** (replacement). A **rewrite step** $g \to_\rho h$ is performed by:
1. **matching** $L$ as a sub-diagram of $g$ via a match $f : L \to g$;
2. **deleting** the matched $L \setminus K$ (constructing a pushout complement);
3. **adding** $R \setminus K$ (taking the pushout along $r$),

yielding the derived diagram $h$. Execution is rewriting; a **trace** is a reduction sequence $g_0 \to_\rho g_1 \to_{\rho'} \cdots \to g_n$; **replay** re-runs the sequence; **deadlock** is "no rule matches but $g$ is not a normal form." This induces a **labelled transition system** (LTS) whose states are string diagrams and whose labelled transitions are rule applications.

Ref: nLab, *graph rewriting* / DPO ([ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)); Ehrig–Pfender–Schneider (1973); Lack–Sobocinski, *Adhesive categories*; Gadducci–Montanari, *functorial semantics of rewriting*; nLab, *labelled transition system* ([ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)).

### 10.7 Labelled transition system (LTS)

An **LTS** is a structure $T = (S, i, E, \mathrm{Tran})$ with a set $S$ of **states**, initial state $i \in S$, a set $E$ of **events** (labels), and a **transition relation** $\mathrm{Tran} \subseteq S \times E \times S$; $s \to_a s'$ denotes $(s, a, s') \in \mathrm{Tran}$. The dynamics $R$ of `cantilune` induces an LTS with $S = $ string diagrams and $E = R$ (rules), making traces well-defined.

Ref: nLab, *labelled transition system* ([ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)).

### 10.8 Petri projection — categorical semantics (with a real subtlety)

Classically, a (place/transition) **Petri net** is modeled as a **commutative monoidal category**: places are generating objects; transitions are morphisms $\mathrm{in} \otimes \cdots \otimes \mathrm{in} \to \mathrm{out} \otimes \cdots \otimes \mathrm{out}$; markings are objects; firing a transition is applying a morphism. This is the "Petri nets are monoids" correspondence (Meseguer–Montanari, 1990).

⚠️ **Subtlety that affects this spec (declared, must be resolved in P1a):** in a *commutative* monoidal category, an Eckmann–Hilton argument collapses **sequential** and **parallel** composition ($g \circ f$ and $g \otimes f$ coincide), i.e. the **collective-token philosophy** where tokens carry no individual identity. This conflicts with `cantilune`'s need to keep $\circ$ (DAG dependency) and $\otimes$ (parallelism) *distinct*. The standard resolution is the **individual-token philosophy** via *pre-nets* (Bruni–Meseguer–Montanari–Sassone): pre-nets generate **free strict symmetric monoidal categories** (not commutative), preserving the $\circ$/$\otimes$ distinction; symmetries are then added to recover token permutation. **RFC-0002 P1a must adopt pre-net / SSMC semantics rather than the naive commutative-monoidal reading**, or justify why the collapse is harmless for `cantilune`'s use. This is recorded as Open Question §8.6.

Ref: nLab, *Petri net* ([ncatlab.org/nlab/show/Petri+net](https://ncatlab.org/nlab/show/Petri+net)); Meseguer–Montanari, *Petri nets are monoids* (1990); Bruni–Meseguer–Montanari–Sassone, *pre-nets*.

### 10.9 π projection — presheaf semantics (待证)

The π-calculus (here half-π (II): request/accept + free untyped conversation) has categorical semantics in **presheaf / functor categories** over a category of name-generation contexts (Fiore–Moggi–Sangiorgi), not in a bare SMC. The bridge from `cantilune`'s $(C, R)$ to this presheaf model — and proof that it is a rewriting functor — is the **待证** work of RFC-0002 §4.2/§4.3.

Ref: Fiore–Moggi–Sangiorgi, *A fully abstract model for the π-calculus* (LICS 1996 / subsequent). **Attribution unverified — reviewer must confirm the exact citation and that it supports this spec's usage.**

### 10.10 Rewriting functor / functorial consistency

A **rewriting functor** (functorial semantics of rewriting) is a (strong) monoidal functor $F : C \to D$ between rewriting-equipped categories that **lifts to rewriting**: for every rewrite step $g \to_\rho h$ in $C$, there is a rewrite step $F(g) \to_{F(\rho)} F(h)$ in $D$. The **Four-Projection Consistency Theorem** (RFC-0002) asserts each projection $P_i$ is such a rewriting functor from $(C, R)$ to its target, so a single step is read consistently across all four.

Ref: Gadducci–Montanari, *functorial semantics of rewriting* (**attribution unverified**); nLab, *graph rewriting* ([ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)).

## 11. Citation verification obligation (governance)

All concept citations in §10 are **unverified attributions** drawn from web sources treated as untrusted input. Before FCP, a reviewer must confirm each cited work exists, says what §10 claims it says, and supports this spec's usage. Three attributions are particularly load-bearing and must be checked first: (i) Meseguer–Montanari "Petri nets are monoids" + the pre-net resolution; (ii) Fiore–Moggi–Sangiorgi π-presheaf semantics; (iii) Gadducci–Montanari functorial rewriting. Any citation that cannot be verified is marked **unverified** and the corresponding claim does not enter FCP.

