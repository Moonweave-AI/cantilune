# Local formal build evidence — 2026-07-26, FMS/Open-pi/cross-epoch increment

Status: successful pinned Lean kernel build, placeholder scan, source
integrity gate, and dependency audit of the current working tree. The tree is
uncommitted and this record is not an independent QA-L4 signature.

## Repository and environment

- `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch at execution: `codex/theory-foundation`
- proof-sensitive state: modified/untracked relative to `HEAD`
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

Git dependency checkouts were exposed through process-local
`safe.directory` values only. No global Git configuration was changed.

## New load-bearing declarations covered

The root build includes:

- `FMSCpoOmegaScottPower`: the omega-chain-range Scott topology, continuous
  principal/choice/direct image/flatten, the all-omega-CPO endofunctor,
  natural unit and multiplication, both unit laws, associativity, and the
  resulting unseparated `CategoryTheory.Monad ωCPO`;
- `FMSCpoOmegaScottStrength`: continuous object-level cartesian Fubini and
  left/right candidate strength components, map naturality, pure/principal
  compatibility, swap symmetry, product associativity, and explicit
  right-oriented Fubini equality;
- `FMSCpoOmegaScottStrongCoherence`: the multiplication/Fubini interchange
  as an exact `ContinuousHom` equation, plus chosen-binary-product
  isomorphisms and genuine Fubini/left-strength/right-strength components;
- `FMSCpoOmegaScottWorldMonad`: the actual pointwise Monad on the nonconstant
  `World ⥤ ωCPO` support model, unit and multiplication naturality across
  world injections, and a pointwise Fubini natural transformation;
- `FMSCpoOmegaScottSeparatedNoGo`: the order-theoretic impossibility of a
  monotone multiplication satisfying the two necessary unit instances for
  the direct `WithBot (OmegaScottPower ·)` transformer;
- `OpenSMCActionAlpha`: freshness-safe input and general bound-output action
  and derivative quotients with native one-step renaming compatibility;
- `OpenSMCNamedComposition`: exact-support restriction/plug/parallel
  certificates and the nonempty identity/operational-route no-go results;
- `OpenSMCFiniteControlIdentityBoundary`: exact strong/native trace-length
  bounds, exclusion of arbitrary-long and coherent infinite runs for a fixed
  finite process, and a genuine two-step one-shot relay;
- `CrossEpochProductFamily`: four dependent native/replay chains obtained
  from a supplied heterogeneous admission, new-epoch product rule bundle,
  and endpoint equation.

The corresponding regression modules and all earlier root imports were built
in the same run.

## Full evidence gate

Executed from the repository root with the pinned toolchain and process-local
Git safety configuration:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File formal\scripts\ci.ps1
```

Final observed result:

- source integrity: 305 Lean files;
- aggregate SHA-256:
  `5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`;
- pinned axiom-target-list SHA-256:
  `7babc506661851f0a05e1324c66ec42ad771b8308cb2c70c29c6507f5f10a312`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- `lake build`: successful, 8960 jobs;
- existing linter warnings, no build errors;
- kernel dependency audit: 804 declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`;
- ordinary evidence-gate exit code: 0.

An earlier invocation supplied the wrong root for process-local dependency
`safe.directory` values and was rejected by Git before the build. The
configuration was corrected to `formal/.lake/packages`; the complete gate
above was then run from the beginning and passed. No cache or global Git
configuration was modified.

## Completion-gate regression

Executed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File formal\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1. The gate listed exactly 11
`implemented_unverified` and 7 `partial_scaffold` obligations, with zero
`proved` or `reviewed`. This is the correct governance outcome: a successful
dirty-tree kernel build cannot create immutable provenance or human review.

## Scope boundary

The run does not establish the separated Abramsky free
pointed-semilattice powerdomain, bundled strong-commutative coherence, the
initial recursive FMS agent-domain solution, complete hiding/coherence,
adequacy, selected-scope definability, or process-pair full abstraction.
Nor does it instantiate a production product package: the eight planned
packages currently have no package source trees, rule inventories, or
package-owned proof inputs.

The named Open-pi layer also remains partial. The current exact-name
plug/hide rule rejects nonempty unit composites, and its presented identity
has no native operational wire. Choosing alpha-fresh forwarding, a linear
one-shot identity, or guarded replication/recursion is an RFC decision.

Consequently this evidence promotes no proof-manifest status and cannot by
itself pass QA-L4, FCP, or ADR acceptance.
