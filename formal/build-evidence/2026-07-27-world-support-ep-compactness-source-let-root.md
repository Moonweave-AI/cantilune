# Local formal build evidence — 2026-07-27, world support / EP compactness / source-let boundary

Status: successful pinned Lean kernel build, source-integrity gate,
placeholder scan, and dependency audit of the current mutable working tree.
This is not immutable commit-bound proof evidence and is not an independent
human QA-L4 signature.

## Repository and environment

- repository `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch: `codex/theory-foundation`
- proof-sensitive state: modified and untracked relative to `HEAD`
- Git status entries at capture: 38
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

## Load-bearing declarations added

### Exact support and total support-lax Fubini

- `SupportedWorldModel.powerMonad` transports exact finite support along
  arbitrary injections between finite worlds.
- `powerSupport_mapRaw_reindex` proves exact support pushforward.
- `Bridge.forgetFunctor` is faithful from the exact-support model category
  into the actual functor category `World ⥤ ωCPO`.
- `Bridge.forgetPowerIso` naturally identifies supported power followed by
  forgetting with pointwise omega-Scott power after forgetting; map, unit,
  and multiplication compatibility are also proved.
- `supportLaxPowerMonad` gives the separate support-inclusion category a
  genuine monad.
- `fubiniLax` has kernel proofs of naturality, principal/unit behavior,
  symmetry, associativity, and multiplication interchange.
- `supportLaxMonoidalCategory` and `supportLaxSymmetricCategory` are actual
  mathlib monoidal structures.
- `supportLaxPowerFunctorLaxMonoidal`,
  `supportLaxPowerFunctorLaxBraided`, and the two `NatTrans.IsMonoidal`
  instances package the construction as a commutative monoidal monad.

The exact-support and support-lax categories are distinct. The latter is not
the exact separated tensor. The forgetful functor is not proved full,
essentially surjective, or an equivalence, and its comparison is not
additionally packaged as a monad morphism. The support-lax symmetric monoidal
category is constructed for each fixed finite resource type. Its tensor uses
the underlying Cartesian product, but no separate mathlib finite-product
universal-property package is claimed.

### Concrete EP universal properties

- `concreteEmbeddingCoconeIsColimit`
- `concreteEmbeddingCategoricalIsColimit`
- `InitialAlgebra.concreteActualInitialAlgebra`
- `concreteActualTerminalCoalgebra`
- `concreteActualAlgebraicCompactnessWitness`

The second declaration is a genuine mathlib `IsColimit` for the concrete
diagram in `World ⥤ ωCPO`, bridged from the explicit embedding-cocone
construction. It is an ordinary categorical colimit, not an enriched
colimit or a general solution-set theorem.

The initial and terminal results quantify over every algebra and coalgebra of
the implemented `ActualAgentFunctor`; uniqueness comes respectively from the
explicit embedding cocone colimit and projection limit. The packaged result
is algebraic compactness for this one unseparated lower omega-Scott
endofunctor, not a general theorem for all locally continuous endofunctors
and not an identification with the separated Abramsky/FMS powerdomain.

### FMS source-law boundary

- `CommutativeLetWithStrictConstants.divergence_eq_deadlock`
- `no_separated_commutative_let`
- `FMSCpoFMSLetPackageNoGo.no_sourceLetLaws`

The first two are representation-independent and have no axioms. The
package-level theorem connects the actual mandatory
`CpoPowerdomainPackage.divergence_ne_empty` field to the obstruction: no such
package can also carry strict-divergence, zero-preserving, commutative
source-style `let` laws, even at the one-point test object.

The code comments now record that `divergence_ne_empty` is a strengthened
Cantilune requirement rather than a disequality stated by the FMS source.

### Late-pi alpha and segmented event composition

- `ActionAlpha.iff_orbit_eq_and_boundOutputAdmissible`
- `alphaAction_boundOutput_eq_iff`
- `EpochIndexedExactFMSPath`
- `FiniteCommonFMSSegmentedAgreement.endpointAppend`

The alpha theorems close the general bound-output label quotient while
retaining subject observability and excluding the invalid self-bound label
from genuine open labels.

The segmented path is dependently indexed by a real `EpochChain`, but its
event/action maps and native FMS paths remain supplied inputs at
`agent.obj 0`. Endpoint append is half-open and action-list associativity is
not a stochastic `TrajectoryAgreement`.

## Targeted and aggregate builds

Observed successful targeted commands include:

```powershell
lake build Cantilune.Tests.FMSCpoFMSLetNoGo
lake build Cantilune.Tests.FMSCpoFMSLetPackageNoGo
lake build Cantilune.Tests.FMSCpoConcreteInitialAlgebra
lake build Cantilune.Tests.FMSCpoConcreteTerminalCoalgebra
lake build Cantilune.Tests.FMSCpoConcreteAlgebraicCompactness
lake build Cantilune.Tests.OpenSMCActionAlpha Cantilune.Tests.OpenSMCAlphaTransitionQuotient
```

The final aggregate command (re-run after the categorical-colimit,
forgetful-bridge, and monoidal-package additions):

```powershell
lake build Cantilune.Tests.All Cantilune
```

completed successfully with 9125 jobs.

During the first aggregate attempts, concurrent Lean processes on Windows
failed transiently with exit `3221225477` or a temporary failure to read an
existing mathlib `.olean.private` file. Every listed target was rebuilt
serially and passed; the subsequent complete aggregate passed. No theorem or
tactic failure was hidden by this recovery.

## Complete ordinary evidence gate

Executed from `formal/`:

```powershell
Set-Alias lake C:\Users\NJHL\.elan\bin\lake.exe
Set-Alias lean C:\Users\NJHL\.elan\bin\lean.exe
.\scripts\ci.ps1
```

Observed result:

- source integrity: 471 Lean source files;
- source aggregate SHA-256:
  `d037f58afee8d65e0a911729a168ddf1ab9c0eade57424ec046dc23d6b2d31a5`;
- pinned axiom-target-list SHA-256:
  `68854f39d7a1e430f0114d582aa1a50c61f4423457622e6c2e35246a8f182449`;
- proof-manifest SHA-256:
  `5a5b1a3359398d5c51fd452ffa9fc781227ff087361dc5a4741b68e90fc7a90d`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root `lake build`: successful, 9125 jobs;
- kernel dependency audit: 1367 distinct declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`;
- `git diff --check`: exit 0; and
- ordinary evidence-gate exit code: 0.

Existing Lean linter warnings were emitted, but there were no final build,
integrity, placeholder, or dependency-audit errors.

## Strict completion-gate regression

Executed:

```powershell
.\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1. The gate listed exactly:

- 11 `implemented_unverified`;
- 7 `partial_scaffold`;
- 0 `proved`; and
- 0 `reviewed`.

The gate correctly refused terminal completion and was not bypassed.

## Independent adversarial review boundary

A read-only agent review rebuilt the support/world/colimit/segmented targets
and found no incorrect kernel theorem. It identified important scope limits
that are now recorded in the manifest and research log:

- the supported-world monad is a custom category, not yet an equivalence with
  `World ⥤ ωCPO`; the new bridge is faithful but not full or essentially
  surjective;
- support-lax Fubini now is a complete mathlib commutative monoidal-monad
  package in the support-inclusion category, but remains distinct from exact
  separated Fubini;
- the embedding universal property now has a genuine mathlib `IsColimit`
  bridge, but is still an ordinary rather than enriched colimit and does not
  prove general algebraic compactness;
- the segmented FMS path consumes arbitrary supplied action/native evidence,
  is fixed at world zero, and is not a production trajectory law; and
- the source-let no-go requires its three explicit source-style laws and does
  not refute every powerdomain construction.

This agent review is not an independent human QA-L4 approval.

A final read-only follow-up review directly inspected and rebuilt the three
new bridge/package targets. It found no blocker, major correctness defect,
vacuous assumption, constant-diagram substitution, or placeholder. It
confirmed that:

- the categorical diagram uses the real nonconstant `concreteStageMap` tower
  and its `IsColimit` quantifies all cocones and mediators;
- the supported-world forgetful functor is genuinely faithful and compares
  the actual unseparated pointwise power endofunctors; and
- the support-lax symmetric monoidal and monoidal-monad structures quantify
  arbitrary objects and arrows for a fixed finite resource type.

That follow-up is an adversarial agent review of mutable-tree evidence, not a
commit-bound independent QA-L4 signature, so no manifest status was promoted.

## Exact non-closure boundary

The current working tree still lacks:

- a source-compatible separated Abramsky/FMS powerdomain satisfying an
  RFC-consistent law set;
- complete FMS agent restriction, operational adequacy, definability, and
  source-pinned full abstraction;
- an RFC-selected total nonempty named-boundary Open-pi category with reusable
  wires and native plug/hide/restriction adequacy;
- two concrete production Markov kernels, their coupling, and a production
  exact-FMS package;
- all eight package-owned rule/rank/pre-net/resource/authorization/fairness/
  stable-window/positive-epsilon fact sets;
- immutable commit-bound proof provenance; and
- independent QA-L4, FCP, and ADR acceptance.

No proof-manifest status is promoted by this mutable-tree run.
