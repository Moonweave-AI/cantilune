# RFC-0002: Projection Consistency — What the Proof Buys, and the Four-Projection Consistency Theorem

| Field | Value |
|---|---|
| Status | **Draft** (pre-FCP) |
| Type | Architecture / Formal |
| Risk | S2 |
| Champion / Decision Owner | Joker-of-Gotham (DRI) |
| Required Reviewers | Architecture (second reader — **TBD, gap**), Formal-math reviewer (required for §4 proof — **TBD, gap**) |
| Created | 2026-07-23 |
| Updated | 2026-07-24 (proof-scope reconciliation) |
| Related | RFC-0001, ADR-0001, `docs/spec/formal-semantics.md`, `docs/research/0001-p1b-pi-bridge-audit.md`, `docs/research/0006-theory-closure-iteration.md` |

> **Governance note:** This RFC is the **生死线 (project life-line)** identified in ADR-0001. It is *not* primarily a proof document — the proofs live in `docs/spec/formal-semantics.md`. Its job in the main line is to state **what cantilune's runtime gains if the four projections are consistent**, why that gain is the whole point of the unified structure, and then the theorem + phased proof that must earn it. Per the DRI's decisions, π-projection consistency is **NOT by construction** and is proven on a **phased plan** (§4); all π-side claims are **待证 / unverified** until a proof exists.

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

| Projection | Clause (1) SMC-functor | Clause (2) event map | Clause (3) provenance/exhaustiveness | Clause (4) terminal observations | Overall |
|---|---|---|---|---|---|
| DAG | FreeSMC equation quotient exists; intended static target certificate incomplete | generic operational family over a supplied LTS isomorphism plus finite fixture; arbitrary typed-DPO map absent | generic reflection theorem over supplied data; intended instance absent | finite fixture only | **open** |
| Petri | FreeSMC quotient and declaration-order finite fixture exist; intended static target incomplete | generic operational family plus finite firing fixture; general rule-to-firing map absent | generic reflection theorem over supplied data; intended instance absent | finite fixture only | **open** |
| Morphism | by construction (identity view) | by construction | by construction | by construction using the same success predicate | **按构造一致** |
| π (half-π II) | typed open-process presentation and a mathlib SMC instance exist; nonconstant `Set^I`/`Cpo^I` support objects, discrete-CPO finite power, allocation, continuous support hiding/retraction equations, and finite `P_f(H-)` approximants exist; the full FMS powerdomain/domain/full-abstraction instance does not | the finite P1c reference matrix has 60/60 native cells and four event-indexed certificates that are exact only in their declared restricted target relations | all 15 π events erase to independent alpha/structural late-π derivations; mismatch, reconnect-as-delegation, and quiescent shutdown are native one-step witnesses, but the open reconnect/delete encodings have extra raw late-LTS transitions | complete only for the restricted finite reference relations, not the whole standard late LTS | **restricted reference P1c operational layer closed; full reflection/general/static/FMS layers open** |

## 4. Phased proof plan (DRI decision: 明示分期)

The proof is phased not for mathematical convenience but because **each phase unlocks a different capability**, so the project can move forward on what is proven without waiting on the hardest line.

### 4.1 P1a — Corrected three-projection consistency work

- State $P_{DAG}$, $P_{Petri}$, $P_{Mor}$ as SMC-functors explicitly.
- Show each preserves $\otimes$, $\circ$, $\sigma$, $I$.
- Show each lifts $R$ to its target rewriting (node-advance / firing / identity-redex).
- **Petri choice:** use declaration-order pre-nets/free SSMCs for individual-token provenance. The primary-source audit rejects the former global Eckmann–Hilton rationale; the design choice remains, for a corrected reason.
- **Rewrite qualification:** the former F2 (“every strong monoidal functor preserves DPO rewriting”) is false. Strong monoidality does not imply preservation of pushouts. DAG and Petri require explicit rule/derivation maps after $R$ is defined.
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
  three such certificates compose as a P1a family. This theorem does not
  construct the intended DAG/Petri semantics or their static/resource/
  admission layers.
- **Five-layer family:** a second polymorphic constructor combines three
  already-supplied static/operational/admission/resource/terminal
  certificates and proves simultaneous native rewrite, admission, resource,
  and terminal results. It does not manufacture the intended DAG/Petri values
  or arbitrary DPO rule maps.
- **Capability unlocked only after those proofs:** three-view drift-free execution is not yet earned.
- **Output/status:** static construction partly drafted; morphism identity case complete; DAG/Petri rewrite clauses open.

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

- Extend P1b's bridge to finite-epoch half-π (II): post-handshake conversation,
  unrestricted name mobility within an epoch, delegation, free/bound output,
  choice/match, dynamic partners, and signature admission. Internal recursion
  and replication are outside this RFC.
- **Capability (if proven):** the open-ecosystem case — agents that, at runtime, talk to partners unknown at authoring time — becomes fully consistent too.
- **Current matrix:** the audit vocabulary has 15 source events and four
  projection columns, hence 60 typed cells. The finite reference calculus now
  has 60/60 non-reflexive native cells. DAG uses rank-certified acyclic graph
  rewrites, Petri uses identity-bearing individual-token firings, morphism is
  the total identity view, and π retains its native typed derivation. Four
  separately named restricted target relations have soundness, reflection,
  terminal, and signature-version `ProjectionCertificate`s inside those
  relations. This is not full reflection for the whole raw standard-late LTS:
  the open reconnect and quiescent-delete encodings admit additional visible
  environmental transitions. Their finite step shapes still
  share the same ready-event/completed-event fixture: DAG steps are not yet
  derived from arbitrary DPO matches and Petri steps are not yet derived from
  a general enabling equation. Thus this closes reference coverage, not an
  arbitrary product-rule theorem from the general DPOI/Petri/FMS semantics.
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
  target. This is an executable ordinary node/edge fragment, not yet the
  general typed-open-hypergraph DPOI semantics.
- **Concrete event/epoch probability bridge for those occurrences:** each
  occurrence now generates an `ExecutionPackage` whose positive-mass business
  transition carries that exact replayable `DPOEvent`, followed only by an
  explicit external completed hold. Every business-labelled trajectory
  position has the same DAG/Petri/native-late-π/morphism derivation and both
  endpoint epochs; every finite subsegment has exact stored event endpoints,
  endpoint-free whole-segment replay, and fixed runtime-signature alignment;
  the almost-sure common-trajectory theorem is instantiated. This is a
  fixed-signature one-occurrence package, not a heterogeneous-signature
  multi-event epoch scheduler.
- **Remaining binding condition:** generalize the 60 reference witnesses to
  every admitted source rule and connect the four operational certificates to
  the same static SMC, resource, admission, and replay semantics. The
  amendment remains Proposed until the Owner/DRI and process-semantics
  reviewer accept it; implementation evidence does not itself accept the RFC.
- **Status: 待证 beyond the restricted reference relations.** The earlier
  missing-native-witness stop is lifted, but the full-standard-late-reflection
  obstruction is not. Full P1c remains open until an accepted closed/restricted
  encoding has exact transition classification and the general five-layer
  certificates share one execution package.

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

## 8. Open questions

1. ~~Indexing category $\mathbb{I}$ and target variance~~ **RESOLVED 2026-07-23**: finite ordinals + injections with $up$/$swap$; target is covariant $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$. Nonconstant support functors and a pointwise support-model commuting instance now exist. Remaining: construct the actual FMS agent/powerdomain model, an adequate plug/hide interpretation, and supported-process renaming needed for a genuinely natural nominal denotation.
2. Granularity alignment: does one π interaction step correspond to one source event, or many? (affects clauses 2/3 for π, and hence the granularity at which "same event" is claimed).
3. Whether P1b's sublanguage is expressive enough to be useful (if not, re-evaluate half-π (II) vs session-typed — the §1 capability table is the arbiter: if the sublanguage buys no useful agent-to-agent replayability, the choice must be revisited, not quietly shrunk).
4. Second reviewer / formal-math reviewer assignment (governance gap).
5. **DAG/Petri rewrite maps:** define the exact $R$ and prove each non-identity projection maps each rule to a legal target derivation. The pre-net target choice is resolved; rewriting preservation is not.
6. **P1b formal object:** define request/accept BNF, configurations, $R_{\mathrm{RA}}$, freshness, substitution, and the split between $E_{\mathrm{stat}}$ and the operational encoding.
7. **Observable LTS and terminal predicates:** independently define each state congruence, observable derivation domain, administrative-step policy, and success predicate; prove clause (4). $(C,R)$ alone does not classify a stuck state as successful or deadlocked.
8. **P1c generalisation:** the finite reference calculus closes all 60
   event-indexed cells and four operational certificates only in their
   declared restricted target relations. First close the selected protocol's
   whole-standard-late transition classification; then construct
   provenance-sharing native
   DAG, reconfigurable-Petri, π, and morphism derivations for every admitted
   general rule and connect the five certificate layers.
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
   endpoint-free replay, and fixed runtime-signature alignment. What remains
   is a heterogeneous-signature dependent joint transition kernel crossing
   certified admission boundaries, real general-presheaf DPO
   match/complement/policy re-execution, and derivation of the stable region,
   stable-window, fairness, and positive-$\varepsilon$ witnesses for each
   intended product package.

## 9. FCP summary (not yet entered)

Pre-FCP/M1. Entering FCP requires: corrected P1a static and rewrite proofs, P1b target redesign plus proof or honest fallback, formal-math reviewer assignment, and Q1–Q7 closure.

## 10. Decision record

- **Phased proof adopted** (DRI decision 2026-07-23): P1a (three non-π projections) + P1b (π sublanguage) + P1c (deferred π full). The audit corrects P1a from “three by construction” to the statuses in §3.1.
- **π projection is 待证 by design** (half-π (II) decision); no by-construction claim for π.
- **Fallback discipline** binding: unproven ⇒ reduced subset + unverified marking.
- **RFC reframed (this revision):** from a proof document to a "what the proof buys" document; proofs remain in the spec, capability mappings added per phase (§1, §2, §4).
- **Independent audit disposition (2026-07-23, historical):** reject the non-standard `|` tensor and the “bisimulation quotient is required” conclusion; return P1b to C0 target/typing redesign. The later §4.2 implementation decision now selects the replacement dual architecture; it does not change the unproved status.
- **Source-audit correction:** retain pre-net semantics for individual-token/order provenance, not because of a claimed global Eckmann–Hilton collapse; reject generic F2 because strong monoidality does not imply pushout preservation.
- **P1c native-rule amendment proposed (2026-07-23):** the π syntax now has a
  proof-guarded mismatch constructor; reconnect is native delegation and
  quiescent delete is a native shutdown handshake. The finite reference
  matrix now has 60/60 native cells and four-view event-indexed operational
  certificates in restricted target relations. This does not establish full
  reflection for the whole raw standard-late LTS. No weak-step substitution
  is authorized.

## 11. Tracking

| Artifact | Status |
|---|---|
| `docs/spec/formal-semantics.md` (definitions + proofs) | Draft corrected by independent audit; §12 and §13 no longer overclaim |
| FreeSMC / DPOI foundation | The generated FreeSMC quotient, actual mathlib category/monoidal/symmetric instances, and the arbitrary-target monoidal natural-isomorphism comparison and uniqueness theorem kernel-build. The full typed-presheaf slice is adhesive; arbitrary monic incidence matches have a complement exactly under the explicit gluing condition, witnessed complements are unique up to compatible isomorphism, fixed open boundaries lift explicitly, and standard parallel-independent derivations have general residuals and a canonical concurrency isomorphism. Active-support normalization preserves concrete morphism identity/composition and sends globally injective concrete matches to typed-slice monomorphisms. Intrinsic finite positional hypergraphs are full and faithful into, and equivalent to, their well-formed essential image, which is closed under the constructed complements, second pushouts, and residuals. This is not an unconditional M-adhesive equivalence or whole-slice equivalence; the latter is false even for finite objects, as a kernel-checked malformed-incidence witness shows. The remaining decision is which correct restricted category is normative |
| P1a proof | A reusable operational certificate family and nonempty finite DAG/pre-net/morphism values kernel-build. A typed self-loop counterexample proves there can be no total incidence-preserving strict-DAG projection on all typed open hypergraphs, so the production source must be restricted by acyclicity/rankability (or the target changed). Concrete intended restricted static/resource/admission/DPO maps remain open |
| P1b proof (or fallback) | **Finite reference calculus implemented; full theorem incomplete.** Alpha/structural finite-control late-π, native one-step erasure, finite closed request/accept reflection, a genuine pointwise finite-power monad, locally nameless supported-process functor, finite `P_f(H-)` stages, and a concrete support-level OpenPi commuting instance kernel-build. `CompleteExternalFMSTheoremPackage` now records the full powerdomain coherence, exact world/action shape, coherent restriction, domain, and strong-late full-abstraction acceptance boundary. `CompleteFMSAvailable` has no inhabitant: the Set/CPO initial solution, Abramsky powerdomain/domain model, adequate hiding, and full abstraction remain open |
| P1c proof | Explicit finite 60-cell reference matrix is 60/60 native. Four event-indexed operational certificates prove soundness/reflection inside their declared restricted target relations, and every π cell erases to an independent standard late-π derivation. This is not full reflection for the whole standard late LTS: the current open reconnect and quiescent-delete source processes also admit visible environmental outputs, yielding a kernel-checked impossibility theorem for the actual process map. A separate closed redesign gives genuine strong native $\tau$ steps for four internal event families and now classifies every native transition from those four sources exactly. It still cannot produce a full event-isolated certificate: the closed open/close endpoint has a further payload $\tau$ step, and Lean proves the current two-state source LTS cannot reflect it. Mismatch, reconnect, and quiescent delete additionally have computed-Config DPO/Petri/late-π/morphism/replay common derivations. A reviewed multi-state/terminal protocol choice, the other twelve admitted occurrences, and the general static/resource/admission layers remain open |
| Stochastic feedback bridge | A genuine Markov kernel, Ionescu--Tulcea trajectory law, measurable not-hit events, and conditional almost-sure bridge kernel-build. Deterministic and seed-randomized event-path couplings both forget exactly to the state law; the latter can retain different native event identities for identical endpoints. On those same probability spaces, every finite subsegment carries its ordered native event identities, exact `ObservableLTS.Path`, endpoint-free whole-segment `DPOEvent` replay, the exact stored source/target of every event, opportunity alignment, and fixed runtime signature epoch. The finite-height expectation bound is derived from the concrete kernel phase tails (`H/ε`), and the admitted P1c one-phase instance proves an expected count at most one. `opportunityEpoch` is not the runtime epoch, and no heterogeneous-signature stochastic `EpochChain` yet crosses certified admissions on one probability space. General-presheaf-DPO executable replay and construction of stable-window/fairness/positive-$\varepsilon$ premises from every product package remain open |
| Research/evidence logs | source audit complete; local build evidence at `formal/build-evidence/2026-07-23-local.md`; human QA-L4 review pending |
| Citation verification (spec §11) | Primary sources verified; global Petri collapse and generic F2 rejected; “Gadducci–Montanari, Functorial Semantics…” corrected to Meseguer (2005) |
| Formal-math reviewer | To assign |
| Formal simulator (§5 checkers) | Post-FCP |

## Next Steps

| Action | Owner | Due/Review | Canonical Link |
|---|---|---|---|
| Decide that the normative graph layer is the adhesive typed-presheaf slice plus the finite well-formed positional essential image (not the refuted whole-slice equivalence), then connect its closed DPO derivations to restricted DAG/Petri static and rule maps | DRI + formal-math reviewer | Pre-FCP | this RFC §4.1 |
| Construct a genuine inhabitant of the complete pinned FMS acceptance interface and instantiate the OpenPi commuting bridge; the interface itself is now explicit and must not be replaced by the finite discrete fragment | DRI + process-semantics reviewer | Pre-FCP | spec §13.9 |
| Choose and review a closed/restricted P1c protocol encoding (or explicitly change the observation/source LTS in RFC), prove full standard-late reflection for that choice, and lift all 15 events to admitted non-fixture occurrences without weak steps | DRI + process-semantics reviewer | Pre-FCP | this RFC §4.3 |
| Extend the event-labelled coupling across certified heterogeneous signature admissions on one dependent probability space; make replay execute general presheaf-DPO match/complement/policy evidence; discharge stable-window, fairness, and positive-$\varepsilon$ hypotheses for each concrete runtime package | DRI + probability reviewer | Pre-FCP | research log / feedback formalization |
| Construct the one shared source execution package and prove `four_projection_consistency` | DRI + all three reviewers | Pre-FCP | formal proof manifest |
| Assign formal-math reviewer | DRI | Pre-FCP | this RFC metadata / governance note |
| Enter FCP once §9 gates met | DRI | post-review | this RFC §9 |
