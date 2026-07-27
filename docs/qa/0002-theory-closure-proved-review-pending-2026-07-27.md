---
title: Cantilune Core Theory QA-L4 evidence-binding / review-pending packet
document_type: quality-evidence-and-review-packet
status: evidence-binding-pending / human-review-pending
risk: S2
quality_target: QA-L4
maturity: Pre-FCP/M1
owner: Joker-of-Gotham
dri: Joker-of-Gotham
updated: 2026-07-28
review_cycle: on every proof-sensitive change
---

# Conclusion

This is the QA-L4 review packet for the Cantilune generic Core Theory and its
nonempty reference execution package. It is not an independent review
signature.

The aggregate proof state is determined mechanically:

- verified source commit: `SOURCE_COMMIT_PENDING`;
- descendant evidence/manifest commit: `EVIDENCE_COMMIT_PENDING`;
- complete build and axiom-audit record: `BUILD_EVIDENCE_PENDING`;
- build-evidence SHA-256: `BUILD_EVIDENCE_SHA256_PENDING`;
- technical status is `proved` only when these values are replaced by real,
  mutually consistent evidence, CENTRAL-18 contains its complete common
  chain, the source build succeeds on the verified source commit, and
  `formal/scripts/ci.ps1 -RequireProved` succeeds on the descendant evidence
  commit after proving all proof-sensitive paths equal the source commit;
- until then, the technical status is
  `implemented / immutable-evidence-pending`;
- after the technical status becomes `proved`, the aggregate governance state
  remains **`proved / review-pending`** until independent human review and the
  final Owner/DRI signature.

Nothing in this packet declares QA-L4 complete, RFC-0002 through FCP, or
ADR-0001 Accepted.

## Classification and authority

| Field | Value |
|---|---|
| Work object | Load-bearing formal theory, reference semantics, and proof provenance |
| Risk | S2 |
| Quality target | QA-L4: kernel verification plus independent specialist review |
| Maturity | M1 / Pre-FCP |
| Owner / DRI | Joker-of-Gotham / Joker-of-Gotham |
| Ownership transfer | None |
| Decision authority | RFC-0002 section 25 and its kernel-backed compatibility amendments |
| Proof authority | The exact Lean source commit, pinned toolchain and dependency lock, strict CI, axiom audit, and proof-obligation manifest |
| Review authority | Independent human reviewers bound to the same source commit and theorem inventory |

The Owner and DRI being the same person is explicit. Agent implementation and
kernel checking do not count as independent human review.

# Ratified proof boundary

The review must evaluate the following boundary, not a broader historical
claim.

The central FMS record is exactly `MaximumCompatibleD1AFMSClosure`, inhabited
by `maximum_compatible_d1a_fms_closure`. It combines evidence from two
explicitly distinguished branches in one audit record; it does not identify
the separated enriched-adjunction construction with the non-separated D1-A
monad/domain/hiding construction. Reviewers must reject any release note that
renames this result “complete source-paper FMS” or transfers a universal
property between the branches without a comparison theorem.

1. Core Theory proves a parameterised four-projection theorem for every
   product package that carries the complete required certificates.
2. Core Theory contains a nonempty, substantive reference execution package.
3. The eight planned production packages are deferred to a separate Product
   Conformance phase. Their rule inventories and runtime facts do not exist in
   this proof package and are not inferred from package names.
4. The FMS effect is the ratified D1-A unseparated effect:
   effect-level divergence and deadlock share one bottom so the chosen Fubini
   operation can be symmetric and commutative.
5. Native late-pi transitions, terminal classification, and product semantics
   continue to distinguish divergence from deadlock.
6. Open-pi categorical wiring and native operational processes are two
   related layers. The algebraic layer supplies typed, polarised abstract
   ports and SMC coherence; fresh nominal representatives supply genuine
   strong late-pi event steps.
7. Fifteen event families are normative. The sixty-operation registry is a
   total `refinesTo` registry with enriched occurrence metadata.
8. Every normative event uses a genuine strong late-pi step. Weak `tau*`
   observation is only a derived view.
9. DAG projection uses SCC condensation plus a strict rankable subview.
   Petri projection uses individual-token provenance.

# Mandatory no-go and maximal-compatible boundaries

These are part of the accepted theorem statement, not optional caveats.

## D1-A is not the separated Abramsky source effect

The pinned FMS source distinguishes its least element from semilattice zero.
Cantilune D1-A deliberately collapses them at the effect layer. Therefore the
delivery must not be described as a definitionally identical reconstruction
of the separated Abramsky powerdomain.

The kernel no-go modules record two consequences:

- exposing divergence and deadlock as distinct source constants cannot be
  fully abstract under a denotation that maps both to D1-A bottom; and
- D1-A choice/bottom semantics cannot be fully abstract for
  constructor-sensitive strong bisimulation, even on the finite
  tau/choice counterexample.

The maximally compatible positive theorem has three separately typed parts:
finite Hoare adequacy/full abstraction with finitely-generated definability;
`RecursiveProc` finite-action-trace guarded/contextual-Hoare adequacy/full
abstraction and source interpretation; and actual-Agent native-path
adequacy/full abstraction only for deterministic typed tau/free-output prefix
tries, with constructive `CompactPrefixPoint` realization. The source
interpretation is not reverse semantic-image definability. Genuine strong
late-pi soundness/reflection and terminal divergence/deadlock separation are
independent operational theorems.

## Raw process structural equality does not supply reusable wires

Alpha conversion plus lawful ACU/scope structural congruence does not make a
fixed positive-prefix finite relay a categorical unit. The accepted route is
a presented algebraic wiring SMC together with a separately proved native
adequacy/commutation layer. It does not claim an identity-preserving SMC
functor into the raw-process structural quotient.

## All-elements definability is impossible

The optional strengthening that one process syntax define every element of
every omega-CPO is excluded by the formal Cantor diagonal result. The positive
scope is finite Hoare finitely-generated definability and the explicit
`CompactPrefixPoint` actual-Agent realization, followed by the exact
guarded/contextual source interpretation. It does not claim all compact
elements or reverse semantic-image definability.

# Quality evidence matrix

The final reviewer must bind every row to the verified commit and build record
above.

| Area | Required evidence | Candidate proof surface | Gate state |
|---|---|---|---|
| Free SMC | Equality quotient, category/SMC coherence, universal comparison and uniqueness | `formal/Cantilune/Core/FreeSMCArbitraryUniversal.lean` and manifest symbol for CENTRAL-01 | Evidence binding pending |
| Open hypergraph and DPOI | Exact finite positional equivalence, arbitrary legal monic occurrence in that scope, complement/result uniqueness, Van Kampen and concurrency | Core DPOI modules and CENTRAL-02/03 | Evidence binding pending |
| Signature and replay | Extension coherence, representative-independent rewrite, exact `DPOEvent` replay, path lift/reflection | CENTRAL-04 through CENTRAL-07 | Evidence binding pending |
| P1a | Product-supplied whole-LTS DAG/Petri/morphism certificates with path and terminal coverage; selected canonical SCC-DAG and provenance-Petri sidecars; separate fourteen-event fixed-signature three-carrier replay reference | `CompleteProductP1aProjectionScope`, `P1aSemanticCertificate`, `FixedSignatureReferenceP1aScope`, CENTRAL-08/09 | Implementation present; sidecars and reference are explicitly not identified with one another; evidence binding pending |
| Open-pi | Typed polarised algebraic SMC, fresh nominal realization, pairwise-fresh singleton wire names, globally disjoint canonical tensor blocks, joint derivative-alpha, native plug/hide/restriction representatives and exact compatibility boundary | `OpenSMCCanonicalPositional`, `OpenSMCPolarisedHomBridge` | Evidence binding pending |
| P1b | Exact structural late residual, alpha/capture avoidance, `res(com)`, `open+close`, ordinary `com`, reflection and terminal classification | P1b structural-late bridge and CENTRAL-13 | Evidence binding pending |
| P1c | Fifteen native families, sixty-operation total registry, enriched metadata, strong one-step refinement/replay, and explicit visible-admission then native-tau reconnect phase | `P1cOperationRegistry`, `P1cFullNativeRefinement`, CENTRAL-14 | Evidence binding pending |
| D1-A FMS | Distinct separated and D1-A branches; all-object lower omega-Scott effect, Monad/Fubini coherence, actual recursive agent-domain solution, restriction/hiding, finite and `RecursiveProc` guarded/contextual Hoare theorems, deterministic-prefix actual-Agent theorem, total finite-control coalgebra and fifteen-family commutation | `MaximumCompatibleD1AFMSClosure`, `FMSConcreteD1AAcceptance`, actual-Agent prefix/total-coalgebra/bridge modules | Evidence binding pending |
| Feedback/probability | Finite-height hard closure, no internal oscillation, conditional almost-sure hitting, expected bound, event/replay/epoch alignment | `CompleteFiniteHeightClosure`, CENTRAL-15/16 | Evidence binding pending |
| Terminal semantics | Success, external wait, deadlock and productive infinity do not drift across the admitted reference occurrence | terminal theorem and CENTRAL-17 | Evidence binding pending |
| Total composition | Generic four-projection theorem plus one substantive reconnect conformance witness, with one operation/`refinesTo`/metadata/payload/admission/selected-trajectory/actual-Agent chain | `CompleteProductCommonTrajectoryCertificate`, Core/Technical Closure theorem and CENTRAL-18 | Common-chain implementation present; immutable evidence binding pending |
| Static assurance | Complete root imports, zero whole-word `sorry`/`admit`/`axiom`/`unsafe`, clean build | Strict CI record | `BUILD_EVIDENCE_PENDING` |
| Kernel assumptions | Every maintained declaration found exactly once and restricted to the documented Lean foundations | Axiom-audit output | `BUILD_EVIDENCE_PENDING` |
| Provenance | Toolchain, dependency lock, source aggregate, proof manifest and exact commit agree | Integrity record and build evidence | Pending exact binding |
| Independent review | Category/DPO/Petri, pi/domain, and Lean/provenance review bound to the exact commit | Signed review records | Pending human reviewers |

# QA-L4 gates

## Q0 — Scope and traceability

Pass criteria:

- RFC-0002, ADR-0001, this packet, and the proof manifest state the same
  theorem and exclusions;
- each central obligation names a real Lean declaration;
- the FMS sources, versions, hashes, page ranges, assumptions, and applicability
  boundary are recorded;
- no product certificate or review result is fabricated.

Technical disposition: to be determined by the final strict gate and document
audit. Human disposition: review pending.

## Q1 — Reproducible kernel gate

Pass criteria across verified source commit `SOURCE_COMMIT_PENDING` and its
descendant evidence commit `EVIDENCE_COMMIT_PENDING`:

- the pinned root `lake build` succeeds;
- `formal/scripts/ci.ps1 -RequireProved` succeeds;
- the strict gate proves every proof-sensitive path in the evidence commit is
  identical to the verified source commit;
- the source scan finds zero whole-word
  `sorry`, `admit`, `axiom`, or `unsafe`;
- every axiom-audit target resolves exactly once;
- only the documented Lean foundations appear;
- the source aggregate and pinned inputs match
  `formal/source-integrity.json`;
- `formal/proof-obligations.json` contains only `proved` or `reviewed` for the
  accepted Core Theory scope.
- CENTRAL-18 binds one operation/registry/metadata/payload/admission/
  `TrajectoryAgreement`/actual-Agent chain.

Evidence: `BUILD_EVIDENCE_PENDING`.

## Q2 — Semantic regression and negative-boundary gate

The reviewer must inspect positive and negative coverage for:

- illegal wiring and implicit linear resource/channel duplication;
- DPO dangling, active-session deletion and signature redefinition;
- replay identity under multiple redexes;
- declaration-order pre-nets and individual-token provenance;
- alpha conversion, capture avoidance, freshness and scope extrusion;
- `res(com)`, `open+close`, ordinary `com`, mismatch, reconnect, delegation,
  admission and quiescent deletion;
- duplicate/conflicting ballots, missing quorum and explicit accept/reject;
- positive-epsilon convergence and the absence of an unconditional
  convergence claim without epsilon/fairness/stability;
- success, external wait, deadlock and productive infinity;
- the D1-A strong-observation, explicit-bottom, all-domain-definability and
  raw-wire no-go theorems.

Evidence: `BUILD_EVIDENCE_PENDING`.

## Q3 — Independent mathematical review

This gate is **pending**. Required non-author perspectives are:

1. category theory / DPO / Petri;
2. pi-calculus / domain theory;
3. Lean kernel assumptions / provenance.

One person may cover more than one perspective only if the Owner explicitly
records the competence and conflict-of-interest assessment. A DRI self-review
or agent review is not independent QA-L4 evidence.

## Q4 — Completion-scope gate

The technical scope passes only when Q0–Q2 pass for the exact immutable source
commit and the substantive reference witness is included. This gate does not
require any of the eight production packages; it requires the generic
certificate interface through which those packages will later conform.

## Q5 — Governance acceptance

This gate is **pending** until:

- independent reviewers sign evidence bound to the exact source commit;
- the Owner/DRI records final receipt and disposition;
- RFC-0002 completes its real FCP process; and
- ADR-0001 is explicitly changed from Proposed to Accepted.

No build can perform these governance acts.

# Review checklist and signature block

Each reviewer should record:

- exact source commit and build-evidence record inspected;
- theorem symbols sampled or exhaustively checked;
- statement-strength and quantifier-scope findings;
- assumptions and literature-boundary findings;
- replay/epoch/terminal consistency findings;
- any required changes, with severity;
- conflict-of-interest declaration;
- decision: accept, accept with tracked conditions, or reject.

| Review perspective | Reviewer | Commit | Decision | Evidence link |
|---|---|---|---|---|
| Category / DPO / Petri | Pending | Pending | Pending | Pending |
| Pi / domain theory | Pending | Pending | Pending | Pending |
| Lean / provenance | Pending | Pending | Pending | Pending |

Owner/DRI final signature: **Pending**.

# Open quality debt and exclusions

| Item | Disposition | Owner |
|---|---|---|
| Eight production packages | Deferred Product Conformance; each package must supply its own rule inventory, rank, pre-net, resources, authorization, fairness, stable window, positive epsilon, admission and replay witnesses | Future package owners |
| Separated Abramsky effect | Not claimed by D1-A; retained as a literature/reference distinction | Domain-theory reviewer |
| Strong-bisimulation FMS full abstraction | Kernel-refuted for D1-A; native strong-step theorems remain separate | Pi/domain reviewer |
| All-elements/all-omega-CPO definability | Kernel-refuted; only realization of explicitly supplied finite Hoare generated trace sets and syntax-defined `CompactPrefixPoint`s is claimed; no theorem identifies these with every order-theoretic compact Agent element, and contextual source interpretation is not reverse definability | Pi/domain reviewer |
| Raw structural-quotient SMC identity | Not claimed; algebraic wiring plus native commutation is the accepted route | Category/pi reviewers |
| Human independent review | Required before reviewed/QA-L4 complete | Owner/DRI |
| FCP and ADR disposition | Pending explicit human governance action | Owner/DRI |

# Release-quality disposition

Before all technical evidence placeholders are replaced and CENTRAL-18's
common chain is present: **do not promote; immutable evidence binding
pending**.

After they are replaced and the strict proved gate passes:
**Core Theory proved / review-pending; suitable for independent QA-L4 review,
but not yet FCP Passed or ADR Accepted**.
