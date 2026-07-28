# Local formal build evidence — 2026-07-27, bilimit/alpha/Fubini-boundary increment

Status: successful pinned Lean kernel build, source-integrity check,
placeholder scan, and dependency audit of the current mutable working tree.
This record is not immutable commit-bound evidence and is not an independent
human QA-L4 signature.

## Repository and environment

- repository `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch: `codex/theory-foundation`
- proof-sensitive state: modified and untracked relative to `HEAD`
- Git status entries at capture: 24
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

## Load-bearing declarations covered

The integrated root build includes:

- continuous embedding-projection pairs, the concrete recursive iteration
  tower, coherent-thread projection limits, finite-stage embeddings, and the
  unconditional inhabitant `concreteBilimitExhaustivity`;
- derivation of both canonical fold inverse laws, shifted projection-limit
  preservation, and the continuous-natural
  `concreteActualFixedPointWitness` for the unseparated omega-Scott functor;
- arbitrary-fresh-choice substitution permutation up to `RecursiveAlpha`,
  all three binder common-fresh normalizers, the total
  `RecursiveAlpha.substitutionCongruent` inhabitant, and unconditional
  all-constructor recursive native-step permutation returning one genuine
  native step and an alpha-related target;
- `powerHiding` for the actual unseparated omega-Scott world monad, with
  allocation, unit, multiplication, and chosen-Fubini coherence; and
- the concrete effectful support-denotation allocate/hide retraction; and
- the representation-independent package theorem
  `no_distinguishedFubiniStrictness`, which rejects the simultaneous
  strengthened requirements of separated divergence/deadlock, commutative
  Fubini, and first-input strictness for both distinguished constants.

## Complete ordinary evidence gate

Executed from `formal/`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\ci.ps1
```

Observed result:

- source integrity: 427 Lean source files;
- source aggregate SHA-256:
  `039c48d0c5a946fbf5f02cb0ee67c81ff73a428fe49291ddda92a8fe61ea7064`;
- pinned axiom-target-list SHA-256:
  `a2b76a74a497760f5e083a984a17995b76b74fa93eff877c99cf8f67953b0650`;
- proof-manifest SHA-256:
  `ada80d16a37993169268a8584bd23b1f5f75769d0b2a45c257ceb283af1ea699`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- aggregate `lake build Cantilune.Pi Cantilune.Tests.All`: successful,
  9079 jobs;
- root CI `lake build`: successful, 9081 jobs;
- kernel dependency audit: 1232 declarations;
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

Observed result: expected exit code 1. The gate listed exactly:

- 11 `implemented_unverified`;
- 7 `partial_scaffold`;
- 0 `proved`; and
- 0 `reviewed`.

This is a correct refusal, not a CI failure to be bypassed.

## Adversarial agent-level review

A separate read-only review found no P0–P2 correctness defect, hidden
postulate, circular proof, weak transition presented as a native step, or
unjustified naturality claim.

The reviews confirmed:

- `concreteBilimitExhaustivity` is a noncircular inhabitant whose
  coordinate-exhaustivity argument reaches each target coordinate at a
  finite stage;
- `concreteActualFixedPointWitness` is an actual fixed point only for the
  unseparated omega-Scott lower/Hoare functor, not algebraic compactness or an
  Abramsky powerdomain;
- `powerHiding` is monadic direct-image coherence for the unseparated
  omega-Scott model, not recursive-agent restriction or full abstraction;
- `RecursiveAlpha.substitutionCongruent` is unconditionally constructed and
  closes all native constructors up to alpha without a weak-step
  replacement; and
- `no_distinguishedFubiniStrictness` uses no finite powerset representation
  and refutes exactly its stated strengthened combination, not every
  Abramsky construction.

This is implementation review evidence, not an independent human QA-L4
signature.

## Exact terminal boundary

The evidence does not establish total theory closure:

- no recursive agent, algebraic-compactness witness, agent restriction,
  syntax denotation, adequacy, definability, or full-abstraction package is
  constructed;
- the current strengthened FMS target is inconsistent if it simultaneously
  retains separated divergence/deadlock, commutative Fubini, and both
  first-input strictness laws, so FCP must revise that target before a
  source-compatible semantic package can be completed;
- no RFC-selected total nonempty named-boundary operational Open-π SMC
  exists;
- the generic production trajectory theorem still consumes, rather than
  constructs, two production kernels, their coupling, and an exact FMS
  package;
- all eight planned products still lack package-owned rule inventories,
  rank, pre-net, resource/session, authorization, fairness/stable-window,
  and positive-epsilon facts; and
- immutable provenance, human QA-L4, RFC-0002 FCP, and ADR-0001 acceptance
  remain absent.

No proof-manifest status is promoted by this run.

## Nominal separation and marked-occurrence increment

The same mutable working tree subsequently added:

- preservation and reflection of finite-support disjointness under arbitrary
  finite-world injections, with permutation and allocation instances;
- equality of the actual continuous renaming maps for the fresh-choice alpha
  permutation;
- transport and reflection of compatibility and partial composition in the
  concrete finite-support PCM; and
- provenance-bearing raw and recursive strong-late native events, total
  marking/erasure, and an occurrence-based parallel residual square whose
  exact two orders are marked native traces with a common endpoint.

The marked-event tests include two important negative controls. Two genuine
same-channel synchronizations retain the hidden channel in their event
support and are therefore not independent after action erasure to `tau`.
The reversed traces of the choice process `(a.b) + (b.a)` cannot construct a
parallel residual square. Distinct-channel replicated outputs provide the
positive exact-diamond control.

The post-integration ordinary evidence gate was executed from `formal/` with
the pinned Elan `lake` and `lean` executables explicitly bound in the current
PowerShell process. Its observed result was:

- source integrity: 431 Lean source files;
- source aggregate SHA-256:
  `9a3e26998208054ec8624c973c87ba2c9b6f0d53acb3a259ad6c7fa4d67cd379`;
- pinned axiom-target-list SHA-256:
  `77bd6d6a25d6ca78843c95881d869c0d07d1e7ec24defecfb1ae1b9cf7abe05c`;
- proof-manifest SHA-256:
  `aa0c1c3e0fa6768dd727c9c8e29e4197a129e738b429eca47803696a9fc21a56`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root `lake build`: successful, 9085 jobs;
- kernel dependency audit: 1246 declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`; and
- ordinary evidence-gate exit code: 0.

The strict completion gate was then executed against the same source state.
It correctly exited 1 before rebuilding and listed exactly:

- 11 `implemented_unverified`;
- 7 `partial_scaffold`;
- 0 `proved`; and
- 0 `reviewed`.

This is a correct quality-gate refusal. It is not a Lean build failure and
was not bypassed.

The increment does not automatically derive the four explicit
source/residual freshness premises, construct an alpha-freshened
`DerivativeAlpha` residual square, prove the general recursive
structural-congruence diamond, or migrate every consumer of the older
label-only replay quotient. It also does not alter the exact terminal
boundary recorded above: the strengthened FMS target still needs an FCP
resolution, the total named-boundary Open-pi category still needs a public
representation decision, and the production package facts and kernels are
still absent.

No proof-manifest, QA-L4, RFC, or ADR status is promoted by this increment.
