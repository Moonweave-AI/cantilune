import Cantilune.Core.EpochSeparatedProjection
import Cantilune.Feedback.HeterogeneousAdmissionTrajectory

/-!
# A nonempty reference for epoch-separated admission projection

`CompleteProjectionCertificate` cannot encode a strictly advancing admission
as a step of one fixed-signature execution package.  The replacement
interface in `Core.EpochSeparatedProjection` instead relates an old package
to a separately typed new package.

This module connects that interface to the already concrete two-epoch
reference runtime.  All four target slots intentionally use the same
identity view: the point of this witness is only to prove that the
epoch-separated interface is inhabited and retains native/replay evidence.
It is not a DAG, Petri, pi, or morphism product certificate.

Verification status: this identity-view reference is intentionally weaker
than a product certificate.  Its declarations are included in the local
kernel gate; it does not supply substantive DAG, Petri, pi, or morphism
semantics.
-/

namespace Cantilune.Feedback.EpochSeparatedProjectionReference

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory

namespace Reference

abbrev oldPackage :=
  HeterogeneousAdmissionTrajectory.Reference.oldPackage

abbrev newPackage :=
  HeterogeneousAdmissionTrajectory.Reference.newPackage

abbrev admission :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.event

/--
The boundary event is native exactly from the old epoch's terminal state to
the new epoch's initial state.
-/
def boundarySemantics :
    HeterogeneousAdmissionLTS
      (universes :=
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.universes)
      oldPackage newPackage where
  Event := Unit
  eventOf := fun _ => ()
  step := fun before _event after =>
    before =
        HeterogeneousAdmissionTrajectory.Reference.OldState.done ∧
      after =
        HeterogeneousAdmissionTrajectory.Reference.NewState.live

/--
The concrete source occurrence contains both an independently declared
native boundary step and the exact heterogeneous configuration replay.
-/
def sourceOccurrence :
    HeterogeneousPackageAdmission
      oldPackage newPackage boundarySemantics admission where
  beforeState :=
    HeterogeneousAdmissionTrajectory.Reference.OldState.done
  afterState :=
    HeterogeneousAdmissionTrajectory.Reference.NewState.live
  native := ⟨rfl, rfl⟩
  replays :=
    HeterogeneousAdmissionTrajectory.Reference.boundary.replays

abbrev oldIdentity :
    ProjectionCertificate oldPackage.lts oldPackage.lts :=
  ProjectionCertificate.identity oldPackage.lts

abbrev newIdentity :
    ProjectionCertificate newPackage.lts newPackage.lts :=
  ProjectionCertificate.identity newPackage.lts

/--
One identity target view.  Native derivability and replay remain fields of
the target occurrence; the commuting equations only align their labels and
endpoints with the source occurrence.
-/
def identityAdmissionProjection :
    HeterogeneousAdmissionProjection
      oldPackage newPackage oldPackage newPackage
      boundarySemantics boundarySemantics admission sourceOccurrence
      oldIdentity newIdentity where
  targetOccurrence := sourceOccurrence
  mapAdmissionEvent := id
  event_commutes := rfl
  before_commutes := rfl
  after_commutes := rfl

/--
A four-slot inhabitant of the corrected admission interface.

The four views are intentionally identical.  A substantive product
certificate must replace them with independently typed DAG, Petri, pi, and
morphism packages and their native admission derivations.
-/
def fourIdentityViews :
    FourTargetAdmissionBundle admission
      oldPackage newPackage boundarySemantics sourceOccurrence where
  dagBefore := oldPackage
  dagAfter := newPackage
  dagBeforeProjection := oldIdentity
  dagAfterProjection := newIdentity
  dagSemantics := boundarySemantics
  dag := identityAdmissionProjection

  petriBefore := oldPackage
  petriAfter := newPackage
  petriBeforeProjection := oldIdentity
  petriAfterProjection := newIdentity
  petriSemantics := boundarySemantics
  petri := identityAdmissionProjection

  piBefore := oldPackage
  piAfter := newPackage
  piBeforeProjection := oldIdentity
  piAfterProjection := newIdentity
  piSemantics := boundarySemantics
  pi := identityAdmissionProjection

  morphismBefore := oldPackage
  morphismAfter := newPackage
  morphismBeforeProjection := oldIdentity
  morphismAfterProjection := newIdentity
  morphismSemantics := boundarySemantics
  morphism := identityAdmissionProjection

/-- The corrected four-target admission interface is propositionally nonempty. -/
theorem fourTargetAdmissionBundle_nonempty :
    Nonempty
      (FourTargetAdmissionBundle admission
        oldPackage newPackage boundarySemantics sourceOccurrence) :=
  ⟨fourIdentityViews⟩

/--
The concrete source occurrence crosses from runtime signature version zero
to version one; this is obtained from admission replay, not from a
same-package step.
-/
theorem sourceOccurrence_version_strict :
    (oldPackage.configOf sourceOccurrence.beforeState).signatureVersion <
      (newPackage.configOf sourceOccurrence.afterState).signatureVersion :=
  sourceOccurrence.version_strict

/-- The old and new LTS observations expose the same strict epoch boundary. -/
theorem sourceOccurrence_lts_version_strict :
    oldPackage.lts.signatureVersion sourceOccurrence.beforeState <
      newPackage.lts.signatureVersion sourceOccurrence.afterState :=
  sourceOccurrence.lts_version_strict

/--
Each identity target retains the independently supplied native admission at
the mapped endpoints.
-/
theorem dag_native_at_mapped_endpoints :
    boundarySemantics.step
      (oldIdentity.mapState sourceOccurrence.beforeState)
      (identityAdmissionProjection.mapAdmissionEvent
        (boundarySemantics.eventOf admission))
      (newIdentity.mapState sourceOccurrence.afterState) :=
  identityAdmissionProjection.target_native_at_mapped_endpoints

/--
The same mapped endpoints retain exact heterogeneous replay; native
derivability and replay are separately obtained.
-/
theorem dag_replays_at_mapped_endpoints :
    AdmissionReplays admission
      (oldPackage.configOf
        (oldIdentity.mapState sourceOccurrence.beforeState))
      (newPackage.configOf
        (newIdentity.mapState sourceOccurrence.afterState)) :=
  identityAdmissionProjection.target_replays_at_mapped_endpoints

end Reference

end Cantilune.Feedback.EpochSeparatedProjectionReference
