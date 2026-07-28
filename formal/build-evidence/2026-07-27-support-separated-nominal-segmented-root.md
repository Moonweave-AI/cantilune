# Local formal build evidence — 2026-07-27, support/nominal/segmented increment

Status: successful pinned Lean kernel build, source-integrity gate,
placeholder scan, and dependency audit of the current mutable working tree.
This is not immutable commit-bound proof evidence and is not an independent
human QA-L4 signature.

## Repository and environment

- repository `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch: `codex/theory-foundation`
- proof-sensitive state: modified and untracked relative to `HEAD`
- Git status entries at capture: 26
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

## Load-bearing declarations covered

The integrated build includes:

- actual mathlib monoidal and symmetric category instances for the
  support-separated omega-CPO tensor;
- the natural involutive last-two-world permutation, continuous-natural
  double-shift alpha isomorphism, and both allocation-exchange equations;
- exact restriction/intersection and Fubini factorisation through the
  separated locus;
- the fixed-finite-resource lower omega-Scott `powerObject`, exact support
  laws for return, exact-support maps, choice and multiplication, and the
  complete guarded Fubini support formula and exactness criterion;
- source-to-residual free-name bounds for marked late-pi events, including a
  nonempty-bound-name regression and conservative-criterion counterexamples;
- endpoint append for five-view finite chains;
- an exact no-go theorem for naive full-list common-FMS append at a nonempty
  shared epoch; and
- a half-open `ExactFMSSegmentPath` representation with native endpoint
  continuity, nonduplicating endpoint append, prefix/full action laws, and
  three-way action associativity.

The build also rechecks
`FMSCpoPowerdomainPackageCoherenceNoGo.no_distinguishedFubiniStrictness`,
which is representation-independent and rejects exactly the strengthened
combination of:

- divergence/deadlock disequality;
- commutative Fubini; and
- first-input absorption for both distinguished constants.

It does not reject an Abramsky construction which omits that conjunction.

## Targeted and aggregate builds

Observed successful commands include:

```powershell
lake build Cantilune.Tests.FMSCpoOmegaScottPowerSupport
lake build Cantilune.Tests.LateMarkedResidualFreshness
lake build Cantilune.Tests.FMSCommonSegmentedCrossEpochChain
lake build Cantilune.Pi Cantilune.Tests.All Cantilune
```

The final aggregate command completed successfully with 9099 jobs.

Two independent read-only agent checks additionally rebuilt:

- the five support/FMS targets: 8697 jobs, exit 0; and
- the marked residual and common-chain targets: 8731 jobs, exit 0.

These are adversarial implementation checks, not human QA-L4 approval.

## Complete ordinary evidence gate

Executed from `formal/`:

```powershell
Set-Alias lake C:\Users\NJHL\.elan\bin\lake.exe
Set-Alias lean C:\Users\NJHL\.elan\bin\lean.exe
.\scripts\ci.ps1
```

Observed result:

- source integrity: 445 Lean source files;
- source aggregate SHA-256:
  `d7439408cea6ea3a18f33fa58bc35770ff9c2b73a13ba7bbfd9d68b5a4225542`;
- pinned axiom-target-list SHA-256:
  `ebb84c8e25c883f4f8f6daeec04e04e211527d56a01d9ecc40629a30ad92821e`;
- proof-manifest SHA-256:
  `fb3164b79f04f8dd8127d9942857121fb545b45229407d7a470cc4a6557c5a38`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root `lake build`: successful, 9099 jobs;
- kernel dependency audit: 1296 distinct declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`; and
- ordinary evidence-gate exit code: 0.

Existing Lean linter warnings were emitted, but there were no build,
integrity, placeholder, or dependency-audit errors.

## Strict completion-gate regression

Executed:

```powershell
.\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1 before rebuilding. The gate listed
exactly:

- 11 `implemented_unverified`;
- 7 `partial_scaffold`;
- 0 `proved`; and
- 0 `reviewed`.

This is the correct refusal. It was not bypassed.

## Exact non-closure boundary

This evidence does not establish terminal theory closure:

- the support lift is fixed-finite-resource and lacks world-injection
  naturality and a supported monad;
- separated Fubini remains conditional, and unrestricted lower-power Fubini
  loses support at an empty branch;
- the recursive fixed point remains the unseparated omega-Scott fixed point,
  not algebraic compactness or the source-compatible Abramsky/FMS package;
- FMS agent restriction, adequacy, definability, and full abstraction remain
  unconstructed;
- the strengthened two-constant Fubini law set is inconsistent and requires
  RFC/FCP revision;
- the segmented FMS path is not yet dependently indexed by a concrete
  heterogeneous `EpochChain`;
- a total nonempty named-boundary Open-pi SMC still requires an RFC-selected
  boundary/wire representation;
- no production kernels, coupling, exact FMS inhabitant, or eight
  package-owned runtime fact sets exist in the repository; and
- immutable provenance, independent human QA-L4, RFC FCP, and ADR acceptance
  remain absent.

No proof-manifest status is promoted by this mutable-tree run.
