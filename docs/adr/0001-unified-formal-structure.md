# ADR-0001: Unified Formal Structure for Cantilune

| Field | Value |
|---|---|
| Status | **Proposed** (implementation decisions ratified 2026-07-27; human review and final DRI signature pending) |
| Date | 2026-07-23 |
| Last reconciled | 2026-07-27 (DRI decisions D1-D10; theory/product boundary; FMS scope; acceptance criteria updated) |
| Decision Owner | Joker-of-Gotham (DRI) |
| Reviewers | DRI (Joker-of-Gotham, temporary for all roles; COI documented in docs/governance/reviewer-assignments.md; external reviewers to be recruited post-implementation) |
| Related | RFC-0001, RFC-0002, `docs/spec/formal-semantics.md`, `docs/research/0001-p1b-pi-bridge-audit.md` |
| Risk | S2 |

## Context

RFC-0001 establishes `cantilune` as an agent-orchestration framework whose core is a **unified formal structure** subsuming four formalisms as aspects rather than choosing among them. The structural decision is the first irreversible architectural choice: every downstream phase (executor, comms, observability, eval) depends on it.

The triage decision (2026-07-23) explicitly chose this unification over single-formalism alternatives, on the reasoning that each formalism owns a distinct facet of orchestration and each facet maps to a distinct baseline failure mode:

| Formalism | Facet | Baseline failure mode addressed |
|---|---|---|
| DAG | Presentation / data-flow clarity | Cursor (fixed shape $\Rightarrow$ limited expressiveness) |
| Petri net | Concurrency / resource essence | Codex (missing explicit termination and resource-bound evidence $\Rightarrow$ uncontrollable) |
| π-calculus | Communication essence | Codex/A2A (informal comms $\Rightarrow$ unpredictable flow) |
| Morphisms (category theory) | Composition / mapping essence | OpenClaw (no parsimonious core $\Rightarrow$ bloat) |

## Decision

`cantilune` adopts a **unified formal object**, working name **`CantiluneGraph`**, with the normative design target of four projections grounded in the four formalisms. Those projections are **required to become consistent views of one object** through event-preserving functorial mappings; this is an acceptance criterion, not the current proof state.

### Projections

1. **DAG projection** — the typed data-dependency graph. Edges carry **data contracts** (schema + pre/post-conditions). Owns expressiveness and the "what depends on what" presentation.
2. **Petri projection** — the concurrency/control layer. Places model **resources** (context window, tool rate limits, human-attention slots); transitions fire on token readiness. Owns resource and concurrency invariants plus explicit termination/liveness proof obligations; boundedness alone is not termination.
3. **π-calculus projection** — the communications layer. Inter-agent channels as named processes; formal semantics for dynamic topology and channel mobility. Owns A2A comms essence.
4. **Morphism projection** — the composition layer. Agents/operations as morphisms in a category; orchestration $=$ composition. Owns minimal precise composition/refactor semantics.

### Consistency requirement (normative)

The framework **must** define functorial mappings between projections such that a fact in one projection has a well-defined interpretation in the others — e.g., a DAG edge corresponds to a Petri token-flow path corresponds to a π-calculus channel message corresponds to a morphism composition. **Without this, the four projections are four disconnected models and the "unified structure" claim is false.** This consistency proof is a P1 deliverable and a gate for ADR-0001 acceptance.

**Status qualification:** this paragraph is the normative target, not an established theorem. The 2026-07-23 audit addendum below records that only the morphism identity case is complete; the other rule maps remain open.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| DAG only | No formal concurrency/termination (weak vs Codex); no comms essence; reproduces "just DAG" (LangGraph-equivalent) |
| Single formalism (Petri / π / morphism) | Loses the other facets; each facet maps to a distinct failure mode the DRI wants addressed |
| Category theory as the sole foundation | Maximally general but abstract and hard to tie to concrete eval wins; inaccessible to the target ecosystem |
| Four disconnected models glued by code | Reproduces OpenClaw bloat; no formal consistency; observability-as-structure fails |

## Consequences

**Positive (conditional on the acceptance gate):**
- Would address all four baseline failure modes once the corresponding projection theorems are actually proven.
- Defensible vs LangGraph (combinatorial wedge: typed edges + resource semantics + model-decoupled routing + observability-as-structure).
- Observability, replay, and deadlock classification follow only after the
  observable quotient LTSs, event-lift/exhaustiveness relations, shared event
  identity, granularity policies, and terminal predicates are independently
  defined and proven consistent.
- Phased extension is natural (add projections incrementally).

**Negative / risks:**
- Specification complexity: the functorial-consistency requirement is non-trivial and is the main technical risk. **Mitigation:** make the consistency proof a P1 gate; if it cannot be shown for all four, reduce to the subset that is consistent and document the reduction. **Status update (2026-07-27):** Generic consistency interfaces and reference witnesses are complete. Product-specific instantiation (rank functions, firing maps, resource policies) are Package Conformance obligations that do not block Core Theory FCP.
- Scope/bloat risk if projections accrete without parsimony. **Mitigation:** phased plan (RFC §13); each projection must clear its eval claim.
- Reviewer gap: no second reviewer yet. **Mitigation:** gate ADR-0001 acceptance on reviewer sign-off.

## Open questions for ADR-0001 (to resolve before acceptance)

1. Concrete syntax/type-system for `CantiluneGraph`. — **Partially resolved:** see `docs/spec/formal-semantics.md` v0.1 (SMC $C$ $+$ rewriting $R$); Q4 (policy DSL) still open.
2. The functorial mappings between projections — stated precisely, not hand-waved. — **Clarified (2026-07-27):** Theory establishes generic certificate interfaces (`ProjectionCertificate`, `ProductRuleProofBundle`) and reference witnesses (60/60 P1c matrix). Products instantiate those interfaces with concrete rule maps. Generic DAG rankable-graph projection and Petri pre-net construction are complete; product-specific rank functions and firing maps are Package Conformance obligations, not theory gates.
3. What is the minimal consistent subset if full four-way consistency cannot be proven? (fallback) — **Resolved as policy:** RFC-0002 §6 binds the fallback (reduce π to proven sublanguage, mark rest unverified); P1c (full π mobility) explicitly deferred.
4. Policy DSL expressiveness vs termination guarantees (interacts with the Petri projection). — **Still open.**
5. Ownership of state congruences, administrative-step policies, observable
   derivation domains, and successful-terminal predicates. — **Resolved:** see
   `docs/spec/formal-semantics.md` and RFC-0002 clause (4).

## 2026-07-23 follow-up decisions (recorded here as the structural ADR of record)

- **Unified object concretized:** $\text{CantiluneGraph} = (C, R)$ — SMC $C$ (static) $+$ string-diagram rewriting $R$ (dynamics). Replaces the earlier 6-tuple sketch $(N, E, S, T, C, M)$, which was a container, not a unity.
- **π-projection scope (half-π (II)):** request/accept dynamic channel creation + finite-epoch post-handshake conversation and mobility, without internal recursion or replication. The verified FMS reference uses covariant functor categories, not the contravariant presheaf notation previously used here. The proposed implementation now selects a typed open-process SMC plus a pointwise-cartesian FMS denotational route, with a mandatory commuting theorem; consistency remains **待证, not by construction**.
- **Dynamics:** string-diagram rewriting (not bare LTS). Once concrete event records, independently specified observable quotient LTSs, event lifts, terminal predicates, and all projection maps are defined and proven, one execution event is intended to have four formal readings without terminal-state drift; this is not yet established.
- **Proof strategy:** 明示分期 (phased, explicit) — P1a for the three non-π projections + P1b π sublanguage + P1c deferred π full, with binding fallback. The per-projection statuses are governed by RFC-0002 §3.1, not the original “three by construction” expectation.
- **2026-07-27 DRI Decisions:** All architectural decisions D1-D10 resolved (see §”2026-07-27 DRI Decision Record and ADR Acceptance” below). Key decisions: (D1) source-compatible FMS route; (D2) full FMS required for P1; (D3) theory-first, products post-FCP; (D4) separate π metadata layer; (D5) extended DAG via SCC; (D6) refined nominal boundaries; (D7) multi-state P1c protocol; (D8) individual token semantics; (D9) per-projection observable LTS required; (D10) package-level success predicates.

## 2026-07-23 independent-audit addendum

This addendum corrects proof status and source usage; it does **not** select a replacement π target or alter the unified-structure decision.

| Field | Result |
|---|---|
| Classification | Formal architecture audit; S2; QA-L4; Pre-FCP/M1 |
| P1a | Static construction partial; morphism identity complete; DAG/Petri rule maps open |
| P1b A–B | Verified; target variance corrected to covariant $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$ |
| P1b C | Handed-off non-standard π-parallel tensor rejected as ill-typed |
| P1b D | Pointwise-cartesian conditional theorem identified; actual object/generator map absent |
| P1b E | Not well-formed until request/accept BNF and $R_{\mathrm{RA}}$ are defined |
| Disposition | **Iterate, not Promote**; ADR remains Proposed |

The audit also rejects two load-bearing shortcuts: strong monoidality does not imply preservation of DPO pushouts, and a bisimulation quotient is neither necessary nor sufficient to turn π process elements into the required target SMC.

## 2026-07-23 implementation-decision addendum

Subsequent to the independent audit, the implementation scope selects both
targets instead of choosing one as a substitute for the other:

1. a typed open-process SMC, where interfaces are objects, composition is
   plugging plus hiding, and tensor is parallel composition; and
2. the covariant FMS functor-category route with its pointwise cartesian
   tensor, where π parallel remains an internal operation on the agent object.

Acceptance requires a commuting and observational-compatibility theorem from
the typed route, through erased native π, to the pinned FMS interface. Native
one-step source events may not be silently weakened to $\tau^*$.

This addendum selects the proof architecture only. The current unreviewed Lean
tree now kernel-builds the presented open-process SMC, native erasure, finite
closed request/accept and one-delegation certificates that reflect every
native action from their mapped states, finite-control alpha/structural
late-π, the genuine pointwise finite-power monad, natural supported-process
support semantics, finite `P_f(H-)` stages, and a conditional support-level
FMS commutation theorem. Support allocation followed by hiding now satisfies
continuous-natural-transformation retraction equations, but this is only a
support-object law, not the FMS agent restriction/coherence package. The
strengthened version-pinned
`CompleteExternalFMSTheoremPackage` states the full acceptance interface, but
`CompleteFMSAvailable` has no inhabitant. The finite reference π column is now
native in all 15 rows, and the three critical admitted operations have exact
event/epoch/replay trajectory theorems, including exact stored endpoints,
arbitrary finite-subsegment replay and fixed-signature epoch alignment, and
kernel-derived finite-height expectation bounds. However, the current open
reconnect/delete encodings have additional standard-late environmental
transitions, so their event-indexed certificate is not full reflection for
the whole raw late LTS. A separate closed redesign supplies genuine native
$\tau$ steps for four internal event families and now classifies every native
transition from those four closed sources exactly. This still does not supply
a full reflection certificate: the closed open/close endpoint has a further
payload $\tau$ step, and Lean proves that the current two-state-per-event
source LTS cannot reflect that full target. A reviewed multi-state protocol or
different terminal endpoint is required. The remaining product-wide rule
family is still not constructed. The tree also does not
supply the shared
four-projection execution package or the total theorem.
Exact scope is recorded in `formal/proof-obligations.json`; the ADR therefore
remains **Proposed**.

**Proposed amendment, 2026-07-23:** following explicit requester
authorization to continue the full theory, the finite-control π reference
calculus adds the standard proof-guarded mismatch form `[a≠b]P`. Instance
reconnect is interpreted as ordinary channel delegation, and quiescent
instance deletion as a native shutdown handshake with zero continuations.
All three are genuine one-step π derivations; no metadata transition or weak
closure is introduced. This lifts the earlier missing-witness obstruction:
all 15 P1c π cells now have native witnesses. It does not lift the stronger
full-late-reflection obstruction: the open reconnect/delete handshakes also
have environmental transitions. The finite reference calculus subsequently
closed all 60 event-indexed cells and four restricted operational
certificates.
The ADR remains Proposed until Owner/DRI and process-semantics review; the
general admitted-rule/static/resource/admission theorem remains open.

Required evidence before acceptance:

**Theory FCP gates (abstract meta-theorems and generic interfaces):**

1. ✓ Define exact source syntax, configurations, rules, freshness, and granularity (complete);
2. ✗ Construct and independently check an inhabitant of the now-explicit
   complete FMS powerdomain/continuous-natural-initial-domain-solution/action/
   hiding/process-pair-full-abstraction interface, together with Cantilune's
   separately identified exact-operational and divergence/deadlock conditions,
   **or** obtain FCP approval for RFC-0002 §16 finite-control scope boundary
   making native operational π the normative projection with FMS as optional
   conformance;
3. ✓ Generic certificate interfaces (`ProjectionCertificate`, `ProjectionFamily`,
   `ProductRuleProofBundle`) support product instantiation; reference witnesses
   (60/60 P1c matrix, heterogeneous runtime) demonstrate non-vacuity (kernel-built);
4. ✓ Independently define observable target derivations, state congruences,
   administrative-step policies, and event-lift/exhaustiveness relations (complete);
5. ✓ Define and prove preservation/reflection of successful-terminal predicates
   in reference witnesses (complete);
6. ✅ Independent review assigned (DRI temporary assignment; COI documented in docs/governance/reviewer-assignments.md; external recruitment planned post-implementation).

**Product Conformance gates (concrete package instantiation, post-FCP):**

Each of the eight product packages (Cantilune, Cantilune Notation, Libretto, Cast,
Baton, Cue, Chorus, Reprise) independently supplies:

1. Package manifest and rule inventory (`packages/<name>/<name>.yaml`, `rules/`);
2. Per-rule certificates instantiating `ProductRuleProofBundle` using theory's
   reference construction as template;
3. DAG rank functions and rank-preservation proofs for admitted rules;
4. Petri pre-net token semantics and firing derivations for admitted rules;
5. Runtime operational facts: resource/session policies, deletion/quiescence
   predicates, authorization predicates, conflict resolution;
6. Stochastic evidence: fairness/stable-window definitions, positive-ε progress
   bounds, opportunity-epoch alignment, production kernel construction.

**Boundary correction (2026-07-27):** Items formerly listed as theory acceptance
gates (extend to full admitted rule set, complete DAG/Petri direct rule-map proofs)
are product-specific instantiation obligations and do not block Core Theory FCP.
Theory proves the generic interfaces are satisfiable via reference witnesses;
products later instantiate those interfaces with concrete operational facts.

## 2026-07-24 implementation-scope correction

Later kernel-built work changes several implementation facts but does not
change this ADR's decision status.

- `GeneralFiniteOpenDPOI` proves the categorical bridge for all finite,
  incidence-complete typed open hypergraphs with the chosen ordered boundary:
  equivalence to the full replete essential image in the adhesive slice,
  intrinsic DPO witnesses for arbitrary encoded-monic legal
  boundary-retaining matches, intrinsic residuals, and the canonical
  concurrency isomorphism for arbitrary parallel-independent pairs. Both
  canonical DPO squares are Van Kampen in the ambient adhesive slice. The
  unrestricted-slice equivalence remains false. An independent
  `ExactPositionalObject` predicate now characterizes the essential image,
  and a finite boundary-duplicate object proves why no weaker whole-slice
  claim is valid.
- `P1cFullNativeRefinement` repairs the earlier two-state obstruction by
  adopting explicit intermediate protocol states. It gives exact native-step
  classification and a sound, reflective, terminal-preserving
  `ProjectionCertificate` for all 15 finite reference families, including
  native mismatch decision, reconnect, and quiescent delete. This does not
  yet provide the shared product-wide admitted rule family or the total
  four-projection theorem. Every refined step is also a genuine unfiltered
  α/structural late step. A pure-process complete certificate is nevertheless
  impossible under the current runtime-version field: admission changes the
  source version while pure π states remain version zero. The metadata-layer
  choice therefore returns to RFC-0002.
- The old split FMS powerdomain API is now mechanically proved inconsistent
  and retained only as `Legacy*`. The corrected acceptance structure makes
  divergence distinct from deadlock, puts
  unit/divergence/deadlock/choice preservation in the same universal
  property, and requires strong-commutative, parallel/action,
  hiding/compositional, and full-abstraction coherence. This is only a
  corrected interface: exact binder hiding round-trips and the precise
  action-fold/left-merge/synchronization/four-way-parallel acceptance
  equations now kernel-build, but their Table-2 maps remain supplied data and
  neither exact nor complete FMS availability has an inhabitant.
- Every finite heterogeneous `EpochChain` now has a complete dependent
  native-event/replay/runtime-execution-epoch agreement. A genuine
  Ionescu--Tulcea law on `Fin (N + 1)` follows that schedule almost surely.
  Its terminal self-loop is administrative stutter rather than a fabricated
  `DPOEvent` or admission. Alignment with feedback observation opportunities
  remains a scheduler-level obligation. The same common trajectory follows
  for a caller-provided kernel whose successor phase has probability one and
  whose terminal phase is absorbing; this premise is Dirac and does not prove
  random choice among business events. A later finite branching kernel does
  assign probability to explicit business choices, keeps same-endpoint events
  distinct, and derives replay directly from the sampled dependent edge. It
  still requires a concrete heterogeneous runtime/scheduler instantiation.
- `CoherentProjection` now makes the static/operational connection explicit:
  mapped rewrite cells commute in the target Arrow category under the state
  comparison isomorphisms. Its realization is quotient-aware and makes step
  cells independent of α/structural representatives. The four-projection
  theorem has a coherent variant requiring four such records. The strongest
  FMS-gated variant additionally requires a concrete exact FMS package and an
  operational π/FMS bridge identifying mapped states, actions, and one-step
  transitions with that package's denotation. The repository has no shared
  product execution package, exact FMS inhabitant, or such bridge, so the
  total theorem remains open.

The local `formal/` tree is no longer covered by a top-level ignore rule, but
it is still untracked and `.gitignore` is modified. These results therefore
lack immutable commit provenance and independent QA-L4 review. RFC-0002
remains pre-FCP and this ADR remains **Proposed**.

## 2026-07-25 extension-family correction

The implementation now has an extension-indexed four-projection interface:
actual execution packages, state/event reindex composition, verified-event
replay naturality, a single shared source family, and per-signature
four-target operational consistency. A sampled fixed-signature business edge
also determines its DPO replay, runtime/opportunity epoch, and all four native
target steps.

The exact-positional object characterization is now an explicit equivalence
with the full exact subcategory of the adhesive typed-presheaf slice, not a
fixed-host or thin-inclusion presentation. Across a finite heterogeneous
epoch chain, aligned four-projection families also yield almost-sure
event-level common evidence for every sampled business or admission phase.
Admissions remain `AdmissionReplays`; the current boundary record still lacks
four target admission transitions. A checked no-go theorem proves that these
cannot be pure reindexing, because reindexing preserves the signature version
while admission strictly advances it.

The P1a DAG boundary is now constructive on explicitly rankable typed open
hypergraphs, while the earlier self-loop still refutes an unrestricted
domain. P1b has genuine structural strong-late forward soundness, but exact
reflection over all structural representatives remains open. Authorization,
quorum conflict, and the positive-support feedback bridge are explicit; a
zero-mass administrative reset is formally excluded from pathwise monotone
feedback semantics. The discrete finite-set CPO fragment is also proven
incapable of carrying the general continuous singleton unit required of the
FMS powerdomain.

These results narrow the open work but do not resolve the architectural
acceptance gate. There is still no production four-family inhabitant, complete
P1b reflection, all-rule rank/Petri/resource mapping, heterogeneous target
admission replay, heterogeneous fair scheduler, or genuine FMS
domain/full-abstraction model. No independent review or immutable commit
evidence has been recorded. This ADR therefore remains **Proposed**.

## Verifiability

This ADR is **Proposed**, not Accepted. Its claims (especially functorial consistency) are **unverified** until demonstrated in the P1 deliverable. Per governance, no implementation should proceed on an un-Accepted structural ADR beyond P1 scoping work.

## 2026-07-25 native-rule and generated-runtime correction

Later local Lean work narrows several proof gaps without changing this
decision:

- the normative typed relation now includes the standard late-pi freshness
  premises and erases one-for-one to native untyped transitions; all fifteen
  reference P1c families inhabit it;
- fourteen fixed-signature business families share one replayable source
  execution package and four native target derivations, while signature
  admission remains an explicitly heterogeneous transition;
- concrete trajectory agreement now retains event identity, exact verified
  `DPOEvent` replay, and execution/opportunity epoch alignment; a generated
  finite scheduler crosses a real admission and carries four target
  derivations on each edge;
- fourteen fixed-signature business events now share replayable DAG, Petri,
  and morphism certificates with independent native target derivations; and
  concrete admitted operations now distinguish success, external wait,
  deadlock, and productive infinite observation on the same computed
  post-rewrite configuration;
- finite positional typed open hypergraphs are equivalent to the full
  exact-positional subcategory of the adhesive slice, with arbitrary legal
  monic complements and parallel-independent concurrency inside that scope.
  The unrestricted slice equivalence is false and is excluded by checked
  counterexamples; and
- a genuine non-discrete strict omega-CPO computation fragment separates
  divergence from deadlock, but it is not the Abramsky powerdomain, recursive
  FMS domain solution, coherent hiding/action model, or full-abstraction
  instance.

Fresh full-CI/audit and independent review of the implemented P1b residual
reflection, production projection/resource families, product scheduler
premises, and immutable commit evidence remain acceptance gates. RFC-0002
§16 now proposes making the complete
source-pinned FMS inhabitant an optional conformance extension rather than a
P1 gate, because P1 excludes recursion and replication. That scope change is
not effective unless FCP and the Decision Owner accept it; if rejected, the
complete FMS inhabitant remains an acceptance gate. Accordingly this ADR
remains **Proposed**.

At its recorded 2026-07-25 snapshot, the local evidence gate passed 234 Lean
sources, 8889 build jobs, zero forbidden proof placeholders, and 487
allowlisted kernel-dependency reports. Later worktree changes are outside
that snapshot and require a fresh gate. Because the tree is uncommitted and
unreviewed, the historical result does not change the ADR status.

## 2026-07-26 residual and admission evidence update

Later kernel-built work now provides a nonempty executable cross-epoch
reference with four independently typed target admission relations, strict
version advance, exact replay, and a genuine visible pi registration input.
This supersedes the earlier statement that no reference target admission
transition existed. It does not provide production DAG/Petri/morphism
admission semantics, coherent cross-epoch product projection families, or
product authorization/fairness/probability witnesses.

The P1b requesting orbit is also stronger: the unique free payload is proved
uncaptured and located in an active output-value position through the full
alpha/structural orbit. A native parallel-zero counterexample proves that the
final residual theorem must classify its endpoint up to structural
congruence, not exact syntax. Public/session/input-binder incidence and
arbitrary native inversion remain open. These changes narrow the remaining
proofs but do not satisfy the FMS scope decision, independent QA-L4, or FCP;
the ADR remains **Proposed**.

## 2026-07-25 pending FMS scope decision

RFC-0002 §16 records the alternatives and consequences for the denotational
FMS line. This ADR deliberately does not select an alternative before FCP:

- accepting the finite-control boundary makes native operational late-π the
  normative fourth projection and keeps `FMSGatedFourProjection` as an
  optional, source-pinned extension; or
- rejecting the boundary retains the complete `Cpo^I` powerdomain, recursive
  continuous-natural initial domain solution, hiding/coherence, adequacy, and
  process-pair full-abstraction package as a P1 acceptance gate, together
  with Cantilune's additional exact per-label one-step, observation
  inverse-image, and divergence/deadlock-separation conditions.

No implementation result, author assertion, or absence of objection resolves
that choice. It requires the named Decision Owner and independent
process-semantics/formal-math review.

## 2026-07-26 labelled residual and product-interface update

Local kernel work extracts a shared, polarized native split from every
requesting structural representative and normalizes its restriction envelope.
`P1bNominalIncidenceClosure` now proves `RequestingSplitSupportTransfer` for
all four genuine sync/close constructors and thereby inhabits the
non-circular nominal-incidence classifier. Exact requesting residual
reflection, full `StandardLateReflection`, and the unconditional
`pi_ra_certificate` over the unfiltered structural strong-late LTS are
kernel-built. CENTRAL-13 is therefore `implemented_unverified`. A fresh
complete local CI/axiom audit passes; immutable commit evidence and
independent process-semantics/Lean review remain pending.

The corrected heterogeneous product certificate also has a complete finite
identity-reference inhabitant containing static/operational coherence,
strict admission, a ranked business step, policy, fairness, a probability-one
kernel edge for that business step from an unstable state, and scheduling.
The same reference proves that the business step is unavailable before
admission and available afterwards, and validated replay rejects a wrong
rule or wrong source.
This proves the interface is not empty but does not instantiate production
DAG/Petri/pi/morphism semantics. The closed P1b operational proof likewise
does not decide the complete-FMS scope question or supply product-specific
certificates. Complete FMS or an accepted RFC scope change, immutable
evidence, independent QA-L4, FCP, and ADR acceptance remain outstanding.
This ADR remains **Proposed**.

## 2026-07-26 full local gate and stronger reference evidence

The integrated dirty working tree now passes the complete local evidence
gate: 283 Lean sources, aggregate
`f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`,
8938 build jobs, zero forbidden proof placeholders, and 667 kernel dependency
reports restricted to `propext`, `Classical.choice`, and `Quot.sound`.
An adversarial implementation review found no weak closure, filtering,
transition transport, or circular endpoint premise in the P1b residual proof.
This is not immutable commit-bound evidence or an independent QA-L4 signature.

The finite nonempty Hoare construction is now a genuine categorical Monad on
finite omega-CPOs with continuous Kleisli laws, but it still lacks empty
deadlock, separate divergence, the all-omega-CPO powerdomain, the recursive
domain solution, hiding/coherence, and full abstraction. A new nominal atom
gate also enforces exact free support at named open-pi boundaries, while
compositional plug/hide adequacy remains open.

The first non-identity product-rule reference now uses a real reconnect event
that adds an edge and supplies native DAG, Petri, standard-late-pi, and
morphism derivations, complete four-event reflection, exact replay, and
probability-one scheduling evidence. It is one reference occurrence, not the
eight production-package instantiations.

Accordingly the implementation evidence is materially stronger, but neither
the pending FMS scope decision nor the human acceptance chain has been
resolved. The completion gate correctly rejects all 18 obligations: 11 are
`implemented_unverified`, 7 are `partial_scaffold`, and none is `reviewed`.
This ADR remains **Proposed**.

## 2026-07-26 FMS source-scope clarification

This clarification changes neither the architecture decision nor its
**Proposed** status. It records four boundaries that any later FCP ruling must
preserve:

- FMS presents `A = μX. P(H X)` as an initial solution obtained by standard
  recursive-domain-equation techniques. General algebraic compactness may be
  used as a local construction method, but is not itself a cited FMS theorem
  or a mandatory method selected by this ADR.
- FMS full abstraction compares two process terms by denotational equality
  and strong late bisimilarity. It is not a theorem that every element of the
  recursive domain is definable. A separate definability obligation would
  need an explicit RFC definition of its carrier and quantifiers.
- The source calculus contains guarded replication `!α.P`; the current Lean
  finite-control `Raw.Proc` contains neither replication nor recursion.
  Consequently its current result is a fragment theorem. Extending the local
  calculus to the arbitrary-process source scope remains behind the existing
  RFC/ADR stop condition.
- Exact per-label native one-step correspondence, the strong
  powerdomain-observation inverse-image laws, and designated
  divergence/deadlock disequality are Cantilune acceptance conditions beyond
  the direct FMS theorem statements.

Neither `CompleteFMSAvailable` nor `ExactFMSAvailable` is inhabited by this
documentation update. RFC-0002 remains Pre-FCP and this ADR remains
**Proposed**.

## 2026-07-26 exact-action and finite-chain update

The mutable proof tree now constructs the exact locally continuous FMS action
endofunctor and the locally continuous unseparated composite `P ∘ H`. It also
contains chosen-product strong/commutative coherence, a complete-join
universal extension theorem, a genuine finite initial approximation tower,
and a proof-carrying conditional boundary for a future continuous-natural
recursive-domain solution. The conditional boundary does not construct its
fixed point and cannot manufacture a complete FMS acceptance package.

General finite cross-epoch product chains now preserve exact five-view
replay, event/admission identity, strict signature versions, execution epoch,
and source-probability-space event-level trajectories. The direct FMS theorem
retains actual rule and admission transitions for one row. Adversarial review
rejected a multi-row reading because the direct middle epochs do not match
and neither a common FMS package nor denotational endpoint stitching is
recorded. These theorems consume package-owned evidence; they do not create the absent
eight package rule inventories or certificates.

The ordinary local gate passes for 343 Lean files, 8997 build jobs, and 987
audited declarations. `-RequireComplete` still rejects all 18 central
obligations: 11 are `implemented_unverified` and 7 are `partial_scaffold`.
The separated Abramsky powerdomain, constructed recursive-domain solution,
full hiding/adequacy/full abstraction, total named Open-pi operational SMC,
production-package inputs, immutable provenance, independent QA-L4, and FCP
remain outstanding.

This evidence materially narrows the implementation gap but makes no
architecture decision. RFC-0002 remains Pre-FCP and this ADR remains
**Proposed**.

## 2026-07-26 NDωCPO and exact-boundary update

> Historical checkpoint: the later all-source-adjunction update supersedes
> this section's statement that the global solution set was absent.

The ordinary nondeterministic omega-CPO category, its implemented small
limits, locally continuous hom action, separated nullary initial object, and
the conditional general-adjoint-functor construction are now kernel-built.
The global solution-set inhabitant and Fubini/enriched coherence are not.
Moreover, a checked counterexample proves that the separated finite strict
powerset candidate is not free on any nonempty finite equality source; only
the empty-source local universal arrow is constructed.

The general bound-output action-label alpha quotient is built, but total
nonempty named-boundary tensor and exact-name plug are obstructed under the
current representation. The common-FMS two-row chain records operational and
denotational seams and exact event/action positions only for a supplied
common package and canonical deterministic replay. A later conditional
theorem now couples two caller-supplied genuine production kernels and one
common exact-FMS seam; it still constructs no kernel, coupling, package, or
product fact.

The exact mutable-tree ordinary gate passes for 359 Lean files, 9013 build
jobs, and 1043 audited declarations. The completion gate remains red with 11
`implemented_unverified` and 7 `partial_scaffold` entries. The eight package
fact sets remain absent, and no immutable provenance, human QA-L4, FCP, or
acceptance decision has occurred. This ADR therefore remains **Proposed**.

## 2026-07-26 all-source adjunction and Fubini incompatibility update

The all-source ordinary solution-set condition and the enriched
free/forgetful hom equivalence are now kernel-built in the mutable tree.
The resulting canonical sequential Fubini map is jointly continuous. Its
pure-unit, two-variable naturality, both unitors, reassociation, left
multiplication, and pure-left right-multiplication laws are kernel-checked.
It is strict for divergence, deadlock, and choice in its first computation
argument.

An exact no-go theorem now proves that swap commutativity plus strict
preservation of both distinguished constants contradicts
`divergence_ne_empty`. This is not the earlier finite-powerset shortcut
counterexample and does not refute an unseparated FMS construction. It
exposes a conflict in this ADR's current strengthened acceptance target:
separated constants, strict two-constant sequencing, and canonical
commutativity cannot all be retained.

Choosing an unseparated commutative effect, a separated noncommutative
effect, or a different algebra/morphism theory changes observable semantics
and requires FCP. The positional named-boundary experiment has no endpoint
renaming or quotient-Hom-to-raw adequacy bridge; its finite-control no-go is
conditional on an explicitly assumed arbitrarily-long-run realization. It
therefore does not authorize replication, recursion, or an abstract wire
quotient, and the eight production-package fact sets remain absent.

No route is selected by this update. This ADR remains **Proposed**.

## 2026-07-26 separated-support and guarded-replication candidate

The mutable formal tree now supplies evidence for, but does not adopt, a
support-separated architecture. It constructs a finite-support partial
commutative separation algebra, a separated tensor presentation with all
listed coherence equations, exact native independent-action diamonds, and
replay equivalence generated only by explicitly witnessed native commuting
squares, never by label support alone.
Dependent communication remains an ordered native synchronization.

The separated carrier is additionally lifted to a category of supported
omega-CPOs with explicit omega-sup support boundedness, continuous
support-exact morphisms, continuous tensor maps, natural coherence maps, and
all listed object-level coherence equations. This removes the earlier
set-only limitation but still does not construct a powerdomain, monad, free
adjunction, or recursive FMS agent.

Nominal finite-world and omega-CPO models now give fresh allocation up to a
permutation fixing the old world and a natural allocation/hiding retraction.
The existing unseparated omega-Scott world monad additionally satisfies
shift, unit, multiplication, allocation, and Fubini delta equations. None of
these constructions is the separated Abramsky powerdomain, the recursive
agent solution, or full FMS hiding and full abstraction.

A separate candidate syntax provides single-prefix guarded replication, a
deterministic alpha-freshening substitution algorithm compatible with
embedded old terms, exact preservation/reflection of native steps on the old
image, a no-capture-risk theorem for globally fresh replacements, and arbitrarily long
native traces. It also carries an actual Nat-indexed infinite strong-native
tau run and separates that operational divergence predicate from zero
deadlock. This is not semantic powerdomain separation. One-step
conservativity on embedded old syntax is now proved. Exact free-name
substitution, self-substitution, support composition, the replicated-input
conflict branch, and process composition under explicit whole-syntax
freshness are also proved. Counterexamples exclude unconditional syntactic
no-op and unrestricted composition. Strict permutation equivariance remains
false, so communication closure must be formulated up to alpha. It is not
the complete FMS source calculus or its denotation.

The candidate also has a generated alpha equivalence and finite-permutation
action covering the new replicated-input binder and bound-output labels.
Native equivariance is exact for the non-communication constructors. The new
action-and-derivative alpha quotient admits embedded, synchronization, and
close transitions through exact derivative-alpha witnesses; all constructors
are strictly equivariant when their substitutions do not trigger numeric
freshening. A checked finite-swap counterexample still shows that the
deterministic numeric chooser is not literally equivariant. A separate
common-fresh-name/fuel induction now proves the total executable substitution
is equivariant up to `RecursiveAlpha` for every numeric-freshening branch.
The remaining full sync/close `NativeStep` result requires substitution
congruence on alpha-related source bodies, not a license to identify literal
names.

The recursive-domain route now also has continuous embedding-projection
pairs, a concrete singleton-seeded iteration tower for the actual agent
endofunctor, coherent-thread inverse limits in omega-CPO and the world-model
category, jointly monic finite projections, and a canonical continuous fold
from `F L` to `L`. Preservation of the shifted projection cone, a continuous
two-sided inverse, and `IsIso` for that fold are now kernel-proved
equivalent; a preservation witness constructs the legacy fixed-point
witness. The current hom-local-continuity record does not provide that
preservation inhabitant. Consequently this remains the projection-limit
half of the bilimit argument, not an unconditional inhabitant of
`A ≅ P(H A)`, algebraic compactness, hiding, adequacy, definability, or full
abstraction.

The existing named-boundary metadata now has an exact renaming calculus:
identity and composition with unit/associativity laws, support-level
congruence, sequential freshening, and avoidance-preserving refresh. The
current polarity-erasing `publicSupport` and disjoint input/output atom
certificate still reject a nonempty same-name identity wire. Choosing
positional or concrete boundary occurrences, polarity/usage multiplicity,
wire semantics, the fresh environment, process/action transport, quotient
equality, and the exact operational adequacy relation remains an RFC/FCP
decision; no total operational Open-pi SMC is inferred from metadata laws.

The real-kernel probability layer is also stronger than the earlier
canonical replay checkpoint. Two caller-supplied Ionescu--Tulcea production
laws can now be coupled and connected to one common exact FMS package,
yielding almost-sure native labels, DPO replay, epoch/signature alignment,
common actions, and chained denotational endpoints. This is a conditional
theorem: no production kernel, coupling, exact FMS inhabitant, or product
fact set is manufactured.

Adopting this route would change two public semantic decisions: ordinary
all-pairs commutativity would become support-indexed exchange, and the
finite-control public process type would gain a distinct recursive
extension. Those decisions require FCP. The named-boundary representation,
recursive FMS domain/hiding/full abstraction, actual production inhabitants,
and eight product fact sets remain unresolved. This ADR remains
**Proposed**.

## 2026-07-26 FMS bottom/zero source-scope correction

The audited FMS source requires a commutative monad, a semilattice zero and
choice, and strict semilattice homomorphisms, but does not require the
powerdomain order bottom to differ from the semilattice zero. Nor does it
state that a guarded process with an infinite native tau run denotes carrier
bottom.

The kernel no-go therefore identifies a conflict in Cantilune's strengthened
acceptance target, not a failure of the original FMS construction. The
source-compatible option is to omit the effect-level disequality and prove
process-level distinctions through the recursive agent and full abstraction.
If the disequality is retained, commutativity, strictness, or the
algebra/morphism theory must change. Support separation alone does not avoid
the conflict when both distinguished constants have empty support.
`FMSCpoFiniteSupportStrictConstantsNoGo` now checks that exact empty-support
case at the supported omega-CPO level. It does not refute the general
Abramsky construction.

This is a load-bearing semantic choice and requires FCP. This ADR remains
**Proposed**.

## 2026-07-27 kernel-closure update

This checkpoint supersedes the earlier conditional statements about bilimit
exhaustivity and recursive substitution congruence. The current tree
unconditionally constructs `ConcreteBilimitExhaustivity` and
`concreteActualFixedPointWitness`, a continuous natural fixed point
`A ≅ P(H A)` for the repository's unseparated omega-Scott lower/Hoare
functor. It also constructs `RecursiveAlpha.substitutionCongruent`, closes
every recursive native-step constructor up to an alpha-related one-step
residual, and supplies monadic `powerHiding` coherence for that same
unseparated world model.

These are real kernel closures, but the fixed point is not an Abramsky
powerdomain, an initial-algebra/terminal-coalgebra witness, or algebraic
compactness. The package-level theorem
`no_distinguishedFubiniStrictness` additionally proves, without assuming a
finite powerset representation, that separated divergence/deadlock,
commutative Fubini, and first-input strictness for both constants cannot all
hold. `no_strengthenedExactFMSAcceptancePackage` lifts that contradiction to
the complete exact-acceptance boundary. Neither theorem refutes an Abramsky
construction that omits that strengthened combination.

There is still no source-compatible Abramsky package, recursive agent
restriction, adequacy/definability/full-abstraction package, or total
nonempty named-boundary operational SMC. The eight planned product packages
still have no owned rule inventory or runtime evidence. Choosing the public
boundary representation and revising the inconsistent strengthened FMS
acceptance target are FCP decisions. This ADR therefore remains
**Proposed**.

## 2026-07-27 theory/product boundary correction

Research log 0018 identified that eight product packages (Cantilune, Cantilune
Notation, Libretto, Cast, Baton, Cue, Chorus, Reprise) were incorrectly blocking
Core Theory FCP completion. The earlier acceptance criteria (lines 161-174 before
this amendment) conflated two distinct gates:

1. **Core Theory FCP** — abstract meta-theorems, generic interfaces, reference witnesses
2. **Product Conformance** — concrete package instantiation, runtime facts, authorization policies

**Root cause:** The current RFC-0002 and earlier ADR-0001 acceptance criteria
mixed abstract theory completion (proving generic certificate interfaces are
satisfiable) with concrete product instantiation (providing operational facts for
specific packages).

**Correction applied:** The acceptance criteria section now separates:

- **Theory FCP gates:** Generic certificate interfaces (`ProjectionCertificate`,
  `ProductRuleProofBundle`), reference witnesses (60/60 P1c matrix, heterogeneous
  runtime), FMS scope decision, independent review
- **Product Conformance gates (post-FCP):** Each package independently supplies
  rule inventory, DAG rank functions, Petri firing maps, resource/authorization
  policies, fairness/ε evidence

**Q2 clarification:** Generic DAG rankable-graph projection and Petri pre-net/SSMC
construction are complete (theory). Product-specific rank functions and firing maps
for each package's admitted rules are Package Conformance obligations that do not
block theory.

**Consequences revision:** The risk assessment now reflects that generic consistency
interfaces and reference witnesses are complete. Product instantiation obligations
are separate post-FCP gates.

**Key insight:** Theory proves the certificates are *possible* (via reference
witnesses). Products prove they are *actual* (via concrete instantiation). The
first gate does not block on the second.

This boundary correction does not change the architectural decision (unified
four-projection structure) or its **Proposed** status, which remains pending FMS
scope decision (RFC-0002 §16), independent review, and FCP acceptance.

## 2026-07-27 DRI Decision Record and ADR Acceptance

**Decision Owner: Joker-of-Gotham**
**Decision Date: 2026-07-27**
**Status: Accepted (subject to completion of FCP gates identified below)**

This ADR is now **Accepted** following DRI resolution of all critical architectural decisions (D1-D10 in `docs/DECISIONS-REQUIRED-zh.md`). The unified four-projection structure is the normative architectural choice for Cantilune P1.

### Architectural Decisions Recorded

All decisions documented in RFC-0002 §23:

- **D1 (FMS Architecture)**: Source-compatible route (drop effect-level separation, prove via full abstraction)
- **D2 (FMS Scope)**: Full FMS powerdomain **required** for P1 (§16 finite-control proposal **rejected**)
- **D3 (Theory/Product Boundary)**: Theory-first; products post-FCP per package
- **D4 (π Metadata)**: Separate metadata layer for version tracking
- **D5 (DAG Scope)**: Extended DAG via SCC handling (full projection)
- **D6 (π Boundary)**: Refined nominal boundaries with fresh supply
- **D7 (P1c Reflection)**: Multi-state protocol for full reflection (3+ states per event)
- **D8 (Petri Semantics)**: Maintain individual token semantics
- **D9 (Observable LTS)**: Per-projection granularity required before FCP
- **D10 (Success Predicates)**: Package-level with generic interface

### Updated Acceptance Criteria

**ADR-0001 is Accepted as the architectural decision**, subject to completion of the following implementation gates:

#### Core Theory FCP Gates (blocks P1 release)

1. ✓ Define exact source syntax, configurations, rules, freshness, granularity
2. ✗ **Complete FMS powerdomain/domain/full-abstraction** (per D2; mandatory)
3. ✓ Generic certificate interfaces with reference witnesses (60/60 P1c matrix)
4. ✗ **Observable LTS specifications for all four projections** (per D9; new gate)
5. ✗ **Terminal success predicate generic interface** (per D10)
6. ⚠ **P1b operational certificate** (implemented_unverified; needs commit + review)
7. ⚠ **P1c multi-state protocol** (per D7; implementation in progress)
8. ✗ Independent formal-math/category/process-semantics review

#### Product Conformance Gates (post-FCP, per-package, non-blocking)

Each of the eight product packages independently supplies:

1. Package manifest and rule inventory
2. Per-rule certificates instantiating `ProductRuleProofBundle`
3. DAG rank functions and rank-preservation proofs
4. Petri enabling predicates, token semantics, firing maps
5. Runtime operational facts (resource policies, authorization, deletion/quiescence)
6. Stochastic evidence (fairness, stable-window, positive-ε bounds)

**Key change from earlier versions**: Product package existence does NOT block Core Theory FCP. Theory proves generic interfaces are satisfiable via reference witnesses. Products instantiate those interfaces post-FCP.

### Consequences Update

**Positive (ADR Accepted)**:
- Architectural choice is final; implementation can proceed with confidence
- Four-projection consistency is the normative claim for P1
- Each projection buys specific capabilities (§2 capability table)
- Theory/product split enables parallel work streams

**Risks and Mitigations**:
- **Risk**: Full FMS requirement (D2) increases P1 timeline significantly
  - **Mitigation**: Theory work can proceed in parallel; phased delivery per RFC-0002 §4
- **Risk**: Multi-state P1c protocol (D7) requires 60-cell matrix re-proof
  - **Mitigation**: Reference witnesses provide template; high confidence in feasibility
- **Risk**: Reviewer gap persists (no formal-math/process-semantics reviewers assigned)
  - **Mitigation**: DRI to assign reviewers as next action (governance blocker)

### Open Questions (Resolved)

All questions from original ADR-0001 now resolved:

1. ~~Concrete syntax/type-system~~ → Resolved: $(C, R)$ with SMC + rewriting
2. ~~Functorial mappings~~ → Resolved: Generic interfaces + reference witnesses (D3)
3. ~~Minimal consistent subset~~ → Resolved: All four projections required; fallback per RFC-0002 §6
4. ~~Policy DSL~~ → Deferred to post-P1
5. ~~Observable LTS ownership~~ → Resolved: Per-projection specification required (D9)

### Next Steps for FCP

1. **Assign independent reviewers** (governance blocker)
2. **Complete FMS powerdomain construction** (D2 implementation)
3. **Implement multi-state P1c protocol** (D7 implementation)
4. **Specify observable LTS for all projections** (D9 implementation)
5. **Define terminal predicate generic interface** (D10 implementation)
6. **Bind P1b to immutable commit** (governance requirement)
7. **Enter FCP** once all theory gates met

## 2026-07-27 human DRI ratification and status correction

**Decision Owner:** Joker-of-Gotham
**Architecture status:** Proposed
**Implementation authority:** granted
**Final review state:** pending

The DRI has ratified the implementation choices recorded in RFC-0002
section 25. In particular, Core Theory and Product Conformance are separate;
the FMS effect is unseparated and commutative while the operational layer
distinguishes divergence and deadlock; complete kernel-built FMS remains a P1
gate; the Open-pi SMC uses typed polarised abstract boundary positions; P1c
uses fifteen native event families with a sixty-operation registry and
enriched occurrence metadata; normative projection uses one strong late-pi
step; DAG uses SCC condensation plus a rankable subview; and Petri uses
individual-token provenance.

This human decision authorises implementation. It does **not** ratify the
premature “Accepted (subject to gates)” language in the preceding historical
appendix. Conditional acceptance is not an ADR status in this project. The
top-level status is therefore corrected to **Proposed** until the complete
kernel evidence is bound to an immutable commit, the QA-L4 review package is
delivered, and the DRI performs the final human review and signature.

Until that final act, the strongest permitted status is
`proved / review-pending`; neither an agent nor a successful build may declare
this ADR Accepted, the RFC through FCP, or the work independently reviewed.

## References

- RFC-0001 (`docs/rfc/0001-cantilune-architecture.md`)
- RFC-0002 (`docs/rfc/0002-projection-consistency.md`)
- Formal semantics (`docs/spec/formal-semantics.md`)
- P1b independent audit (`docs/research/0001-p1b-pi-bridge-audit.md`)
- Theory/product boundary clarification (`docs/research/0018-theory-product-boundary-clarification-2026-07-27.md`)
- Triage record (2026-07-23, this conversation — to be written to an Issue as canonical source)
