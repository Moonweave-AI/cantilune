import Cantilune.Core.ExecutionEpochTrace
import Cantilune.Feedback.StochasticExecution
import Cantilune.Pi.AdmissionCertificate

/-!
# A heterogeneous admission trajectory on one probability space

`NativeMarkovKernel` deliberately fixes one signature and one
`ExecutionPackage`.  A signature admission therefore cannot be represented by
pretending that it is another `DPOEvent` of that package.

This file gives the smallest non-vacuous alternative:

* two replay epochs are joined by an actual `SignatureAdmissionEvent`;
* their states and labels are embedded in one sum-like global LTS;
* old-epoch and new-epoch labels retain their own verified `DPOEvent` replay,
  while the boundary retains heterogeneous `AdmissionReplays`;
* a finite stochastic matrix on one fixed phase type carries one of those
  replay witnesses on every positive edge; and
* its genuine Ionescu--Tulcea law almost surely has a complete event-labelled
  trajectory crossing the admission.

The construction is a concrete two-epoch witness.  It does not yet define a
generic scheduler over an unbounded stream of freshly supplied signatures.
-/

noncomputable section

namespace Cantilune.Feedback.HeterogeneousAdmissionTrajectory

open MeasureTheory ProbabilityTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.StochasticExecution

universe u

/-! ## A type-correct global encoding of two adjacent replay epochs -/

/-- A configuration packaged with the signature that indexes its labels. -/
structure PackedConfig where
  signature : FinSignature
  config : Config signature

/-- States from either side of one heterogeneous admission boundary. -/
inductive GlobalState (before after : SomeReplayEpoch)
  | old : before.package.lts.State → GlobalState before after
  | new : after.package.lts.State → GlobalState before after

/-- Labels retain which fixed-signature epoch produced them. -/
inductive GlobalEvent (before after : SomeReplayEpoch)
  | old : before.package.lts.Event → GlobalEvent before after
  | admission : GlobalEvent before after
  | new : after.package.lts.Event → GlobalEvent before after

namespace GlobalState

variable {before after : SomeReplayEpoch}

/-- Forget the global tag while retaining the dependent configuration. -/
def packedConfig : GlobalState before after → PackedConfig
  | .old state =>
      ⟨before.signature, before.package.configOf state⟩
  | .new state =>
      ⟨after.signature, after.package.configOf state⟩

/-- The actual runtime signature version of a global state. -/
def signatureVersion : GlobalState before after → Nat
  | .old state => before.package.lts.signatureVersion state
  | .new state => after.package.lts.signatureVersion state

end GlobalState

/-- Native steps in the global LTS, including exactly one admission edge. -/
inductive GlobalStep
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after) :
    GlobalState before after →
      GlobalEvent before after →
      GlobalState before after → Prop
  | old {source event target}
      (step :
        before.package.lts.ObservableStep source event target) :
      GlobalStep boundary (.old source) (.old event) (.old target)
  | admission :
      GlobalStep boundary
        (.old before.epoch.target) .admission
        (.new after.epoch.source)
  | new {source event target}
      (step :
        after.package.lts.ObservableStep source event target) :
      GlobalStep boundary (.new source) (.new event) (.new target)

/--
The only global label that can cross from the old state summand to the new
state summand is the heterogeneous admission label.
-/
def BoundaryLabelProperty
    {before after : SomeReplayEpoch}
    (source : GlobalState before after)
    (event : GlobalEvent before after)
    (target : GlobalState before after) : Prop :=
  match source, target with
  | .old _, .new _ => event = .admission
  | _, _ => True

theorem GlobalStep.boundary_label
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    {boundary : AdjacentAdmission universes before after}
    {source : GlobalState before after}
    {event : GlobalEvent before after}
    {target : GlobalState before after}
    (step : GlobalStep boundary source event target) :
    BoundaryLabelProperty source event target := by
  cases step <;> simp [BoundaryLabelProperty]

/-- The one fixed global LTS in which both signatures and the boundary live. -/
def globalLTS
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after) :
    ObservableLTS where
  State := GlobalState before after
  Event := GlobalEvent before after
  stateSetoid := ObservableLTS.equalitySetoid _
  step := GlobalStep boundary
  observable := fun _ => True
  success := fun _ => False
  waiting := fun _ => False
  signatureVersion := GlobalState.signatureVersion
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

/--
Replay evidence is deliberately heterogeneous: ordinary labels use their own
fixed-signature `DPOEvent`, while admission uses reindex-and-version replay.
-/
def EventReplay
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after) :
    GlobalEvent before after → Prop
  | .old event =>
      ∃ source target,
        before.package.lts.ObservableStep source event target ∧
        (before.package.eventRecord event).Replays
          (before.package.configOf source)
          (before.package.configOf target) ∧
        (before.package.eventRecord event).event.signatureVersion =
          before.epoch.executionEpoch
  | .admission =>
      AdmissionReplays boundary.admission
        (before.package.configOf before.epoch.target)
        (after.package.configOf after.epoch.source)
  | .new event =>
      ∃ source target,
        after.package.lts.ObservableStep source event target ∧
        (after.package.eventRecord event).Replays
          (after.package.configOf source)
          (after.package.configOf target) ∧
        (after.package.eventRecord event).event.signatureVersion =
          after.epoch.executionEpoch

/--
The execution-epoch statement carried by a global label.

An ordinary DPO label belongs to one fixed-signature epoch.  An admission
label names both adjacent runtime versions and proves that the boundary
strictly advances the execution epoch.
-/
def EventEpochAlignment
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after) :
    GlobalEvent before after → Prop
  | .old event =>
      (before.package.eventRecord event).event.signatureVersion =
        before.epoch.executionEpoch
  | .admission =>
      before.epoch.executionEpoch = boundary.admission.fromVersion ∧
        after.epoch.executionEpoch = boundary.admission.toVersion ∧
        before.epoch.executionEpoch < after.epoch.executionEpoch
  | .new event =>
      (after.package.eventRecord event).event.signatureVersion =
        after.epoch.executionEpoch

/--
Exact replay evidence entails exact epoch alignment.  In particular, the
admission case uses `AdmissionReplays`; it is never recast as a same-signature
`DPOEvent.Replays` witness.
-/
theorem eventReplay_epochAlignment
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    {boundary : AdjacentAdmission universes before after}
    {event : GlobalEvent before after}
    (replay : EventReplay boundary event) :
    EventEpochAlignment boundary event := by
  cases event with
  | old event =>
      rcases replay with ⟨_source, _target, _step, _replay, epoch⟩
      exact epoch
  | admission =>
      exact
        ⟨before.epoch.target_epoch.symm.trans replay.1,
          after.epoch.source_epoch.symm.trans replay.target_version,
          boundary.execution_epoch_strict⟩
  | new event =>
      rcases replay with ⟨_source, _target, _step, _replay, epoch⟩
      exact epoch

private theorem appendPath
    {L : ObservableLTS}
    {source middle target : L.State}
    {first second : List L.Event}
    (head : L.Path source first middle)
    (tail : L.Path middle second target) :
    L.Path source (first ++ second) target := by
  induction head with
  | nil state =>
      exact tail
  | @cons source next middle event events step path ih =>
      exact ObservableLTS.Path.cons step (ih tail)

private theorem liftOldPath
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after)
    {source target : before.package.lts.State}
    {events : List before.package.lts.Event}
    (path : before.package.lts.Path source events target) :
    (globalLTS boundary).Path
      (.old source) (events.map GlobalEvent.old) (.old target) := by
  induction path with
  | nil state =>
      exact
        ObservableLTS.Path.nil
          (L := globalLTS boundary) (GlobalState.old state)
  | @cons source middle target event events step path ih =>
      exact
        ObservableLTS.Path.cons
          ⟨GlobalStep.old step, trivial⟩ ih

private theorem liftNewPath
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after)
    {source target : after.package.lts.State}
    {events : List after.package.lts.Event}
    (path : after.package.lts.Path source events target) :
    (globalLTS boundary).Path
      (.new source) (events.map GlobalEvent.new) (.new target) := by
  induction path with
  | nil state =>
      exact
        ObservableLTS.Path.nil
          (L := globalLTS boundary) (GlobalState.new state)
  | @cons source middle target event events step path ih =>
      exact
        ObservableLTS.Path.cons
          ⟨GlobalStep.new step, trivial⟩ ih

/-- The exact global label list: old DPO events, admission, then new events. -/
def traceEvents
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (_boundary : AdjacentAdmission universes before after) :
    List (GlobalEvent before after) :=
  before.epoch.events.map GlobalEvent.old ++
    .admission :: after.epoch.events.map GlobalEvent.new

/-- The two replay epochs and their admission form one native global path. -/
theorem trace_path
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after) :
    (globalLTS boundary).Path
      (.old before.epoch.source)
      (traceEvents boundary)
      (.new after.epoch.target) := by
  apply appendPath (liftOldPath boundary before.epoch.path)
  exact
    ObservableLTS.Path.cons
      ⟨GlobalStep.admission, trivial⟩
      (liftNewPath boundary after.epoch.path)

/--
Every label of the global path carries its native derivation, exact runtime
epoch, and the appropriate same-signature or admission replay equation.
-/
theorem trace_event_replay
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after)
    (event : GlobalEvent before after)
    (member : event ∈ traceEvents boundary) :
    EventReplay boundary event := by
  cases event with
  | old event =>
      have eventMember : event ∈ before.epoch.events := by
        simpa [traceEvents] using member
      obtain ⟨source, target, step, replay⟩ :=
        before.epoch.event_has_verified_replay eventMember
      exact
        ⟨source, target, step, replay,
          before.epoch.event_signature_epoch eventMember⟩
  | admission =>
      exact boundary.replays
  | new event =>
      have eventMember : event ∈ after.epoch.events := by
        simpa [traceEvents] using member
      obtain ⟨source, target, step, replay⟩ :=
        after.epoch.event_has_verified_replay eventMember
      exact
        ⟨source, target, step, replay,
          after.epoch.event_signature_epoch eventMember⟩

/-! ## A concrete certified signature admission with DPO events on both sides -/

namespace Reference

open Cantilune.Pi.AdmissionCertificate

def oldStart : Config ReferenceSignature.source where
  signatureVersion := 0
  nodes := ∅
  edges := ∅
  nodeLabel := fun _ => none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 0
  tombstones := ∅

def oldEnd : Config ReferenceSignature.source :=
  { oldStart with policyState := 1 }

def newStart : Config ReferenceSignature.target :=
  admissionTarget ReferenceSignature.event oldEnd

theorem oldStart_wellFormed : oldStart.WellFormed := by
  simp [oldStart, Config.WellFormed]

theorem oldEnd_wellFormed : oldEnd.WellFormed := by
  simp [oldEnd, oldStart, Config.WellFormed]

theorem newStart_wellFormed : newStart.WellFormed :=
  admissionTarget_wellFormed ReferenceSignature.event oldEnd_wellFormed

inductive OldState
  | start
  | done
  deriving DecidableEq, Repr, Fintype

inductive OldEvent
  | advance
  deriving DecidableEq, Repr, Fintype

inductive OldStep : OldState → OldEvent → OldState → Prop
  | advance : OldStep .start .advance .done

def oldConfigOf : OldState → Config ReferenceSignature.source
  | .start => oldStart
  | .done => oldEnd

def oldLTS : ObservableLTS where
  State := OldState
  Event := OldEvent
  stateSetoid := ObservableLTS.equalitySetoid _
  step := OldStep
  observable := fun _ => True
  success := fun state => state = .done
  waiting := fun _ => False
  signatureVersion := fun _ => 0
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

def oldReplayKernel : DPOEvent.ReplayKernel ReferenceSignature.source where
  run recipe source :=
    if recipe.signatureVersion = 0 ∧
        recipe.ruleId = 8100 ∧
        source.signatureVersion = 0 ∧
        source.policyState = 0 then
      some { source with policyState := 1 }
    else
      none

def oldRecord : DPOEvent ReferenceSignature.source where
  signatureVersion := 0
  ruleId := 8100
  source := oldStart
  target := oldEnd
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := ⟨id, Function.injective_id⟩
  complementTag := 8101
  freshNames := ∅
  policyEvidence := [8102]
  externalEvidence := []
  kind := .internal
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp
  sourceWellFormed := oldStart_wellFormed
  targetWellFormed := oldEnd_wellFormed

def oldVerified :
    DPOEvent.Verified oldReplayKernel where
  event := oldRecord
  replay_correct := by
    simp [oldReplayKernel, oldRecord, DPOEvent.replayRecipe,
      oldStart, oldEnd]

def oldPackage : ExecutionPackage ReferenceSignature.source where
  lts := oldLTS
  configOf := oldConfigOf
  replayKernel := oldReplayKernel
  eventRecord := fun _ => oldVerified
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨step, _observable⟩
    cases step
    exact oldVerified.replays_recorded
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking := {
    internal := fun _ => False
    rank := fun _ => 0
    epoch := fun _ => 0
    decreases := by simp
    epoch_preserved := by simp
  }

theorem oldPath :
    oldLTS.Path OldState.start [OldEvent.advance] OldState.done :=
  ObservableLTS.Path.cons
    ⟨OldStep.advance, trivial⟩
    (ObservableLTS.Path.nil (L := oldLTS) OldState.done)

def oldEpoch : ReplayEpoch oldPackage where
  executionEpoch := 0
  source := .start
  target := .done
  events := [.advance]
  path := oldPath
  source_epoch := rfl

inductive NewState
  | live
  deriving DecidableEq, Repr, Fintype

inductive NewEvent
  | hold
  deriving DecidableEq, Repr, Fintype

inductive NewStep : NewState → NewEvent → NewState → Prop
  | hold : NewStep .live .hold .live

def newLTS : ObservableLTS where
  State := NewState
  Event := NewEvent
  stateSetoid := ObservableLTS.equalitySetoid _
  step := NewStep
  observable := fun _ => True
  success := fun _ => True
  waiting := fun _ => False
  signatureVersion := fun _ => 1
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

def newReplayKernel : DPOEvent.ReplayKernel ReferenceSignature.target where
  run recipe source :=
    if recipe.signatureVersion = 1 ∧
        recipe.ruleId = 8200 ∧
        source.signatureVersion = 1 then
      some source
    else
      none

def newRecord : DPOEvent ReferenceSignature.target where
  signatureVersion := 1
  ruleId := 8200
  source := newStart
  target := newStart
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := ⟨id, Function.injective_id⟩
  complementTag := 8201
  freshNames := ∅
  policyEvidence := [8202]
  externalEvidence := []
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp
  sourceWellFormed := newStart_wellFormed
  targetWellFormed := newStart_wellFormed

def newVerified :
    DPOEvent.Verified newReplayKernel where
  event := newRecord
  replay_correct := by
    simp [newReplayKernel, newRecord, DPOEvent.replayRecipe, newStart,
      admissionTarget, withSignatureVersion, ReferenceSignature.event]

def newPackage : ExecutionPackage ReferenceSignature.target where
  lts := newLTS
  configOf := fun _ => newStart
  replayKernel := newReplayKernel
  eventRecord := fun _ => newVerified
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨step, _observable⟩
    cases step
    exact newVerified.replays_recorded
  stateVersion := by
    intro state
    cases state
    rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking := {
    internal := fun _ => False
    rank := fun _ => 0
    epoch := fun _ => 1
    decreases := by simp
    epoch_preserved := by simp
  }

theorem newPath :
    newLTS.Path NewState.live [NewEvent.hold] NewState.live :=
  ObservableLTS.Path.cons
    ⟨NewStep.hold, trivial⟩
    (ObservableLTS.Path.nil (L := newLTS) NewState.live)

def newEpoch : ReplayEpoch newPackage where
  executionEpoch := 1
  source := .live
  target := .live
  events := [.hold]
  path := newPath
  source_epoch := rfl

def oldSome : SomeReplayEpoch where
  signature := ReferenceSignature.source
  package := oldPackage
  epoch := oldEpoch

def newSome : SomeReplayEpoch where
  signature := ReferenceSignature.target
  package := newPackage
  epoch := newEpoch

def boundary :
    AdjacentAdmission ReferenceSignature.universes oldSome newSome where
  admission := ReferenceSignature.event
  replays := ⟨rfl, rfl⟩

def epochChain :
    EpochChain ReferenceSignature.universes oldSome newSome :=
  .cons boundary (.single newSome)

theorem epochChain_replay :
    EpochChain.ReplayAgreement epochChain :=
  EpochChain.complete_replay_agreement epochChain

theorem globalTrace :
    (globalLTS boundary).Path
      (.old OldState.start)
      (traceEvents boundary)
      (.new NewState.live) :=
  trace_path boundary

/-! ## A finite stochastic kernel whose positive edges carry exact replay -/

inductive Phase
  | oldStart
  | oldDone
  | newLive
  deriving DecidableEq, Repr, Fintype

private instance : MeasurableSpace Phase := ⊤

def phaseState : Phase → GlobalState oldSome newSome
  | .oldStart => .old OldState.start
  | .oldDone => .old OldState.done
  | .newLive => .new NewState.live

def next : Phase → Phase
  | .oldStart => .oldDone
  | .oldDone => .newLive
  | .newLive => .newLive

def phaseLabel : Phase → GlobalEvent oldSome newSome
  | .oldStart => .old OldEvent.advance
  | .oldDone => .admission
  | .newLive => .new NewEvent.hold

theorem phase_native (source : Phase) :
    (globalLTS boundary).ObservableStep
      (phaseState source) (phaseLabel source) (phaseState (next source)) := by
  cases source with
  | oldStart =>
      exact ⟨GlobalStep.old ⟨OldStep.advance, trivial⟩, trivial⟩
  | oldDone =>
      exact ⟨GlobalStep.admission, trivial⟩
  | newLive =>
      exact ⟨GlobalStep.new ⟨NewStep.hold, trivial⟩, trivial⟩

theorem phase_replay (source : Phase) :
    EventReplay boundary (phaseLabel source) := by
  cases source with
  | oldStart =>
      exact
        ⟨OldState.start, OldState.done,
          ⟨OldStep.advance, trivial⟩,
          oldVerified.replays_recorded, rfl⟩
  | oldDone =>
      exact boundary.replays
  | newLive =>
      exact
        ⟨NewState.live, NewState.live,
          ⟨NewStep.hold, trivial⟩,
          newVerified.replays_recorded, rfl⟩

/-- One global event with its native endpoints and exact replay evidence. -/
structure NativeReplayEvent (source target : Phase) where
  label : GlobalEvent oldSome newSome
  native :
    (globalLTS boundary).ObservableStep
      (phaseState source) label (phaseState target)
  replay : EventReplay boundary label

namespace NativeReplayEvent

/-- Every sampled native replay event carries its exact runtime epoch(s). -/
theorem epochAlignment
    {source target : Phase}
    (event : NativeReplayEvent source target) :
    EventEpochAlignment boundary event.label :=
  eventReplay_epochAlignment event.replay

end NativeReplayEvent

def selectedEvent (source : Phase) :
    NativeReplayEvent source (next source) where
  label := phaseLabel source
  native := phase_native source
  replay := phase_replay source

/--
A finite stochastic matrix whose positive edges carry dependent replay
events.  This is the signature-heterogeneous counterpart of the support part
of `NativeMarkovKernel`; no single fixed-signature package is fabricated.
-/
structure ReplayMarkovKernel
    (State : Type*) [Fintype State] [DecidableEq State]
    (ReplayEvent : State → State → Type u) where
  probability : State → State → Real
  probability_nonnegative :
    ∀ source target, 0 ≤ probability source target
  row_sum :
    ∀ source, ∑ target, probability source target = 1
  event_of_positive :
    ∀ {source target},
      0 < probability source target → ReplayEvent source target

namespace ReplayMarkovKernel

variable {State : Type*} [Fintype State] [DecidableEq State]
variable {ReplayEvent : State → State → Type u}
variable [MeasurableSpace State] [MeasurableSingletonClass State]

noncomputable def stateMeasure
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (source : State) : Measure State :=
  ∑ target,
    ENNReal.ofReal (kernel.probability source target) •
      Measure.dirac target

omit [MeasurableSingletonClass State] in
theorem stateMeasure_univ
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (source : State) :
    kernel.stateMeasure source Set.univ = 1 := by
  simp only [stateMeasure, Measure.finsetSum_apply,
    Measure.smul_apply, Measure.dirac_apply_of_mem, Set.mem_univ,
    smul_eq_mul, mul_one]
  rw [← ENNReal.ofReal_sum_of_nonneg]
  · rw [kernel.row_sum]
    norm_num
  · intro target _member
    exact kernel.probability_nonnegative source target

noncomputable def toKernel
    (kernel : ReplayMarkovKernel State ReplayEvent) :
    ProbabilityTheory.Kernel State State :=
  ProbabilityTheory.Kernel.ofFunOfCountable kernel.stateMeasure

@[simp]
theorem toKernel_apply
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (source : State) :
    kernel.toKernel source = kernel.stateMeasure source :=
  rfl

noncomputable def toMarkovExecutionKernel
    (kernel : ReplayMarkovKernel State ReplayEvent) :
    MarkovExecutionKernel State where
  stepKernel := kernel.toKernel
  isMarkov := by
    constructor
    intro source
    rw [isProbabilityMeasure_iff]
    exact kernel.stateMeasure_univ source

/-- The genuine trajectory law projected to its history through time `n`. -/
noncomputable def finiteMarginal
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (initial : Measure State) [IsProbabilityMeasure initial]
    (n : Nat) :
    Measure ((i : Finset.Iic n) → State) :=
  (kernel.toMarkovExecutionKernel.trajectoryMeasure initial).map
    (Preorder.frestrictLe n)

/-- At time zero the finite marginal is exactly the supplied initial law. -/
theorem finiteMarginal_zero
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (initial : Measure State) [IsProbabilityMeasure initial] :
    kernel.finiteMarginal initial 0 =
      initial.map (MeasurableEquiv.piUnique _).symm := by
  unfold finiteMarginal MarkovExecutionKernel.trajectoryMeasure
  rw [ProbabilityTheory.Kernel.trajMeasure,
    Measure.map_comp _ _ (Preorder.measurable_frestrictLe 0),
    ProbabilityTheory.Kernel.traj_map_frestrictLe,
    ProbabilityTheory.Kernel.partialTraj_self]
  simp

/-- A trajectory started from a Dirac law begins at that state almost surely. -/
theorem trajectory_ae_starts_at
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (start : State) :
    ∀ᵐ path ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure
          (Measure.dirac start),
      path 0 = start := by
  have historyStart :
      ∀ᵐ history ∂ kernel.finiteMarginal (Measure.dirac start) 0,
        history ⟨0, Finset.mem_Iic.mpr le_rfl⟩ = start := by
    rw [kernel.finiteMarginal_zero]
    simp
  unfold ReplayMarkovKernel.finiteMarginal at historyStart
  have pulled :=
    (ae_map_iff
      (Preorder.measurable_frestrictLe 0).aemeasurable
      (Set.toFinite
        {history : (i : Finset.Iic 0) → State |
          history ⟨0, Finset.mem_Iic.mpr le_rfl⟩ =
            start}).measurableSet).1 historyStart
  simpa [Preorder.frestrictLe_apply] using pulled

theorem ae_positive_probability
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (source : State) :
    ∀ᵐ target ∂ kernel.toKernel source,
      0 < kernel.probability source target := by
  rw [toKernel_apply]
  unfold stateMeasure
  rw [ae_finsetSum_measure_iff]
  intro target _member
  by_cases zero : kernel.probability source target = 0
  · simp [zero]
  · have positive :
        0 < kernel.probability source target :=
      lt_of_le_of_ne
        (kernel.probability_nonnegative source target) (Ne.symm zero)
    apply Measure.ae_smul_measure
    rw [MeasureTheory.ae_dirac_iff]
    · exact positive
    · exact
        (Set.toFinite
          {target : State |
            0 < kernel.probability source target}).measurableSet

set_option maxHeartbeats 400000 in
theorem trajectory_ae_positive_probability_at
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (initial : Measure State) [IsProbabilityMeasure initial]
    (n : Nat) :
    ∀ᵐ path ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      0 < kernel.probability (path n) (path (n + 1)) := by
  have joint :
      ∀ᵐ pair ∂
          (kernel.toMarkovExecutionKernel.trajectoryMeasure initial).map
              (Preorder.frestrictLe n) ⊗ₘ
            kernel.toMarkovExecutionKernel.historyKernel n,
        0 <
          kernel.probability
            (pair.1 ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2 := by
    apply Measure.ae_compProd_of_ae_ae
    · exact
        measurableSet_lt measurable_const
          (measurable_of_finite
            (fun pair :
                ((i : Finset.Iic n) → State) × State =>
              kernel.probability
                (pair.1 ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2))
    · exact Filter.Eventually.of_forall fun history => by
        have row :=
          kernel.ae_positive_probability
            (history ⟨n, Finset.mem_Iic.mpr le_rfl⟩)
        simpa [MarkovExecutionKernel.historyKernel,
          toMarkovExecutionKernel, toKernel_apply] using row
  unfold MarkovExecutionKernel.trajectoryMeasure at joint ⊢
  have jointMeasureEq :=
    ProbabilityTheory.Kernel.map_frestrictLe_trajMeasure_compProd_eq_map_trajMeasure
      (X := fun _ => State)
      (μ₀ := initial)
      (κ := kernel.toMarkovExecutionKernel.historyKernel)
      (a := n)
  rw [jointMeasureEq] at joint
  have pulled :=
    (ae_map_iff
      (Preorder.measurable_frestrictLe n |>.prod
        (measurable_pi_apply (n + 1))).aemeasurable
      (measurableSet_lt measurable_const
        (measurable_of_finite
          (fun pair :
              ((i : Finset.Iic n) → State) × State =>
            kernel.probability
              (pair.1 ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2)))).1 joint
  simpa [Preorder.frestrictLe_apply] using pulled

theorem trajectory_ae_positive_probability
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (initial : Measure State) [IsProbabilityMeasure initial] :
    ∀ᵐ path ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      ∀ n, 0 < kernel.probability (path n) (path (n + 1)) := by
  rw [ae_all_iff]
  exact kernel.trajectory_ae_positive_probability_at initial

/-- A sampled state path decorated with exact dependent replay events. -/
structure ReplayTrajectory
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (path : Nat → State) where
  positive :
    ∀ n, 0 < kernel.probability (path n) (path (n + 1))
  event : ∀ n, ReplayEvent (path n) (path (n + 1))

/--
Almost every path of the genuine kernel law admits an event label with exact
replay evidence at every step.
-/
theorem almost_sure_replay_trajectory
    (kernel : ReplayMarkovKernel State ReplayEvent)
    (initial : Measure State) [IsProbabilityMeasure initial] :
    ∀ᵐ path ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (ReplayTrajectory kernel path) := by
  filter_upwards [kernel.trajectory_ae_positive_probability initial] with
      path positive
  exact
    ⟨{
      positive := positive
      event := fun n => kernel.event_of_positive (positive n)
    }⟩

end ReplayMarkovKernel

def transitionProbability (source target : Phase) : Real :=
  if target = next source then 1 else 0

theorem positive_target_eq_next
    {source target : Phase}
    (positive : 0 < transitionProbability source target) :
    target = next source := by
  by_contra different
  simp [transitionProbability, different] at positive

def stochasticKernel :
    ReplayMarkovKernel Phase NativeReplayEvent where
  probability := transitionProbability
  probability_nonnegative := by
    intro source target
    by_cases equality : target = next source <;>
      simp [transitionProbability, equality]
  row_sum := by
    intro source
    simp [transitionProbability]
  event_of_positive := by
    intro source target positive
    have equality := positive_target_eq_next positive
    subst target
    exact selectedEvent source

noncomputable def initial : Measure Phase :=
  Measure.dirac .oldStart

noncomputable instance : IsProbabilityMeasure initial := by
  unfold initial
  infer_instance

/-- The Ionescu--Tulcea path starts in the old signature almost surely. -/
theorem trajectory_ae_starts_old :
    ∀ᵐ path ∂
        stochasticKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      path 0 = .oldStart := by
  have historyStart :
      ∀ᵐ history ∂ stochasticKernel.finiteMarginal initial 0,
        history ⟨0, Finset.mem_Iic.mpr le_rfl⟩ = Phase.oldStart := by
    rw [ReplayMarkovKernel.finiteMarginal_zero]
    simp [initial]
  unfold ReplayMarkovKernel.finiteMarginal at historyStart
  have pulled :=
    (ae_map_iff
      (Preorder.measurable_frestrictLe 0).aemeasurable
      (Set.toFinite
        {history : (i : Finset.Iic 0) → Phase |
          history ⟨0, Finset.mem_Iic.mpr le_rfl⟩ =
            Phase.oldStart}).measurableSet).1 historyStart
  simpa [Preorder.frestrictLe_apply] using pulled

/--
The event-labelled stochastic path reaches the old epoch endpoint and then the
new-signature state across the certified admission.
-/
structure HeterogeneousCommonTrajectory (path : Nat → Phase) where
  replay :
    ReplayMarkovKernel.ReplayTrajectory stochasticKernel path
  startsOld : path 0 = .oldStart
  oldEndpoint : path 1 = .oldDone
  newSignature : path 2 = .newLive
  admissionReplay : EventReplay boundary (.admission)

/--
The strengthened event-level agreement carried by a sampled heterogeneous
trajectory.  Besides its state path, it records at every time:

* the actual selected global label;
* its native transition derivation;
* the correct replay relation (`DPOEvent.Replays` or `AdmissionReplays`); and
* its exact execution-epoch alignment.

All four clauses are derived from the positive-support event selector; none
is supplied as an independent trajectory assumption.
-/
structure EventReplayEpochTrajectory (path : Nat → Phase) where
  common : HeterogeneousCommonTrajectory path
  eventReplay :
    ∀ n, EventReplay boundary (common.replay.event n).label
  eventEpochAlignment :
    ∀ n, EventEpochAlignment boundary (common.replay.event n).label

/-- Construct the full event/replay/epoch agreement from the common path. -/
def HeterogeneousCommonTrajectory.toEventReplayEpochTrajectory
    {path : Nat → Phase}
    (trajectory : HeterogeneousCommonTrajectory path) :
    EventReplayEpochTrajectory path where
  common := trajectory
  eventReplay := fun n => (trajectory.replay.event n).replay
  eventEpochAlignment := fun n =>
    (trajectory.replay.event n).epochAlignment

def heterogeneousCommonTrajectory
    (path : Nat → Phase)
    (replay :
      ReplayMarkovKernel.ReplayTrajectory stochasticKernel path)
    (startsOld : path 0 = .oldStart) :
    HeterogeneousCommonTrajectory path where
  replay := replay
  startsOld := startsOld
  oldEndpoint := by
    calc
      path 1 = next (path 0) :=
        positive_target_eq_next (replay.positive 0)
      _ = .oldDone := by rw [startsOld]; rfl
  newSignature := by
    have oldEndpoint :
        path 1 = Phase.oldDone := by
      calc
        path 1 = next (path 0) :=
          positive_target_eq_next (replay.positive 0)
        _ = .oldDone := by rw [startsOld]; rfl
    calc
      path 2 = next (path 1) :=
        positive_target_eq_next (replay.positive 1)
      _ = .newLive := by rw [oldEndpoint]; rfl
  admissionReplay := boundary.replays

/-- The sampled event between epochs is the certified admission label itself. -/
theorem HeterogeneousCommonTrajectory.admission_label_at_one
    {path : Nat → Phase}
    (trajectory : HeterogeneousCommonTrajectory path) :
    (trajectory.replay.event 1).label =
      (GlobalEvent.admission :
        GlobalEvent oldSome newSome) := by
  let label := (trajectory.replay.event 1).label
  have native :
      (globalLTS boundary).ObservableStep
        (phaseState .oldDone) label (phaseState .newLive) := by
    simpa only [trajectory.oldEndpoint, trajectory.newSignature] using
      (trajectory.replay.event 1).native
  change label = (GlobalEvent.admission : GlobalEvent oldSome newSome)
  rcases native with ⟨step, _observable⟩
  simpa [BoundaryLabelProperty, phaseState] using step.boundary_label

/--
The concrete Ionescu--Tulcea law lives on one fixed global phase space and
almost surely carries old-signature DPO replay, the certified admission, and
new-signature DPO replay as dependent event labels.
-/
theorem almost_sure_heterogeneous_common_trajectory :
    ∀ᵐ path ∂
        stochasticKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (HeterogeneousCommonTrajectory path) := by
  filter_upwards
    [stochasticKernel.almost_sure_replay_trajectory initial,
      trajectory_ae_starts_old] with path replay startsOld
  rcases replay with ⟨replay⟩
  exact ⟨heterogeneousCommonTrajectory path replay startsOld⟩

/--
Almost every Ionescu--Tulcea sample has a full event-labelled agreement:
native derivations, replay equations, and execution-epoch alignment hold at
every sampled edge.  This is the event-level probability bridge, not merely
an agreement of projected state trajectories.
-/
theorem almost_sure_event_replay_epoch_trajectory :
    ∀ᵐ path ∂
        stochasticKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (EventReplayEpochTrajectory path) := by
  filter_upwards [almost_sure_heterogeneous_common_trajectory] with
      path trajectory
  rcases trajectory with ⟨trajectory⟩
  exact ⟨trajectory.toEventReplayEpochTrajectory⟩

end Reference

end Cantilune.Feedback.HeterogeneousAdmissionTrajectory
