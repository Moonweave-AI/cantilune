# Local formal build evidence — 2026-07-27 post-`09f9476` recovery

Status: successful pinned Lean kernel build, source-integrity gate,
placeholder scan, and dependency audit of the current mutable working tree.
This is not immutable commit-bound proof evidence and not an independent
QA-L4 signature.

## Repository and environment

- repository HEAD:
  `09f9476846a54cea3fa7b97a970ec599d1d4c96d`
- branch: `codex/theory-foundation`
- proof-sensitive state: modified and untracked relative to HEAD
- Git status entries at capture: 191
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

## Repaired declarations in scope

P1c reference recovery:

- `Cantilune.Pi.P1cMultiState.matrix_cell_protocol_completion`
- `Cantilune.Pi.P1cMultiState.reflection_correspondence`
- `Cantilune.Pi.P1cMultiState.p1c_complete_protocol`

Unseparated omega-Scott recovery:

- `Cantilune.Pi.PowerdomainUnseparated.divergence_eq_deadlock`
- `Cantilune.Pi.PowerdomainUnseparated.unseparated_monad_exists`
- `Cantilune.Pi.PowerdomainUnseparated.fubiniRaw_swap`
- `Cantilune.Pi.PowerdomainUnseparated.chosenProductStrongCommutativeCertificate_exists`
- `Cantilune.Pi.PowerdomainUnseparated.concrete_actual_agent_equation_inhabited`

Conditional interface theorems, not concrete late-pi inhabitants:

- `Cantilune.Pi.PowerdomainUnseparated.AdequacyPackage.result_membership_iff`
- `Cantilune.Pi.PowerdomainUnseparated.FullAbstractionPackage.full_abstraction_of_package`
- `Cantilune.Pi.PowerdomainUnseparated.DefinabilityPackage.compact_definable_of_package`

## Commands and observed results

Final targeted builds:

```powershell
lake build Cantilune.Pi.P1cMultiState Cantilune.Tests.P1cMultiState
lake build Cantilune.Tests.PowerdomainUnseparated
```

Observed results: both exit code 0; respectively 8,661 and 8,702 jobs.

Complete ordinary evidence gate:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ci.ps1
```

Observed:

- source integrity: 485 Lean source files;
- source aggregate:
  `c21eb3dccf06d3c431d49592d6a0ef433cc5fc474b571d0863f6db176445a1f4`;
- pinned axiom-target-list SHA-256:
  `d03e7b2dfe07f815a59faee72103482b9d023d4161bd725f53848689896f4e2e`;
- proof-manifest SHA-256:
  `5a5b1a3359398d5c51fd452ffa9fc781227ff087361dc5a4741b68e90fc7a90d`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root build successful: 9,139 jobs;
- kernel dependency audit: 1,377 distinct declarations;
- permitted dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`; and
- ordinary evidence-gate exit code 0.

Strict completion gate:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1:

- 11 `implemented_unverified`;
- 7 `partial_scaffold`;
- 0 `proved`;
- 0 `reviewed`.

No central obligation was promoted by this run.

## Exact scope boundary

The repaired P1c facade proves uniform protocol completion and exact
round-trip on its explicit translation image; it does not establish 3,600
native late-pi reductions or general DPO-to-pi reflection.

The unseparated facade exposes a real all-omega-CPO lower omega-Scott monad,
continuous Fubini, and a concrete fixed point/initial algebra/terminal
coalgebra for `ActualAgentFunctor`. Its adequacy, definability, and full
abstraction declarations are derived from proof-carrying package inputs. No
concrete native late-pi package is constructed.

The current tree is not clean or immutable, and no independent QA-L4 review
is recorded. This evidence therefore supports reproducibility of the mutable
tree only and does not authorize FCP promotion.
