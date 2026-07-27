import Cantilune.Feedback.EpochSeparatedProjectionReference
import Cantilune.Feedback.FiniteExecutableHeterogeneousRuntime

/-!
# Four typed package admissions for the executable epoch reference

`FiniteExecutableHeterogeneousRuntime` already gives four dependently typed
native target relations for the old-business, admission, and new-business
phases.  `EpochSeparatedProjectionReference` gives the old/new source
packages and exact heterogeneous admission replay.

This module joins those two constructions.  For each target view it builds
separate old-signature and new-signature `ExecutionPackage`s, fixed-epoch
projection certificates, a native heterogeneous admission, and exact
`AdmissionReplays`.  The four values form one `FourTargetAdmissionBundle`.

The target semantics remain the finite executable reference semantics.  The
view index makes their state, event, and native derivation types distinct; it
does not turn them into production DAGs, pre-nets, pi agents, or morphisms,
and it supplies no static projection family or product policy certificate.
-/

namespace Cantilune.Feedback.FiniteExecutableEpochProjectionReference

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory
open Cantilune.Feedback.EpochSeparatedProjectionReference
open Cantilune.Feedback.FiniteExecutableHeterogeneousRuntime

namespace Reference

abbrev oldPackage :=
  EpochSeparatedProjectionReference.Reference.oldPackage

abbrev newPackage :=
  EpochSeparatedProjectionReference.Reference.newPackage

abbrev admission :=
  EpochSeparatedProjectionReference.Reference.admission

abbrev sourceSemantics :=
  EpochSeparatedProjectionReference.Reference.boundarySemantics

abbrev sourceOccurrence :=
  EpochSeparatedProjectionReference.Reference.sourceOccurrence

/-- The old fixed epoch contains only the old-business target transition. -/
inductive BeforeStep (view : TargetView) :
    TargetState view → TargetEvent view → TargetState view → Prop
  | oldBusiness :
      BeforeStep view .oldStart .oldBusiness .oldDone

/-- The new fixed epoch contains only the new-business target transition. -/
inductive AfterStep (view : TargetView) :
    TargetState view → TargetEvent view → TargetState view → Prop
  | newBusiness :
      AfterStep view .newLive .newBusiness .newLive

/--
The heterogeneous target relation is view-indexed.  Its pi constructor stores
the real unfiltered registration input from `AdmissionCertificate`; it is not
an administrative event whose only evidence is its label.
-/
inductive TargetAdmissionStep :
    (view : TargetView) →
      TargetState view → TargetEvent view → TargetState view → Prop
  | dag
      (static :
        SignatureInterpretation.Extends
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.extension
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.oldViews.dag
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.newViews.dag) :
      TargetAdmissionStep .dag .oldDone .admission .newLive
  | petri
      (static :
        SignatureInterpretation.Extends
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.extension
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.oldViews.petri
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.newViews.petri) :
      TargetAdmissionStep .petri .oldDone .admission .newLive
  | pi
      (static :
        SignatureInterpretation.Extends
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.extension
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.oldViews.pi
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.newViews.pi)
      (native :
        Cantilune.Pi.Step
          Cantilune.Pi.AdmissionCertificate.certifiedAdmissionWait
          Cantilune.Pi.AdmissionCertificate.admissionAction
          .zero) :
      TargetAdmissionStep .pi .oldDone .admission .newLive
  | morphism
      (static :
        SignatureInterpretation.Extends
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.extension
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.oldViews.morphism
          Cantilune.Pi.AdmissionCertificate.ReferenceSignature.newViews.morphism) :
      TargetAdmissionStep .morphism .oldDone .admission .newLive

/-- Every heterogeneous constructor is also the executable runtime edge. -/
theorem TargetAdmissionStep.runtime_native
    {view : TargetView}
    {before : TargetState view}
    {event : TargetEvent view}
    {after : TargetState view}
    (step : TargetAdmissionStep view before event after) :
    TargetStep view before event after := by
  cases step <;> exact TargetStep.admission

def beforeLTS (view : TargetView) : ObservableLTS where
  State := TargetState view
  Event := TargetEvent view
  stateSetoid := ObservableLTS.equalitySetoid _
  step := BeforeStep view
  observable := fun _ => True
  success := fun state => state = .oldDone
  waiting := fun _ => False
  signatureVersion := fun _ => admission.fromVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

def afterLTS (view : TargetView) : ObservableLTS where
  State := TargetState view
  Event := TargetEvent view
  stateSetoid := ObservableLTS.equalitySetoid _
  step := AfterStep view
  observable := fun _ => True
  success := fun state => state = .newLive
  waiting := fun _ => False
  signatureVersion := fun _ => admission.toVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

def beforeConfigOf (view : TargetView) :
    TargetState view →
      Config Cantilune.Pi.AdmissionCertificate.ReferenceSignature.source
  | .oldStart =>
      HeterogeneousAdmissionTrajectory.Reference.oldStart
  | .oldDone | .newLive =>
      HeterogeneousAdmissionTrajectory.Reference.oldEnd

def afterConfigOf (view : TargetView) :
    TargetState view →
      Config Cantilune.Pi.AdmissionCertificate.ReferenceSignature.target
  | _ => HeterogeneousAdmissionTrajectory.Reference.newStart

/--
The old target package reuses the old source replay kernel but has its own
view-indexed state, event, and native-step types.
-/
def beforePackage (view : TargetView) :
    ExecutionPackage
      Cantilune.Pi.AdmissionCertificate.ReferenceSignature.source where
  lts := beforeLTS view
  configOf := beforeConfigOf view
  replayKernel :=
    HeterogeneousAdmissionTrajectory.Reference.oldReplayKernel
  eventRecord := fun _ =>
    HeterogeneousAdmissionTrajectory.Reference.oldVerified
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact
      HeterogeneousAdmissionTrajectory.Reference.oldVerified.replays_recorded
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => admission.fromVersion
      decreases := by simp
      epoch_preserved := by simp }

/-- The new target package is the corresponding view-indexed fixed epoch. -/
def afterPackage (view : TargetView) :
    ExecutionPackage
      Cantilune.Pi.AdmissionCertificate.ReferenceSignature.target where
  lts := afterLTS view
  configOf := afterConfigOf view
  replayKernel :=
    HeterogeneousAdmissionTrajectory.Reference.newReplayKernel
  eventRecord := fun _ =>
    HeterogeneousAdmissionTrajectory.Reference.newVerified
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact
      HeterogeneousAdmissionTrajectory.Reference.newVerified.replays_recorded
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => admission.toVersion
      decreases := by simp
      epoch_preserved := by simp }

def beforeMapState (view : TargetView) :
    HeterogeneousAdmissionTrajectory.Reference.OldState →
      TargetState view
  | .start => .oldStart
  | .done => .oldDone

def beforeMapEvent (view : TargetView) :
    HeterogeneousAdmissionTrajectory.Reference.OldEvent →
      TargetEvent view
  | .advance => .oldBusiness

/-- Fixed-old-epoch operational projection into one typed target view. -/
def beforeProjection (view : TargetView) :
    ProjectionCertificate oldPackage.lts (beforePackage view).lts where
  mapState := beforeMapState view
  mapEvent := beforeMapEvent view
  Lift := fun sourceEvent targetEvent =>
    beforeMapEvent view sourceEvent = targetEvent
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    intro source event target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact ⟨BeforeStep.oldBusiness, trivial⟩
  reflect := by
    intro source event target step
    cases source with
    | start =>
        rcases step with ⟨native, _observable⟩
        cases native
        exact
          ⟨.advance, .done,
            ⟨HeterogeneousAdmissionTrajectory.Reference.OldStep.advance,
              trivial⟩,
            rfl, rfl⟩
    | done =>
        rcases step with ⟨native, _observable⟩
        cases native
  success_iff := by
    intro state
    change beforeMapState view state = .oldDone ↔ state = .done
    cases state <;> simp [beforeMapState]
  waiting_iff := by
    intro state
    change False ↔ False
    simp
  signatureVersion_preserved := by
    intro state
    cases state <;> rfl

def afterMapState (view : TargetView) :
    HeterogeneousAdmissionTrajectory.Reference.NewState →
      TargetState view
  | .live => .newLive

def afterMapEvent (view : TargetView) :
    HeterogeneousAdmissionTrajectory.Reference.NewEvent →
      TargetEvent view
  | .hold => .newBusiness

/-- Fixed-new-epoch operational projection into one typed target view. -/
def afterProjection (view : TargetView) :
    ProjectionCertificate newPackage.lts (afterPackage view).lts where
  mapState := afterMapState view
  mapEvent := afterMapEvent view
  Lift := fun sourceEvent targetEvent =>
    afterMapEvent view sourceEvent = targetEvent
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    intro source event target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact ⟨AfterStep.newBusiness, trivial⟩
  reflect := by
    intro source event target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact
      ⟨.hold, .live,
        ⟨HeterogeneousAdmissionTrajectory.Reference.NewStep.hold,
          trivial⟩,
        rfl, rfl⟩
  success_iff := by
    intro state
    change afterMapState view state = .newLive ↔ True
    cases state
    simp [afterMapState]
  waiting_iff := by
    intro state
    change False ↔ False
    simp
  signatureVersion_preserved := by
    intro state
    cases state
    rfl

/--
The cross-epoch event is the independently declared native admission
constructor of the selected target view.
-/
def targetSemantics (view : TargetView) :
    HeterogeneousAdmissionLTS
      (universes :=
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.universes)
      (beforePackage view) (afterPackage view) where
  Event := TargetEvent view
  eventOf := fun _ => .admission
  step := TargetAdmissionStep view

def targetOccurrence (view : TargetView) :
    HeterogeneousPackageAdmission
      (beforePackage view) (afterPackage view)
      (targetSemantics view) admission where
  beforeState := .oldDone
  afterState := .newLive
  native := by
    cases view with
    | dag =>
        exact
          TargetAdmissionStep.dag
            Cantilune.Pi.AdmissionCertificate.ReferenceSignature.fourViewAdmission.dag
    | petri =>
        exact
          TargetAdmissionStep.petri
            Cantilune.Pi.AdmissionCertificate.ReferenceSignature.fourViewAdmission.petri
    | pi =>
        exact
          TargetAdmissionStep.pi
            Cantilune.Pi.AdmissionCertificate.ReferenceSignature.fourViewAdmission.pi
            Cantilune.Pi.AdmissionCertificate.certified_admission_native
    | morphism =>
        exact
          TargetAdmissionStep.morphism
            Cantilune.Pi.AdmissionCertificate.ReferenceSignature.fourViewAdmission.morphism
  replays :=
    HeterogeneousAdmissionTrajectory.Reference.boundary.replays

/--
One target view commutes with the shared source admission without identifying
the two native event types.
-/
def admissionProjection (view : TargetView) :
    HeterogeneousAdmissionProjection
      oldPackage newPackage
      (beforePackage view) (afterPackage view)
      sourceSemantics (targetSemantics view)
      admission sourceOccurrence
      (beforeProjection view) (afterProjection view) where
  targetOccurrence := targetOccurrence view
  mapAdmissionEvent := fun _ => .admission
  event_commutes := rfl
  before_commutes := rfl
  after_commutes := rfl

/-- Four independently typed native target admissions with exact replay. -/
def fourTypedViews :
    FourTargetAdmissionBundle admission
      oldPackage newPackage sourceSemantics sourceOccurrence where
  dagBefore := beforePackage .dag
  dagAfter := afterPackage .dag
  dagBeforeProjection := beforeProjection .dag
  dagAfterProjection := afterProjection .dag
  dagSemantics := targetSemantics .dag
  dag := admissionProjection .dag

  petriBefore := beforePackage .petri
  petriAfter := afterPackage .petri
  petriBeforeProjection := beforeProjection .petri
  petriAfterProjection := afterProjection .petri
  petriSemantics := targetSemantics .petri
  petri := admissionProjection .petri

  piBefore := beforePackage .pi
  piAfter := afterPackage .pi
  piBeforeProjection := beforeProjection .pi
  piAfterProjection := afterProjection .pi
  piSemantics := targetSemantics .pi
  pi := admissionProjection .pi

  morphismBefore := beforePackage .morphism
  morphismAfter := afterPackage .morphism
  morphismBeforeProjection := beforeProjection .morphism
  morphismAfterProjection := afterProjection .morphism
  morphismSemantics := targetSemantics .morphism
  morphism := admissionProjection .morphism

theorem fourTypedViews_nonempty :
    Nonempty
      (FourTargetAdmissionBundle admission
        oldPackage newPackage sourceSemantics sourceOccurrence) :=
  ⟨fourTypedViews⟩

theorem target_native_all :
    (targetSemantics .dag).step .oldDone .admission .newLive ∧
      (targetSemantics .petri).step .oldDone .admission .newLive ∧
      (targetSemantics .pi).step .oldDone .admission .newLive ∧
      (targetSemantics .morphism).step .oldDone .admission .newLive :=
  ⟨(targetOccurrence .dag).native,
    (targetOccurrence .petri).native,
    (targetOccurrence .pi).native,
    (targetOccurrence .morphism).native⟩

/-- The four bundled admission steps are the runtime's four native edges. -/
theorem target_runtime_native_all :
    TargetStep .dag .oldDone .admission .newLive ∧
      TargetStep .petri .oldDone .admission .newLive ∧
      TargetStep .pi .oldDone .admission .newLive ∧
      TargetStep .morphism .oldDone .admission .newLive :=
  ⟨(targetOccurrence .dag).native.runtime_native,
    (targetOccurrence .petri).native.runtime_native,
    (targetOccurrence .pi).native.runtime_native,
    (targetOccurrence .morphism).native.runtime_native⟩

/--
The pi component of the heterogeneous bundle contains the native visible
registration input used by the admitted signature certificate.
-/
theorem pi_target_admission_native :
    Cantilune.Pi.Step
      Cantilune.Pi.AdmissionCertificate.certifiedAdmissionWait
      Cantilune.Pi.AdmissionCertificate.admissionAction
      .zero := by
  have native := (targetOccurrence .pi).native
  cases native with
  | pi _static step => exact step

theorem target_replays_all :
    AdmissionReplays admission
        ((beforePackage .dag).configOf .oldDone)
        ((afterPackage .dag).configOf .newLive) ∧
      AdmissionReplays admission
        ((beforePackage .petri).configOf .oldDone)
        ((afterPackage .petri).configOf .newLive) ∧
      AdmissionReplays admission
        ((beforePackage .pi).configOf .oldDone)
        ((afterPackage .pi).configOf .newLive) ∧
      AdmissionReplays admission
        ((beforePackage .morphism).configOf .oldDone)
        ((afterPackage .morphism).configOf .newLive) :=
  ⟨(targetOccurrence .dag).replays,
    (targetOccurrence .petri).replays,
    (targetOccurrence .pi).replays,
    (targetOccurrence .morphism).replays⟩

theorem target_versions_strict_all :
    (beforePackage .dag).lts.signatureVersion .oldDone <
        (afterPackage .dag).lts.signatureVersion .newLive ∧
      (beforePackage .petri).lts.signatureVersion .oldDone <
        (afterPackage .petri).lts.signatureVersion .newLive ∧
      (beforePackage .pi).lts.signatureVersion .oldDone <
        (afterPackage .pi).lts.signatureVersion .newLive ∧
      (beforePackage .morphism).lts.signatureVersion .oldDone <
        (afterPackage .morphism).lts.signatureVersion .newLive :=
  ⟨(targetOccurrence .dag).lts_version_strict,
    (targetOccurrence .petri).lts_version_strict,
    (targetOccurrence .pi).lts_version_strict,
    (targetOccurrence .morphism).lts_version_strict⟩

end Reference

end Cantilune.Feedback.FiniteExecutableEpochProjectionReference
