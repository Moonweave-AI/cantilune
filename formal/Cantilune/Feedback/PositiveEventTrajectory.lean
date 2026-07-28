import Cantilune.Feedback.EventTrajectorySupport

/-!
# Event trajectories without zero-mass totalisation

`TotalNativeLabelling` is useful when a concrete LTS genuinely contains an
event for every ordered state pair.  It is too strong for many native
semantics: a stochastic matrix may assign zero mass to an impossible pair,
and no source event should be invented merely to decorate that null path.

This module gives the exact alternative.  A `PositiveStatePath` carries the
proof that every sampled edge has positive matrix mass.  A
`PositiveEventLabelling` then decorates it with native events.  The finite
kernel trajectory law produces such a path almost surely, so event labels,
replay, state projection, and epoch alignment are recovered without any
zero-mass administrative transition.
-/

noncomputable section

namespace Cantilune.Feedback.EventTrajectory.FiniteDiscrete

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]

/-- A state trajectory all of whose consecutive edges have positive mass. -/
structure PositiveStatePath
    (kernel : NativeMarkovKernel signature package State) where
  state : Nat → State
  positive :
    ∀ n, 0 < kernel.probability (state n) (state (n + 1))

namespace PositiveEventLabelling

variable {kernel : NativeMarkovKernel signature package State}

/-- Decorate a positive state path with the selected native events. -/
def decorate
    (labelling : PositiveEventLabelling kernel)
    (path : PositiveStatePath kernel) :
    InfiniteEventTrajectory package where
  state n := kernel.stateEquiv (path.state n)
  event n := labelling.event (path.positive n)
  native n := labelling.native (path.positive n)

/-- Project a native event trajectory back through the kernel state equivalence. -/
def projectState
    (trajectory : InfiniteEventTrajectory package) :
    Nat → State :=
  fun n => kernel.stateEquiv.symm (trajectory.state n)

@[simp]
theorem projectState_decorate
    (labelling : PositiveEventLabelling kernel)
    (path : PositiveStatePath kernel) :
    projectState (kernel := kernel) (labelling.decorate path) =
      path.state := by
  funext n
  simp [projectState, decorate]

/-- Exact event-labelled coupling for one positive state path. -/
structure TrajectoryAgreement
    (labelling : PositiveEventLabelling kernel)
    (path : PositiveStatePath kernel) where
  trajectory : InfiniteEventTrajectory package
  state_projection :
    projectState (kernel := kernel) trajectory = path.state
  selected_event :
    ∀ n,
      trajectory.event n =
        labelling.event (path.positive n)
  replay :
    ∀ n,
      (package.eventRecord (trajectory.event n)).Replays
        (package.configOf (trajectory.state n))
        (package.configOf (trajectory.state (n + 1)))

/-- Agreement is constructed; it is not a hypothesis on the stochastic law. -/
def trajectoryAgreement
    (labelling : PositiveEventLabelling kernel)
    (path : PositiveStatePath kernel) :
    TrajectoryAgreement labelling path where
  trajectory := labelling.decorate path
  state_projection := projectState_decorate labelling path
  selected_event := by intro n; rfl
  replay := by
    intro n
    exact (labelling.decorate path).event_replays n

end PositiveEventLabelling

/--
Epoch alignment specialized to positive edges.  No event is requested for a
zero-mass pair.
-/
structure PositiveEpochKernelAlignment
    {kernel : NativeMarkovKernel signature package State}
    (labelling : PositiveEventLabelling kernel)
    (window : StableFairWindow) where
  stable_state_version :
    ∀ state,
      package.lts.signatureVersion (kernel.stateEquiv state) =
        window.signatureVersion window.startEpoch
  opportunity_noninternal :
    ∀ {source target}
      (positive : 0 < kernel.probability source target),
      ¬ package.ranking.internal (labelling.event positive)

namespace PositiveEpochKernelAlignment

variable {kernel : NativeMarkovKernel signature package State}
variable {labelling : PositiveEventLabelling kernel}
variable {window : StableFairWindow}

private theorem signature_at_positive_eventEpoch
    (window : StableFairWindow) (n : Nat) :
    window.signatureVersion (eventEpoch window n) =
      window.signatureVersion window.startEpoch := by
  obtain ⟨offset, equality⟩ :=
    Nat.exists_eq_add_of_le (window.opportunity_after_start n)
  unfold eventEpoch
  rw [equality]
  exact window.signature_stable offset

/-- Every positively decorated path has exact event-epoch alignment. -/
theorem decorate_aligned
    (alignment : PositiveEpochKernelAlignment labelling window)
    (path : PositiveStatePath kernel) :
    EpochAlignedTrajectory window (labelling.decorate path) where
  event_noninternal n :=
    alignment.opportunity_noninternal (path.positive n)
  source_signature n := by
    calc
      package.lts.signatureVersion
          ((labelling.decorate path).state n) =
          window.signatureVersion window.startEpoch :=
        alignment.stable_state_version (path.state n)
      _ = window.signatureVersion (eventEpoch window n) := by
        symm
        apply signature_at_positive_eventEpoch
  target_signature n := by
    calc
      package.lts.signatureVersion
          ((labelling.decorate path).state (n + 1)) =
          window.signatureVersion window.startEpoch :=
        alignment.stable_state_version (path.state (n + 1))
      _ = window.signatureVersion (eventEpoch window n) := by
        symm
        apply signature_at_positive_eventEpoch

end PositiveEpochKernelAlignment

variable [MeasurableSpace State] [MeasurableSingletonClass State]

/--
The actual Ionescu--Tulcea law almost surely produces a positive state path
with exactly the sampled state sequence.
-/
theorem positive_state_path_exists_almost_surely
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State) :
    ∀ᵐ rawPath ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      ∃ path : PositiveStatePath kernel,
        path.state = rawPath := by
  filter_upwards
    [kernel.trajectory_ae_positive_probability initial] with
      rawPath positive
  exact ⟨⟨rawPath, positive⟩, rfl⟩

/--
Almost every generated state path therefore has a native, event-labelled,
exactly replayable trajectory agreement.  No `TrajectoryAgreement` premise
and no null-edge event selector appear in the theorem.
-/
theorem replayable_positive_trajectory_exists_almost_surely
    {kernel : NativeMarkovKernel signature package State}
    (labelling : PositiveEventLabelling kernel)
    (initial : InitialDistribution State) :
    ∀ᵐ rawPath ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      ∃ path : PositiveStatePath kernel,
        path.state = rawPath ∧
          Nonempty (labelling.TrajectoryAgreement path) := by
  filter_upwards
    [positive_state_path_exists_almost_surely kernel initial] with
      rawPath witness
  rcases witness with ⟨path, stateEquality⟩
  exact
    ⟨path, stateEquality,
      ⟨labelling.trajectoryAgreement path⟩⟩

/--
Adding an explicit alignment value gives the full almost-sure common
trajectory: state projection, selected native event, exact replay, and epoch
alignment all refer to the same decorated path.
-/
theorem replayable_epoch_aligned_trajectory_exists_almost_surely
    {kernel : NativeMarkovKernel signature package State}
    (labelling : PositiveEventLabelling kernel)
    (initial : InitialDistribution State)
    {window : StableFairWindow}
    (alignment : PositiveEpochKernelAlignment labelling window) :
    ∀ᵐ rawPath ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      ∃ path : PositiveStatePath kernel,
        path.state = rawPath ∧
          Nonempty (labelling.TrajectoryAgreement path) ∧
          Nonempty
            (EpochAlignedTrajectory window (labelling.decorate path)) := by
  filter_upwards
    [positive_state_path_exists_almost_surely kernel initial] with
      rawPath witness
  rcases witness with ⟨path, stateEquality⟩
  exact
    ⟨path, stateEquality,
      ⟨labelling.trajectoryAgreement path⟩,
      ⟨alignment.decorate_aligned path⟩⟩

end Cantilune.Feedback.EventTrajectory.FiniteDiscrete
