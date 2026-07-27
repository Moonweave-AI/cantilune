---
title: Superseded Cantilune theory-closure QA-L4 readiness snapshot
status: Superseded
risk: S2
quality_target: QA-L4
maturity: Pre-FCP/M1
owner: Joker-of-Gotham
---

> **Superseded snapshot (2026-07-28):** This chronology predates the current
> maximum-compatible D1-A closure and must not be used as the current QA
> packet. Its job counts, obligation counts, missing-result inventory and
> suggested FMS alternatives are historical. The replacement is
> `0002-theory-closure-proved-review-pending-2026-07-27.md`. The replacement
> keeps QA-L4, FCP and ADR acceptance pending; distinguishes the separated
> enriched-adjunction branch from the non-separated D1-A monad/domain branch;
> limits actual-Agent full abstraction to deterministic typed
> tau/free-output prefix tries; treats guarded results as
> native-trace/contextual-Hoare; and excludes all eight production-package
> instantiations.

# Conclusion

Cantilune is **not yet QA-L4 complete**. This document is the review packet
and gate definition; it is not a review signature. The finite-control
operational theory has substantial kernel-checked implementation evidence,
but the current RFC still makes the complete FMS inhabitant mandatory.
The working tree now contains a genuine unseparated Hoare/lower Monad on all
omega-CPOs and continuous maps, plus freshness-safe input and bound-output
action quotients. It still lacks the separated Abramsky free
pointed-semilattice powerdomain, recursive agent-domain solution,
hiding/coherence, and process-pair full abstraction. Exact-name plug/hide
also has kernel-checked nonempty-unit obstructions under the current
finite-control operational route. Product packages have not supplied their
rule certificates, and no immutable commit or independent three-discipline
review exists. The first
`ProductRuleAdmission.Certificate` is additionally uninhabited: it asks one
fixed-signature `ExecutionPackage` step both to preserve and strictly advance
the signature version. It is a legacy negative regression, not the generic
interface through which product completion can currently be claimed. The
corrected heterogeneous interface, one substantive fixed-epoch P1c
occurrence, and the generic `CrossEpochProductFamily` composition theorem
are now kernel built. None of the eight planned distributions has a package
tree, rule inventory, or package-owned rank/pre-net/resource/authorization/
fairness/positive-epsilon proof input, so no production-package certificate
can currently be instantiated.

# Classification and rationale

- Work object: formal-theory implementation and research convergence.
- Risk: S2. Incorrect projection/reflection, replay, or convergence claims can
  invalidate core architecture, but this work does not directly operate a
  production or embodied system.
- Target: QA-L4, because the result is a load-bearing cross-model theorem and
  includes mechanized mathematics, external semantic dependencies, and
  governance decisions.
- Maturity: Pre-FCP/M1. RFC-0002 is Draft and ADR-0001 is Proposed.
- DRI: Joker-of-Gotham.
- Required independent reviewers:
  1. category theory / DPO / Petri;
  2. π-calculus / domain theory;
  3. Lean kernel assumptions and evidence provenance.

# Quality evidence matrix

| Area | Required QA-L4 evidence | Current disposition |
|---|---|---|
| Scope and design | EN/ZH spec, RFC, ADR agree on exact theorem boundary and assumptions | Draft; FMS boundary is Proposed, not effective |
| Free SMC | quotient, category/SMC laws, universal comparison and uniqueness | implemented_unverified |
| DPOI | exact-positional equivalence, legal monic complements, Van Kampen squares, concurrency | implemented_unverified in the characterized finite scope |
| P1a | substantive DAG/Petri/morphism certificates for every admitted product rule | the legacy admission record is kernel-proved uninhabited and the corrected heterogeneous interface is root-built; the first non-identity fixed-epoch product bundle uses a reconnect occurrence that really adds `(0, 1)`, carries independent DAG/Petri/native-late-pi/morphism business derivations, maps all four source events bijectively, reflects every target step, and replays the exact event; production-package inhabitants remain absent |
| Open π SMC | named boundary discipline, SMC coherence, and operational plug/hide adequacy | the presented quotient has genuine mathlib Category/Monoidal/Symmetric instances; the atom gate carries distinct typed name ports and exact erased free support; the partial named-composition layer checks restriction, hidden-middle support, and parallel disjointness. Exact-name hiding rejects both unit composites at a nonempty boundary, while the presented identity erases to raw zero and has no native step. Every fixed finite-control process also has strong/native run length bounded by its initial prefix count, excluding an arbitrarily reusable operational identity when each use consumes a step; a genuine two-step one-shot relay remains possible. A category therefore still needs an RFC-selected alpha-fresh linear or replicated wiring semantics and native adequacy |
| π operational layer | α, capture avoidance, structural late LTS, exact soundness/reflection | the P1b request/accept operational chain is kernel-built over the unfiltered structural strong-late LTS. `OpenSMCActionAlpha` additionally quotients general input/bound-output labels and derivatives by freshness-safe renaming and preserves genuine native one-step derivations; it rejects a bound-output binder equal to its channel. Immutable provenance and independent QA-L4 review remain absent |
| FMS | all-ωCPO powerdomain, recursive domain solution, hiding/coherence, adequacy, selected-scope definability if separately specified, full abstraction | `FMSCpoOmegaScottPower` constructs a genuine unseparated Hoare/lower endofunctor and Monad on all omega-CPOs and `ContinuousHom`s. Continuous Fubini/candidate strength components satisfy map naturality, pure-unit, swap, product associativity, and the exact multiplication/Fubini interchange; chosen-product morphism components are constructed. The Monad is also instantiated pointwise on the real nonconstant `World ⥤ ωCPO` support model, with unit/μ world naturality and pointwise Fubini. `FMSCpoConcreteBilimitExhaustivity` now constructs the canonical exhaustive approximation and a continuous-natural actual fixed-point witness `A ≅ P(H A)` for this unseparated omega-Scott lower/Hoare model, and the corresponding unseparated `powerHiding` is kernel-built. This is not an initial-algebra/terminal-coalgebra result, an algebraic-compactness witness, the separated Abramsky free pointed-semilattice powerdomain, full hiding/coherence, adequacy, definability, or full abstraction. The package-level no-go is no longer finite-powerset-specific: commutative Fubini together with mapped divergence, divergence/deadlock separation, and first-input strictness at both divergence and deadlock forces the two distinguished constants to coincide. It refutes that strengthened combination, not an Abramsky construction that omits one of those requirements |
| Replay and probability | event identity, exact DPOEvent replay, epoch alignment, stable/fair window, positive ε | the five-state authorized reference kernel has a root-built positive common trajectory with event identity, replay, and epoch alignment; the non-identity reconnect bundle additionally carries ε=1, stable/fair-window and external-scheduling evidence. `CrossEpochProductFamily` composes any supplied four-view admission and new-epoch rule bundle into four replay-aligned dependent chains; arbitrary production premises must still be supplied |
| Terminal semantics | success, wait, deadlock, productive infinity pairwise separated | reference admitted occurrences implemented_unverified |
| Static assurance | zero forbidden proof placeholders; complete import graph; manifest and integrity checks | local dirty-worktree gate passes for 305 Lean files at aggregate `5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`; root build completed in 8960 jobs |
| Kernel assumptions | each central declaration reports only the approved Lean foundations | local audit passes for 804 declarations; only `propext`, `Classical.choice`, and `Quot.sound` occur |
| Provenance | exact commit, toolchain, dependency lock, source aggregate, build log | pinned local build record exists, but the proof tree is dirty/uncommitted and therefore not immutable commit-bound evidence |
| Independent review | three non-author reviews bound to the exact commit and declarations | absent |
| Governance | RFC-0002 FCP outcome and ADR-0001 Accepted decision | absent |

# Q0–Q5 gates

## Q0 — Scope and traceability

Pass only if:

- `formal/proof-obligations.json` contains exactly the approved 18 central
  obligations and every non-missing entry names a real Lean declaration;
- English and Chinese spec/RFC/ADR state the same proof boundary;
- every external theorem package records source, version, assumptions, and
  applicability;
- no theorem-range TBD or unrecorded alternative remains.

Owner: DRI. Reviewers: all three disciplines.

## Q1 — Deterministic source and kernel gate

Pass only if, on the exact candidate commit:

- `formal/scripts/ci.ps1` succeeds;
- `lake build` is clean;
- all project Lean sources contain zero whole-word
  `sorry` / `admit` / `axiom` / `unsafe`;
- source count, aggregate hash, pinned input hashes, and build evidence agree;
- every configured declaration is found exactly once by the axiom audit.

Owner: Lean reviewer. A local dirty-worktree build is insufficient.

## Q2 — Semantic regression gate

Pass only if executable or kernel-checked regressions cover:

- invalid wiring and implicit linear-resource duplication;
- DPO dangling, active-session deletion, and signature redefinition;
- replay identity under multiple redexes;
- declaration-order pre-nets and individual-token provenance;
- α-conversion, capture avoidance, freshness, scope extrusion, `res(com)`,
  `open+close`, and ordinary `com`;
- mismatch, reconnect, delegation, admission, and quiescent deletion;
- duplicate/conflicting ballots, no quorum, explicit accept/reject autonomy;
- positive-ε convergence and counterexamples when ε/fairness/stability is
  absent;
- success, external wait, deadlock, and productive infinity;
- negative results forbidding π parallel as the model tensor, generic DPO
  preservation by strong monoidality, event recovery from τ alone, and
  termination from boundedness alone.

Owner: Lean reviewer with the category and π reviewers.

## Q3 — Independent mathematical review

Pass only if the reviewers, independently of the implementation author:

- check statement strength, quantifier scope, and representative independence;
- inspect FreeSMC coherence/universality;
- inspect exact-positional DPOI legality and concurrency hypotheses;
- inspect the P1b residual proof through α/ACU/restriction/scope extrusion;
- inspect all FMS assumptions or the accepted finite-control scope decision;
- inspect probability/event/replay coupling and terminal classifications;
- sign review evidence bound to the exact commit and central symbols.

Owner: three non-author reviewers, once named and assigned. No reviewer has
yet been recorded as accepting this assignment, and the agent cannot satisfy
this gate by self-review.

## Q4 — Completion-scope gate

Pass only by one of these explicit RFC outcomes:

1. FCP keeps complete FMS normative, and a source-pinned, reviewed
   `CompleteFMSAvailable` inhabitant plus operational/FMS coherence is
   constructed; or
2. FCP accepts RFC-0002 §16, splits the optional FMS conformance gate from
   finite-control P1, and all normative finite-control obligations are
   reviewed.

Additionally, the fixed-signature business certificate and heterogeneous
source/four-target admission interfaces must first be separated and built.
Every production rule package must then supply rank, pre-net,
resource/session/deletion, authorization, admission, fairness, stable-window,
and positive-ε evidence through that corrected interface.

Owner: Decision Owner and product-rule owners.

## Q5 — Governance acceptance

Pass only if:

- all central obligations required by the accepted scope are `reviewed` with
  commit-bound evidence;
- RFC-0002 completes FCP;
- ADR-0001 records the accepted decision;
- exceptions and quality debt have named owners and expiry/review dates.

Owner: Decision Owner. No local code change can self-approve this gate.

# Current blockers and quality debt

| Blocker | Lift condition | Owner |
|---|---|---|
| P1b implementation verification | bind the integrated closure to an immutable commit, rerun the complete gate on that exact commit, and obtain independent process-semantics/Lean review; the operational proof and dirty-worktree full CI/axiom audit are complete | π/Lean proof owners and independent reviewers |
| Complete FMS under current RFC | construct/import and review the full package, or accept RFC-0002 §16 | domain reviewer / Decision Owner |
| Product-wide certificates | instantiate the kernel-built `ProductRuleProofBundle` gate for every product rule, including substantive cross-epoch four-view admissions and concrete rank/resource/authorization/fairness/positive-ε evidence | product-rule owners |
| Immutable proof provenance | settle sources, commit, recompute integrity, run the full gate | DRI / Lean reviewer |
| Independent QA-L4 | three non-author reviews bound to the candidate commit | reviewers to be assigned |
| FCP / ADR | recorded human governance decisions | Decision Owner |

# Current verification-environment note

The pinned Lean 4.32.0 toolchain is available locally. The ordinary evidence
gate passed on the current dirty working tree: 305 Lean files, aggregate
`5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`,
zero forbidden placeholders, root `lake build` success in 8960 jobs, and
804 dependency reports restricted to `propext`, `Classical.choice`, and
`Quot.sound`. The ordinary gate exited successfully; the separate
`-RequireComplete` regression exited 1 and listed all 11
`implemented_unverified` plus 7 `partial_scaffold` obligations. The record is
`formal/build-evidence/2026-07-26-fms-openpi-crossepoch-root.md`.

This is strong local kernel evidence, but it is not immutable commit-bound
provenance or independent review. `ci.ps1 -RequireComplete` rejects all 18
entries as designed. Every manifest entry therefore remains
`partial_scaffold` or `implemented_unverified`; none is `proved` or
`reviewed`.

# Release-quality input

Disposition: **Iterate; do not promote**. The candidate may be presented for
QA-L4 review only after Q0–Q2 pass on an immutable commit and the FMS scope
question is explicitly placed before FCP. No current evidence supports
claiming “all theory complete,” FMS full abstraction, RFC passage, or ADR
acceptance.

## Latest mutable-tree gate — 2026-07-26

The exact action/domain-boundary/finite-chain increment has passed the
complete ordinary local gate:

- 343 Lean source files;
- aggregate
  `8b08b6c0215d4b6430083d14b477febe65f4df4adf7b0ee6a75f27df73d1163b`;
- 8997 successful Lake build jobs;
- zero `sorry`, `admit`, `axiom`, or `unsafe`;
- 987 audited declarations, depending only on `propext`,
  `Classical.choice`, and `Quot.sound`.

The exact record is
`formal/build-evidence/2026-07-26-fms-action-finitechain-root.md`.
`ci.ps1 -RequireComplete` still exits 1 and reports 11
`implemented_unverified` plus 7 `partial_scaffold` obligations.

The local implementation now includes the exact locally continuous action
functor, locally continuous unseparated `P ∘ H`, chosen-product
strong/commutative coherence, a complete-join universal property, an honest
conditional recursive-domain boundary, arbitrary finite five-view
event/replay/epoch trajectories, and an exact one-row FMS gate. Adversarial
review rejected the attempted direct multi-row FMS claim: eventful after
epochs cannot equal empty before epochs, and common-package/denotational
endpoint continuity is not stored. A follow-up implementation-level review
accepted the corrected one-row scope and retained `partial_scaffold` status;
that result is not a human QA-L4 signature. These results narrow the gaps but
do not construct the separated
Abramsky powerdomain, an actual recursive-domain inhabitant, full
hiding/adequacy/full abstraction, a total operational named Open-pi SMC, or
any of the eight absent production-package instances.

Disposition remains **Iterate; do not promote**. This mutable-tree run is not
an immutable candidate commit, independent QA-L4 review, FCP decision, or
ADR acceptance.

## Final mutable-tree evidence — 2026-07-26

The NDωCPO/AFT, named-boundary, common-FMS, and finite-strict no-go increment
now passes the complete ordinary local evidence gate on its exact recorded
source state:

- 359 Lean source files;
- aggregate
  `7bf56b13ed7075f476b9ba71c00c840b904678a42d2f3d1df734af57a9162eb4`;
- axiom-target-list hash
  `7471e603f5b060b0afbd1037b8f9a7b07698184cee4a49b44789c300b3fb30c7`;
- root build success in 9013 jobs;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`; and
- 1043 audited declarations depending only on `propext`,
  `Classical.choice`, and `Quot.sound`.

The exact record is
`formal/build-evidence/2026-07-26-ndcpo-openpi-commonfms-root.md`.
`ci.ps1 -RequireComplete` still exits 1 and reports exactly 11
`implemented_unverified` plus 7 `partial_scaffold` obligations.

Two agent-level adversarial reviews accepted the stated, limited kernel
claims: the conditional AFT construction has no hidden inhabitant, and the
finite strict powerset candidate genuinely fails initiality for every
nonempty finite equality source. These reviews are implementation evidence,
not independent human QA-L4 signatures. The full all-source solution-set,
enriched/strong commutative powerdomain, recursive FMS domain,
hiding/adequacy/definability/full abstraction, total named Open-π SMC, real
production trajectory agreement, and eight package-owned certificates remain
absent.

Disposition remains **Iterate; do not promote**.

## All-source/Fubini and production-event delta — 2026-07-26

After the preceding immutable-evidence snapshot, the mutable tree gained:

- an actual all-source `SolutionSetCondition.{0}` and ordinary
  free/forgetful adjunction;
- an unconditional CPO-enriched hom adjunction;
- a jointly continuous canonical sequential Fubini construction;
- a kernel no-go showing that separated divergence/deadlock, strict
  preservation of both constants, and swap commutativity are inconsistent;
- a sparse event-payload Markov kernel with genuine Ionescu--Tulcea event
  paths, positive-support native steps, and exact DPO replay; and
- an independent adversarial review of the positional named-boundary
  experiment.

`lake build Cantilune.Tests.All` completed successfully in 9036 jobs after
root integration. The selected new declarations use only `propext`,
`Classical.choice`, and `Quot.sound`, and the new modules contain no forbidden
proof placeholders.

The review rejected promotion of the positional experiment to a total
operational named Open-pi SMC: the raw operands are not renamed onto the
realized middle, fresh middle names are disjoint from both operands, and no
quotient-Hom-to-raw adequacy bridge exists. The finite-control identity
no-go is conditional on an explicitly assumed arbitrarily-long-run
realization.

The Fubini no-go changes the quality disposition from “construction still
missing” to “the current strengthened target is inconsistent”. FCP must
choose an unseparated commutative effect, a separated noncommutative effect,
or a new algebra/morphism theory before complete-FMS work can resume.

The sparse theorem removes the total-self-event artefact but still consumes
caller-supplied finite event kernels and a semantic coupling/seam. It does
not supply epoch/signature/progress/epsilon facts or any production-package
instance.

This remains mutable, agent-reviewed evidence—not a human QA-L4 signature or
an accepted architecture decision. Disposition remains **Iterate; do not
promote**.

## Final integrated mutable-tree gate — 2026-07-26

The post-review source state passed the ordinary gate recorded in
`formal/build-evidence/2026-07-26-global-ssc-fubini-sparse-event-root.md`:

- 384 Lean source files;
- aggregate
  `e14b886283e3efa46b555ea6d272020476f40a4b5eae52871a4e770e29566990`;
- root build success in 9038 jobs;
- zero forbidden proof placeholders; and
- 1076 audited declarations restricted to `propext`,
  `Classical.choice`, and `Quot.sound`.

The completion gate correctly exits 1 with 11
`implemented_unverified` and 7 `partial_scaffold` entries. No entry is
`proved` or `reviewed`. This final local run changes no QA-L4, FCP, or ADR
status.

## Bilimit/alpha/hiding integration status — 2026-07-27

This mutable-tree increment eliminates two formerly explicit premises:

- `concreteActualFixedPointWitness` supplies an actual continuous-natural
  `A ≅ P(H A)` fixed point for the unseparated omega-Scott lower/Hoare model,
  using the now-constructed concrete bilimit exhaustivity witness;
- recursive capture-avoiding substitution is congruent under
  `RecursiveAlpha`, and native transitions admit an unconditional
  all-constructor one-step permutation theorem up to alpha, without a weak
  transition or τ-star replacement.

The existing unseparated `powerHiding` therefore composes with an actual
fixed point in that limited model. This does **not** establish initiality,
terminality, algebraic compactness, the separated Abramsky powerdomain,
source-level hiding/coherence, adequacy, definability, or full abstraction.
The general package no-go has also been sharpened: commutative Fubini,
mapped divergence, separation of divergence from deadlock, and first-input
strictness at both distinguished constants are jointly inconsistent. The
proof is representation-independent and does not rely on finite powersets;
it does not refute an Abramsky construction that does not demand that full
strengthened combination. The kernel corollary
`no_strengthenedExactFMSAcceptancePackage` states the resulting
uninhabitedness directly at the complete exact-acceptance boundary.

The fresh root run recorded in
`formal/build-evidence/2026-07-27-bilimit-alpha-hiding-root.md` passed the
ordinary gate over 427 Lean files at aggregate
`039c48d0c5a946fbf5f02cb0ee67c81ff73a428fe49291ddda92a8fe61ea7064`;
the root build completed in 9081 jobs, the whole-word placeholder scan was
clean, and 1232 audited declarations used only `propext`,
`Classical.choice`, and `Quot.sound`.
The proof-obligation classification remains 11 `implemented_unverified` and
7 `partial_scaffold`, with no `proved` or `reviewed` entry. Recursive
agent/full FMS semantics, a total named Open-π SMC, real production kernels,
and all eight package-owned fact sets remain absent. Agent-level review is
not an independent human QA-L4 signature. Disposition remains
**Iterate; do not promote**.

## Nominal-separation and marked-occurrence QA increment — 2026-07-27

The current mutable tree adds kernel-checked finite-support transport under
world injections, permutations, and allocation, including reflection of
compatibility and partial composition in the concrete finite-support PCM.
It also adds provenance-bearing native events for the recursive strong-late
LTS. Every native step is markable and erasable; the new parallel residual
square produces both exact marked orders and cannot be constructed from the
known choice counterexample. Hidden synchronization channels remain in
event support, so erasure to `tau` no longer creates a false independence
certificate.

This closes neither the complete FMS gate nor the total named Open-pi gate.
The first still needs an FCP-consistent target and the source-level recursive
agent, restriction, adequacy, definability, and full-abstraction results.
The second still needs an RFC-selected public-boundary representation,
wire realization, process renaming, and Hom equality. The label-only replay
quotient also remains unsuitable for load-bearing independence until its
consumers migrate to the marked residual relation.

No production kernel or product-owned rule/runtime fact was added. The
package audit still records no rule inventory, rank, pre-net, resource,
authorization, fairness/stable-window, or positive-epsilon input for any of
the eight planned packages. These omissions cannot be discharged by a
generic theorem.

This is mutable implementation evidence only. It does not constitute an
immutable candidate, an independent human QA-L4 signature, an FCP decision,
or ADR acceptance. Disposition remains **Iterate; do not promote**.
