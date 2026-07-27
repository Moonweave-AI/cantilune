import Cantilune.Feedback.EventTrajectory

/-!
# Probability measure on replayable event paths

`EventTrajectory` constructs a replayable event decoration of every state
sample path.  This module transports the Ionescu--Tulcea state law to a
distinct event-path sample space and proves that forgetting events returns the
original law exactly.

The selected event is deterministic for each ordered state pair.  A kernel
that probabilistically distinguishes several events with the same endpoints
would require an additional finite event distribution; no such probability
is silently invented here.
-/

namespace Cantilune.Feedback.EventTrajectory.FiniteDiscrete

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]

/--
A sample in the event-path space.  Its state code determines both the native
event at each time and the replayable package trajectory through `labelling`.
-/
structure ReplayableEventPath
    {kernel : NativeMarkovKernel signature package State}
    (labelling : TotalNativeLabelling kernel) where
  stateCode : Nat → State

namespace ReplayableEventPath

variable {kernel : NativeMarkovKernel signature package State}
variable {labelling : TotalNativeLabelling kernel}

/-- Embed a state path into the event-path sample space. -/
def ofState (path : Nat → State) : ReplayableEventPath labelling :=
  ⟨path⟩

/-- The selected package-level event trajectory carried by a sample. -/
def trajectory (path : ReplayableEventPath labelling) :
    InfiniteEventTrajectory package :=
  labelling.decorate path.stateCode

/-- The event occurring between state `n` and state `n+1`. -/
def event (path : ReplayableEventPath labelling) (n : Nat) :
    package.lts.Event :=
  (path.trajectory).event n

/-- Every selected event is a native observable package step. -/
theorem native (path : ReplayableEventPath labelling) (n : Nat) :
    package.lts.ObservableStep
      ((path.trajectory).state n)
      (path.event n)
      ((path.trajectory).state (n + 1)) :=
  (path.trajectory).native n

/-- Every selected event replays its recorded configurations. -/
theorem replays (path : ReplayableEventPath labelling) (n : Nat) :
    (package.eventRecord (path.event n)).Replays
      (package.configOf ((path.trajectory).state n))
      (package.configOf ((path.trajectory).state (n + 1))) :=
  InfiniteEventTrajectory.event_replays path.trajectory n

/-- State projection of the carried package trajectory is the stored code. -/
theorem trajectory_state_projection
    (path : ReplayableEventPath labelling) :
    TotalNativeLabelling.projectState
        (kernel := kernel) path.trajectory =
      path.stateCode :=
  TotalNativeLabelling.projectState_decorate labelling path.stateCode

@[simp]
theorem stateCode_ofState (path : Nat → State) :
    (ofState (labelling := labelling) path).stateCode = path :=
  rfl

variable [MeasurableSpace State]

/--
The measurable structure is transported from state trajectories.  Therefore
event-path cylinders selected by this deterministic labelling have exactly
the measurability inherited from their state-code preimages.
-/
instance measurableSpace : MeasurableSpace (ReplayableEventPath labelling) :=
  MeasurableSpace.comap stateCode inferInstance

theorem measurable_stateCode :
    Measurable
      (stateCode :
        ReplayableEventPath labelling → (Nat → State)) :=
  comap_measurable _

theorem measurable_ofState :
    Measurable
      (ofState :
        (Nat → State) → ReplayableEventPath labelling) := by
  rw [measurable_comap_iff]
  exact measurable_id

end ReplayableEventPath

variable [MeasurableSpace State]
variable [MeasurableSingletonClass State]

/--
The genuine probability law on replayable event paths, obtained as the
measurable pushforward of the Ionescu--Tulcea state trajectory law.
-/
noncomputable def replayableEventTrajectoryMeasure
    {kernel : NativeMarkovKernel signature package State}
    (labelling : TotalNativeLabelling kernel)
    (initial : InitialDistribution State) :
    Measure (ReplayableEventPath labelling) :=
  (kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure).map
    (ReplayableEventPath.ofState (labelling := labelling))

noncomputable instance replayableEventTrajectoryMeasure_isProbability
    {kernel : NativeMarkovKernel signature package State}
    (labelling : TotalNativeLabelling kernel)
    (initial : InitialDistribution State) :
    IsProbabilityMeasure
      (replayableEventTrajectoryMeasure labelling initial) :=
  Measure.isProbabilityMeasure_map
    (ReplayableEventPath.measurable_ofState
      (labelling := labelling)).aemeasurable

/--
One event-path sample carries the complete common trajectory data required by
the execution package: exact state projection, selected native event labels,
replayable `DPOEvent` records, and alignment with the shared stable epoch
window.
-/
structure CompleteCommonTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : ReplayableEventPath bridge.labelling) where
  trajectory : InfiniteEventTrajectory package
  trajectory_eq : trajectory = path.trajectory
  state_projection :
    TotalNativeLabelling.projectState
        (kernel := kernel) trajectory =
      path.stateCode
  selected_event :
    ∀ n,
      trajectory.event n =
        bridge.labelling.event
          (path.stateCode n) (path.stateCode (n + 1))
  replayable :
    ∀ n,
      (package.eventRecord (trajectory.event n)).Replays
        (package.configOf (trajectory.state n))
        (package.configOf (trajectory.state (n + 1)))
  epoch_aligned :
    EpochAlignedTrajectory bridge.progress.window trajectory

/-- Construct the complete event/state/epoch/replay agreement for every path. -/
def completeCommonTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : ReplayableEventPath bridge.labelling) :
    CompleteCommonTrajectory bridge path where
  trajectory := path.trajectory
  trajectory_eq := rfl
  state_projection := path.trajectory_state_projection
  selected_event := by
    intro n
    rfl
  replayable := path.replays
  epoch_aligned := bridge.alignment.decorate_aligned path.stateCode

/--
Forgetting event labels from the pushed-forward law recovers exactly the
original Ionescu--Tulcea state law.
-/
theorem map_stateCode_replayableEventTrajectoryMeasure
    {kernel : NativeMarkovKernel signature package State}
    (labelling : TotalNativeLabelling kernel)
    (initial : InitialDistribution State) :
    (replayableEventTrajectoryMeasure labelling initial).map
        ReplayableEventPath.stateCode =
      kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure := by
  rw [replayableEventTrajectoryMeasure, Measure.map_map
    (ReplayableEventPath.measurable_stateCode (labelling := labelling))
    (ReplayableEventPath.measurable_ofState (labelling := labelling))]
  change
    Measure.map id
        (kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure) =
      kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure
  exact Measure.map_id

/--
Almost-sure stable hitting now lives on the event-path probability space, not
only on the underlying state sample space.
-/
theorem replayable_event_measure_almost_sure_hitting
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon) :
    ∀ᵐ path ∂replayableEventTrajectoryMeasure bridge.labelling initial,
      bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
        path.stateCode := by
  have stateAE :
      ∀ᵐ path
        ∂kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path :=
    bridge.progress.finite_kernel_feedback_almost_sure_hitting
  have measurableEventuallyHits :
      MeasurableSet
        {path : Nat → State |
          bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
            path} := by
    have measurableNeverHit :
        MeasurableSet
          bridge.progress.toKernelProgressAssumption.hittingBridge.neverHit := by
      exact MeasurableSet.iInter
        bridge.progress.toKernelProgressAssumption.hittingBridge.measurable_notHit
    have setEquality :
        {path : Nat → State |
          bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
            path} =
          bridge.progress.toKernelProgressAssumption.hittingBridge.neverHitᶜ := by
      ext path
      exact
        bridge.progress.toKernelProgressAssumption.hittingBridge
          |>.eventuallyHits_iff_not_mem_neverHit path
    rw [setEquality]
    exact measurableNeverHit.compl
  have measurableReplayableEventuallyHits :
      MeasurableSet
        {path : ReplayableEventPath bridge.labelling |
          bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
            path.stateCode} :=
    measurableEventuallyHits.preimage
      (ReplayableEventPath.measurable_stateCode
        (labelling := bridge.labelling))
  exact
    (ae_map_iff
      (ReplayableEventPath.measurable_ofState
        (labelling := bridge.labelling)).aemeasurable
      measurableReplayableEventuallyHits).2
      (by simpa using stateAE)

/--
The full common-trajectory theorem: almost every event-path sample both
eventually hits the stable region and carries native labels, exact epoch
alignment, and independently replayable `DPOEvent` records at every step.
-/
theorem complete_common_trajectory_almost_sure
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon) :
    ∀ᵐ path ∂replayableEventTrajectoryMeasure bridge.labelling initial,
      Nonempty (CompleteCommonTrajectory bridge path) ∧
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path.stateCode := by
  filter_upwards
    [replayable_event_measure_almost_sure_hitting bridge] with path hits
  exact ⟨⟨completeCommonTrajectory bridge path⟩, hits⟩

end Cantilune.Feedback.EventTrajectory.FiniteDiscrete
