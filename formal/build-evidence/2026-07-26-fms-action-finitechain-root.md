# Local formal build evidence — 2026-07-26, exact action/domain boundary/finite-chain increment

Status: successful pinned Lean kernel build, source-integrity check,
placeholder scan, and dependency audit of the current mutable working tree.
This record is not immutable commit-bound evidence and is not an independent
QA-L4 signature.

## Repository and environment

- repository `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch: `codex/theory-foundation`
- proof-sensitive state: modified and untracked relative to `HEAD`
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

Git safety exceptions for the repository and dependency checkouts were
provided only through process-local environment variables. No global Git
configuration was changed. An initial invocation omitted the repository
root from that process-local list and was rejected by Git before any build
or proof check; the complete gate was then rerun from the beginning with the
correct list.

## New load-bearing declarations covered

The root build includes:

- the exact nonconstant FMS action endofunctor and its local continuity;
- the unseparated all-omega-CPO OmegaScott monad's chosen-product
  strong/commutative coherence and local continuity;
- local continuity of the actual composite `P ∘ H`;
- the complete-join universal extension and uniqueness theorem for the
  unseparated lower/Hoare power object, with arbitrary-supremum preservation
  explicit in the target morphism;
- the finite initial approximation tower and the checked absence of a seed
  retraction or stage-zero fixed point;
- the proof-carrying actual fixed-point/algebraic-compactness boundary,
  conditional transport to `AgentDomainSolution`, and no construction of a
  fixed-point inhabitant;
- general bound-output alpha-step quotienting and the contextual named
  category/partial tensor together with their checked operational
  obstructions;
- arbitrary finite cross-epoch five-view replay/event/admission/epoch
  agreement;
- source-probability-space coupling of all five canonical trajectories while
  retaining dependent event marks, DPOEvent replay, and four native target
  derivations; and
- one direct FMS-gated product row retaining its concrete rule and admission
  FMS transitions, plus a checked event-count obstruction showing why the
  current direct row adapter does not compose into a second row.

## Complete ordinary evidence gate

Executed from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File formal\scripts\ci.ps1
```

Observed result:

- source integrity: 343 Lean source files;
- source aggregate SHA-256:
  `8b08b6c0215d4b6430083d14b477febe65f4df4adf7b0ee6a75f27df73d1163b`;
- pinned axiom-target-list SHA-256:
  `f78b81a15b64607e768f495ee2da89457a391743b0e67cd5a8d5ce945f88927f`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root `lake build`: successful, 8997 jobs;
- kernel dependency audit: 987 configured declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`;
- ordinary evidence-gate exit code: 0.

Existing Lean linter warnings were emitted, but there were no build or audit
errors.

## Implementation-level adversarial review

An independent agent pass rejected the first direct multi-row FMS claim.
After the module, manifest, and English/Chinese documentation were narrowed
to a one-row direct adapter plus a conditional finite-chain interface, the
follow-up pass returned `Accept`. It confirmed the event-count obstruction,
the absence of a common FMS package/denotational seam, and the retained
`partial_scaffold` status of CENTRAL-18. This is an implementation-level
scope review only; it is not one of the required human QA-L4 signatures.

## Completion-gate regression

Executed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File formal\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1 before the duplicate build. The gate
listed exactly 11 `implemented_unverified` and 7 `partial_scaffold`
obligations, with zero `proved` or `reviewed`. This is the correct governance
result for an uncommitted tree without independent review.

## Exact boundary

This evidence does not establish:

- a separated Abramsky free pointed continuous-semilattice powerdomain on
  all omega-CPOs;
- a constructed bilimit/initial recursive solution
  `A ≅ P(H A)`;
- full restriction/hiding, allocation, substitution, and strength
  coherence;
- operational adequacy, a separately specified definability theorem, or
  process-pair full abstraction for the source calculus;
- a total operational symmetric monoidal named Open-pi category at nonempty
  boundaries; or
- any of the eight planned production packages' rule inventories and
  package-owned DAG/Petri/morphism admission, rank, resource/session,
  authorization, fairness, stable-window, or positive-epsilon certificates.
- a multi-row common FMS trace: the direct adapter's eventful after epoch
  cannot equal a next adapter's empty before epoch, and the current row-wise
  gate neither fixes one common FMS package nor stores denotational endpoint
  stitching.

The repository's current finite-control pi syntax also lacks the guarded
replication present in the checked FMS source calculus. Expanding that syntax
is an existing RFC/ADR stop condition.

Consequently no proof-manifest entry is promoted by this run. Immutable
provenance, three independent QA-L4 reviews, RFC-0002 FCP, and ADR-0001
acceptance remain external governance requirements.
