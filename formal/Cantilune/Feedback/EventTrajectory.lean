import Cantilune.Feedback.Execution
import Cantilune.Feedback.StochasticExecution

/-!
# Event-labelled stochastic execution trajectories

The finite stochastic bridge in `StochasticExecution` starts with state mass.
This module records the extra data needed to recover native, replayable events
without pretending that an existential support proof is itself a sampler.

There are two levels.

* `PositiveEventLabelling` selects a native event for every state pair carrying
  positive mass.  Its existence is equivalent to full native support, including
  diagonal holding mass.
* `TotalNativeLabelling` selects a native event for every state pair.  This
  stronger interface decorates every state sample path, including null paths,
  with a replayable event trajectory.  It is used by the concrete finite
  execution package below the generic probability theorem.

The probability law remains the genuine state trajectory law already
constructed by Ionescu--Tulcea.  Decoration is deterministic and its state
projection is proved pointwise, so no caller-provided trajectory-agreement
premise is introduced.
-/

namespace Cantilune.Feedback.EventTrajectory

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

/-- A finite native event trajectory with `steps + 1` states. -/
structure FiniteEventTrajectory
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    (steps : Nat) where
  state : Fin (steps + 1) → package.lts.State
  event : Fin steps → package.lts.Event
  native :
    ∀ i : Fin steps,
      package.lts.ObservableStep
        (state i.castSucc) (event i) (state i.succ)

namespace FiniteEventTrajectory

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {steps : Nat}

/-- Every recorded finite-trajectory step independently replays its endpoint. -/
theorem event_replays
    (trajectory : FiniteEventTrajectory package steps)
    (i : Fin steps) :
    (package.eventRecord (trajectory.event i)).Replays
      (package.configOf (trajectory.state i.castSucc))
      (package.configOf (trajectory.state i.succ)) :=
  package.eventEndpoints (trajectory.native i)

/-- A replay of a finite-trajectory event has the recorded next configuration. -/
theorem replay_target_unique
    (trajectory : FiniteEventTrajectory package steps)
    (i : Fin steps)
    {target : Config signature}
    (replay :
      (package.eventRecord (trajectory.event i)).Replays
        (package.configOf (trajectory.state i.castSucc)) target) :
    target = package.configOf (trajectory.state i.succ) :=
  DPOEvent.event_replay_unique replay (trajectory.event_replays i)

end FiniteEventTrajectory

/-- A fully witnessed infinite native event trajectory. -/
structure InfiniteEventTrajectory
    {signature : FinSignature}
    (package : ExecutionPackage signature) where
  state : Nat → package.lts.State
  event : Nat → package.lts.Event
  native :
    ∀ n,
      package.lts.ObservableStep
        (state n) (event n) (state (n + 1))

namespace InfiniteEventTrajectory

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}

/-- Forget replay-specific packaging and retain the existing productivity trace. -/
def toInfiniteExecution
    (trajectory : InfiniteEventTrajectory package) :
    InfiniteExecution package.lts where
  state := trajectory.state
  event := trajectory.event
  step := trajectory.native

/-- Restrict an infinite event trajectory to its first `steps` events. -/
def finitePrefix
    (trajectory : InfiniteEventTrajectory package)
    (steps : Nat) :
    FiniteEventTrajectory package steps where
  state i := trajectory.state i
  event i := trajectory.event i
  native i := trajectory.native i

/-- Every infinite-trajectory event replays from its state configuration. -/
theorem event_replays
    (trajectory : InfiniteEventTrajectory package)
    (n : Nat) :
    (package.eventRecord (trajectory.event n)).Replays
      (package.configOf (trajectory.state n))
      (package.configOf (trajectory.state (n + 1))) :=
  package.eventEndpoints (trajectory.native n)

/-- Deterministic replay cannot disagree with the trajectory's next state. -/
theorem replay_target_unique
    (trajectory : InfiniteEventTrajectory package)
    (n : Nat)
    {target : Config signature}
    (replay :
      (package.eventRecord (trajectory.event n)).Replays
        (package.configOf (trajectory.state n)) target) :
    target = package.configOf (trajectory.state (n + 1)) :=
  DPOEvent.event_replay_unique replay (trajectory.event_replays n)

end InfiniteEventTrajectory

namespace FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]

/-- Every positive matrix entry is realised by a native observable event. -/
def FullyEventSupported
    (kernel : NativeMarkovKernel signature package State) : Prop :=
  ∀ {source target},
    0 < kernel.probability source target →
      ∃ event,
        package.lts.ObservableStep
          (kernel.stateEquiv source) event (kernel.stateEquiv target)

/--
An explicit event selector for every positive state transition.

Unlike `NativeMarkovKernel.native_support_of_change`, this includes positive
diagonal holding mass.
-/
structure PositiveEventLabelling
    (kernel : NativeMarkovKernel signature package State) where
  event :
    ∀ {source target},
      0 < kernel.probability source target →
        package.lts.Event
  native :
    ∀ {source target}
      (positive : 0 < kernel.probability source target),
      package.lts.ObservableStep
        (kernel.stateEquiv source)
        (event positive)
        (kernel.stateEquiv target)

namespace PositiveEventLabelling

variable {kernel : NativeMarkovKernel signature package State}

/-- Forget event selection and recover the original state-mass kernel. -/
def forget
    (_labelling : PositiveEventLabelling kernel) :
    NativeMarkovKernel signature package State :=
  kernel

@[simp]
theorem forget_probability
    (labelling : PositiveEventLabelling kernel)
    (source target : State) :
    labelling.forget.probability source target =
      kernel.probability source target :=
  rfl

/-- Select events from the exact full-support proposition. -/
noncomputable def ofFullyEventSupported
    (supported : FullyEventSupported kernel) :
    PositiveEventLabelling kernel where
  event := fun positive => Classical.choose (supported positive)
  native := fun positive => Classical.choose_spec (supported positive)

/-- Event labelling is neither stronger nor weaker than full event support. -/
theorem nonempty_iff_fullyEventSupported :
    Nonempty (PositiveEventLabelling kernel) ↔
      FullyEventSupported kernel := by
  constructor
  · rintro ⟨labelling⟩ source target positive
    exact ⟨labelling.event positive, labelling.native positive⟩
  · intro supported
    exact ⟨ofFullyEventSupported supported⟩

/--
For the existing state kernel, the only missing support obligation is positive
diagonal mass: off-diagonal support is already a field of
`NativeMarkovKernel`.
-/
theorem fullyEventSupported_iff_diagonal :
    FullyEventSupported kernel ↔
      ∀ state,
        0 < kernel.probability state state →
          ∃ event,
            package.lts.ObservableStep
              (kernel.stateEquiv state) event (kernel.stateEquiv state) := by
  constructor
  · intro supported state positive
    exact supported positive
  · intro diagonal source target positive
    by_cases same : source = target
    · subst target
      exact diagonal source positive
    · exact kernel.native_support_of_change positive same

/-- The selected positive-mass event replays its two configurations. -/
theorem selected_event_replays
    (labelling : PositiveEventLabelling kernel)
    {source target : State}
    (positive : 0 < kernel.probability source target) :
    (package.eventRecord (labelling.event positive)).Replays
      (package.configOf (kernel.stateEquiv source))
      (package.configOf (kernel.stateEquiv target)) :=
  package.eventEndpoints (labelling.native positive)

/-- A successful replay of the selected event has a unique target. -/
theorem selected_replay_target_unique
    (labelling : PositiveEventLabelling kernel)
    {source target : State}
    (positive : 0 < kernel.probability source target)
    {replayedTarget : Config signature}
    (replay :
      (package.eventRecord (labelling.event positive)).Replays
        (package.configOf (kernel.stateEquiv source)) replayedTarget) :
    replayedTarget =
      package.configOf (kernel.stateEquiv target) :=
  DPOEvent.event_replay_unique replay
    (labelling.selected_event_replays positive)

end PositiveEventLabelling

/--
A native event choice for every ordered state pair.

This intentionally strengthens positive support.  It lets the deterministic
decoration below be defined on every point of the trajectory sample space,
including null state paths containing zero-mass transitions.
-/
structure TotalNativeLabelling
    (kernel : NativeMarkovKernel signature package State) where
  event : State → State → package.lts.Event
  native :
    ∀ source target,
      package.lts.ObservableStep
        (kernel.stateEquiv source)
        (event source target)
        (kernel.stateEquiv target)

namespace TotalNativeLabelling

variable {kernel : NativeMarkovKernel signature package State}

/-- Restrict a total selector to transitions carrying positive mass. -/
def toPositive
    (labelling : TotalNativeLabelling kernel) :
    PositiveEventLabelling kernel where
  event := fun {source target} _positive =>
    labelling.event source target
  native := fun {source target} _positive =>
    labelling.native source target

/-- Decorate every state path with selected native events. -/
def decorate
    (labelling : TotalNativeLabelling kernel)
    (path : Nat → State) :
    InfiniteEventTrajectory package where
  state n := kernel.stateEquiv (path n)
  event n := labelling.event (path n) (path (n + 1))
  native n := labelling.native (path n) (path (n + 1))

/-- Project a package trajectory back to the finite kernel's state space. -/
def projectState
    (trajectory : InfiniteEventTrajectory package) :
    Nat → State :=
  fun n => kernel.stateEquiv.symm (trajectory.state n)

@[simp]
theorem projectState_decorate
    (labelling : TotalNativeLabelling kernel)
    (path : Nat → State) :
    projectState (kernel := kernel) (labelling.decorate path) = path := by
  funext n
  simp [projectState, decorate]

/--
The exact coupling between one state path and its selected event trajectory.
-/
structure TrajectoryAgreement
    (labelling : TotalNativeLabelling kernel)
    (path : Nat → State) where
  trajectory : InfiniteEventTrajectory package
  state_projection :
    projectState (kernel := kernel) trajectory = path
  selected_event :
    ∀ n,
      trajectory.event n =
        labelling.event (path n) (path (n + 1))

/--
Trajectory agreement is constructed for every state path; callers do not
supply it as a premise.
-/
def trajectoryAgreement
    (labelling : TotalNativeLabelling kernel)
    (path : Nat → State) :
    TrajectoryAgreement labelling path where
  trajectory := labelling.decorate path
  state_projection := projectState_decorate labelling path
  selected_event := by
    intro n
    rfl

end TotalNativeLabelling

/-- The external epoch assigned to event number `n`. -/
def eventEpoch
    (window : StableFairWindow) (n : Nat) : Nat :=
  window.opportunityEpoch n

/-- Consecutive sampled events occupy distinct ordered opportunity epochs. -/
def EpochBoundary
    (window : StableFairWindow) (n : Nat) : Prop :=
  eventEpoch window n < eventEpoch window (n + 1)

theorem every_step_has_epoch_boundary
    (window : StableFairWindow) (n : Nat) :
    EpochBoundary window n :=
  window.opportunity_strictMono (Nat.lt_succ_self n)

theorem event_epoch_observed
    (window : StableFairWindow) (n : Nat) :
    window.observed (eventEpoch window n) :=
  window.opportunity_observed n

theorem event_epochs_cofinal
    (window : StableFairWindow)
    {epoch : Nat} (afterStart : window.startEpoch ≤ epoch) :
    ∃ n, epoch ≤ eventEpoch window n :=
  window.cofinal epoch afterStart

private theorem signature_at_eventEpoch
    (window : StableFairWindow) (n : Nat) :
    window.signatureVersion (eventEpoch window n) =
      window.signatureVersion window.startEpoch := by
  obtain ⟨offset, equality⟩ :=
    Nat.exists_eq_add_of_le (window.opportunity_after_start n)
  unfold eventEpoch
  rw [equality]
  exact window.signature_stable offset

/--
Kernel-level connection between a stable/fair external schedule and the
selected native events.

The finite state need not contain an unbounded wall-clock epoch.  Instead all
states carry the stable signature version, while event number `n` is assigned
the external epoch `window.opportunityEpoch n`.
-/
structure EpochKernelAlignment
    {kernel : NativeMarkovKernel signature package State}
    (labelling : TotalNativeLabelling kernel)
    (window : StableFairWindow) where
  stable_state_version :
    ∀ state,
      package.lts.signatureVersion (kernel.stateEquiv state) =
        window.signatureVersion window.startEpoch
  opportunity_noninternal :
    ∀ source target,
      ¬package.ranking.internal (labelling.event source target)

/-- Path-level epoch and signature agreement for replayable events. -/
structure EpochAlignedTrajectory
    (window : StableFairWindow)
    (trajectory : InfiniteEventTrajectory package) where
  event_noninternal :
    ∀ n, ¬package.ranking.internal (trajectory.event n)
  source_signature :
    ∀ n,
      package.lts.signatureVersion (trajectory.state n) =
        window.signatureVersion (eventEpoch window n)
  target_signature :
    ∀ n,
      package.lts.signatureVersion (trajectory.state (n + 1)) =
        window.signatureVersion (eventEpoch window n)

namespace EpochAlignedTrajectory

variable {window : StableFairWindow}
variable {trajectory : InfiniteEventTrajectory package}

/-- Epoch alignment also holds for the concrete source configuration. -/
theorem source_config_signature
    (alignment : EpochAlignedTrajectory window trajectory)
    (n : Nat) :
    (package.configOf (trajectory.state n)).signatureVersion =
      window.signatureVersion (eventEpoch window n) :=
  (package.stateVersion (trajectory.state n)).trans
    (alignment.source_signature n)

/-- Epoch alignment also holds for the replayed target configuration. -/
theorem target_config_signature
    (alignment : EpochAlignedTrajectory window trajectory)
    (n : Nat) :
    (package.configOf (trajectory.state (n + 1))).signatureVersion =
      window.signatureVersion (eventEpoch window n) :=
  (package.stateVersion (trajectory.state (n + 1))).trans
    (alignment.target_signature n)

end EpochAlignedTrajectory

namespace EpochKernelAlignment

variable {kernel : NativeMarkovKernel signature package State}
variable {labelling : TotalNativeLabelling kernel}
variable {window : StableFairWindow}

/-- Every decorated sample path is aligned with the same stable/fair window. -/
theorem decorate_aligned
    (alignment : EpochKernelAlignment labelling window)
    (path : Nat → State) :
    EpochAlignedTrajectory window (labelling.decorate path) where
  event_noninternal n :=
    alignment.opportunity_noninternal (path n) (path (n + 1))
  source_signature n := by
    calc
      package.lts.signatureVersion
          ((labelling.decorate path).state n) =
          window.signatureVersion window.startEpoch :=
        alignment.stable_state_version (path n)
      _ = window.signatureVersion (eventEpoch window n) :=
        (signature_at_eventEpoch window n).symm
  target_signature n := by
    calc
      package.lts.signatureVersion
          ((labelling.decorate path).state (n + 1)) =
          window.signatureVersion window.startEpoch :=
        alignment.stable_state_version (path (n + 1))
      _ = window.signatureVersion (eventEpoch window n) :=
        (signature_at_eventEpoch window n).symm

end EpochKernelAlignment

/--
A finite progress proof, an event selector, and an epoch alignment over one
shared stable/fair window.
-/
structure EventProgressBridge
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (epsilon : Real) where
  progress : ProgressBridge kernel initial epsilon
  labelling : TotalNativeLabelling kernel
  alignment : EpochKernelAlignment labelling progress.window

namespace EventProgressBridge

variable
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}

/-- The event-labelled trajectory constructed from one state sample path. -/
def eventTrajectory
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : Nat → State) :
    InfiniteEventTrajectory package :=
  bridge.labelling.decorate path

@[simp]
theorem eventTrajectory_projection
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : Nat → State) :
    TotalNativeLabelling.projectState
        (kernel := kernel) (bridge.eventTrajectory path) =
      path :=
  TotalNativeLabelling.projectState_decorate bridge.labelling path

/-- The shared window aligns every selected event and both endpoint versions. -/
theorem eventTrajectory_epoch_aligned
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : Nat → State) :
    EpochAlignedTrajectory
      bridge.progress.window (bridge.eventTrajectory path) :=
  bridge.alignment.decorate_aligned path

/--
Almost-sure hitting lifted to deterministic, replayable event trajectories.

The measure is the same Ionescu--Tulcea state law used by the finite bridge;
`eventTrajectory_projection` proves that event decoration does not change its
state path.  No trajectory-agreement field or premise is required.
-/
theorem replayable_event_trajectory_almost_sure_hitting
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (bridge : EventProgressBridge kernel initial epsilon) :
    ∀ᵐ path
      ∂kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
        (TotalNativeLabelling.projectState
          (kernel := kernel) (bridge.eventTrajectory path)) := by
  simpa [eventTrajectory,
    TotalNativeLabelling.projectState_decorate] using
      bridge.progress.finite_kernel_feedback_almost_sure_hitting

end EventProgressBridge

end FiniteDiscrete

end Cantilune.Feedback.EventTrajectory
