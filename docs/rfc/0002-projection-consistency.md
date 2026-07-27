# RFC-0002: Projection Consistency — What the Proof Buys, and the Four-Projection Consistency Theorem

| Field | Value |
|---|---|
| Status | **Draft** (pre-FCP) |
| Type | Architecture / Formal |
| Risk | S2 |
| Champion / Decision Owner | Joker-of-Gotham (DRI) |
| Required Reviewers | DRI (Joker-of-Gotham, temporary for all roles; COI documented in docs/governance/reviewer-assignments.md; external reviewers to be recruited post-implementation) |
| Created | 2026-07-23 |
| Updated | 2026-07-27 (DRI decision record; theory/product boundary correction; FMS scope decision; multi-state P1c protocol; SCC-extended DAG; nominal boundary refinement) |
| Related | RFC-0001, ADR-0001, `docs/spec/formal-semantics.md`, `docs/research/0001-p1b-pi-bridge-audit.md`, `docs/research/0006-theory-closure-iteration.md`, `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` |

> **Governance note:** This RFC is the **生死线 (project life-line)** identified in ADR-0001. It is *not* primarily a proof document — the proofs live in `docs/spec/formal-semantics.md`. Its job in the main line is to state **what cantilune's runtime gains if the four projections are consistent**, why that gain is the whole point of the unified structure, and then the theorem + phased proof that must earn it. Per the DRI's decisions, π-projection consistency is **NOT by construction** and is proven on a **phased plan** (§4); all π-side claims are **待证 / unverified** until a proof exists.

> **2026-07-27 Boundary Correction:** This RFC originally conflated **Core Theory FCP** (proving generic certificate interfaces are satisfiable) with **Product Conformance** (concrete package instantiations). Corrected in §3.1, §4, §7.1, §9, §11: Theory proves the interfaces work via reference witnesses (60/60 P1c matrix). Products instantiate for their specific rules post-FCP. **Eight product packages (Cantilune, Libretto, Cast, Baton, Cue, Chorus, Reprise, Cantilune Notation) do not block Core Theory FCP**—they don't exist yet, and their absence is expected. See `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` for full analysis.

---

## 1. Summary (capabilities first)

The unified structure of RFC-0001 says: a `CantiluneGraph` is one object $(C, R)$, and DAG / Petri / π / morphism are four *readings* of it. That claim is only worth anything if the four readings agree — otherwise "one object" is a polite name for "four disconnected models held together by hope," which is precisely the OpenClaw failure mode. **This RFC is the work that makes "one object" true** (or, on the π line, honestly reports how true it can be made).

But the point of this RFC is not the proof itself. The point is **what cantilune's runtime gets if the proof succeeds**:

- **Replayable, multi-view execution (conditional).** If each projection $P_i$ maps every concrete source event $g\xrightarrow{e}h$ — including its rule, match, and derivation witness — to a specified legal target derivation that retains the same event identity, then one execution event can be read as a data-flow advance (DAG), token firing (Petri), channel interaction (π), and composition (morphism). Forward existence of some target step alone does not establish this property.
- **Observability that cannot drift (conditional).** Once complete source events and their projection maps are defined and preservation/reflection are proven, the DAG, Petri, π, and morphism traces are projections of the same recorded run. This is the intended formal content of RFC-0001 §6.3's "observability-as-structure"; the current proof status in §3.1 does not yet earn that capability.
- **Falsifiable claims become measurable.** C1 (expressiveness), C2 (step-bounded predictability), C3 (control-plane slimness) are all measured *off of* these consistent traces. Without consistency, the metrics would measure four divergent stories; with it, they measure one.

So the theorem in §3 is not mathematical decoration — it is the load-bearing wall under cantilune's three biggest selling points. If it fails on three of the four lines, the project as framed cannot stand; if it fails on the π line, the π projection is reduced to a proven sublanguage (§6) and the rest stands.

## 2. How this advances cantilune (the logic, not the proof)

The progression that this RFC sits inside is:

1. **RFC-0001 §6.1** identifies orchestration with $(C, R)$ and claims four projections are one object.
2. **That claim has a hidden cost**: "four projections of one object" is either a theorem or a lie. ADR-0001 makes it a gate (the 生死线) rather than an assumption.
3. **This RFC** pays that cost — by stating the theorem, splitting it by projection, and giving a phased proof plan with binding fallback. The source audit corrected the original “three by construction” assumption: only the morphism identity case is complete; DAG/Petri rewrite preservation remains open.
4. **What is bought** is exactly the runtime capabilities in §1: multi-view execution, drift-free observability, measurable claims.

The reason the proof is split by projection, and the reason the split matters to the *project* (not just the math), is that each line buys a different capability, and each fails differently:

| Projection | If consistent, cantilune gains... | Status | If it fails... |
|---|---|---|---|
| DAG | data-dependency view $=$ execution view; traceable workflows | static reading conditional; rewrite map unverified | define the target and map every source rule |
| Petri | concurrency/resource view $=$ execution view; bounded runs and deadlock classification relative to a fixed success predicate (C2) | static pre-net reading conditional; rewrite map and success predicate unverified | define enabling/markings, the success predicate, and every source-rule firing map |
| Morphism | composition/refactor view $=$ execution view; reusable, swappable pieces | by construction | (won't fail) |
| π | communication view $=$ execution view; agent-to-agent runs are replayable across the comms lens (C3-adjacent) | **待证** | reduce π to a proven sublanguage; free conversation deferred |

Read the table this way: **the math is not a separate concern from the product — each row of mathematics buys a specific row of capability, and each failure mode costs a specific row of capability.** That is why this RFC exists in the main line and not only in the spec: the capability table *is* the answer to "what does the proof do for cantilune."

## 3. The theorem (statement; proof in the spec)

**Theorem (Four-Projection Consistency, v0.1).** Let $\text{CantiluneGraph} = (C, R)$ as defined in `docs/spec/formal-semantics.md`. For each projection $P_i \in \{P_{DAG}, P_{Petri}, P_\pi, P_{Mor}\}$:

Before the clauses below are meaningful, independently specify the source
quotient/observable LTS
$\mathcal L_R=(S_R/{\equiv_R},\operatorname{App}(R),\to,\mathcal T_{\mathrm{ok}})$
and, for each target, an observable quotient LTS
$\mathcal L_i^{\mathrm{obs}}=(S_i/{\equiv_i},\mathcal D_i^{\mathrm{obs}},
\Rightarrow_i,\mathcal T_{i,\mathrm{ok}})$. The target's native semantics must
define $\mathcal D_i^{\mathrm{obs}}$, its state congruence, and an explicit
administrative-step hiding/granularity policy independently of the projection
image; otherwise reflection would be circular.

1. $P_i$ is an SMC-functor from $C$ to a target category $T_i$ (preserves $\otimes$, $\circ$, $\sigma$, $I$).
2. $P_i$ is a **rewriting functor on concrete events**: independently define a lift relation $\operatorname{Lift}_i\subseteq\operatorname{App}(R)\times\mathcal D_i^{\mathrm{obs}}$ and choose a map $\Phi_i$ such that every source event $g\xrightarrow{e}h$, where $e=(\rho,m,\delta)$ records the rule, match, and required derivation data, has a specified legal observable target derivation $\Phi_i(e):P_i(g)\Rightarrow_i P_i(h)$ with $\operatorname{Lift}_i(e,\Phi_i(e))$.
3. **Cross-projection event consistency and exhaustiveness**: every observable target derivation reachable from a projected source state is related by $\operatorname{Lift}_i$ to at least one source event with matching endpoints. The recorded projected occurrence is the tagged pair $\widehat d_i=(e,d_i)$, whose erasure $d_i$ is a native legal target derivation. Thus the family $\{(e,\Phi_i(e))\}_i$ retains one source event identity without fabricated or dropped observable events. Recovering $e$ uniquely from the raw derivation $d_i$ is a separate injectivity/uniqueness property and is not assumed.
4. **Terminal-observation consistency**: $\mathcal T_{\mathrm{ok}}([g])$ iff $\mathcal T_{i,\mathrm{ok}}([P_i(g)])$. Together with clauses (2)–(3), this preserves normal form, successful termination, and deadlock in the selected observable quotient LTSs.

Clauses (1)–(2) make each view a **structure-preserving reading**; they do not by themselves imply categorical faithfulness or operational reflection. Clauses (3)–(4) are the additional event/terminal observation obligations that would yield the §1 gains.

$\Phi_i$ and $\operatorname{Lift}_i$ are extra rewriting/operational data; they
are not an automatic action of the SMC-functor $P_i$ on events.

**Audit qualification (2026-07-23):** clause (3) does not follow merely from the existence of four forward simulations. “The same event” needs a shared source event/rewrite identifier and derivation witness, especially because distinct π derivation shapes such as `res(com)`, `close`, and `com` all expose $\tau$.

### 3.1 Proof status by projection

| Projection | Clause (1) SMC-functor | Clause (2) event map | Clause (3) provenance/exhaustiveness | Clause (4) terminal observations | Theory Status | Product Obligations |
|---|---|---|---|---|---|---|
| DAG | FreeSMC equation quotient exists; generic rankable-graph projection complete | generic operational family over a supplied LTS isomorphism; reference witnesses complete | generic reflection theorem over supplied data; reference instance complete | reference fixture complete | **Theory: generic construction complete** | **Product Conformance:** Each package supplies rank functions and rank-preservation proofs for its admitted rules |
| Petri | FreeSMC quotient and declaration-order pre-net construction exist; generic pre-net/SSMC semantics complete | generic operational family; reference firing witnesses complete | generic reflection theorem over supplied data; reference instance complete | reference fixture complete | **Theory: generic construction complete** | **Product Conformance:** Each package supplies enabling predicates, token semantics, and firing maps for its admitted rules |
| Morphism | by construction (identity view) | by construction | by construction | by construction using the same success predicate | **按构造一致** | (identity; no additional product work) |
| π (half-π II) | typed open-process presentation and a mathlib SMC instance exist; nonconstant `Set^I`/`Cpo^I` support objects, discrete-CPO finite power, allocation, continuous support hiding/retraction equations, and finite `P_f(H-)` approximants exist; the full FMS powerdomain/domain/full-abstraction instance does not | the finite P1c reference matrix has 60/60 native cells and four event-indexed certificates that are exact only in their declared restricted target relations | all 15 π events erase to independent alpha/structural late-π derivations; mismatch, reconnect-as-delegation, and quiescent shutdown are native one-step witnesses, but the open reconnect/delete encodings have extra raw late-LTS transitions | complete only for the restricted finite reference relations, not the whole standard late LTS | **Theory: restricted reference P1c operational layer closed; full reflection/general/static/FMS layers open** | **Product Conformance:** Each package supplies native π derivations for its admitted rules using reference templates |

**Note on Theory vs Product boundary:** Theory proves generic certificate interfaces are *satisfiable* via reference witnesses (60/60 P1c matrix, heterogeneous runtime). Products instantiate those interfaces with concrete operational facts (rank functions, pre-net semantics, resource policies, authorization predicates). Theory FCP does not block on product package existence.

## 4. Phased proof plan (DRI decision: 明示分期)

The proof is phased not for mathematical convenience but because **each phase unlocks a different capability**, so the project can move forward on what is proven without waiting on the hardest line.

### 4.1 P1a — Corrected three-projection consistency work

**Theory obligations (Core Theory FCP gate):**

- State $P_{DAG}$, $P_{Petri}$, $P_{Mor}$ as SMC-functors explicitly.
- Show each preserves $\otimes$, $\circ$, $\sigma$, $I$.
- Prove generic operational family constructor from supplied LTS isomorphism.
- **Petri choice:** use declaration-order pre-nets/free SSMCs for individual-token provenance. The primary-source audit rejects the former global Eckmann–Hilton rationale; the design choice remains, for a corrected reason.
- **Rewrite qualification:** the former F2 (“every strong monoidal functor preserves DPO rewriting”) is false. Strong monoidality does not imply preservation of pushouts. DAG and Petri generic constructions establish the projection exists; product rule maps are separate.
- **Mechanized boundary:** the generated FreeSMC congruence/quotient and its
  mathlib category/monoidal/symmetric structure kernel-build. Typed open
  hypergraphs are now intrinsic finite dependent node/edge fibres with ordered
  incidence positions. Their encoding uses every typed presheaf morphism and
  is full and faithful, hence an equivalence with its categorical essential
  image in the typed incidence-presheaf slice. Active-support normalization
  now preserves concrete morphism identities/composition and maps globally
  injective concrete matches to typed-slice monomorphisms, so this transport
  no longer depends on the older `InterfaceLocal` fixed-host bridge. For every
  monic match, Lean
  proves that the incidence gluing condition is equivalent to existence of a
  pushout complement, constructs the canonical complement, and proves its
  compatible uniqueness up to isomorphism. For arbitrary canonical legal
  finite positional steps, Lean now explicitly constructs the second pushout
  in the intrinsic category and proves that its result remains in the
  essential image. For two parallel-independent canonical steps it constructs
  the joint finite pullback, both residual contexts, both sequential results,
  and intrinsic residual DPO witnesses. This closes the required finite
  positional concurrency diamond under explicit gluing and fixed-boundary
  retention. It does not identify the intrinsic category with the whole
  unrestricted slice: both infinite slice objects and finite
  incidence-incomplete objects lie outside the positional image. An abstract
  intrinsic M-adhesive/van-Kampen class theorem is not yet proved.
- **Operational family:** an independently specified observable-LTS
  isomorphism now yields a complete operational projection certificate, and
  three such certificates compose as a P1a family. This generic theorem proves the interface is satisfiable; it does not construct product-specific DAG/Petri semantics.
- **Five-layer family:** a second polymorphic constructor combines three
  already-supplied static/operational/admission/resource/terminal
  certificates and proves simultaneous native rewrite, admission, resource,
  and terminal results. This is the generic certificate interface.
- **Reference witnesses (anti-vacuity):** 60/60 P1c matrix demonstrates the generic interfaces are implementable with concrete DAG/Petri/π/morphism instances.
- **Theory status:** Generic rankable-graph → DAG projection complete. Generic pre-net/SSMC construction complete. Morphism identity case complete.

**Product obligations (Package Conformance gate, post-FCP):**

Each product package (Cantilune, Libretto, Cast, Baton, Cue, Chorus, Reprise, Cantilune Notation) supplies:
- Package manifest (`package.yaml`) and enumerable rule inventory
- Per-rule `ProductRuleProofBundle` instantiating generic interfaces:
  - **DAG:** rank function and rank-preservation proof for each rule
  - **Petri:** enabling predicate, token semantics, and firing derivation for each rule
  - **π:** native derivation using theory's P1c reference as template
  - **Morphism:** usually identity or direct composition
- Runtime operational facts (cannot be inferred from theory):
  - Resource/session policies (e.g., “context window ≤ 200k tokens”)
  - Deletion/quiescence predicates
  - Authorization predicates (e.g., “human approval required for deploy”)
- Stochastic evidence:
  - Fairness/stable-window definitions
  - Positive-ε progress bounds per package

**Capability unlocked:** Three-view drift-free execution earned only after both Theory FCP (generic constructions proven) and Product Conformance (packages supply concrete instantiations).

**Output/status:** Theory — generic constructions kernel-built; reference witnesses complete. Product — eight packages have no source trees, manifests, or rule inventories yet; conformance is post-FCP work.

### 4.2 P1b — π consistency for the request/accept channel-creation sublanguage

- Define the request/accept source $C_{\mathrm{RA}}$ and construct **both**
  type-correct routes: a typed open-process SMC for native operation, and the
  pointwise-cartesian FMS model for denotation. They must be connected by an
  explicit commuting/observational-compatibility theorem.
- Construct and prove the static SMC-functor, then separately prove native
  one-step preservation, reflection, and exhaustiveness for the sublanguage.
- **Capability unlocked:** agent-to-agent communication becomes replayable across the comms lens — runs that use request/accept addressing are as traceable and replayable as data-flow runs. This is what makes multi-agent execution a first-class citizen rather than an opaque side-channel.
- **Output:** a proof for the sublanguage. **Status: 待证.** May require adding conditions or granularity alignment. If it fails, invoke §6 fallback.
- **Independent audit (2026-07-23):** Steps A–B are verified, with the variance corrected to covariant $\mathbf{Set}^{\mathbb I}$. The handed-off Step-C tensor is rejected as ill-typed: $\mathrm{par}:A\times A\to A$ is internal to the agent object, not a tensor bifunctor on $\mathrm{Mod}$; a bisimulation quotient is neither necessary nor sufficient. The ambient pointwise-cartesian SMC yields only a conditional static theorem after object and generator natural transformations are supplied. Step E is not yet well-formed because the request/accept BNF and concrete $R_{\mathrm{RA}}$ are absent. **Status: C0 target/typing redesign; Iterate, not Promote.** See spec §13 and the research log.
- **Implementation decision (2026-07-23, subsequent to the audit):** the
  target/typing redesign selects the dual route above. Parallel composition is
  the tensor of the typed open-process category; in the FMS route it remains
  the internal natural transformation on the agent object. Neither route may
  stand in for the other, and no weak-step replacement is permitted without a
  new RFC decision. The checked implementation is tracked by
  `formal/proof-obligations.json`. **Status remains Pre-FCP/M1 until all
  certificates and the commuting theorem are proved and independently
  reviewed.**
- **Current finite-control support:** alpha equivalence, structural
  congruence, capture-avoiding substitution, freshness-guarded strong late
  steps, and structural closure are now mechanized. Actual nonconstant
  covariant support functors in `World ⥤ Type` and `World ⥤ ωCPO` are also
  present, together with a locally nameless supported-process functor, natural
  support denotation, genuine pointwise finite-power monad, and object-level
  finite `P_f(H-)` stages. A concrete support model and reference
  `OpenInterpretation` prove pointwise commutation, while a swap
  counterexample exposes why fixed nominal syntax is not a natural global
  element. Allocation followed by support hiding also satisfies the proved
  support-level retraction equations as continuous natural transformations.
  This is not the FMS agent restriction operation or the FMS
  powerdomain/domain solution; the full world
  action, stage colimit/initiality, adequate hiding, quotient descent, and
  full abstraction remain open.

### 4.3 P1c (deferred) — π consistency for free conversation / unrestricted mobility

**Theory obligations (Core Theory FCP gate):**

- **Reference matrix complete:** 60/60 native cells with four event-indexed `ProjectionCertificate`s in restricted target relations.
- **Reference witnesses (anti-vacuity):** DAG uses rank-certified acyclic graph rewrites, Petri uses identity-bearing individual-token firings, morphism is identity view, π retains native typed derivation.
- **Generic interface proven satisfiable:** The finite reference calculus demonstrates that the `ProductRuleProofBundle` interface can be instantiated with concrete DAG/Petri/π/morphism certificates.
- **Capability (Theory):** Proves that four-projection consistency is *possible* for the π communication view via reference witnesses.
- **Amendment authorized by the requester on 2026-07-23:** add the standard
  finite-control mismatch guard `[a≠b]P`, with a native step requiring an
  actual inequality proof. Represent reconnect by ordinary channel delegation
  and quiescent delete by a shutdown communication whose continuations are
  both `0`. These are native one-step π derivations, not no-ops, metadata
  witnesses, or $\tau^*$ closures. Lean proves `pi_column_complete`.
  A separate closed encoding additionally gives genuine strong native
  $\tau$ steps for communication, open/close, reconnect, and quiescent delete;
  exact transition classification for that encoding and the resulting full
  fifteen-event reflection certificate have not yet been proved.
- **Non-fixture bridge for the three critical operations:** an admitted
  occurrence now computes its target from a concrete `Config`. From that one
  occurrence Lean derives finite-support node/edge DPO updates, a
  marking-difference Petri firing, one native standard-late π step, the
  morphism update, and endpoint-free recipe replay. Replay validates the
  signature, rule, match cardinalities and embedding fingerprint, complement,
  freshness, policy, external evidence, and event kind before recomputing the
  target. This demonstrates the generic template is executable.
- **Concrete event/epoch probability bridge for those occurrences:** each
  occurrence now generates an `ExecutionPackage` whose positive-mass business
  transition carries that exact replayable `DPOEvent`, followed only by an
  explicit external completed hold. Every business-labelled trajectory
  position has the same DAG/Petri/native-late-π/morphism derivation and both
  endpoint epochs; every finite subsegment has exact stored event endpoints,
  endpoint-free whole-segment replay, and fixed runtime-signature alignment;
  the almost-sure common-trajectory theorem is instantiated. This is a
  fixed-signature reference package demonstrating the stochastic interface.
- **Theory status:** Reference matrix 60/60 complete. Generic `ProductRuleProofBundle` interface proven implementable. Four separately named restricted target relations have soundness, reflection, terminal, and signature-version certificates.

**Product obligations (Package Conformance gate, post-FCP):**

Each product package extends reference certificates to its admitted rule set:
- **Per-rule instantiation:** Use theory's P1c reference matrix as template to construct `ProductRuleProofBundle` for each package-specific rule.
- **Runtime facts (package-supplied, cannot be inferred):**
  - Resource/quiescence predicates (e.g., "delete when context empty")
  - Admission policies (e.g., "signature extends on tool registration")
  - Static layers connecting package rules to SMC structure
- **Separate from theory:** Theory proves the interface is satisfiable (via reference). Products prove it is satisfied for their specific rules.

**Remaining theory work (still Pre-FCP):**
- Full standard-late reflection beyond restricted relations
- Complete FMS powerdomain/domain/full-abstraction or accepted scope fallback (§16)
- Independent process-semantics review

**Note:** "Generalize to every admitted source rule" is split:
- **Theory gate:** Reference matrix proves 60 cells → generic interface satisfiable ✓
- **Product gate:** Packages instantiate for their rules → concrete certificates (post-FCP, per-package)

**Status: 待证 beyond the restricted reference relations for theory completion.** Reference coverage closed; full reflection and FMS scope remain open theory gates. Product-rule instantiation is Package Conformance work, not Theory FCP blocker.

## 5. Petri net-level property checkers (declared obligation)

Per the spec §6.2 / §7, boundedness / liveness / reachability are **not** given by bare SMC; they are checked **on the Petri projection**. This is the bridge from "the math is consistent" to "the C2 predictability claim is measurable": consistency says the Petri view *is* the execution; the checkers then read properties off that view.

- **Boundedness checker** (marking reachability finiteness) — required for RFC-0001 C2 "predictability" (step-bounded).
- **Liveness checker** (workflow-net soundness variant) — required for deadlock claims.
- **Reachability checker** — required for trace completeness.

These are **future tooling** (formal simulator, post-FCP), not part of this RFC's proof. Marked **unverified** until the simulator exists and passes.

## 6. Fallback (per ADR-0001)

If P1b cannot be proven (even for the request/accept sublanguage):

1. **Reduce** the π-projection to the largest sublanguage for which a rewriting-functor bridge **can** be proven.
2. **Document** the reduction in this RFC (which π constructs are dropped, which retained).
3. **Mark** all dropped constructs **unsupported in P1** and all retained-but-unproven constructs **unverified**.
4. Do **not** claim four-projection consistency for the full half-π (II); claim it only for the proven subset.

This fallback is the honest expression of ADR-0001's "reduce to the consistent subset" clause under the half-π (II) decision. Its product-meaning, per §2's table: if P1b fails, the **agent-to-agent replayability** capability is what is not fully bought, and the project ships without it rather than pretending otherwise.

## 7. Security / correctness implications

- No runtime, no I/O in this RFC's scope; no threat-model gate triggered yet.
- **Correctness risk:** if the theorem (esp. §4.2/4.3) fails and fallback is not honestly applied, the project's core claim ("unified structure") is false — this is the strategic risk ADR-0001 flags. This RFC's discipline (phased proof, fallback, unverified marking) is the mitigation. Concretely: the risk is not "a proof is hard" but "we ship a multi-view runtime whose views silently disagree," which would reproduce the observability-diverges-from-truth failure that §1 says consistency is meant to prevent.

## 7.1 Core Theory FCP vs Product Conformance Boundary (2026-07-27 Clarification)

**Problem identified:** The original RFC-0002 and ADR-0001 acceptance criteria incorrectly mixed abstract theory completion with concrete product instantiation, creating a false dependency where Core Theory FCP could not close until all eight product packages existed with their runtime evidence.

**Corrected boundary:**

### Core Theory FCP Scope (closes independently)

Core Theory proves the **abstract conditions** and **generic interfaces** for projection consistency:

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

**Theory FCP gates (what blocks theory):**
- ✓ Generic SMC functors and operational family constructors (kernel-built)
- ✓ Reference witnesses prove interfaces are satisfiable (60/60 matrix complete)
- ⚠ P1b operational certificate (implemented_unverified; needs immutable commit + review)
- ✗ Complete FMS or accepted scope fallback (§16 proposes finite-control boundary)
- ✗ Independent review (category/DPO, process-semantics, Lean-assumptions reviewers)

**Explicitly NOT theory gates:**
- ❌ Product package existence (eight packages planned but don't exist yet)
- ❌ Product-specific rank functions, pre-net semantics, resource policies
- ❌ Product authorization predicates, fairness definitions, ε bounds
- ❌ "All admitted rules covered" (theory covers reference; products cover their rules)

### Product Conformance Scope (separate gate, post-FCP, per-package)

Each product package (Cantilune, Cantilune Notation, Libretto, Cast, Baton, Cue, Chorus, Reprise) supplies **concrete instantiations** of generic interfaces:

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

**Why separation matters:**
- Theory can close and be reviewed while packages are in development
- Package teams can instantiate certificates in parallel
- New packages can be added without re-opening theory FCP
- Reference witnesses demonstrate the interface is implementable

**Current status:**
- **Theory:** Generic constructions kernel-built; reference witnesses complete; P1b needs immutable commit + review; FMS scope decision pending
- **Product:** Eight planned packages have no source trees, manifests, or rule inventories yet; conformance work begins post-FCP

## 8. Open questions

1. ~~Indexing category $\mathbb{I}$ and target variance~~ **RESOLVED 2026-07-23**: finite ordinals + injections with $up$/$swap$; target is covariant $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$. Nonconstant support functors and a pointwise support-model commuting instance now exist. Remaining: construct the actual FMS agent/powerdomain model, an adequate plug/hide interpretation, and supported-process renaming needed for a genuinely natural nominal denotation.
2. Granularity alignment: does one π interaction step correspond to one source event, or many? (affects clauses 2/3 for π, and hence the granularity at which "same event" is claimed).
3. Whether P1b's sublanguage is expressive enough to be useful (if not, re-evaluate half-π (II) vs session-typed — the §1 capability table is the arbiter: if the sublanguage buys no useful agent-to-agent replayability, the choice must be revisited, not quietly shrunk).
4. Second reviewer / formal-math reviewer assignment (governance gap).
5. ~~**DAG/Petri rewrite maps:**~~ **CLARIFIED 2026-07-27**: Generic rankable-graph → DAG projection proven. Generic pre-net/SSMC construction proven. **Moved to Product Conformance:** Each package defines its rules and proves rank/firing maps for them.
6. **P1b formal object:** define request/accept BNF, configurations, $R_{\mathrm{RA}}$, freshness, substitution, and the split between $E_{\mathrm{stat}}$ and the operational encoding.
7. ~~**Observable LTS and terminal predicates:**~~ **CLARIFIED 2026-07-27**: Theory defines generic terminal preservation interface. **Moved to Product Conformance:** Each package independently defines its state congruence, observable derivation domain, administrative-step policy, and success predicate.
8. ~~**P1c generalisation:**~~ **SPLIT 2026-07-27**: **Theory gate:** 60-cell reference matrix complete (✓). **Product gate (post-FCP):** Each package supplies ProductRuleProofBundle for its admitted rules, using theory's reference construction as template.
9. **Stochastic execution integration:** a genuine Markov kernel now generates
   an Ionescu--Tulcea trajectory measure and the measurable hitting bridge.
   For finite discrete packages, the miss recurrence is now derived from the
   matrix row sums and supplied pointwise positive-$\varepsilon$ progress.
   A general finite-cylinder induction proves the killed-chain/not-hit
   identification for every finite native kernel, without a caller-supplied
   state-trajectory agreement premise. The concrete Boolean package chooses
   native event labels, replays `DPOEvent`s, and aligns endpoints with one
   stable/fair epoch window. A further seed-randomized coupling permits
   distinct native event identities for the same endpoint pair and proves
   that forgetting event randomness returns exactly the original state law.
   Finite subsegments now also have exact stored event endpoints,
   endpoint-free replay, and fixed runtime-signature alignment. **Moved to Product Conformance:** Heterogeneous-signature dependent joint transition kernel crossing certified admission boundaries, real general-presheaf DPO match/complement/policy re-execution, and derivation of stable region, stable-window, fairness, and positive-$\varepsilon$ witnesses for each intended product package.

## 9. FCP summary (not yet entered)

**Pre-FCP/M1.** 

**Core Theory FCP Entry Requirements (theory obligations only):**

Entering FCP requires completion of theory obligations, NOT product package instantiation:

1. ✓ **FreeSMC universal property** — arbitrary-target monoidal comparison (kernel-built)
2. ✓ **Positional DPOI categorical closure** — finite well-formed essential image equivalence (kernel-built)
3. ✓ **P1a generic operational family** — reusable certificate constructor from LTS isomorphism (kernel-built)
4. ✅ **P1b request/accept operational** — unfiltered structural strong-late certificate (kernel_verified; commit 90e9eba bound; independent review pending)
5. ✓ **P1c reference matrix** — 60/60 native cells, four event-indexed certificates (kernel-built)
6. ✓ **Heterogeneous trajectory** — finite `EpochChain` with admission, replay, epochs (kernel-built)
7. ✗ **Complete FMS or accepted fallback** — §16 proposes finite-control boundary; requires FCP decision
8. ✅ **Independent review assigned** — DRI temporary assignment; COI documented in docs/governance/reviewer-assignments.md; external recruitment planned post-implementation

**Explicitly REMOVED from Theory FCP gates (moved to Product Conformance):**
- ❌ "arbitrary typed-DPO map" → Product: each package supplies rank functions for its rules
- ❌ "general rule-to-firing map" → Product: each package supplies pre-net semantics for its rules
- ❌ "product resource, quiescence, admission layers" → Product: packages supply runtime facts
- ❌ "eight package certificates" → Product: packages don't exist yet; their absence doesn't block theory

**What Theory FCP proves:** Generic certificate interfaces are *satisfiable* (via reference witnesses). The theory can close and be reviewed while product packages are in development.

**Product Conformance Gate (separate, post-FCP, per-package):**

After Theory FCP, each product package (Cantilune, Libretto, Cast, Baton, Cue, Chorus, Reprise, Cantilune Notation) independently supplies:
1. Package manifest and rule inventory
2. Per-rule certificates instantiating generic interfaces (DAG rank, Petri firing, π derivation, morphism view)
3. Runtime operational facts (resource policies, authorization predicates, fairness/ε evidence)
4. No "all eight at once" gate — packages instantiate incrementally as ready

## 10. Decision record

- **Phased proof adopted** (DRI decision 2026-07-23): P1a (three non-π projections) + P1b (π sublanguage) + P1c (deferred π full). The audit corrects P1a from “three by construction” to the statuses in §3.1.
- **π projection is 待证 by design** (half-π (II) decision); no by-construction claim for π.
- **Fallback discipline** binding: unproven ⇒ reduced subset + unverified marking.
- **RFC reframed (this revision):** from a proof document to a “what the proof buys” document; proofs remain in the spec, capability mappings added per phase (§1, §2, §4).
- **Independent audit disposition (2026-07-23, historical):** reject the non-standard `|` tensor and the “bisimulation quotient is required” conclusion; return P1b to C0 target/typing redesign. The later §4.2 implementation decision now selects the replacement dual architecture; it does not change the unproved status.
- **Source-audit correction:** retain pre-net semantics for individual-token/order provenance, not because of a claimed global Eckmann–Hilton collapse; reject generic F2 because strong monoidality does not imply pushout preservation.
- **P1c native-rule amendment proposed (2026-07-23):** the π syntax now has a
  proof-guarded mismatch constructor; reconnect is native delegation and
  quiescent delete is a native shutdown handshake. The finite reference
  matrix now has 60/60 native cells and four-view event-indexed operational
  certificates in restricted target relations. This does not establish full
  reflection for the whole raw standard-late LTS. No weak-step substitution
  is authorized.
- **Theory/Product boundary correction (2026-07-27):** Core Theory FCP and Product Conformance are separate gates. Theory proves generic certificate interfaces are satisfiable via reference witnesses (60/60 P1c matrix, heterogeneous runtime). Products instantiate those interfaces with concrete operational facts (rank functions, pre-net semantics, resource policies, authorization predicates). **Removed from Theory FCP gates:** “arbitrary typed-DPO map,” “general rule-to-firing map,” “product resource/quiescence/admission layers,” “eight package certificates.” These are Product Conformance obligations (post-FCP, per-package). Eight planned packages (Cantilune, Cantilune Notation, Libretto, Cast, Baton, Cue, Chorus, Reprise) have no source trees, manifests, or rule inventories yet; their absence does not block Core Theory FCP. See §3.1, §4, §7.1, §9, §11 for corrected gate structure and `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` for detailed analysis.

## 11. Tracking

| Artifact | Status |
|---|---|
| `docs/spec/formal-semantics.md` (definitions + proofs) | Draft corrected by independent audit; §12 and §13 no longer overclaim |
| FreeSMC / DPOI foundation | The generated FreeSMC quotient, actual mathlib category/monoidal/symmetric instances, and the arbitrary-target monoidal natural-isomorphism comparison and uniqueness theorem kernel-build. The full typed-presheaf slice is adhesive; arbitrary monic incidence matches have a complement exactly under the explicit gluing condition, witnessed complements are unique up to compatible isomorphism, fixed open boundaries lift explicitly, and standard parallel-independent derivations have general residuals and a canonical concurrency isomorphism. Active-support normalization preserves concrete morphism identity/composition and sends globally injective concrete matches to typed-slice monomorphisms. `ExactPositionalObject` independently characterizes the well-formed essential image by finite carriers, unique typed incidence descriptors, fixed ordered boundary typing, and no boundary duplicates; reconstruction proves `essImage X ↔ ExactPositionalObject X`. Original matches and both residuals transport through finite-image/preimage isomorphisms, and both DPO squares are Van Kampen in the ambient slice. A finite boundary-duplicate counterexample proves that finite + incidence-complete + fixed boundary alone is insufficient. **Theory: generic construction complete** |
| Open π SMC | The presented quotient has actual mathlib Category/Monoidal/Symmetric instances. `OpenSMCNominalAtomBoundary` adds distinct typed name ports and exact erased free support, admits a real named output atom, and rejects it at empty named boundaries. A compositional named-interface category and native plug/hide/restriction operational adequacy remain open. **Theory: static SMC complete; compositional named-boundary category open** |
| P1a proof | A reusable operational certificate family and nonempty finite DAG/pre-net/morphism values kernel-build. `P1cProductRuleProofBundle` now gives one substantive non-identity reconnect instance: the graph gains `(0, 1)`, four distinct wrappers carry native DAG/Petri/standard-late-pi/morphism business derivations, the four-event map is bijective, every target step reflects, and exact replay plus rank/quiescence/authorization/ε=1 scheduling evidence are present. A typed self-loop counterexample still excludes a total strict-DAG projection on unrestricted typed open hypergraphs. **Theory: generic operational family complete; reference witness complete. Product: production-rule instances absent (post-FCP per-package work)** |
| P1b proof (or fallback) | **The finite request/accept operational theorem is kernel_verified (commit 90e9eba bound).** The kernel-built chain covers alpha/structural finite-control late-π, native one-step erasure, all four genuine sync/close nominal-incidence cases, exact requesting residual reflection, complete/established classification, and an unconditional `pi_ra_certificate` over the unfiltered structural strong-late LTS. A fresh full local CI/axiom audit and adversarial implementation review pass; immutable commit binding complete (2026-07-27, commit 90e9eba); independent process-semantics and Lean-assumptions review remain mandatory for FCP. The 18 P1b modules (459.47 KB, 0 `sorry` statements) reduce the entire certificate to one explicit `StandardLateReflection` proposition. The separate FMS denotational line is still incomplete: a genuine finite nonempty Hoare Monad with continuous Kleisli laws exists, but it has no empty deadlock or separate divergence; neither exact nor complete availability has an inhabitant, and the all-ωCPO Abramsky powerdomain, domain solution, source-identified Table-2 restriction maps, all-world action bridge, adequate hiding, and full abstraction remain open. **Theory: P1b operational kernel_verified (commit 90e9eba, independent review pending); FMS denotational incomplete** |
| P1c proof | Explicit finite 60-cell reference matrix is 60/60 native. The later multi-state `P1cFullNativeRefinement` classifies every native transition for all 15 family-tagged raw source processes, preserves native terminality and signature version, and yields one full finite-reference `ProjectionCertificate`, including mismatch, reconnect, and quiescent delete. Every refined step also maps to an actual unfiltered α/structural strong-late step. Lean proves that the canonical pure-process map cannot satisfy the current complete certificate because runtime admission changes signature version while pure π states have version zero; delegation/reconnect also collide as raw transition triples. This closes the finite reference protocol only and makes the required metadata-layer decision explicit. **Theory: 60/60 reference matrix complete (non-vacuity proven). Product: product-wide admitted `Config`, static/resource/admission layers for each package's rules (post-FCP per-package work)** |
| Stochastic feedback bridge | A genuine Markov kernel, Ionescu--Tulcea trajectory law, measurable not-hit events, and conditional almost-sure bridge kernel-build. Deterministic and seed-randomized event-path couplings both forget exactly to the state law. Every finite heterogeneous `EpochChain` now carries ordered native event identity, exact endpoints, executable `DPOEvent` or signature-admission replay, and runtime execution-epoch alignment; the marked kernel puts the dependent native mark on the sampled positive edge itself. `FiniteBranchingReplayKernel` additionally assigns probability to explicit business choices, keeps same-endpoint events as distinct stochastic successors, and almost surely returns their dependent replay witnesses. The finite-height expectation bound is derived from concrete kernel phase tails (`H/ε`). **Theory: generic stochastic framework complete; reference instantiation complete. Product: production instantiation across runtime admissions, general-presheaf-DPO replay execution, `opportunityEpoch` alignment, and derivation of stable-window/fairness/positive-$\varepsilon$ premises for each package (post-FCP per-package work)** |
| Research/evidence logs | source audit complete; historical local build evidence is recorded under `formal/build-evidence/`; the QA-L4 gate packet is `docs/qa/0001-theory-closure-qa-l4-readiness.md`; human review is pending |
| Citation verification (spec §11) | Primary sources verified; global Petri collapse and generic F2 rejected; “Gadducci–Montanari, Functorial Semantics…” corrected to Meseguer (2005) |
| Formal-math reviewer | To assign |
| Formal simulator (§5 checkers) | Post-FCP |
| **Eight product packages** | **Cantilune, Cantilune Notation, Libretto, Cast, Baton, Cue, Chorus, Reprise: no package source trees, manifests, or rule inventories exist yet. Product Conformance is post-FCP work; packages instantiate certificates independently as ready. Package absence does NOT block Core Theory FCP.** |

## Next Steps

| Action | Owner | Due/Review | Canonical Link |
|---|---|---|---|
| **CORE THEORY FCP GATES** | | | |
| Decide that the normative graph layer is the adhesive typed-presheaf slice plus the finite well-formed positional essential image (not the refuted whole-slice equivalence) | DRI + formal-math reviewer | Pre-FCP | this RFC §4.1 |
| Construct a genuine inhabitant of the complete pinned FMS acceptance interface OR accept §16 finite-control boundary fallback; the interface itself is now explicit and must not be replaced by the finite discrete fragment | DRI + process-semantics reviewer | Pre-FCP | spec §13.9, this RFC §16 |
| ✅ P1b kernel_verified and bound to immutable commit; obtain independent process-semantics + Lean reviewer approval | DRI (commit binding complete 2026-07-27) + process-semantics reviewer + Lean reviewer (pending) | Pre-FCP | this RFC §4.2, `docs/qa/gate4-p1b-review-report.md` |
| Assign category/DPO, process-semantics, and Lean-assumptions independent reviewers | DRI | Pre-FCP | this RFC metadata / governance note |
| Enter FCP once theory gates met (§9 criteria) | DRI | post-review | this RFC §9 |
| **PRODUCT CONFORMANCE (POST-FCP, PER-PACKAGE)** | | | |
| Create package boundaries and conformance specification template | DRI | Post-FCP | `packages/` structure, `docs/conformance/product-certificate-requirements.md` |
| Each package: supply manifest, rule inventory, and per-rule ProductRuleProofBundle (DAG rank, Petri firing, π derivation, morphism view) | Package owners | Post-FCP, incremental | Per-package conformance gates |
| Each package: supply runtime operational facts (resource policies, authorization predicates, deletion/quiescence, fairness/ε bounds) | Package owners | Post-FCP, incremental | Per-package conformance gates |
| **REMOVED FROM GATES (incorrectly theory-blocking)** | | | |
| ~~Lift the closed finite multi-state P1c reference protocol to all 15 admitted non-fixture `Config` occurrences~~ | ~~DRI~~ | ~~Pre-FCP~~ | **SPLIT:** Theory has 60/60 reference (✓). Product packages instantiate for their rules (post-FCP per-package) |
| ~~Instantiate generic branching kernel across certified heterogeneous runtime admissions for all packages~~ | ~~DRI~~ | ~~Pre-FCP~~ | **MOVED TO PRODUCT:** Generic framework complete (✓). Each package supplies fairness/ε/stable-window premises (post-FCP per-package) |
| ~~Complete DAG/Petri direct rule-map proofs~~ | ~~DRI~~ | ~~Pre-FCP~~ | **MOVED TO PRODUCT:** Generic rankable-DAG and pre-net constructions complete (✓). Each package supplies rank/firing maps for its rules (post-FCP per-package) |

## 12. 2026-07-24 proof-scope correction

This section supersedes older “remaining” descriptions in §§8 and 11 where
they conflict. It records local Lean implementation evidence only. The RFC
remains **Draft / pre-FCP**.

1. **General finite DPOI.**
   `GeneralFiniteOpenDPOI` now proves the equivalence between finite,
   incidence-complete typed open hypergraphs and the full replete essential
   image in the adhesive typed-presheaf slice. For arbitrary categorical
   matches whose encoded rule legs and occurrence are monic, ordinary
   legality plus fixed-boundary retention yields an intrinsic two-pushout DPO
   witness. For two such parallel-independent matches, both residuals remain
   intrinsic and the standard concurrency diamond commutes up to the
   canonical right-image-preserving isomorphism. Both canonical DPO squares
   are additionally Van Kampen in the ambient adhesive slice. This removes fixed-host,
   thin-inclusion, and `InterfaceLocal` restrictions at that exact finite
   well-formed scope; it does not revive the refuted equivalence with the
   unrestricted slice.
2. **P1c finite native closure.**
   `P1cFullNativeRefinement` uses explicit intermediate protocol states and
   proves a full `ProjectionCertificate` for all 15 reference families
   against the complete family-tagged `Late.NativeStep` relation. Open/close
   and restriction retain their real second payload step; mismatch decision,
   reconnect, and quiescent delete are native. Exact classification,
   soundness, reflection, terminal equivalence, and signature versions are
   kernel-built. This closes the finite multi-state reference protocol, not
   the shared product-wide admitted rule family or all five certificate
   layers.
3. **FMS interface correction, not an FMS instance.**
   Lean proves the former split legacy powerdomain/coherence API inconsistent.
   The corrected interface requires divergence to be distinct from
   deadlock, and requires unit/divergence/deadlock/choice preservation in the
   same free universal property, together with strong-commutative Fubini,
   locally continuous action, exact parallel/action coherence, canonical
   hiding, and operational/world-indexed full abstraction. No inhabitant of
   `CompleteFMSAvailable` exists in this repository, so the real
   $\mathbf{Cpo}^{\mathbb I}$ domain-equation/full-abstraction obligation
   remains open. Binder-level abstraction/substitution and canonical
   restriction now satisfy exact round-trip equations, including nested
   binders. `FMSExactAcceptance` additionally pins stage transitions to
   unrolling plus powerdomain observation, restriction to the four action
   cases, synchronization to Fubini/map/multiplication, and parallel to the
   exact four-way choice. Its Table-2 case maps are still supplied data, and
   neither its exact nor the complete FMS availability proposition has an
   inhabitant.
4. **Finite heterogeneous probability bridge.**
   Every finite `EpochChain` now has a dependent `ChainTraceAgreement`
   covering its ordered native events, `DPOEvent` replay, signature-admission
   replay, and runtime execution-epoch alignment. A genuine
   Ionescu--Tulcea law on
   `Fin (number of events + 1)` follows this complete schedule almost surely.
   The final self-loop is administrative stutter and is never reported as a
   business event or admission. Feedback observation-opportunity alignment
   is still a separate scheduler obligation; an execution epoch is not
   silently identified with `opportunityEpoch`. A caller-provided Markov
   kernel satisfying almost-sure successor phases and terminal absorption
   now inherits the same complete common trajectory. A separate finite
   branching construction assigns mass directly to business choices, stores
   the sampled choice in the successor, distinguishes events with identical
   unmarked endpoints, and almost surely carries the corresponding dependent
   replay witness. A concrete heterogeneous runtime scheduler has not yet
   instantiated that generic construction.
5. **Static/operational anti-vacuity gate.**
   A new coherent certificate relates the static SMC functor to the
   operational state and rewrite maps by an exact Arrow-category commuting
   square for every step. The coherent four-projection theorem requires four
   such records. The categorical realization is quotient-aware: state-setoid
   equivalence is exactly represented-arrow isomorphism, its chosen
   isomorphisms are coherent, and step cells are representative-independent.
   `FMSGatedFourProjection` further requires a concrete
   `ExactFMSAcceptancePackage` and an `OperationalFMSPiCoherence` record which
   identifies mapped π states/actions/steps with that package's denotation
   and transition relation. No shared product execution package, exact FMS
   inhabitant, or such π/FMS bridge currently supplies the bundle, so this
   strengthens the acceptance boundary rather than closing the total theorem.
6. **Evidence and governance.**
   `formal/` is no longer hidden by a top-level ignore rule, but it remains
   untracked and `.gitignore` is modified in the current worktree. These
   results are not commit-bound evidence and have not received independent
   QA-L4 review. FCP has not begun, and ADR-0001 remains Proposed.

The remaining pre-FCP proof work is therefore narrower but still
load-bearing: construct or independently import a genuine complete FMS
inhabitant; decide whether runtime signature metadata is separated from pure
structural π state or represented by an enriched target; connect the general
DPOI and finite P1c results to one shared admitted source execution package
with substantive rankable DAG/Petri/static/resource and cross-layer coherent
certificates; instantiate the branching event kernel and prove
scheduler-level opportunity/fairness alignment; and obtain the required
independent reviews.

## 13. 2026-07-25 extension-family and execution correction

The following local Lean results refine §12 without changing this RFC's
Draft/pre-FCP status.

1. `ProjectionFamily` now indexes actual source and target
   `ExecutionPackage`s over every finite signature. Reindexing satisfies
   state/event identity and composition, and equality of verified event
   records makes replay commute with signature extension.
   `FourProjectionFamily` forces all four targets to share one source family,
   proves per-signature operational consistency, two-admission naturality,
   and four-target replay commutation. No production family inhabits this
   interface yet.
2. `FourProjectionSampledTrajectory` derives the source event, native step,
   verified DPO replay, exact endpoints, opportunity/runtime epoch equality,
   singleton epoch chain, and all four native target steps from one sampled
   branching edge. This is the complete fixed-signature common trajectory.
   Cross-signature admission remains the separate, correct
   `AdmissionReplays` case.
3. The request/accept bridge now has genuine unfiltered structural
   strong-late one-step soundness and exact success/wait/version equations.
   Full `StandardLateReflection` still needs derivative uniqueness under
   arbitrary alpha/structural representatives. Lean also proves that S4
   choice idempotence is not a rule of the current structural congruence, so
   it must be supplied by the intended equational/bisimulation layer.
4. The strict DAG scope now has both directions of the boundary: arbitrary
   typed open hypergraphs cannot all be ranked, while every graph carrying an
   explicit strict incidence rank has a concrete incidence-complete,
   boundary-preserving, acyclic DAG view. Production DPO rules still need
   rank preservation.
5. Authorized ballots, deduplication, order independence, all four quorum
   outcomes, and observed-party autonomy are kernel-checked. The admitted P1c
   positive support has a concrete monotone feedback bridge; the zero-mass
   reset is formally excluded from any pathwise monotone 0/1 evidence map.
   Product conflict and scheduling policy remain RFC decisions.
6. The equality-ordered finite-set functor exists on ωCPO, but Lean proves
   that neither it nor its `World ⥤ ωCPO` pointwise lift can carry the required
   continuous singleton unit on general ordered objects. This rules out the
   discrete fragment as the FMS powerdomain; it does not supply the Abramsky
   construction or domain/full-abstraction inhabitant. The external FMS
   source states in Proposition 2.2 that a suitable base-Cpo Abramsky
   powerdomain lifts pointwise to `Cpo^I`, then uses
   `A = μX. P(H X)` for
   `H X = N × (N ⇒ X) + N × N × X + N × δX + X`; Theorems 3.2 and 3.3
   state the finite and full closed strong-late full-abstraction results.
   Those paper theorems are source obligations, not Lean-kernel proofs or an
   axiom-free inhabitant of the local acceptance structures.
7. `ExactPositionalDPOI` upgrades the exact-positional object
   characterization to an explicit equivalence with the full subcategory of
   the adhesive typed-presheaf slice. It includes every typed natural
   transformation between exact objects and preserves and reflects
   monomorphisms, so fixed-host, thin-inclusion, and `InterfaceLocal`
   restrictions are absent within this scope. It does not assert an
   equivalence with the unrestricted slice, which still contains malformed,
   infinite, incidence-incomplete, and duplicate-boundary objects.
8. `FiniteHeterogeneousFourProjection` extends sampled common evidence across
   an aligned finite `EpochChain`. Almost every nonterminal phase has one
   sampled dependent mark, replay, execution-epoch alignment, and either a
   replayable business `DPOOccurrence` with four native target derivations or
   a distinct `AdmissionOccurrence`. `SourceFamilyAlignment` is explicit
   because the chain stores arbitrary existential execution packages.
   Pure reindexing cannot supply four target admission replays: the checked
   no-go theorem uses the fact that `Config.reindex` preserves
   `signatureVersion` while a replayed admission strictly advances it.
   Separate heterogeneous target-admission transitions and evidence are
   required.

The remaining load-bearing work is therefore production inhabitation rather
than another generic wrapper: exact P1b structural reflection, rank-preserving
DAG and declaration-order Petri maps for every admitted rule, all non-fixture
P1c occurrences and resources, heterogeneous target-admission transitions
and replay evidence, a heterogeneous authorized/fair stochastic
scheduler, a genuine complete FMS model and operational bridge, and
commit-bound independent review.

## 14. 2026-07-25 native-rule and generated-runtime update

This update supersedes the narrower implementation statements in §§12–13
without changing the RFC's Draft/pre-FCP status.

1. Legal typed π transitions now use `Step.StandardNativeStep`; all standard
   freshness and capture premises are part of relation membership. Every such
   transition erases to one native standard-late step. All fifteen P1c
   reference families, including mismatch decision, reconnect, and quiescent
   delete, have this proof.
2. All fourteen fixed-signature P1c families have a shared reference
   `ExecutionPackage` with exact verified event replay and four native target
   derivations. The three admitted graph operations additionally re-execute
   their concrete enabling and match fingerprint. Dynamic admission remains a
   heterogeneous `AdmissionReplays` edge.
3. The admitted-operation probability bridge now constructs the concrete
   `TrajectoryAgreement`, including selected event marks, exact adjacent
   `Config` replay, and epoch alignment. A separate finite executable
   heterogeneous runtime constructs its scheduler and Markov kernel, crosses
   one actual admission, and almost surely retains both business DPO
   occurrences, the admission occurrence, unique dependent marks, and four
   native target derivations on every edge. This closes non-vacuity for a
   finite reference scheduler, not product authorization/fairness/epsilon.
4. The finite positional DPOI scope is implemented: an explicit equivalence
   with the full exact-positional subcategory, arbitrary legal monic
   complements with Van Kampen squares, and parallel-independent concurrency.
   Counterexamples formally rule out replacing this target by the
   unrestricted presheaf slice.
5. The CPO layer now contains a real non-discrete finite strict computation
   object with separate divergence and deadlock. It does not supply the
   all-omega-CPO Abramsky powerdomain, omega-ideal free universal property,
   recursive domain solution, hiding/action coherence, or full abstraction.
6. Exact structural P1b reflection remains open only at residual coherence
   through arbitrary alpha/ACU/scope-extrusion chains. The complete state is
   proven unable to step, and every structural step from the established state
   is now exactly `tau` with a target congruent to complete. Requesting still
   requires the binder-substitution and `res(com)`/`open+close` residual
   theorem.
7. The fourteen fixed-signature business families now share replayable DAG,
   Petri, and morphism certificates. Every target transition contains its
   independent native matrix derivation and retains source event provenance;
   soundness, exact reflection, path coverage, terminal preservation, and
   verified source replay therefore refer to one occurrence. The reference
   graph/resource carrier is empty, so arbitrary product rank, pre-net,
   resource, static-SMC, and heterogeneous-admission obligations remain open.
8. Each concrete admitted mismatch/reconnect/quiescent-delete occurrence now
   has a four-way post-business classification: success, external wait,
   genuine deadlock, or an explicit productive infinite external-hold trace.
   The classes are pairwise disjoint and every endpoint denotes the same
   computed `Config`, replay record, four-view derivation, and admitted
   ownership evidence. The branch is an external disposition after one
   rewrite, not four different rewrites.
9. The complete local evidence gate passed for 234 Lean sources and 8889 build
   jobs, with zero forbidden proof placeholders and 487 kernel-dependency
   reports restricted to the recorded allowlist. This is uncommitted local
   evidence, not immutable provenance or independent review.

Consequently the remaining stop conditions are unchanged in kind but narrower
in scope: the genuine FMS construction/import, exact P1b residual reflection,
production rule-family/static/resource inhabitants, derivation of
authorization/fairness/stable-window/positive-epsilon premises, immutable
commit evidence, and independent QA-L4/FCP review. None is silently discharged
by the new reference witnesses.

## 15. 2026-07-25 P1b reflection-decomposition helpers and build restoration

This update adds kernel-checked scaffolding toward the open P1b
`StandardLateReflection` obligation and corrects two build defects in the
untracked `formal/` worktree. It does **not** promote any obligation or
change the RFC's Draft/pre-FCP status.

1. **P1b reflection decomposition.** `P1bStructuralLateBridge.step_decompose`
   is now kernel-checked: every `Late.structuralLateLTS.ObservableStep
   (mapState state) action target` decomposes into a structural congruence
   `Struct (mapState state) source'`, a native step `NativeStep source' action
   target'`, and a target congruence `Struct target' target`. This is the
   exact shape of the `Step.congr` constructor with the `Step.native` identity
   case folded in, and it is the verified substructure a completed
   `StandardLateReflection` proof must drive.
2. **Complete-state inversion.** `P1bStructuralLateBridge.complete_reflect`
   is kernel-checked: no `Late.Step` leaves the complete request/accept state
   through any structurally congruent representative, because structural
   congruence preserves prefix count and a native strong-late step requires a
   positive prefix count. This discharges the `complete` case of
   `StandardLateReflection`. A later exact free-subject/prefix-partition
   theorem also discharges the `established` case without a weak step or
   filter; only `requesting` remains open.
3. **Build restoration.** Two defects in the untracked worktree prevented a
   clean full build: `P1cAdmittedP1aCertificates.lean` referenced `Core.Package`
   types without importing `Cantilune.Core.Package`, and its regression test
   used unqualified `P1cAdmittedOperations.DAG.Step` identifiers. Both are
   corrected. The full `lake build` now completes successfully (8894 jobs),
   still with zero forbidden proof placeholders. This is a worktree build, not
   immutable commit-bound evidence.
4. **Implemented-scope limitation reaffirmed.** No inhabitant of
   `CompleteFMSAvailable` exists in this repository. The theorem currently
   implemented in the worktree is therefore bounded to the proven
   sublanguage (DAG/Petri/morphism reference views; π for the finite
   request/accept and P1c reference families modulo the open
   `StandardLateReflection` residual). This is an evidence boundary, not an
   adopted normative fallback. Under the currently effective draft, the full
   half-π (II) FMS domain-equation / full-abstraction obligation remains
   mandatory and explicitly unverified; only an FCP decision accepting §16
   can remove it from the P1 completion gate.

The remaining load-bearing work depends on the scope ruling proposed below.
In every case it still includes the `requesting` structural-residual
transport, production rule-family/static/resource certificates, scheduler
premises, immutable commit evidence, and independent QA-L4 review. Under the
currently effective draft boundary, a complete FMS inhabitant remains
mandatory. It ceases to be a P1 gate only if FCP accepts the finite-control
boundary proposed in §16.

## 16. 2026-07-25 proposed FMS scope resolution for FCP

**Decision status: REJECTED by DRI on 2026-07-27.** This section proposed making complete FMS optional for P1. The DRI has decided that full FMS powerdomain/domain/full-abstraction is **required** for P1 Core Theory FCP (see §23 D2). This section is retained for historical context only.

### 16.1 Proposed normative P1 boundary

1. P1's normative π projection is the typed, finite-control open-process
   presentation together with the native standard structural late-π LTS.
   Recursion and replication remain outside P1, as already stated in §4.3.
2. The four-projection theorem requires an exact native operational π
   certificate, including provenance, reflection, replay, resources, and
   terminal observations. It does **not** require a denotational
   `Cpo^I` full-abstraction theorem.
3. `FMSGatedFourProjection` remains a separate optional conformance gate.
   A caller may advertise the FMS denotational extension only after supplying
   a concrete `ExactFMSAcceptancePackage` and operational/FMS coherence.
   No current support object, finite powerset, or non-discrete finite CPO
   fragment inhabits that gate.
4. `Set^I` support naturality and finite `P_f(H-)` approximants remain useful
   mechanized components, but they are not to be called the finite FMS
   universality/full-abstraction theorem until the normal-form bijection and
   operational equivalence are themselves formalized.

### 16.2 Why this is a scope boundary rather than a proof shortcut

The source model distinguishes two results. Its set-theoretic interpretation
is universal for finite agents, whereas the whole-calculus domain model uses
Abramsky's powerdomain, the recursive equation `A = μX. P(HX)`, and external
recursive-domain-equation techniques. The extended abstract explicitly
states that the powerdomain is the free strict-semilattice construction on
CPOs and invokes standard domain-equation results for the initial solution;
it does not provide a Lean-ready construction of those foundations. See
Fiore--Moggi--Sangiorgi,
[A Fully-Abstract Model for the π-calculus, §§2.1–2.3 and §3](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).

Cantilune's admitted P1 calculus deliberately excludes the recursion and
guarded replication for which that whole-calculus CPO completion is needed.
Making the CPO theorem an optional, separately gated extension therefore
shrinks the advertised theorem to the actually selected runtime language; it
does not infer full abstraction from the finite support fragment.

### 16.3 Consequences and required ruling

- If FCP accepts this boundary, `CENTRAL-12` must be split into a normative
  finite-control operational/open-SMC obligation and an optional external FMS
  conformance obligation. The latter may remain uninhabited without blocking
  P1, and no document may advertise FMS full abstraction.
- If FCP rejects it, the present stop condition remains: P1 cannot be called
  theoretically complete until the all-ωCPO powerdomain, recursive natural
  initial domain solution, hiding/coherence, adequacy, and the process-pair
  full-abstraction theorem for the selected source-calculus scope are
  kernel-checked or imported through an approved, source-pinned trusted
  theorem policy. General algebraic compactness is one possible construction
  route, not a theorem or mandatory method stated by FMS. A separate
  domain-element definability requirement would first need an RFC definition
  of its carrier and quantifiers; it is not part of the cited
  full-abstraction theorem.
- In either branch, this worktree cannot advance RFC-0002 to FCP or
  ADR-0001 to Accepted by itself. Independent reviewers, immutable build
  provenance, and the Decision Owner's ruling remain mandatory.

## 17. Current proof-evidence correction (2026-07-26)

**Decision status remains Proposed.** The first
`ProductRuleAdmission.Certificate` is uninhabited for every parameter choice:
its embedded source admission is a step of one fixed-signature
`ExecutionPackage`, whose replay preserves signature version, while the same
fields require the admission to advance that version strictly. The
source-level theorem `certificate_uninhabited_fixed_signature_admission` now
kernel-checks the contradiction. This legacy record is therefore a negative
regression, not a product completion interface.

`Core/EpochSeparatedProjection.lean` and
`Theorems/HeterogeneousProductRuleAdmission.lean` now provide the
root-imported, kernel-built separation between fixed-signature business
coherence, heterogeneous source admission, and four independently typed
target admissions. `P1cAdmittedFourOccurrence.fixedOccurrence` further
constructs one substantive fixed-epoch DAG/Petri/native-late-pi/morphism
occurrence for every concrete admitted P1c operation, including exact source
and four-target replay.
`FiniteExecutableEpochProjectionReference.fourTypedViews` additionally
constructs a nonempty cross-epoch reference bundle: separate old/new target
packages, four fixed-epoch projections, four independently typed native
admissions, strict version advance, exact replay, and the real visible pi
registration input. The remaining DAG/Petri/morphism targets are finite
reference semantics, not production models. No product yet supplies the
cross-epoch coherent projection families, substantive production target
admission relations, or the full
rank/resource/authorization/fairness/positive-epsilon bundle.

For P1b, seven aggregate requesting metrics are demonstrably insufficient.
Adding exact free-name and free-subject sets excludes the known counterexample
and yields a nine-field necessary candidate. The root-built arithmetic and
syntax layer now derives two length-two active threads, exact native
`4 -> 2` consumption, residual send/receive polarity, and an outer
restriction/parallel normal form. The nominal-orbit module further proves
that the unique free payload is uncaptured and occurs in an active
output-value position, invariant under the full alpha/structural relation. A
native-constructor inversion module also excludes silent transitions from a
single sequential two-prefix thread, covers slow capture-avoiding
freshening, and extracts two residual one-prefix communication threads up to
structural congruence. The linked-core and endpoint modules prove all four direct/crossed
sync/close native cases and normalize their endpoints through alpha
conversion, restriction permutation, and scope extrusion. A native
parallel-zero counterexample fixes the theorem strength: the actual target
need only be structurally related to an existential linked endpoint, not
syntactically one. `StandardLateReflection` remains open at the
public/session/input-binder incidence localization and arbitrary source-side
`Struct`/native inversion bridge.

The pinned Lean 4.32.0 evidence gate now passes locally for 283 Lean files,
the root 8938-job build, and 667 dependency reports restricted to
`propext`, `Classical.choice`, and `Quot.sound`. This is dirty-worktree
evidence, not immutable commit provenance. The dependency audit also found
no existing Lean package that supplies the complete all-omega-CPO FMS stack;
the powerdomain, recursive natural initial domain solution,
hiding/coherence, adequacy, and process-pair full abstraction therefore
remain absent under the currently effective RFC boundary. The repository
also lacks the additional Cantilune acceptance proofs for exact per-label
native one-step correspondence, the strong powerdomain-observation
inverse-image laws, and divergence/deadlock disequality.

No central obligation is `proved` or `reviewed`. Immutable build provenance,
product-rule inhabitants, independent QA-L4 review, FCP, and ADR acceptance
are still absent, and this section records no approval or scope change.

## 18. 2026-07-26 labelled residual and operational closure checkpoint

The remaining P1b obligation is no longer native-rule selection, context
alignment, restriction garbage, or thread polarity. Kernel-built modules now
invert all four sync/close native constructors, preserve the guarded polarity
pair across the full alpha/structural orbit, and extract one shared
restriction context containing exactly one send/send and one receive/receive
thread. Separate envelope theorems normalize either two essential outer
binders or the scope-extruded one-outer-binder close case while removing only
fresh garbage restrictions. The full reflection theorem is proved equivalent
to a single target-up-to-structure linked-endpoint classifier.

`P1bNominalIncidenceBoundary` packages this as a single non-circular
`RequestingPolarizedNominalIncidence` proposition over the genuine split.
Kernel-checked theorems derive the up-to-structure endpoint classifier,
requesting reflection, and certificate from it. `P1bNominalIncidenceProof`
reduces its construction to `RequestingSplitSupportTransfer`, while
`P1bNominalIncidenceClosure` proves that transfer separately for
`syncLeft`, `syncRight`, `closeLeft`, and `closeRight`. The resulting
`requestingPolarizedNominalIncidence`, exact `requestingNativeResidual`,
`standardLateReflection`, and unconditional `pi_ra_certificate` are now
kernel-built. Exact target syntax, a fixed two-binder outer list, and
aggregate prefix/polarity counts remain correctly rejected by their checked
counterexamples.

This completes the P1b request/accept operational theorem in the working
tree, not the RFC or overall four-projection program. CENTRAL-13 is only
`implemented_unverified` even though the integrated dirty working tree passes
a fresh complete CI and axiom audit; the result must still be bound to an
immutable commit and approved by independent process-semantics/Lean
reviewers. The complete FMS
package or accepted FMS scope decision, production product-rule certificates,
FCP, and ADR acceptance remain outstanding.

The corrected heterogeneous product-rule interface is also now demonstrably
inhabited. A finite reference supplies coherent static/operational projection
families on both sides of a strict epoch admission, four target admissions,
a distinct ranked business step, resource/session policy, authorization,
fairness, and a positive-epsilon bridge whose probability-one edge is that
actual business step from unstable ready to stable done. This is an anti-vacuity witness
for the generic interface only: all four target families are identity
reference semantics. It does not discharge any production rule's DAG,
pre-net, pi, morphism, authorization, fairness, or convergence certificate.
The reference also checks that the business rule is unavailable before
admission and available afterwards, and that replay rejects a wrong rule or
wrong source. These strengthen interface non-vacuity without supplying any
production projection family.
The RFC remains Pre-FCP and this section records no scope decision.

## 19. 2026-07-26 FMS theorem-scope correction

This section corrects source attribution without changing the Proposed,
Pre-FCP decision state or any stop condition.

1. **Recursive solution.** The checked FMS source presents
   `A = μX. P(H X)` as an initial solution obtained by standard recursive
   domain-equation techniques. Cantilune therefore requires the continuous
   natural initial solution and its roll/unroll coherence. It does not require
   a general algebraic-compactness theorem unless a later RFC explicitly
   chooses that stronger local construction route.
2. **Full abstraction.** The source theorem quantifies over pairs of process
   terms: denotational equality is equivalent to strong late bisimilarity
   (with the corresponding open-congruence result). It does not state that
   every element of the recursive domain is syntactically definable. Any
   separate definability theorem is an additional Cantilune proposal whose
   carrier, approximation class, and quantifiers must be decided explicitly.
3. **Source-calculus boundary.** The FMS calculus includes guarded
   replication `!α.P`. Cantilune's current Lean `Raw.Proc` is finite-control
   and contains neither replication nor recursion. A theorem about that Lean
   syntax is therefore a fragment theorem, not an implementation of the FMS
   arbitrary-process theorem. Adding replication/recursion still triggers the
   existing scope stop and requires an RFC/ADR decision.
4. **Additional Cantilune conditions.** Exact per-label native one-step
   soundness/completeness, the strong
   `PowerdomainObservation.map_iff`/`multiplication_iff` inverse-image laws
   (including a divergence-observation policy), and a proof that designated
   divergence and deadlock are distinct are local acceptance conditions.
   They are not direct statements of the cited FMS full-abstraction theorem.

No complete or exact FMS acceptance package is inhabited by this correction.
The complete-FMS gate remains mandatory under the currently effective draft
unless FCP accepts §16, and the RFC remains Pre-FCP.

## 20. Exact action and finite-chain convergence update (2026-07-26)

This update changes neither the normative scope nor the Pre-FCP state.

The exact FMS action endofunctor `H` and its finite-world injection action are
now constructed on `World ⥤ ωCPO`, and both `H` and the actual unseparated
composite `P ∘ H` are locally continuous. The unseparated lower/Hoare monad
has chosen-product strong/commutative coherence. It is free for
arbitrary-supremum-preserving maps into complete-lattice targets. That
universal theorem is intentionally not identified with the required free
pointed continuous semilattice: bottom and empty deadlock still coincide.

The finite initial approximation tower is genuine, but its first connector
has no retraction and stage zero is not a fixed point. A new conditional
boundary accepts an externally constructed continuous-natural
`A ≅ P(H A)` together with initial-algebra and terminal-coalgebra evidence and
can transport it to the existing `AgentDomainSolution` interface. No such
witness, separated `CpoPowerdomainPackage`, or complete FMS package is
constructed.

For products, arbitrary finite cross-epoch chains now preserve all five
replays, exact rule and admission labels, strict signature versions, and
execution epochs. Their canonical source probability space carries a
five-view common trajectory retaining each dependent `DPOEvent` and all four
native target derivations. The direct FMS adapter retains actual rule and
admission transitions for one row only. It does not compose directly:
the row's eventful after epoch cannot equal a next adapter's empty before
epoch, and the record neither fixes one common FMS package nor stores
denotational endpoint continuity.

The arbitrary finite operational theorem is conditional on already supplied
exact five-view boundaries; the FMS-gated direct theorem is one-row. The
eight planned production
packages still have no package source trees or rule inventories, so their
certificate premises cannot be populated without a product-owner input.
The named Open-pi work also remains partial: alpha-safe bound-output labels,
a contextual category, and a disjoint partial tensor are constructed, while
checked no-go theorems exclude a nonempty identity from bound-name alpha
renaming alone and exclude unrestricted name-fusion interchange.

The mutable working tree passes the ordinary local gate for 343 Lean files,
8997 build jobs, and 987 audited declarations. The completion gate still
rejects 11 `implemented_unverified` and 7 `partial_scaffold` obligations.
This section records no FCP decision or scope relaxation.

## 21. NDωCPO/AFT and exact-boundary update (2026-07-26)

> Historical checkpoint: §22 supersedes this section's statement that the
> all-source solution set and enriched adjunction were still absent.

This update changes neither the normative complete-FMS scope nor the
Pre-FCP decision state.

The repository now contains the actual ordinary category `NDωCPO` of
omega-CPOs carrying least divergence, separate deadlock, and continuous
semilattice choice, with strict continuous homomorphisms. Small products and
equalizers give `HasLimits.{0}`, and the carrier functor preserves the
implemented limits. Its hom sets carry pointwise omega-CPO structure,
forgetful action is locally continuous, and composition is jointly
omega-continuous.

At this historical checkpoint the general-adjoint-functor route was still
conditional. Section 22 supersedes that state: the all-source cardinal
closure, solution-set condition, ordinary adjunction, and enriched hom
adjunction are now constructed. The earlier local empty-source universal
arrow and the finite strict-powerset counterexample remain valid supporting
results, but no longer describe the strongest adjunction result.

The named-boundary audit is also sharper. General input and bound-output
action labels and their derivative alpha quotient are constructed, and
finite hiding plus sync/close propagation are native one-step transitions.
Under the current concrete-name boundary representation, however, checked
obstructions exclude a total occurrence-preserving tensor and an exact-name
plug on nonempty boundaries. A total named Open-π SMC requires the public
renaming/fresh-supply/wire representation change and coherence proof already
listed in the research record; it cannot be inferred from alpha conversion.

A two-row common-FMS theorem carries the first eventful endpoint into the
second admission, fixes one common FMS package by type index, and stores
operational and denotational seams for four native
admission/rule/admission/rule edges. A later theorem now separately couples
two caller-supplied genuine production Ionescu--Tulcea laws and, through one
common exact-FMS seam, derives almost-sure native labels, exact DPO replay,
epoch/signature alignment, common actions, and consecutive denotational
endpoints. It does not construct either production kernel, their semantic
coupling, or the still-uninhabited exact FMS package.

The eight planned distributions still have no package source trees,
manifests, rule inventories, or package-owned rank, pre-net,
resource/session, authorization, fairness, stable-window, and
positive-epsilon facts. The generic certificate gates cannot manufacture
those operational inputs.

The exact mutable source state passes the ordinary local gate for 359 Lean
files, 9013 build jobs, and 1043 audited declarations, with zero
`sorry`/`admit`/`axiom`/`unsafe` and only `propext`, `Classical.choice`, and
`Quot.sound` in the axiom audit. `-RequireComplete` still rejects exactly 11
`implemented_unverified` and 7 `partial_scaffold` obligations. This is not
immutable or human-reviewed evidence, and it records no FCP decision.

## 22. All-source adjunction and separated-commutativity conflict (2026-07-26)

This update records a newly proved decision boundary; it does not make the
decision.

The mutable Lean tree now constructs the genuine all-source
`SolutionSetCondition.{0}` for the strict pointed continuous-semilattice
carrier functor. It therefore obtains the ordinary free functor/adjunction
and, using the pointwise hom omega-CPOs, an actual enriched hom equivalence
with continuous free extension and naturality in both arguments.

The canonical sequential Fubini map derived from that enriched free
extension is jointly continuous. Its pure-unit, two-variable naturality,
both unitors, reassociation, left-multiplication, and pure-left
right-multiplication laws are kernel-checked. It is strict for both
divergence and deadlock in its first computation argument. The
kernel-checked theorem `no_commutative_first_strict_pairing` proves that
adding swap commutativity identifies the two constants. Consequently the
current combination of:

1. `divergence_ne_empty`;
2. strict preservation of divergence and deadlock; and
3. canonical commutative Fubini

is inconsistent. The proved sequential coherence laws cannot repair the
failed symmetry equation, and no arbitrary two-effect multiplication or
interchange law is claimed.

The FMS source specifies commutative sequencing and strict semilattice
homomorphisms, but does not state the additional Cantilune disequality.
It also does not identify an infinite native tau run with the order-theoretic
bottom of the powerdomain. The source-compatible route can therefore retain
commutativity without requiring effect-level `bottom != zero`, and recover
process distinctions only through the recursive agent and full abstraction.
FCP must therefore choose whether to drop separation at this effect layer,
retain separation and use a noncommutative/evaluation-ordered effect, or
change the algebra/morphism theory and re-prove its semantic consequences.
No implementation may silently choose among these observably different
routes.

The canonical positional named-boundary experiment and sparse event-kernel
trajectory theorem narrow two other gaps, but do not remove governance or
product premises. Independent review found no endpoint renaming from either

## 23. DRI Decision Record (2026-07-27)

**Decision status: Decided by DRI (Joker-of-Gotham) on 2026-07-27.**

This section records all architectural decisions made by the Decision Owner to advance RFC-0002 and ADR-0001 toward FCP. These decisions resolve the conflicts identified in `docs/DECISIONS-REQUIRED-zh.md` and establish the normative P1 boundary.

### D1: FMS Architecture — Source-Compatible Route (DECIDED)

**Decision**: Adopt Option A — Drop `divergence_ne_empty` at effect layer; prove distinctions through recursive agent and full abstraction (source-compatible route).

**Rationale**:
- Resolves the kernel-proved inconsistency in §22 while maintaining FMS source compatibility
- Minimal rework; preserves existing sequential Fubini coherence proofs
- Aligns with FMS paper specification (which does not require effect-level separation)
- Process-level distinctions proven through full abstraction, not powerdomain bottom

**Implementation impact**: Low. No semantic changes to user-facing π operations.

**Updated**: §16 (FMS scope), §22 (commutativity conflict)

### D2: Full FMS Powerdomain Required for P1 (DECIDED)

**Decision**: Reject §16 proposal — Full FMS powerdomain construction (Abramsky powerdomain, recursive domain equation, hiding/coherence, adequacy, full abstraction) is **required** for P1 Core Theory FCP.

**Rationale**:
- Ensures complete theoretical foundation before product instantiation
- P1 finite-control restriction is a capability decision, not a theory scope decision
- Full FMS proves the π projection is well-founded even if P1 products don't use recursion
- Defers product-level recursion/replication to post-P1 without weakening theory

**Implementation impact**: High. Blocks P1 FCP until FMS domain construction complete.

**Updated**: §16 (status changed from "Proposed" to "Rejected"), §9 FCP gates, ADR-0001 acceptance criteria

**Consequence**: §16 finite-control boundary is **rejected**. Full FMS remains mandatory P1 gate.

### D3: Theory-First, Products Post-FCP (DECIDED)

**Decision**: Adopt theory/product split as documented in research log 0018. Core Theory FCP gates on abstract meta-theorems, generic interfaces, and reference witnesses. Product Conformance is a separate post-FCP gate per package.

**Rationale**:
- Eight product packages (Cantilune, Libretto, Cast, Baton, Cue, Chorus, Reprise, Cantilune Notation) do not exist yet
- Theory proves "for any X satisfying these interfaces, theorem T holds"
- Products later instantiate X with concrete operational facts
- Enables theory review and closure while products are in development

**Theory FCP scope (gates P1)**:
- Generic certificate interfaces (`ProjectionCertificate`, `ProductRuleProofBundle`, `ExecutionPackage`)
- Meta-theorems quantifying over satisfying inputs
- Reference witnesses (60/60 P1c matrix, heterogeneous runtime) proving non-vacuity
- Complete FMS powerdomain/domain/full-abstraction (per D2)

**Product Conformance scope (post-FCP, per-package)**:
- Package manifest and rule inventory
- Per-rule DAG rank functions, Petri firing maps, π derivations
- Runtime operational facts (resource policies, authorization predicates, fairness/ε evidence)

**Implementation impact**: Medium. Clarifies acceptance criteria; removes false dependency.

**Updated**: §3.1, §4.1, §4.3, §7.1, §9, §11, ADR-0001 acceptance criteria

### D4: Separate Metadata Layer for π Versioning (DECIDED)

**Decision**: Adopt Option A — Separate metadata layer (enriched π target with runtime version tracking).

**Rationale**:
- Pure π calculus has no "signature version" concept
- Dynamic admission advances version; pure π states remain version 0
- Metadata layer preserves standard π semantics while enabling runtime provenance
- Theory uses standard late-π LTS; products use enriched operational layer

**Implementation impact**: Medium. Requires metadata-enriched `Config` for products.

**Updated**: §4.3 P1c, ADR-0001 "2026-07-24 implementation-scope correction"

### D5: Extended DAG via SCC Handling (DECIDED)

**Decision**: Adopt Option B — Extended DAG projection that handles cycles through strongly connected component (SCC) decomposition.

**Rationale**:
- `DAGScopeObstruction` proves not all typed graphs are acyclic
- Option A (restrict to acyclic) would require products to prove/maintain acyclicity
- Option B (extend DAG semantics) provides full projection while preserving data-flow intuition
- SCC nodes represent "cyclic work units" in extended DAG view

**Implementation impact**: Medium. Requires SCC decomposition algorithm and extended DAG semantics.

**Updated**: §4.1 P1a, ADR-0001 Q2

### D6: Refined Nominal Boundaries with Fresh Supply (DECIDED)

**Decision**: Adopt Option B — Refined nominal boundaries with fresh-name supply and compositional plug/hide operations.

**Rationale**:
- Current concrete-name representation rejects nonempty same-name identity wires
- Option B enables compositional Open-π SMC without full positional redesign
- Balances implementation effort with formal compositionality requirements
- Fresh supply + renaming adequacy proven sufficient

**Implementation impact**: Medium. Requires fresh-name supply and renaming adequacy proofs.

**Updated**: §4.2 P1b, ADR-0001 "2026-07-26 NDωCPO and exact-boundary update"

### D7: Multi-State Protocol for Full P1c Reflection (DECIDED)

**Decision**: Adopt Option A — Multi-state protocol (3+ states per event) to achieve full standard-late reflection for all 15 P1c families including reconnect/delete.

**Rationale**:
- Current two-state protocol cannot reflect open handshake environmental transitions
- Option C (restrict protocol) would limit where reconnect/delete operations are valid
- Multi-state protocol enables complete reflection while maintaining native π steps
- High effort justified by achieving full four-projection consistency claim

**Implementation impact**: High. Requires redesign of P1c reference protocol and re-proof of 60-cell matrix.

**Updated**: §4.3 P1c, ADR-0001 "2026-07-26 labelled residual and product-interface update"

### D8: Maintain Individual Token Semantics (DECIDED)

**Decision**: Maintain current declaration-order pre-net with individual token provenance (reject switch to collective semantics).

**Rationale**:
- Individual token identity provides superior debugging and provenance tracking
- Differentiates Cantilune from standard Petri net tools
- Current SSMC construction already complete
- Collective semantics would simplify proofs but lose operational capability

**Implementation impact**: None (maintains current approach).

**Updated**: §4.1 P1a

### D9: Define Per-Projection Observable LTS Granularity (DECIDED)

**Decision**: Each projection must independently specify its observable quotient LTS, administrative-step policy, and granularity before FCP. This is a mandatory acceptance criterion, not optional.

**Rationale**:
- RFC-0002 clauses (2)-(3) require independently defined observable derivations
- "Same event" claims depend on granularity alignment
- Cannot defer this decision without undermining consistency theorem statement

**Required per projection**:
- Observable derivation domain $\mathcal{D}_i^{\mathrm{obs}}$
- State congruence $\equiv_i$
- Administrative-step hiding/granularity policy
- Explicit lift relation $\operatorname{Lift}_i$

**Implementation impact**: Medium. Requires formal specification per projection.

**Updated**: §3 (theorem statement), new mandatory FCP gate in §9

### D10: Package-Level Success Predicates with Generic Interface (DECIDED)

**Decision**: Success/deadlock distinction is package-level (each workflow defines its terminal success predicate), with generic interface defined by theory.

**Rationale**:
- Different workflows have different success criteria
- Central predicate would be inflexible
- Theory defines generic terminal preservation interface; products instantiate
- Aligns with theory/product boundary (D3)

**Theory obligation**: Define `TerminalPreservation` generic interface
**Product obligation**: Each package supplies success predicate for its workflows

**Implementation impact**: Low. Clarifies responsibility boundary.

**Updated**: §3 clause (4), §7, ADR-0001 Q5

### FCP Gate Revisions

Based on decisions D1-D10, §9 FCP entry requirements are updated:

**Theory FCP gates (all must be met)**:
1. ✓ FreeSMC universal property (kernel-built)
2. ✓ Positional DPOI categorical closure (kernel-built)
3. ✓ P1a generic operational family (kernel-built)
4. ✅ P1b request/accept operational (kernel_verified; commit 90e9eba bound; independent review pending)
5. ⚠ P1c multi-state protocol for full reflection (per D7; implementation in progress)
6. ✓ Heterogeneous trajectory (kernel-built)
7. ✗ **Complete FMS powerdomain/domain/full-abstraction** (per D2; mandatory, not optional)
8. ✗ Observable LTS specifications for all four projections (per D9; new mandatory gate)
9. ✗ Independent review (category/DPO, process-semantics, Lean-assumptions reviewers unassigned)

**Removed from Theory FCP gates** (moved to Product Conformance per D3):
- ❌ "arbitrary typed-DPO map" → Product packages supply rank functions
- ❌ "general rule-to-firing map" → Product packages supply pre-net semantics
- ❌ "product resource/quiescence/admission layers" → Product packages supply runtime facts
- ❌ "eight package certificates" → Product packages instantiate post-FCP

### Impact Summary

**Critical path decisions (D1-D4)**: Resolved. FCP can proceed once implementation complete.

**Scope decisions (D2, D7)**: Expanded scope — full FMS required, multi-state P1c protocol required. Increases P1 timeline but ensures complete theoretical foundation.

**Boundary clarifications (D3, D9, D10)**: Separate theory from products, require explicit specifications. Improves governance clarity.

**Implementation strategies (D5-D8)**: Selected specific technical approaches with clear rationale.
operand onto the realized middle and no quotient-Hom-to-raw adequacy bridge.
The finite-control no-go excludes only an explicitly assumed
arbitrarily-long-run realization, not structural or generated wires. None of
the eight planned packages supplies its rule or runtime fact set.

This RFC remains Pre-FCP.

## 22.1 Source-compatible effect scope and genuine-kernel update (2026-07-26)

The FMS source audit corrects one acceptance premise. The source requires a
commutative monad, semilattice zero/choice, and strict semilattice
homomorphisms, but does not require the powerdomain order bottom to differ
from semilattice zero. It also does not equate an infinite native tau run
with carrier bottom. The kernel theorem
`no_commutative_first_strict_pairing` therefore exposes an inconsistency in
Cantilune's additional combination of effect-level disequality, all-pairs
symmetry, and strict preservation of both constants; it does not refute the
original FMS route.

The canonical sequential Fubini construction now has kernel proofs of
two-variable naturality, both unitors, reassociation, left multiplication,
and pure-left right multiplication. Its symmetry remains refuted, and no
arbitrary two-effect interchange is claimed. Support separation alone does
not remove the conflict when both distinguished constants have empty
support, because that pair remains compatible.

The guarded-replication extension now has an exact free-name substitution
formula, self-substitution, support composition, an exact replicated-input
freshening equation, and process composition under explicit whole-syntax
freshness. Kernel counterexamples rule out stronger unconditional laws.
Strict deterministic-freshening equivariance remains false; full
communication closure must be stated up to alpha.

The probability bridge now operates over two genuine caller-supplied
Ionescu--Tulcea kernels. With an exact coupling and a common exact-FMS seam,
it derives almost-sure native labels, exact DPO replay, common actions,
epoch/signature alignment, chained denotational endpoints, and equality of
related-state denotations. It does not construct the kernels, coupling,
exact FMS package, or any of the eight absent product fact sets.

No architecture option is selected and no completion status is promoted.
This RFC remains Pre-FCP.

## 23. Experimental separated-support and guarded-replication route (2026-07-26)

This section records kernel-built evidence for an architectural option. It
does not select that option, relax the complete-FMS gate, or record an FCP
decision.

The mutable Lean tree now contains a finite-support partial commutative
separation algebra, support-preserving maps, and a separated tensor
presentation with explicit braiding, associator, unitors, pentagon,
triangle, and hexagon equations. Its operational frame theorem applies only
when the frame support is disjoint. Correspondingly, native late-pi actions
may be exchanged only when their complete name supports are disjoint. The
two orders are retained as exact labelled two-step traces, have the same
raw endpoint, and agree only in a replay quotient generated by explicitly
witnessed native commuting squares. Mere label-support disjointness is not
a quotient rule. A same-channel input/output pair remains dependent and performs its
native tau synchronization; it is not exchanged.

This support construction is now also lifted to a genuine omega-CPO
category. Each object explicitly supplies monotone support and a
`support_omegaSup_bounded` witness; continuous morphisms preserve support
exactly. The disjoint-pair carrier has a kernel-built omega-CPO, continuous
tensor map, natural braiding/associator/unitors, and the corresponding
pentagon/triangle/hexagon equations, including a nonempty finite-support
instance. This is an omega-CPO tensor presentation, not yet a bundled
monoidal category, powerdomain functor, monad, free adjunction, or recursive
FMS agent.

Support separation changes the quantification of exchange but does not by
itself avoid the two-strict-constant contradiction. The existing theorem
`no_commutative_first_strict_pairing` is not a finite-powerset no-go: for an
all-pairs symmetric pairing, strictness at two distinguished first-argument
constants identifies them. If both constants have empty support, they are
also compatible in a disjoint-support tensor, so the same argument applies
at that pair. A separated Cantilune effect must explicitly change the
support assignment, strictness law, or algebra/morphism theory. Any such
change alters the observable exchange law and requires FCP.

Finite-support allocation is now represented functorially over finite
world injections. Any two choices of a fresh representative are related by
a finite swap fixing the old image. A nonconstant world-indexed omega-CPO
support model supplies continuous renaming/permutation, allocation, and a
natural allocation/hiding retraction. This is nominal infrastructure, not
the FMS recursive agent or a proof that every element has a least finite
support.

For the actual unseparated omega-Scott world monad already in the
repository, shift commutes with the pointwise power functor, and the unit,
multiplication component, allocation, and pointwise Fubini equations are
kernel-built. These delta equations do not separate divergence from
deadlock. The concrete EP-bilimit construction now additionally produces a
continuous natural `A ≅ P(H A)` fixed point for this unseparated functor.
These results do not construct the required Abramsky powerdomain, algebraic
compactness, adequacy, or full abstraction.

A separate `RecursiveProc` candidate extension now adds only syntactically
guarded single-prefix replication (`repTau`, `repSend`, and `repRecv`).
It defines a deterministic alpha-freshening substitution algorithm and proves
its compatibility on embedded `Raw.Proc` terms. It also proves exact one-step
preservation and reflection on the embedded finite-control image, and proves
that a replacement absent from every syntactic name position has no capture
risk, including under replicated input. It constructs native
open/close/synchronization/replication rules and traces of every finite
length. A separate theorem gives an actual natural-number-indexed strong
native infinite tau run for replicated tau, proves raw zero has no native
step, and separates those two operational predicates. This is not
 powerdomain-level divergence/deadlock separation. The exact free-name
formula, self-substitution, support composition, replicated-input conflict
equation, and process composition under explicit whole-syntax freshness are
now kernel-checked. Counterexamples rule out unconditional syntactic no-op
and unrestricted composition. Strict permutation equivariance remains
false, so the remaining operational closure must be up to alpha. One-step
conservativity on embedded old syntax is closed. It does not alter the finite-control
`Raw.Proc` theorems. It is not
general recursive equations, guarded sums, the structural/alpha quotient
needed by the FMS source language, a total named Open-pi category, or a
denotational/full-abstraction result.

The recursive syntax now also has a generated alpha equivalence covering
`recv`, `new`, and `repRecv` binders, a quotient, and a finite-permutation
action on processes and late labels including bound output. Exact native
permutation equivariance is proved for prefixes, guards, choice, parallel,
restriction, open, and all three replication rules. It is not yet proved
for every numeric-freshening representative on the nose. The new
action-and-derivative alpha quotient nevertheless admits embedded,
synchronization, and close transitions through derivative-alpha and
target-alpha witness bridges, and proves strict equivariance whenever the
substitutions do not freshen. A kernel counterexample still shows why
literal equality cannot state the general result: supremum-based
deterministic freshening does not commute on the nose with an arbitrary
finite swap. A common-fresh-name construction and fuel induction now prove
the total executable substitution is permutation-equivariant up to
`RecursiveAlpha` across all numeric-freshening branches. Common-fresh
normalization for `recv`, `new`, and `repRecv`, followed by an outer
syntax-depth and inner alpha-derivation induction, now constructs
`RecursiveAlpha.substitutionCongruent`. Full sync/close and every other
recursive `NativeStep` constructor are consequently equivariant up to an
alpha-related target without a weak-step closure.

The recursive-domain route now constructs continuous embedding-projection
pairs, their singleton-seeded iteration under the actual agent functor,
coherent-thread inverse limits at every world, a natural world-model limit
with jointly monic projections, and the canonical continuous fold
`F L -> L`. `FMSCpoConcreteBilimitExhaustivity` now proves the finite
approximants monotone, coordinatewise exhaustive, and the unfold
approximants monotone. It therefore constructs the continuous two-sided
inverse and an unconditional `ActualFixedPointWitness` for the unseparated
omega-Scott `P ∘ H`. It does not construct the initial-algebra and
terminal-coalgebra fields of `ActualAlgebraicCompactnessWitness`, nor does it
turn this `P` into the source-compatible Abramsky powerdomain.

The named-boundary metadata route now has composable sort-preserving
renamings, exact unit/associativity/support-congruence laws, sequential
freshening, and an avoidance-preserving sorted fresh supply. It also
kernel-rejects a nonempty same-name atom wire under the present certificate,
because public support erases polarity while input and output supports must
be disjoint. This does not choose the new public boundary representation or
construct process renaming, a native wire, plug/hide adequacy, or a total
SMC. Those choices remain within this RFC/FCP.

Still absent are a source-compatible Abramsky powerdomain and recursive FMS
solution (and, if FCP retains the additional effect-level disequality, a
revised separated algebra/morphism theory), algebraic compactness, complete
agent restriction/hiding, adequacy, process-scope definability, full
abstraction, a total nonempty named-boundary
Open-pi SMC with native wire adequacy, actual production-kernel/coupling/FMS
inhabitants for the generic real-kernel theorem, and all eight package-owned
operational fact sets. The
package names and generic interfaces cannot supply rank, pre-net, resource,
authorization, fairness, stable-window, or positive-epsilon evidence.

The primary semantic references remain the
[Fiore–Moggi–Sangiorgi LICS paper](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
and the
[Abramsky–Jung domain-theory chapter](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf).
This RFC remains Pre-FCP.

## 23. Bilimit, recursive alpha, and monadic hiding checkpoint (2026-07-27)

This checkpoint supersedes earlier statements in this RFC that described
`ConcreteBilimitExhaustivity` or
`RecursiveAlpha.SubstitutionCongruent` as uninhabited premises.

The mutable Lean tree now proves the following additional closures without
adding postulates:

- `concreteBilimitExhaustivity` inhabits the approximation record and yields
  both canonical fold inverse laws, shifted-cone projection-limit
  preservation, and an unconditional continuous-natural
  `concreteActualFixedPointWitness` for the unseparated omega-Scott functor;
- `RecursiveAlpha.substitutionCongruent` is inhabited, and every recursive
  native transition constructor is unconditionally equivariant up to an
  alpha-related residual;
- the actual unseparated omega-Scott world monad carries `powerHiding`, with
  allocation, unit, multiplication, and chosen-Fubini coherence, including a
  concrete effectful support-denotation retraction.

The first two inhabitants are now constructed. They remain deliberately
narrow: the fixed point is for the unseparated lower/Hoare monad and is not
algebraic compactness, while alpha/substitution closure does not choose a
total named-boundary category. Monadic support hiding is still not an
`AgentDomainSolution.res`, operational adequacy, definability, or full
abstraction proof. The public named-boundary representation remains an
RFC/FCP decision. Finally, the repository still contains no package-owned
rules or runtime facts from which eight production certificates or two
production Markov kernels could be built.

The package-level theorem `no_distinguishedFubiniStrictness` also sharpens
the FMS decision boundary: independently of any finite powerset
representation, separated divergence/deadlock, commutative Fubini, and
first-input strictness for both constants cannot coexist. This does not
refute an Abramsky construction lacking the added disequality; it proves
that Cantilune's strengthened acceptance target cannot be completed without
an RFC/FCP change. The corollary
`no_strengthenedExactFMSAcceptancePackage` closes the same contradiction at
the complete `ExactFMSAcceptancePackage` boundary.

Therefore no central obligation is promoted to `proved` or `reviewed`, and
this RFC remains Pre-FCP.

## 24. Nominal separation and marked-occurrence checkpoint (2026-07-27)

The mutable Lean tree now contains two further, narrowly scoped closures.

First, every finite-world injection preserves and reflects disjoint finite
support. The result is instantiated for permutations and the allocation
map, lifted to equality of the actual continuous renaming maps, and used to
transport both compatibility and partial composition in the concrete
finite-support PCM. This is a nominal transport theorem for the existing
separation predicate. It is not a separated Abramsky powerdomain, a
commutative powerdomain monad, or a repair of the strengthened
two-distinguished-constant Fubini contradiction.

Second, the recursive strong-late operational layer now has provenance-
bearing native events and marked one-step derivations. Marks retain
choice/parallel paths, hidden synchronization and close channels, open and
restriction provenance, and the source of each replication step. Every
native raw or recursive one-step derivation has a mark and erasing that mark
recovers the original native derivation. A parallel residual square can
only be constructed from one occurrence in each parallel component,
complete event-support independence, and explicit source/residual freshness.
It yields the exact two orders as marked native traces with a common target.
Consequently, two same-channel synchronizations are not falsely independent,
and reversed branches of `(a.b) + (b.a)` cannot form a residual square.

The older label-only replay quotient is not thereby upgraded: load-bearing
independence results must migrate to the marked residual relation. Automatic
derivation of residual freshness from support evolution, an alpha-freshened
`DerivativeAlpha` residual square, and a general recursive structural-
congruence diamond remain separate obligations.

These results do not supply the decisions or external facts still required
by this RFC:

- the published FMS construction does not state the additional
  divergence/deadlock disequality used by Cantilune's strengthened package;
  keeping that disequality together with commutative Fubini and strictness at
  both distinguished constants is kernel-refuted and requires an FCP change;
- a total nonempty named-boundary Open-pi SMC still requires an FCP choice of
  public-boundary representation, polarity/usage, native wire realization,
  process renaming, and Hom equality/observation; and
- no production package supplies its rule inventory, ranks, pre-net,
  resources, authorization, fairness/stable-window, positive-epsilon facts,
  production kernels, or coupling. Generic interfaces cannot synthesize
  those facts.

No central status is promoted. RFC-0002 remains Pre-FCP and ADR-0001
remains Proposed.
