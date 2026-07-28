import Cantilune.Feedback.FiniteHeterogeneousFourProjection

/-!
# An executable finite heterogeneous reference runtime

The generic heterogeneous development proves properties of a supplied
`EpochChain`.  This module closes a different, concrete obligation: it
constructs a finite scheduler whose transition function itself emits either
an exact fixed-signature `DPOOccurrence` or the exact
`SignatureAdmissionEvent` occurrence.

The scheduler has three runtime phases:

* one old-signature business event;
* one signature-admission event; and
* one absorbing new-signature business event.

Every emitted edge additionally contains four independently typed native
target derivations.  In particular, target admission is represented by a
native transition in each target LTS.  It is never identified with pure
source-family reindexing.

This is deliberately a strongest nonempty reference runtime, not a product
scheduler policy.  Random branching, authorization, fairness, and progress
probabilities remain caller-supplied obligations for a production runtime.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteExecutableHeterogeneousRuntime

open Filter MeasureTheory ProbabilityTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi.AdmissionCertificate
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference
open Cantilune.Feedback.FiniteHeterogeneousTrajectory

/-- The exact source occurrence selected at each executable phase. -/
inductive ScheduledSourceOccurrence : Phase → Prop
  | oldBusiness
      (occurrence : DPOOccurrence oldSome OldEvent.advance) :
      ScheduledSourceOccurrence .oldStart
  | admission
      (occurrence : AdmissionOccurrence boundary) :
      ScheduledSourceOccurrence .oldDone
  | newBusiness
      (occurrence : DPOOccurrence newSome NewEvent.hold) :
      ScheduledSourceOccurrence .newLive

/-- The old business rule has an exact verified DPO occurrence. -/
theorem oldBusinessOccurrence :
    DPOOccurrence oldSome OldEvent.advance :=
  DPOOccurrence.of_mem oldSome (by
    change OldEvent.advance ∈ [OldEvent.advance]
    exact List.mem_singleton_self OldEvent.advance)

/-- The admission boundary has exact heterogeneous replay and epoch change. -/
theorem admissionOccurrence :
    AdmissionOccurrence boundary := by
  exact
    ⟨boundary.replays, rfl, rfl, by decide⟩

/-- The new-signature business rule has an exact verified DPO occurrence. -/
theorem newBusinessOccurrence :
    DPOOccurrence newSome NewEvent.hold :=
  DPOOccurrence.of_mem newSome (by
    change NewEvent.hold ∈ [NewEvent.hold]
    exact List.mem_singleton_self NewEvent.hold)

/-- Total occurrence selection performed by the executable scheduler. -/
theorem scheduledSourceOccurrence :
    (source : Phase) → ScheduledSourceOccurrence source
  | .oldStart => .oldBusiness oldBusinessOccurrence
  | .oldDone => .admission admissionOccurrence
  | .newLive => .newBusiness newBusinessOccurrence

/--
Names of the four independent target semantics.  The tag indexes both target
state and event types, so a derivation for one view cannot be reused as a
derivation for another view by definitional equality.
-/
inductive TargetView
  | dag
  | petri
  | pi
  | morphism
  deriving DecidableEq, Repr, Fintype

/-- Runtime states of one independently indexed target view. -/
inductive TargetState (_view : TargetView)
  | oldStart
  | oldDone
  | newLive
  deriving DecidableEq, Repr, Fintype

/-- Native events of one independently indexed target view. -/
inductive TargetEvent (_view : TargetView)
  | oldBusiness
  | admission
  | newBusiness
  deriving DecidableEq, Repr, Fintype

/-- Native one-step target semantics, including admission as a primitive edge. -/
inductive TargetStep (view : TargetView) :
    TargetState view → TargetEvent view → TargetState view → Prop
  | oldBusiness :
      TargetStep view .oldStart .oldBusiness .oldDone
  | admission :
      TargetStep view .oldDone .admission .newLive
  | newBusiness :
      TargetStep view .newLive .newBusiness .newLive

/-- The independent native LTS for one target projection. -/
def targetLTS (view : TargetView) : ObservableLTS where
  State := TargetState view
  Event := TargetEvent view
  stateSetoid := ObservableLTS.equalitySetoid _
  step := TargetStep view
  observable := fun _ => True
  success := fun state => state = .newLive
  waiting := fun _ => False
  signatureVersion
    | .oldStart => (ReferenceSignature.event).fromVersion
    | .oldDone => (ReferenceSignature.event).fromVersion
    | .newLive => (ReferenceSignature.event).toVersion
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

/-- State interpretation into one native target view. -/
def targetState (view : TargetView) : Phase → (targetLTS view).State
  | .oldStart => .oldStart
  | .oldDone => .oldDone
  | .newLive => .newLive

/-- Event interpretation into one native target view. -/
def targetEvent (view : TargetView) : Phase → (targetLTS view).Event
  | .oldStart => .oldBusiness
  | .oldDone => .admission
  | .newLive => .newBusiness

/-- Every scheduler decision is one native step in every indexed target view. -/
theorem targetNative (view : TargetView) (source : Phase) :
    (targetLTS view).ObservableStep
      (targetState view source)
      (targetEvent view source)
      (targetState view (next source)) := by
  cases source with
  | oldStart => exact ⟨TargetStep.oldBusiness, trivial⟩
  | oldDone => exact ⟨TargetStep.admission, trivial⟩
  | newLive => exact ⟨TargetStep.newBusiness, trivial⟩

/--
One typed target derivation over the actual sampled endpoints.  `target_eq`
ties it to the scheduler rather than to a later relabelling argument.
-/
structure TargetDerivation
    (view : TargetView) (source target : Phase) : Prop where
  target_eq : target = next source
  native :
    (targetLTS view).ObservableStep
      (targetState view source)
      (targetEvent view source)
      (targetState view target)

namespace TargetDerivation

/-- Construct a target derivation directly from the scheduler successor. -/
theorem ofNext (view : TargetView) (source : Phase) :
    TargetDerivation view source (next source) where
  target_eq := rfl
  native := targetNative view source

end TargetDerivation

/-- Four independently typed target-native derivations of one scheduler edge. -/
structure FourTargetDerivations (source target : Phase) : Prop where
  dag : TargetDerivation .dag source target
  petri : TargetDerivation .petri source target
  pi : TargetDerivation .pi source target
  morphism : TargetDerivation .morphism source target

/-- The scheduler successor has native derivations in all four target views. -/
theorem fourTargetDerivations (source : Phase) :
    FourTargetDerivations source (next source) where
  dag := TargetDerivation.ofNext .dag source
  petri := TargetDerivation.ofNext .petri source
  pi := TargetDerivation.ofNext .pi source
  morphism := TargetDerivation.ofNext .morphism source

/--
An event actually emitted by the scheduler.  The occurrence discriminator,
source native/replay witness, and all four target derivations refer to the
same dependent edge.
-/
structure GeneratedRuntimeEvent (source target : Phase) where
  sourceEvent : NativeReplayEvent source target
  selectedLabel : sourceEvent.label = phaseLabel source
  occurrence : ScheduledSourceOccurrence source
  targets : FourTargetDerivations source target

namespace GeneratedRuntimeEvent

/-- The runtime event mark retained by the stochastic edge. -/
def mark
    {source target : Phase}
    (event : GeneratedRuntimeEvent source target) :
    GlobalEvent oldSome newSome :=
  event.sourceEvent.label

/-- Every generated mark is the scheduler's canonical phase label. -/
@[simp] theorem mark_eq_phaseLabel
    {source target : Phase}
    (event : GeneratedRuntimeEvent source target) :
    event.mark = phaseLabel source :=
  event.selectedLabel

/--
Two generated witnesses for the same dependent edge cannot disagree on the
event mark.  This is the event-level uniqueness needed by replay consumers;
it does not identify events merely because their configuration endpoints
happen to coincide.
-/
theorem mark_unique
    {source target : Phase}
    (left right : GeneratedRuntimeEvent source target) :
    left.mark = right.mark :=
  left.mark_eq_phaseLabel.trans right.mark_eq_phaseLabel.symm

/-- Occurrence evidence on a fixed dependent edge is proof-irrelevant. -/
theorem occurrence_unique
    {source target : Phase}
    (left right : GeneratedRuntimeEvent source target) :
    left.occurrence = right.occurrence :=
  Subsingleton.elim _ _

/-- The four native-target evidence records are likewise proof-irrelevant. -/
theorem targets_unique
    {source target : Phase}
    (left right : GeneratedRuntimeEvent source target) :
    left.targets = right.targets :=
  Subsingleton.elim _ _

/-- The emitted source label carries its exact replay relation. -/
theorem sourceReplay
    {source target : Phase}
    (event : GeneratedRuntimeEvent source target) :
    EventReplay boundary (phaseLabel source) := by
  rw [← event.selectedLabel]
  exact event.sourceEvent.replay

/-- The replay witness fixes the exact source execution epoch(s). -/
theorem sourceEpochAligned
    {source target : Phase}
    (event : GeneratedRuntimeEvent source target) :
    EventEpochAlignment boundary (phaseLabel source) :=
  eventReplay_epochAlignment event.sourceReplay

/-- The sampled old business edge contains its exact DPO occurrence. -/
theorem oldDPO
    (event : GeneratedRuntimeEvent .oldStart .oldDone) :
    DPOOccurrence oldSome OldEvent.advance := by
  cases event.occurrence with
  | oldBusiness occurrence => exact occurrence

/-- The sampled boundary edge contains the exact admission replay. -/
theorem admissionReplay
    (event : GeneratedRuntimeEvent .oldDone .newLive) :
    AdmissionOccurrence boundary := by
  cases event.occurrence with
  | admission occurrence => exact occurrence

/-- The sampled new business edge contains its exact DPO occurrence. -/
theorem newDPO
    (event : GeneratedRuntimeEvent .newLive .newLive) :
    DPOOccurrence newSome NewEvent.hold := by
  cases event.occurrence with
  | newBusiness occurrence => exact occurrence

end GeneratedRuntimeEvent

/-- The executable scheduler emits the complete dependent event at one phase. -/
def emit (source : Phase) :
    GeneratedRuntimeEvent source (next source) where
  sourceEvent := selectedEvent source
  selectedLabel := rfl
  occurrence := scheduledSourceOccurrence source
  targets := fourTargetDerivations source

/-- A finite executable scheduler run, independent of any supplied `EpochChain`. -/
def run : Nat → Phase
  | 0 => .oldStart
  | n + 1 => next (run n)

@[simp] theorem run_zero : run 0 = .oldStart := rfl
@[simp] theorem run_succ (n : Nat) : run (n + 1) = next (run n) := rfl
@[simp] theorem run_one : run 1 = .oldDone := rfl
@[simp] theorem run_two : run 2 = .newLive := rfl

/-- The event emitted at step `n` has exact source and target endpoints. -/
def emittedAt (n : Nat) : GeneratedRuntimeEvent (run n) (run (n + 1)) := by
  simpa using emit (run n)

/-- Scheduler transition weights: exactly one generated successor has mass one. -/
def runtimeProbability (source target : Phase) : Real :=
  if target = next source then 1 else 0

/-- Positive probability determines the executable successor. -/
theorem positive_target_eq_next
    {source target : Phase}
    (positive : 0 < runtimeProbability source target) :
    target = next source := by
  by_contra different
  simp [runtimeProbability, different] at positive

/--
The genuine finite Markov kernel generated by `emit`.  Its positive-support
selector returns the complete dependent runtime event, not an index into a
pre-existing epoch chain.
-/
def runtimeKernel :
    ReplayMarkovKernel Phase GeneratedRuntimeEvent where
  probability := runtimeProbability
  probability_nonnegative := by
    intro source target
    by_cases equality : target = next source <;>
      simp [runtimeProbability, equality]
  row_sum := by
    intro source
    simp [runtimeProbability]
  event_of_positive := by
    intro source target positive
    have equality := positive_target_eq_next positive
    subst target
    exact emit source

/-- Dirac start law of the executable reference runtime. -/
def initial : Measure Phase :=
  Measure.dirac .oldStart

instance : IsProbabilityMeasure initial := by
  unfold initial
  infer_instance

/--
Complete agreement generated by one sampled runtime path.  All occurrence
and four-target fields are extracted from the kernel's dependent edge
witnesses, not supplied as trajectory assumptions.
-/
structure CompleteGeneratedTrajectory (path : Nat → Phase) where
  replay : ReplayMarkovKernel.ReplayTrajectory runtimeKernel path
  startsOld : path 0 = .oldStart
  oldEndpoint : path 1 = .oldDone
  newSignature : path 2 = .newLive
  newFixedPoint : path 3 = .newLive
  sourceReplay :
    ∀ n, EventReplay boundary (phaseLabel (path n))
  sourceEpochAligned :
    ∀ n, EventEpochAlignment boundary (phaseLabel (path n))
  oldBusinessDPO : DPOOccurrence oldSome OldEvent.advance
  admission : AdmissionOccurrence boundary
  newBusinessDPO : DPOOccurrence newSome NewEvent.hold
  admissionTargets : FourTargetDerivations .oldDone .newLive

namespace CompleteGeneratedTrajectory

/-- The exact dependent event mark carried at every trajectory position. -/
def eventMark
    {path : Nat → Phase}
    (trajectory : CompleteGeneratedTrajectory path)
    (n : Nat) :
    GlobalEvent oldSome newSome :=
  (trajectory.replay.event n).mark

@[simp] theorem eventMark_eq_phaseLabel
    {path : Nat → Phase}
    (trajectory : CompleteGeneratedTrajectory path)
    (n : Nat) :
    trajectory.eventMark n = phaseLabel (path n) :=
  (trajectory.replay.event n).mark_eq_phaseLabel

/-- Every sampled edge retains its source DPO/admission occurrence witness. -/
theorem sourceOccurrence
    {path : Nat → Phase}
    (trajectory : CompleteGeneratedTrajectory path)
    (n : Nat) :
    ScheduledSourceOccurrence (path n) :=
  (trajectory.replay.event n).occurrence

/-- Every sampled edge, not only admission, carries all four native targets. -/
theorem fourTargets
    {path : Nat → Phase}
    (trajectory : CompleteGeneratedTrajectory path)
    (n : Nat) :
    FourTargetDerivations (path n) (path (n + 1)) :=
  (trajectory.replay.event n).targets

end CompleteGeneratedTrajectory

/-- Build complete agreement solely from positive support and the start state. -/
def completeGeneratedTrajectory
    (path : Nat → Phase)
    (replay : ReplayMarkovKernel.ReplayTrajectory runtimeKernel path)
    (startsOld : path 0 = .oldStart) :
    CompleteGeneratedTrajectory path := by
  have oldEndpoint : path 1 = .oldDone := by
    calc
      path 1 = next (path 0) :=
        positive_target_eq_next (replay.positive 0)
      _ = .oldDone := by rw [startsOld]; rfl
  have newSignature : path 2 = .newLive := by
    calc
      path 2 = next (path 1) :=
        positive_target_eq_next (replay.positive 1)
      _ = .newLive := by rw [oldEndpoint]; rfl
  have newFixedPoint : path 3 = .newLive := by
    calc
      path 3 = next (path 2) :=
        positive_target_eq_next (replay.positive 2)
      _ = .newLive := by rw [newSignature]; rfl
  have oldEvent :
      GeneratedRuntimeEvent .oldStart .oldDone := by
    simpa only [startsOld, oldEndpoint] using replay.event 0
  have admissionEvent :
      GeneratedRuntimeEvent .oldDone .newLive := by
    simpa only [oldEndpoint, newSignature] using replay.event 1
  have newEvent :
      GeneratedRuntimeEvent .newLive .newLive := by
    simpa only [newSignature, newFixedPoint] using replay.event 2
  exact
    { replay := replay
      startsOld := startsOld
      oldEndpoint := oldEndpoint
      newSignature := newSignature
      newFixedPoint := newFixedPoint
      sourceReplay := fun n => (replay.event n).sourceReplay
      sourceEpochAligned := fun n => (replay.event n).sourceEpochAligned
      oldBusinessDPO := oldEvent.oldDPO
      admission := admissionEvent.admissionReplay
      newBusinessDPO := newEvent.newDPO
      admissionTargets := admissionEvent.targets }

/--
Almost every path of the concrete generated kernel has exact business DPO
replay, admission replay, epoch alignment, and four native target-admission
derivations on one common trajectory.
-/
theorem complete_generated_trajectory_almost_sure :
    ∀ᵐ path ∂
        runtimeKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (CompleteGeneratedTrajectory path) := by
  filter_upwards
    [runtimeKernel.almost_sure_replay_trajectory initial,
      runtimeKernel.trajectory_ae_starts_at Phase.oldStart] with
      path replay starts
  rcases replay with ⟨replay⟩
  exact ⟨completeGeneratedTrajectory path replay starts⟩

/-- Target admission is a genuine state-changing native step in every view. -/
theorem target_admission_native_all :
    (targetLTS .dag).ObservableStep
        (targetState .dag .oldDone) (targetEvent .dag .oldDone)
        (targetState .dag .newLive) ∧
      (targetLTS .petri).ObservableStep
        (targetState .petri .oldDone) (targetEvent .petri .oldDone)
        (targetState .petri .newLive) ∧
      (targetLTS .pi).ObservableStep
        (targetState .pi .oldDone) (targetEvent .pi .oldDone)
        (targetState .pi .newLive) ∧
      (targetLTS .morphism).ObservableStep
        (targetState .morphism .oldDone) (targetEvent .morphism .oldDone)
        (targetState .morphism .newLive) :=
  ⟨targetNative .dag .oldDone,
    targetNative .petri .oldDone,
    targetNative .pi .oldDone,
    targetNative .morphism .oldDone⟩

/-- Each native target admission changes the runtime execution epoch exactly. -/
theorem target_admission_versions (view : TargetView) :
    (targetLTS view).signatureVersion (targetState view .oldDone) =
        (ReferenceSignature.event).fromVersion ∧
      (targetLTS view).signatureVersion (targetState view .newLive) =
        (ReferenceSignature.event).toVersion ∧
      (targetLTS view).signatureVersion (targetState view .oldDone) <
        (targetLTS view).signatureVersion (targetState view .newLive) := by
  cases view <;> exact ⟨rfl, rfl, by decide⟩

/--
The native target admission is not an identity/state-preserving operation.
Together with `pure_reindex_ne_replayed_admission_target`, this excludes the
pure-reindex shortcut at both source and target runtime layers.
-/
theorem target_admission_state_changes (view : TargetView) :
    targetState view .oldDone ≠ targetState view .newLive := by
  intro equality
  cases equality

end Cantilune.Feedback.FiniteExecutableHeterogeneousRuntime
