import Cantilune.Core.CoherentProjection
import Cantilune.Core.ExecutionEpochTrace
import Cantilune.Core.ProjectionFamily

/-!
# Epoch-separated projection certificates

`CompleteProjectionCertificate` combines a fixed-signature operational
projection with a strictly epoch-advancing signature admission.  That
combination is not sound when its source is an `ExecutionPackage`: every
native package step replays a fixed-signature `DPOEvent` and therefore
preserves the signature version.

This module separates the two layers:

* `CoherentFixedProjectionCertificate` certifies one projection inside a
  fixed-signature epoch and contains no admission field;
* `HeterogeneousPackageAdmission` certifies a native transition between two
  separately typed execution packages and independently requires
  `AdmissionReplays`;
* `HeterogeneousAdmissionProjection` relates one source admission to one
  target-view admission without erasing either event or endpoint type; and
* `FourTargetAdmissionBundle` packages four independently typed target views
  around one shared source admission.

The interfaces below are root-imported and kernel-built in the current
working tree.  They remain generic interfaces: concrete target semantics,
static interpretations, and product policy evidence are supplied by their
inhabitants.
-/

namespace Cantilune.Core

open CategoryTheory
open ExecutionEpochTrace

universe u v

/--
The static, operational, resource, terminal, and cross-layer evidence for one
projection inside a fixed-signature epoch.

There is deliberately no `SignatureAdmissionEvent` field.  Epoch boundaries
are represented by the heterogeneous structures below.
-/
structure CoherentFixedProjectionCertificate
    (SourceCategory TargetCategory : Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (Source Target : ObservableLTS)
    (sourceRealization :
      CategoricalLTSRealization Source SourceCategory)
    (targetRealization :
      CategoricalLTSRealization Target TargetCategory) where
  static :
    StaticSMCProjectionCertificate SourceCategory TargetCategory
  operational : ProjectionCertificate Source Target
  resources : ResourceProjectionCompatibility operational
  terminals : TerminalProjectionCompatibility operational
  crossLayer :
    StaticOperationalCoherence static operational
      sourceRealization targetRealization

namespace CoherentFixedProjectionCertificate

/--
Select the fixed-signature layer of a reindexable projection family.

`ProjectionFamily` supplies the static, operational, resource, terminal, and
extension-naturality data.  The caller still supplies the categorical
realizations and their genuine cross-layer commuting proof.
-/
def ofProjectionFamily
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (family : ProjectionFamily SourceCategory TargetCategory)
    (signature : FinSignature)
    (sourceRealization :
      CategoricalLTSRealization
        (family.source.package signature).lts SourceCategory)
    (targetRealization :
      CategoricalLTSRealization
        (family.target.package signature).lts TargetCategory)
    (crossLayer :
      StaticOperationalCoherence
        (family.static signature)
        (family.operational signature)
        sourceRealization targetRealization) :
    CoherentFixedProjectionCertificate
      SourceCategory TargetCategory
      (family.source.package signature).lts
      (family.target.package signature).lts
      sourceRealization targetRealization where
  static := family.static signature
  operational := family.operational signature
  resources := family.resources signature
  terminals := family.terminals signature
  crossLayer := crossLayer

end CoherentFixedProjectionCertificate

namespace CompleteProjectionCertificate

/--
Core negative regression: a strict signature admission cannot be represented
by a native step of one fixed-signature `ExecutionPackage`.

The contradiction does not depend on a particular product rule or target
view.  The package step preserves its signature version, whereas the
admission compatibility fields identify its endpoints with two strictly
ordered admission versions.

Verification status: root-imported and kernel-built in the current working
tree.
-/
theorem fixedPackageSource_impossible
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {universes : ProjectionUniverses}
    {oldSignature signature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := signature)}
    (package : ExecutionPackage signature)
    {Target : ObservableLTS}
    (certificate :
      CompleteProjectionCertificate
        SourceCategory TargetCategory package.lts Target admission) :
    False := by
  let compatibility := certificate.admissionCompatible
  have versionPreserved :
      package.lts.signatureVersion compatibility.sourceAfter =
        package.lts.signatureVersion compatibility.sourceBefore :=
    ExecutionEpochTrace.observable_step_lts_version_preserved
      package compatibility.sourceStep
  have versionsEqual :
      admission.toVersion = admission.fromVersion := by
    calc
      admission.toVersion =
          package.lts.signatureVersion compatibility.sourceAfter :=
        compatibility.sourceAfterVersion.symm
      _ = package.lts.signatureVersion compatibility.sourceBefore :=
        versionPreserved
      _ = admission.fromVersion :=
        compatibility.sourceBeforeVersion
  exact (Nat.ne_of_lt admission.advancesEpoch) versionsEqual.symm

end CompleteProjectionCertificate

/--
An independently specified native transition system across two execution
packages whose signatures may differ.

The native event type is view-specific.  `eventOf` binds the native label to
the exact shared `SignatureAdmissionEvent`; `step` is supplied by the target
semantics rather than manufactured from replay.
-/
structure HeterogeneousAdmissionLTS
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (before : ExecutionPackage oldSignature)
    (after : ExecutionPackage newSignature) where
  Event : Type
  eventOf :
    SignatureAdmissionEvent universes
      (source := oldSignature) (target := newSignature) ->
      Event
  step : before.lts.State -> Event -> after.lts.State -> Prop

/--
One exact admission occurrence between separately typed packages.

Native derivability and configuration replay are independent required fields.
Consequently neither can be obtained circularly by defining it to be the
other.
-/
structure HeterogeneousPackageAdmission
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (before : ExecutionPackage oldSignature)
    (after : ExecutionPackage newSignature)
    (semantics : HeterogeneousAdmissionLTS before after)
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)) where
  beforeState : before.lts.State
  afterState : after.lts.State
  native :
    semantics.step beforeState
      (semantics.eventOf admission) afterState
  replays :
    AdmissionReplays admission
      (before.configOf beforeState)
      (after.configOf afterState)

namespace HeterogeneousPackageAdmission

/-- Every certified heterogeneous package admission strictly advances epoch. -/
theorem version_strict
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {before : ExecutionPackage oldSignature}
    {after : ExecutionPackage newSignature}
    {semantics : HeterogeneousAdmissionLTS before after}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    (occurrence :
      HeterogeneousPackageAdmission
        before after semantics admission) :
    (before.configOf occurrence.beforeState).signatureVersion <
      (after.configOf occurrence.afterState).signatureVersion :=
  occurrence.replays.version_strict

/--
The same strict boundary is visible through the two packages' LTS version
observations.  Unlike an in-package `ObservableStep`, the two sides here have
different package and state types, so no fixed-signature preservation theorem
can collapse this inequality.
-/
theorem lts_version_strict
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {before : ExecutionPackage oldSignature}
    {after : ExecutionPackage newSignature}
    {semantics : HeterogeneousAdmissionLTS before after}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    (occurrence :
      HeterogeneousPackageAdmission
        before after semantics admission) :
    before.lts.signatureVersion occurrence.beforeState <
      after.lts.signatureVersion occurrence.afterState := by
  rw [← before.stateVersion occurrence.beforeState,
    ← after.stateVersion occurrence.afterState]
  exact occurrence.version_strict

end HeterogeneousPackageAdmission

/--
Compatibility of one heterogeneous source admission with one independently
typed target-view admission.

The old and new fixed-signature projections may differ because the signature
has changed.  The endpoint equations relate each side with the corresponding
fixed projection; the event equation prevents a target view from silently
choosing an unrelated admission label.
-/
structure HeterogeneousAdmissionProjection
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (sourceBefore : ExecutionPackage oldSignature)
    (sourceAfter : ExecutionPackage newSignature)
    (targetBefore : ExecutionPackage oldSignature)
    (targetAfter : ExecutionPackage newSignature)
    (sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter)
    (targetSemantics :
      HeterogeneousAdmissionLTS targetBefore targetAfter)
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission)
    (beforeProjection :
      ProjectionCertificate sourceBefore.lts targetBefore.lts)
    (afterProjection :
      ProjectionCertificate sourceAfter.lts targetAfter.lts) where
  targetOccurrence :
    HeterogeneousPackageAdmission
      targetBefore targetAfter targetSemantics admission
  mapAdmissionEvent : sourceSemantics.Event -> targetSemantics.Event
  event_commutes :
    mapAdmissionEvent (sourceSemantics.eventOf admission) =
      targetSemantics.eventOf admission
  before_commutes :
    beforeProjection.mapState sourceOccurrence.beforeState =
      targetOccurrence.beforeState
  after_commutes :
    afterProjection.mapState sourceOccurrence.afterState =
      targetOccurrence.afterState

namespace HeterogeneousAdmissionProjection

/--
The independently supplied target-native admission occurs at exactly the
states and event obtained from the source admission.

This is a derived fact, not a replacement for `targetOccurrence.native`: the
interface still requires the concrete target semantics to provide the native
step before the endpoint and event equations can transport it.
-/
theorem target_native_at_mapped_endpoints
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {targetBefore : ExecutionPackage oldSignature}
    {targetAfter : ExecutionPackage newSignature}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    {targetSemantics :
      HeterogeneousAdmissionLTS targetBefore targetAfter}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission}
    {beforeProjection :
      ProjectionCertificate sourceBefore.lts targetBefore.lts}
    {afterProjection :
      ProjectionCertificate sourceAfter.lts targetAfter.lts}
    (projection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics admission sourceOccurrence
        beforeProjection afterProjection) :
    targetSemantics.step
      (beforeProjection.mapState sourceOccurrence.beforeState)
      (projection.mapAdmissionEvent
        (sourceSemantics.eventOf admission))
      (afterProjection.mapState sourceOccurrence.afterState) := by
  rw [projection.event_commutes, projection.before_commutes,
    projection.after_commutes]
  exact projection.targetOccurrence.native

/--
The target occurrence's heterogeneous replay also holds at the mapped source
endpoints.  Thus neither native derivability nor replay is lost when the
endpoint equalities are used.
-/
theorem target_replays_at_mapped_endpoints
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {targetBefore : ExecutionPackage oldSignature}
    {targetAfter : ExecutionPackage newSignature}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    {targetSemantics :
      HeterogeneousAdmissionLTS targetBefore targetAfter}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission}
    {beforeProjection :
      ProjectionCertificate sourceBefore.lts targetBefore.lts}
    {afterProjection :
      ProjectionCertificate sourceAfter.lts targetAfter.lts}
    (projection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics admission sourceOccurrence
        beforeProjection afterProjection) :
    AdmissionReplays admission
      (targetBefore.configOf
        (beforeProjection.mapState sourceOccurrence.beforeState))
      (targetAfter.configOf
        (afterProjection.mapState sourceOccurrence.afterState)) := by
  rw [projection.before_commutes, projection.after_commutes]
  exact projection.targetOccurrence.replays

end HeterogeneousAdmissionProjection

/--
Four independently typed target admissions around one shared source
admission.

Only fixed-signature operational projections occur here.  Static SMC and
cross-layer evidence live in `CoherentFixedProjectionCertificate`; a product
certificate connects them by choosing those certificates' `operational`
fields as the projections below.
-/
structure FourTargetAdmissionBundle
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceBefore : ExecutionPackage oldSignature)
    (sourceAfter : ExecutionPackage newSignature)
    (sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter)
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission) where
  dagBefore : ExecutionPackage oldSignature
  dagAfter : ExecutionPackage newSignature
  dagBeforeProjection :
    ProjectionCertificate sourceBefore.lts dagBefore.lts
  dagAfterProjection :
    ProjectionCertificate sourceAfter.lts dagAfter.lts
  dagSemantics : HeterogeneousAdmissionLTS dagBefore dagAfter
  dag :
    HeterogeneousAdmissionProjection
      sourceBefore sourceAfter dagBefore dagAfter
      sourceSemantics dagSemantics admission sourceOccurrence
      dagBeforeProjection dagAfterProjection

  petriBefore : ExecutionPackage oldSignature
  petriAfter : ExecutionPackage newSignature
  petriBeforeProjection :
    ProjectionCertificate sourceBefore.lts petriBefore.lts
  petriAfterProjection :
    ProjectionCertificate sourceAfter.lts petriAfter.lts
  petriSemantics : HeterogeneousAdmissionLTS petriBefore petriAfter
  petri :
    HeterogeneousAdmissionProjection
      sourceBefore sourceAfter petriBefore petriAfter
      sourceSemantics petriSemantics admission sourceOccurrence
      petriBeforeProjection petriAfterProjection

  piBefore : ExecutionPackage oldSignature
  piAfter : ExecutionPackage newSignature
  piBeforeProjection :
    ProjectionCertificate sourceBefore.lts piBefore.lts
  piAfterProjection :
    ProjectionCertificate sourceAfter.lts piAfter.lts
  piSemantics : HeterogeneousAdmissionLTS piBefore piAfter
  pi :
    HeterogeneousAdmissionProjection
      sourceBefore sourceAfter piBefore piAfter
      sourceSemantics piSemantics admission sourceOccurrence
      piBeforeProjection piAfterProjection

  morphismBefore : ExecutionPackage oldSignature
  morphismAfter : ExecutionPackage newSignature
  morphismBeforeProjection :
    ProjectionCertificate sourceBefore.lts morphismBefore.lts
  morphismAfterProjection :
    ProjectionCertificate sourceAfter.lts morphismAfter.lts
  morphismSemantics :
    HeterogeneousAdmissionLTS morphismBefore morphismAfter
  morphism :
    HeterogeneousAdmissionProjection
      sourceBefore sourceAfter morphismBefore morphismAfter
      sourceSemantics morphismSemantics admission sourceOccurrence
      morphismBeforeProjection morphismAfterProjection

/-!
## Projection-family coherence across one admission

`FourTargetAdmissionBundle` is deliberately operational.  The structure
below closes the per-view connection to the extension-indexed static and
categorical layers: the old and new endpoint projections are exactly the
corresponding members of one `ProjectionFamily`, and each endpoint has its
own cross-layer commuting proof.

A four-view product theorem must provide four values of this structure over
one shared source family and source occurrence.  This module does not
identify independently supplied source families by proof-irrelevant
equality; a product-level wrapper must make the shared family a parameter.
-/

/--
One coherent projection family together with one native heterogeneous
admission in its source and target execution families.

The operational projections used by `admissionProjection` are not duplicate
fields: their types force them to be `family.operational oldSignature` and
`family.operational newSignature`.
-/
structure CoherentProjectionFamilyAdmission
    (SourceCategory TargetCategory : Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (family : ProjectionFamily SourceCategory TargetCategory)
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceSemantics :
      HeterogeneousAdmissionLTS
        (family.source.package oldSignature)
        (family.source.package newSignature))
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        (family.source.package oldSignature)
        (family.source.package newSignature)
        sourceSemantics admission)
    (targetSemantics :
      HeterogeneousAdmissionLTS
        (family.target.package oldSignature)
        (family.target.package newSignature)) where
  sourceBeforeRealization :
    CategoricalLTSRealization
      (family.source.package oldSignature).lts SourceCategory
  targetBeforeRealization :
    CategoricalLTSRealization
      (family.target.package oldSignature).lts TargetCategory
  beforeCrossLayer :
    StaticOperationalCoherence
      (family.static oldSignature)
      (family.operational oldSignature)
      sourceBeforeRealization targetBeforeRealization

  sourceAfterRealization :
    CategoricalLTSRealization
      (family.source.package newSignature).lts SourceCategory
  targetAfterRealization :
    CategoricalLTSRealization
      (family.target.package newSignature).lts TargetCategory
  afterCrossLayer :
    StaticOperationalCoherence
      (family.static newSignature)
      (family.operational newSignature)
      sourceAfterRealization targetAfterRealization

  admissionProjection :
    HeterogeneousAdmissionProjection
      (family.source.package oldSignature)
      (family.source.package newSignature)
      (family.target.package oldSignature)
      (family.target.package newSignature)
      sourceSemantics targetSemantics admission sourceOccurrence
      (family.operational oldSignature)
      (family.operational newSignature)

namespace CoherentProjectionFamilyAdmission

/-- The old endpoint carries the complete fixed-epoch coherence package. -/
def beforeFixed
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {family : ProjectionFamily SourceCategory TargetCategory}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (family.source.package oldSignature)
        (family.source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (family.source.package oldSignature)
        (family.source.package newSignature)
        sourceSemantics admission}
    {targetSemantics :
      HeterogeneousAdmissionLTS
        (family.target.package oldSignature)
        (family.target.package newSignature)}
    (coherent :
      CoherentProjectionFamilyAdmission
        SourceCategory TargetCategory family admission
        sourceSemantics sourceOccurrence targetSemantics) :
    CoherentFixedProjectionCertificate
      SourceCategory TargetCategory
      (family.source.package oldSignature).lts
      (family.target.package oldSignature).lts
      coherent.sourceBeforeRealization
      coherent.targetBeforeRealization :=
  CoherentFixedProjectionCertificate.ofProjectionFamily
    family oldSignature
    coherent.sourceBeforeRealization
    coherent.targetBeforeRealization
    coherent.beforeCrossLayer

/-- The new endpoint carries the complete fixed-epoch coherence package. -/
def afterFixed
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {family : ProjectionFamily SourceCategory TargetCategory}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (family.source.package oldSignature)
        (family.source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (family.source.package oldSignature)
        (family.source.package newSignature)
        sourceSemantics admission}
    {targetSemantics :
      HeterogeneousAdmissionLTS
        (family.target.package oldSignature)
        (family.target.package newSignature)}
    (coherent :
      CoherentProjectionFamilyAdmission
        SourceCategory TargetCategory family admission
        sourceSemantics sourceOccurrence targetSemantics) :
    CoherentFixedProjectionCertificate
      SourceCategory TargetCategory
      (family.source.package newSignature).lts
      (family.target.package newSignature).lts
      coherent.sourceAfterRealization
      coherent.targetAfterRealization :=
  CoherentFixedProjectionCertificate.ofProjectionFamily
    family newSignature
    coherent.sourceAfterRealization
    coherent.targetAfterRealization
    coherent.afterCrossLayer

/--
The target family supplies a genuine native boundary at the mapped source
endpoints and mapped admission label.
-/
theorem target_native
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {family : ProjectionFamily SourceCategory TargetCategory}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (family.source.package oldSignature)
        (family.source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (family.source.package oldSignature)
        (family.source.package newSignature)
        sourceSemantics admission}
    {targetSemantics :
      HeterogeneousAdmissionLTS
        (family.target.package oldSignature)
        (family.target.package newSignature)}
    (coherent :
      CoherentProjectionFamilyAdmission
        SourceCategory TargetCategory family admission
        sourceSemantics sourceOccurrence targetSemantics) :
    targetSemantics.step
      ((family.operational oldSignature).mapState
        sourceOccurrence.beforeState)
      (coherent.admissionProjection.mapAdmissionEvent
        (sourceSemantics.eventOf admission))
      ((family.operational newSignature).mapState
        sourceOccurrence.afterState) :=
  coherent.admissionProjection.target_native_at_mapped_endpoints

end CoherentProjectionFamilyAdmission

end Cantilune.Core
