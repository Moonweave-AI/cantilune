import Cantilune.Feedback.ExecutionEpochTrajectory
import Cantilune.Feedback.EventTrajectorySupport
import Cantilune.Feedback.RandomizedExecutionEpochTrajectory
import Cantilune.Pi.P1cAdmittedTrajectory

/-!
# Concrete P1c execution-package trajectory agreement

This module instantiates the complete runtime execution-epoch bridge for the
actual admitted mismatch/reconnect/quiescent-delete execution package.  It
also retains the positive-support theorem, so totalisation-only labels with
zero transition probability are excluded almost surely.
-/

namespace Cantilune.Pi.P1cAdmittedExecutionTrajectory

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedTrajectory

variable {σ : FinSignature}

local instance : MeasurableSpace Bool := ⊤

/--
The generic deterministic decoration theorem specialised to the actual
admitted-operation execution package.  This is a constructed value, not a
trajectory-agreement premise: its states are exactly `path`, while every
selected label is an event of `package occurrence`.
-/
noncomputable def concreteTrajectoryAgreement
    (occurrence : Occurrence σ) (path : Nat → Bool) :
    TotalNativeLabelling.TrajectoryAgreement
      (totalLabelling occurrence) path :=
  TotalNativeLabelling.trajectoryAgreement
    (totalLabelling occurrence) path

@[simp] theorem concreteTrajectoryAgreement_state_projection
    (occurrence : Occurrence σ) (path : Nat → Bool) :
    TotalNativeLabelling.projectState
        (kernel := stateKernel occurrence)
        (concreteTrajectoryAgreement occurrence path).trajectory =
      path :=
  (concreteTrajectoryAgreement occurrence path).state_projection

/-- The event mark at index `n` is the deterministic package label selected
from the two adjacent sampled states. -/
@[simp] theorem concreteTrajectoryAgreement_selected_event
    (occurrence : Occurrence σ) (path : Nat → Bool) (n : Nat) :
    (concreteTrajectoryAgreement occurrence path).trajectory.event n =
      (totalLabelling occurrence).event (path n) (path (n + 1)) :=
  (concreteTrajectoryAgreement occurrence path).selected_event n

/--
Every event selected by the concrete agreement independently replays between
the exact adjacent `Config` values.  In particular, the recorded target is
not used to manufacture the endpoint.
-/
theorem concreteTrajectoryAgreement_event_replays
    (occurrence : Occurrence σ) (path : Nat → Bool) (n : Nat) :
    ((package occurrence).eventRecord
        ((concreteTrajectoryAgreement occurrence path).trajectory.event n)).Replays
      ((package occurrence).configOf
        ((concreteTrajectoryAgreement occurrence path).trajectory.state n))
      ((package occurrence).configOf
        ((concreteTrajectoryAgreement occurrence path).trajectory.state (n + 1))) :=
  (concreteTrajectoryAgreement occurrence path).trajectory.event_replays n

/--
The same constructed agreement is aligned with the concrete stable/fair
window: both endpoint signature versions of event `n` equal the opportunity
epoch assigned to that event.
-/
theorem concreteTrajectoryAgreement_epoch_aligned
    (occurrence : Occurrence σ) (path : Nat → Bool) :
    EpochAlignedTrajectory
      (eventProgress occurrence).progress.window
      (concreteTrajectoryAgreement occurrence path).trajectory := by
  simpa [concreteTrajectoryAgreement,
    TotalNativeLabelling.trajectoryAgreement, eventProgress] using
    (eventProgress occurrence).alignment.decorate_aligned path

/--
The concrete admitted-operation kernel has one almost-sure trajectory theorem
at `DPOEvent` granularity: positive event support, exact event identities,
native package steps, endpoint-free replay, fair opportunity alignment,
finite-prefix replay, runtime signature epoch, and eventual stable hitting.
-/
theorem supported_complete_execution_epoch_trajectory_almost_sure
    (occurrence : Occurrence σ) :
    ∀ᵐ path ∂ replayableEventTrajectoryMeasure
        (eventProgress occurrence).labelling initial,
      SupportedReplayablePath occurrence path ∧
        Nonempty
          (CompleteExecutionEpochTrajectory
            (eventProgress occurrence) path) ∧
        ((eventProgress occurrence).progress.toKernelProgressAssumption
          |>.hittingBridge).EventuallyHits path.stateCode := by
  filter_upwards
    [replayable_event_measure_ae_positive_probability
      (eventProgress occurrence).labelling initial,
     complete_execution_epoch_trajectory_almost_sure
      (eventProgress occurrence)] with path positive complete
  refine ⟨?_, complete⟩
  intro n
  change
    SupportedStep
      (path.stateCode n)
      ((totalLabelling occurrence).event
        (path.stateCode n) (path.stateCode (n + 1)))
      (path.stateCode (n + 1))
  exact positive_supported_step occurrence (positive n)

/--
The concrete admitted execution package also induces a randomized common
trajectory bridge for any auxiliary seed space.  The seed is ignored because
this package has one selected native event for each encoded endpoint pair;
the theorem nevertheless lives on the genuine product probability space and
retains exact event, epoch, and replay agreement.
-/
noncomputable def randomizedEventProgress
    (occurrence : Occurrence σ) (Seed : Type*) :
    RandomEventProgressBridge
      (stateKernel occurrence) initial 1 Seed :=
  RandomEventProgressBridge.ofDeterministic
    (eventProgress occurrence) Seed

/--
Almost every state/seed sample for the concrete P1c package carries the full
event-labelled runtime-epoch trajectory and eventually reaches stability.
-/
theorem p1c_complete_random_execution_epoch_trajectory_almost_sure
    (occurrence : Occurrence σ)
    (Seed : Type*) [MeasurableSpace Seed]
    (seedMeasure : Measure (Nat → Seed))
    [IsProbabilityMeasure seedMeasure] :
    ∀ᵐ path ∂randomizedEventTrajectoryMeasure
        (randomizedEventProgress occurrence Seed) seedMeasure,
      Nonempty
          (CompleteRandomExecutionEpochTrajectory
            (randomizedEventProgress occurrence Seed) path) ∧
        ((randomizedEventProgress occurrence Seed).progress
          |>.toKernelProgressAssumption
          |>.hittingBridge).EventuallyHits path.1 := by
  simpa [randomizedEventProgress] using
    Cantilune.Feedback.EventTrajectory.FiniteDiscrete.complete_random_execution_epoch_trajectory_almost_sure
        (randomizedEventProgress occurrence Seed) seedMeasure

end Cantilune.Pi.P1cAdmittedExecutionTrajectory
