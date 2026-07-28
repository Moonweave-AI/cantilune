# Theory implementation evidence log

Status: historical, unreviewed implementation snapshot; superseded by
`docs/research/0006-theory-closure-iteration.md` for current proof scope  
Captured: 2026-07-23 (Asia/Shanghai)
Last reconciled: 2026-07-23 (post-foundation extension)

> **Reading rule:** statements below that use “current”, including the old
> 12/60 P1c matrix stop, the absence of a stochastic trajectory kernel, and
> the absence of general arbitrary-monic presheaf DPO concurrency, describe
> this captured snapshot only. They must not be used as the status of the
> 2026-07-24 tree. Research log 0006 records the later 60/60 event-indexed
> matrix (with its separate full-late-reflection obstruction), general
> arbitrary-monic gluing/complement/concurrency theorems, actual event-labelled
> trajectory bridge, and the boundaries that still remain.

## Governance and baseline

- Work object: formal-research program and proof-evidence hardening.
- Risk: S2.
- Required quality gate: QA-L4.
- Lifecycle and maturity: Pre-FCP / M1.
- Baseline HEAD: `a592d868f19556361cb52aa03772912af4e8bed4`.
- Working branch: `codex/theory-foundation`.
- Tracked patch hash at capture: `dc7be8d20661b3ebef205adf6a893cf2f9deb733`.
  This is the result of hashing `git diff --binary` at capture time; it does
  not include untracked files and is not a commit or review artifact.
- The working tree was already dirty when this implementation began. No files
  were staged or committed by this evidence-infrastructure task.
- Human Owner/DRI and the three independent category reviewers remain
  unrecorded. No QA, FCP, or ADR approval is claimed.

The local pins are Lean `v4.32.0` and mathlib `v4.32.0`.
`formal/lake-manifest.json` resolves mathlib and every transitive dependency
to an exact commit. `formal/build-evidence/2026-07-23-local.md` records the
complete local evidence gate for the reconciled tree: 63 project Lean files,
8,718 build jobs, and 76 maintained axiom-audit declarations. The tree remains
uncommitted, so this is local build evidence rather than commit-bound proof or
independent review.
Because the source state has no immutable commit and the full central
statements have not been constructed, all 18 manifest entries are
`partial_scaffold`. The central
`four_projection_consistency` symbol now composes four already-supplied
five-layer certificates; no intended-calculus four-certificate instance
exists. No entry is `proved` or `reviewed`.

## Implemented draft surface

The current `formal/` tree contains the following implementation drafts:

- finite signatures, monotone signature-extension data, explicit structural
  copy/drop syntax, raw free-SMC terms, raw-term initiality, and coherent
  extension/reindex composition;
- a generated FreeSMC congruence containing the category, tensor,
  associator/unitor/symmetry naturality, inverse, pentagon, triangle, and
  hexagon equations; the hom-wise quotient; an all-carrier `LawfulAlgebra`;
  quotient-fold factorization; exact uniqueness for strict
  identity-on-object interpretations; and the corresponding unit/tensor/
  naturality-preserving `CoherentMonoidalIso` uniqueness theorem;
- finite typed open directed hypergraphs with ordered typed ports and embedded
  boundaries; an executable inclusion-match DPOI fragment with complement/
  result construction, dangling rejection, boundary preservation,
  subject reduction, fixed-match uniqueness, and finite carrier concurrency;
- typed hypergraphs instantiated as a slice of an actual presheaf category,
  using mathlib's `Adhesive` structure, with monic open boundaries, witnessed
  DPO squares, Van Kampen/pullback consequences, and canonical uniqueness of
  a fixed second pushout result;
- a node-only quiescent-deletion obligation tied to an observable package
  step and deterministic replay, with explicit dangling, resource, session,
  endpoint, and tombstone conditions plus positive/negative fixtures;
- runtime configurations, endpoint-free replay recipes, deterministic replay
  kernels, kernel-verified event records, observable LTS definitions,
  terminal-state classification, and generic operational projection
  certificates;
- four-view signature-admission data requiring total DAG, Petri, π, and
  morphism interpretations, together with preservation and transitivity
  proofs across epoch boundaries;
- a layered projection interface that keeps a mathlib symmetric-monoidal
  functor certificate separate from the operational LTS certificate, then
  packages one explicit admission step, resource preservation, and the full
  success/wait/deadlock classification without conflating those layers;
- a finite, nonempty reference execution with independently named DAG,
  declaration-order individual-token pre-net, and morphism views, plus a
  reusable `ObservableLTSIso`-to-`ProjectionCertificate` construction and a
  general three-view operational P1a family over supplied certificates; a
  second polymorphic family combines three supplied five-layer certificates
  and exposes simultaneous native rewrite, admission, resource, and terminal
  theorems without manufacturing any missing layer;
- finite-control typed and raw pi syntax, native transitions, one-step
  erasure, and a presented typed open-process SMC;
- a finite-control late-pi layer with free/all-name analysis, deterministic
  freshening, capture-avoiding substitution, alpha equivalence, structural
  congruence, freshness-guarded native strong late steps, and structural
  closure;
- finite closed request/accept and single-delegation projection certificates
  whose reflection ranges over every native target action, plus a
  mechanically enumerable 15-event by four-projection P1c matrix;
- an external FMS interface and conditional syntax-level commuting theorem,
  together with an actual finite-injection mathlib category, nonconstant
  covariant support objects in `World ⥤ Type` and `World ⥤ ωCPO`, natural
  inactive/parallel operations, allocation, and omega-continuous direct image;
  a concrete support model, bridge obligations, and reference open
  interpretation discharge the commuting theorem pointwise, while a checked
  swap counterexample exposes the missing supported-process renaming layer;
- generic finite-height join evidence, upward-closed stable regions,
  identity-aware aggregation, explicit external acceptance/rejection, finite
  strict-progress bounds, exclusion of infinite internal oscillation,
  conditional geometric-tail convergence, a measure-theoretic
  almost-sure-hitting bridge, the `H/ε` opportunity-count bound, and a
  deterministic `ExecutionPackage`-to-feedback bridge with exact finite-path
  replay;
- a genuine homogeneous mathlib Markov kernel, Ionescu--Tulcea construction
  of the infinite trajectory measure, measurable decreasing not-hit events,
  probability-one support on native execution successors, and a conditional
  construction of the tail/hitting bridge, plus a general finite-native-kernel
  proof identifying killed-chain miss mass with not-hit cylinder probability;
- generic four-certificate operational composition and one nonempty
  shared-source finite instance spanning DAG, pre-net, native π, and morphism
  targets, plus a separate central constructor that accepts four supplied
  five-layer complete certificates sharing one source/admission and exposes
  their combined consistency package.

These artifacts establish a useful executable proof skeleton. They do not, by
themselves, discharge the full theory plan. Their exact build state is tracked
in `formal/proof-obligations.json`. `partial_scaffold` means a kernel-buildable
supporting declaration exists but the central theorem's stated scope or exit
conditions are still unmet; it cannot be promoted merely by committing it.

## Explicit theory gaps

The following obligations remain open and must not be inferred from the draft
surface:

1. The generated FreeSMC equation quotient, its internal SMC laws, and exact
   strict identity-on-object universal property now exist. A mechanized
   `CoherentMonoidalIso` formulation supplies the corresponding weaker
   up-to-isomorphism statement inside that same interpretation class. The
   maintained witness is not a mathlib `MonoidalCategory` instance, and
   arbitrary object-mapping strong monoidal targets remain outside the
   theorem. This static quotient does not imply any projection's DPO
   preservation.
2. Typed-open DPOI now has two real but separate layers. The executable finite
   inclusion-match fragment constructs complements/results under explicit
   gluing conditions. The categorical layer is an actual adhesive presheaf
   slice and proves Van Kampen/pullback properties for witnessed squares. A
   fixed-host category of finite active-support views now has a faithful
   inclusion functor into that slice. For every executable inclusion event
   satisfying `InterfaceLocal`, explicit intersection/union equations prove
   both DPO squares are pushouts in the slice. This is a scoped bridge, not an
   equivalence: ordered port positions are retained in concrete incidence
   carriers but omitted from the type graph, the source category contains
   only views of one host, and faithfulness is on a thin inclusion category.
   Arbitrary legal monic matches, their general complement theorem, and
   categorical critical-pair/concurrency remain absent. Adhesivity alone does
   not supply complement existence.
3. Four-view admission makes all four total interpretations and old-view
   preservation explicit and records an epoch-boundary tombstone identifier.
   A layered certificate ties one nonempty reference event to a source step
   and an unfiltered native π input step. General quantification over every
   admitted extension, concrete target admission semantics for DAG/Petri/
   Morphism, permanent tombstone replay, and cross-projection quiescent
   deletion remain absent.
4. P1a now has a reusable general **operational** family: supplied independent
   observable-LTS isomorphisms yield sound/reflecting certificates and
   simultaneous path/terminal/version theorems. A separate polymorphic
   five-layer family combines already-supplied static, operational,
   admission, resource, and terminal certificates. Neither theorem constructs
   the intended DAG/Petri LTSs or their DPO rule maps; the concrete DAG and
   pre-net values remain finite fixtures.
5. The pi work now includes finite-control alpha equivalence, structural
   congruence, capture-avoiding substitution, freshness-guarded late native
   steps, and structural closure, in addition to the finite closed
   request/accept/delegation certificates. The existing typed erasure theorem
   targets a raw kernel with weaker freshness premises; it does not show that
   every typed step is a `Late.NativeStep`.

   The P1c audit surface has
   `15 events × 4 projections = 60` typed cells. Exactly 12 cells carry native
   strong derivations and 48 remain indexed pending obligations, so current
   `RuleMatrix.Complete` is false. The current π relation has no native
   mismatch-decision, instance-reconnect, or quiescent-delete constructor;
   the three corresponding event-indexed `NativeDerivation` types are proved
   uninhabited. This is an RFC/ADR stop condition. It cannot be discharged by
   metadata, a reflexive step, or silent weakening to `τ*`.
6. Real nonconstant functors now exist in the mathlib functor categories
   `World ⥤ Type` and `World ⥤ ωCPO`; world action, natural support-level
   inactive/parallel, allocation, and omega-continuity are checked. A concrete
   support `ExternalFMS` and reference `OpenInterpretation` prove pointwise
   commutation; their plug/hide operation is only boundary-agnostic union.
   These are support models, not the FMS powerdomain/domain-equation agent
   model. A checked swap counterexample shows that fixed nominal syntax is not
   a natural global element, so supported-process contexts and process
   renaming remain required. Adequate hiding, quotient descent, and full
   abstraction remain absent.
7. The feedback layer now starts from a genuine Markov kernel, uses
   Ionescu--Tulcea to construct an infinite-path probability law, defines
   measurable decreasing not-hit events, and constructs the tail/hitting
   bridge when `KernelProgressAssumption` is supplied. For finite discrete
   packages, a stochastic matrix now requires native support for every
   positive off-diagonal transition and the geometric miss recurrence is
   derived from row sums plus supplied pointwise positive-epsilon progress.
   A finite-cylinder induction over the actual Ionescu--Tulcea `trajMeasure`
   proves, for every finite native kernel, that endpoint-cylinder mass equals
   killed-chain survivor mass and therefore not-hit probability equals finite
   miss probability. No package-specific state-trajectory-agreement premise
   remains. An independent review confirmed the indexing and measurability
   boundary. The matrix support field nevertheless supplies only existence of
   a native step for positive off-diagonal mass; it does not choose event
   labels, replay a `DPOEvent`, treat diagonal holding as an event, or identify
   kernel time with package epochs. Stable-region alignment, stable-window,
   fairness, and positive-epsilon progress witnesses are still not derived
   from every shared package.
8. The central four-projection theorem combines static SMC, operational, one
   admission, resource, and terminal layers only from four already-supplied
   complete certificates. No intended-calculus four-certificate instance
   exists. The 48 P1c cells, executable/categorical DPOI bridge, OpenPi-to-FMS
   commuting instance, all-admission/resource semantics, and package-specific
   stable-window/fairness/positive-epsilon instantiation all remain open.

The authoritative list of all 18 central theorem obligations is
`formal/proof-obligations.json`.

## Independent Agent read-only audit

An independent Agent audit was run against the complete local proof tree after
the initial implementation. This is a second-author technical check, not a
human QA-L4 review. It found no local unchecked axiom, proof placeholder, or
logical self-reference in the Lean declarations it inspected. It did find
that the original `implemented_unverified` classification overstated the
scope of all 17 existing central-name declarations. The manifest was therefore
downgraded to `partial_scaffold`.

The audit's material findings are:

- `ProjectionCertificate` closes paths from supplied single-step soundness and
  reflection fields but has no static SMC, DPO, resource, signature-admission,
  or extension-coherence component.
- request/accept and mobility certificates select a τ-only observation policy.
  Native visible input/output behavior is filtered out, so reflection,
  normality, and terminality are not statements about every native π step.
- `open_pi_smc` is a freely presented quotient whose generated relation
  contains the SMC laws. It does not yet prove that boundaries match free
  names or that its operations implement standard π plugging, hiding, and
  parallel semantics.
- the FMS theorem is conditional on an abstract bridge over raw terms. No
  finite-injection world action, naturality, actual `Set^I`/`Cpo^I` instance,
  quotient descent, dynamic allocation, or full-abstraction witness exists.
- the probability theorem proves convergence of an abstract tail sequence.
  It has no probability measure, stochastic execution kernel, hitting event,
  or almost-everywhere bridge; the `H/ε` theorem is an abstract tail-sum bound.
- DPO uniqueness fixes an already witnessed complement, and DPO concurrency is
  a finite-support executable fragment rather than the general typed-open
  M-adhesive DPOI result.

These findings are encoded per obligation in the manifest and are blockers to
the final theorem, not optional cleanup.

### Remediation completed after that audit

The audit findings above are retained as a historical record. The following
specific weaknesses have since been removed:

- replay no longer defines success by equality with the stored target. A
  `ReplayKernel` receives an endpoint-free recipe and a claimed source, and a
  `Verified` event proves that deterministic execution recomputes the recorded
  target;
- the finite request/accept and delegation certificates now use fully
  restricted closed target processes, observe every native π action, and prove
  transition uniqueness or absence directly on every mapped state. The earlier
  τ-only policy issue is therefore closed for these finite witnesses;
- the hard feedback layer is parameterized by a finite-height join semilattice
  and an upward-closed stable region, rather than only the original numeric
  threshold model;
- `feedback_almost_sure_hitting` now quantifies over an explicit probability
  measure and proves an almost-everywhere hitting statement from a decreasing
  measurable-event bridge; and
- signature admission now requires all four target interpretations and proves
  that their preservation evidence composes across epoch boundaries.
- a separate layered certificate now records a real mathlib braided/strong
  monoidal functor, operational reflection, one native admission step,
  resource preservation, and terminal classification; and
- a deterministic execution/feedback bridge now proves exact finite-path
  replay and preservation of threshold stability for any concrete bridge
  instance.
- the raw FreeSMC now has a generated SMC-equation congruence, hom-wise
  quotient, all-carrier lawful target interface, coherence proofs, and strict
  quotient universal property;
- finite typed-open DPOI has been separated from, and supplemented by, an
  actual adhesive presheaf-slice ambient with witnessed Van Kampen DPO
  squares;
- a reusable general operational P1a theorem now constructs certificates from
  independently supplied observable-LTS isomorphisms;
- finite-control alpha equivalence, structural congruence, capture-avoiding
  substitution, and a freshness-guarded strong late relation now exist;
- actual nonconstant covariant support functors now inhabit both the set and
  omega-CPO functor categories; and
- the probability layer now starts from a genuine Markov kernel and
  Ionescu--Tulcea trajectory measure rather than an externally postulated
  sequence.

These remediations close the historical statements “no quotient,” “no
adhesive ambient,” “no nominal late layer,” “only constant/abstract functor
objects,” and “no stochastic kernel.” They do **not** close the stronger
central obligations recorded at that time. This paragraph is itself
superseded by research log 0006: arbitrary-target FreeSMC comparison,
arbitrary-monic presheaf complement/concurrency, and all 60 event-indexed P1c
cells have since been mechanized, while whole-slice equivalence has been
refuted and full raw late-LTS reflection remains obstructed. The FMS
powerdomain/domain/full-abstraction instance, intended static/resource/
admission P1a instances, package-specific stable-window/fairness/
positive-epsilon witnesses, all-admission quantification, and the shared four
complete certificates remain open.

### Historical RFC/ADR stop condition (superseded)

At this snapshot the P1c matrix was not merely undocumented work. Its then-current total-completion
proposition is refuted, and the refutation is stable under completing all
non-π columns:

- matrix size: 60 cells;
- native strong cells: 12;
- typed pending cells: 48;
- native π derivations proved uninhabited:
  `mismatchGuard`, `instanceReconnect`, and `instanceDeleteQuiescent`.
- `no_complete_extension_preserving_pi` proves that any matrix with the same
  π column is incomplete, independently of how the other three columns are
  filled.

The fixed plan still requires one native target derivation per source event and
forbids silent replacement by weak `τ*`. Therefore an implementer may not
mark these cells complete or quietly change their observation policy.
The later authorized native extension supplied all 15 π witnesses and all 60
event-indexed cells, so the missing-witness statement above no longer blocks
the finite reference matrix. It did not establish reflection of the whole raw
standard-late LTS: open reconnect/delete sources have extra environmental
transitions. Resolving that stronger obstruction remains an RFC/ADR decision,
and the intended `four_projection_consistency` instance is still absent.

## Evidence and CI policy

`formal/scripts/ci.ps1` is the local and CI entry point. It:

1. requires the committed Lean toolchain, Lake dependency manifest, proof
   manifest, and audit-target list;
2. verifies the executable source-integrity record;
3. validates the 18-entry proof manifest and rejects unsupported evidence
   statuses;
4. binds any future `proved/reviewed` entry to an existing commit whose
   proof-sensitive tree is unchanged and to evidence files containing both
   the commit and declaration;
5. rejects whole-word proof placeholders in project-owned Lean sources;
6. runs `lake build`; and
7. imports the project, parses every maintained kernel dependency report, and
   rejects axioms outside `propext`, `Classical.choice`, and `Quot.sound`.

The audit-target file is intentionally append-only at the proof-surface level:
a central result should be added when it becomes maintained evidence. The
allowlist gate is deterministic, but accepting or removing a foundational
principle remains a reviewed policy decision.

The default command is a development evidence gate and deliberately permits
`partial_scaffold` and `missing`. The promotion command
`formal/scripts/ci.ps1 -RequireComplete` rejects every status other than
`reviewed`; it is expected to fail until all central work and independent
reviews are genuinely complete.

The GitHub Actions workflow runs the same script and rejects a missing or
drifting dependency lock. Its runner is fixed to `ubuntu-24.04`; checkout is
pinned to `34e114876b0b11c390a56381ad16ebd13914f8d5`, and lean-action is pinned
to `38fbc41a8c28c4cbaec22d7f7de508ec2e7c0dd9`. The action's repository cache
is disabled because its built-in root-relative lock hash does not follow this
project's `formal/` layout; the mathlib cache remains enabled. The action's
own build is disabled so the evidence script is the single build authority.
The workflow has not been run remotely for this uncommitted tree, so no CI
service result is claimed.

## Advancement conditions

Before changing any manifest item to `proved`, record:

- the fully qualified Lean declaration;
- a successful build using the committed `lean-toolchain` and
  `lake-manifest.json`;
- the exact 40-character source commit; and
- a durable build-evidence reference.

Before changing an item to `reviewed`, also record independent review evidence.
QA-L4 completion, RFC FCP passage, and ADR acceptance are separate human
governance events and must be recorded in their authoritative sources; this
log cannot grant them.
