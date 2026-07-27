# Local formal build evidence — 2026-07-26, NDωCPO/AFT and common-FMS increment

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
configuration was changed.

## New load-bearing declarations covered

The root build includes:

- the actual category `NDωCPO`, arbitrary small products and equalizers,
  `HasLimits.{0}`, and preservation of the constructed limits by the carrier
  functor;
- pointwise omega-CPO hom objects for strict continuous semilattice arrows
  and jointly omega-continuous categorical composition;
- the separated two-point initial `NDωCPO` object, hence the actual free
  algebra on zero generators;
- the exact equivalence between the global carrier solution-set condition
  and existence of its ordinary left adjoint;
- conditional construction, from that solution set, of the ordinary free
  functor, adjunction, monad, strict algebraic multiplication, and complete
  free-extension universal property;
- the genuine singleton local solution set and initial structured arrow for
  the empty omega-CPO;
- the kernel-checked obstruction showing that, for every nonempty finite
  equality source, the separated strict finite-powerset structured arrow is
  not initial and no all-target free extension operation exists;
- an exact separation of the still-uninhabited global solution-set and
  `OrdinaryFubiniWitness` inputs;
- the nonempty-boundary no-go for a total occurrence-preserving concrete-name
  tensor and exact-name plug certificate, together with native one-step
  finite hiding and sync/close propagation;
- one common-package, endpoint-carried two-row FMS chain with four native FMS
  edges and explicit operational and denotational seams; and
- positional source-event/FMS-action agreement for the canonical
  deterministic marked replay scheduler.

## Complete ordinary evidence gate

Executed from `formal/`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\ci.ps1
```

Observed result:

- source integrity: 359 Lean source files;
- source aggregate SHA-256:
  `7bf56b13ed7075f476b9ba71c00c840b904678a42d2f3d1df734af57a9162eb4`;
- pinned axiom-target-list SHA-256:
  `7471e603f5b060b0afbd1037b8f9a7b07698184cee4a49b44789c300b3fb30c7`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root `lake build`: successful, 9013 jobs;
- kernel dependency audit: 1043 declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`;
- ordinary evidence-gate exit code: 0.

Existing Lean linter warnings were emitted, but there were no build or audit
errors.

## Completion-gate regression

Executed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1 before a duplicate build. The gate
listed exactly 11 `implemented_unverified` and 7 `partial_scaffold`
obligations, with zero `proved` or `reviewed`.

## Exact boundary

This evidence does not establish:

- the global all-source `SolutionSetCondition` or its required cardinal
  closure and small representative family;
- an inhabited commutative Fubini witness, enriched free/forgetful
  adjunction, or all strong/Kleisli powerdomain coherence;
- a constructed continuous-natural initial solution `A ≅ P(H A)`;
- complete restriction/hiding, allocation, substitution, operational
  adequacy, a separately specified definability result, or process-pair full
  abstraction;
- a total named-boundary Open-pi SMC under the current concrete-name
  representation;
- a production-kernel `TrajectoryAgreement` for the two-row common-FMS
  theorem; or
- any of the eight planned production packages' missing rule inventories and
  package-owned DAG/Petri/morphism admission, rank, resource/session,
  authorization, fairness, stable-window, or positive-epsilon inputs.

Consequently no proof-manifest entry is promoted by this run. Immutable
provenance, three independent QA-L4 reviews, RFC-0002 FCP, and ADR-0001
acceptance remain external governance requirements.
