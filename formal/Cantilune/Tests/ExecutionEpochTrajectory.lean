import Cantilune.Feedback.ExecutionEpochTrajectory
import Cantilune.Pi.P1cAdmittedExecutionTrajectory
import Cantilune.Pi.P1cAdmittedTrajectory
import Cantilune.Tests.P1cAdmittedOperations

/-!
Kernel-checked instantiations of the runtime execution-epoch trajectory bridge.
-/

namespace Cantilune.Tests.ExecutionEpochTrajectory

noncomputable section

open Cantilune.Core
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Pi.P1cAdmittedExecutionTrajectory
open Cantilune.Tests.P1cAdmittedOperations

example :
    RuntimeEpochAgreement
      (canonicalCompleteTrajectory mismatchOccurrence).trajectory :=
  runtimeEpochAgreement
    (canonicalCompleteTrajectory mismatchOccurrence).trajectory

example :
    CompleteExecutionEpochTrajectory
      (eventProgress reconnectOccurrence)
      (canonicalEventPath reconnectOccurrence) :=
  completeExecutionEpochTrajectory
    (eventProgress reconnectOccurrence)
    (canonicalEventPath reconnectOccurrence)

example :
    TotalNativeLabelling.TrajectoryAgreement
      (totalLabelling mismatchOccurrence)
      canonicalStatePath :=
  concreteTrajectoryAgreement mismatchOccurrence
    canonicalStatePath

example :
    EpochAlignedTrajectory
      (eventProgress reconnectOccurrence).progress.window
      (concreteTrajectoryAgreement reconnectOccurrence
        canonicalStatePath).trajectory :=
  concreteTrajectoryAgreement_epoch_aligned reconnectOccurrence
    canonicalStatePath

example :
    ((package deleteOccurrence).eventRecord
        ((concreteTrajectoryAgreement deleteOccurrence
          canonicalStatePath).trajectory.event 0)).Replays
      ((package deleteOccurrence).configOf
        ((concreteTrajectoryAgreement deleteOccurrence
          canonicalStatePath).trajectory.state 0))
      ((package deleteOccurrence).configOf
        ((concreteTrajectoryAgreement deleteOccurrence
          canonicalStatePath).trajectory.state 1)) :=
  concreteTrajectoryAgreement_event_replays deleteOccurrence
    canonicalStatePath 0

example :
    DPOEvent.signatureVersion
        (DPOEvent.Verified.event
          ((package deleteOccurrence).eventRecord
            ((canonicalCompleteTrajectory deleteOccurrence).trajectory.event 0))) =
      Config.signatureVersion
        ((package deleteOccurrence).configOf
          ((canonicalCompleteTrajectory deleteOccurrence).trajectory.state 0)) :=
  InfiniteEventTrajectory.event_record_execution_epoch
    (canonicalCompleteTrajectory deleteOccurrence).trajectory 0

example :
    ExecutionEpochTrace.replayEvents
        (package reconnectOccurrence)
        (InfiniteEventTrajectory.eventList
          (canonicalCompleteTrajectory reconnectOccurrence).trajectory 0 1)
        ((package reconnectOccurrence).configOf
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.state 0)) =
      some
        ((package reconnectOccurrence).configOf
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.state 1)) ∧
    ∀ offset, offset < 1 →
      (package reconnectOccurrence).configOf
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.state
            (0 + offset)) =
        ((package reconnectOccurrence).eventRecord
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.event
            (0 + offset))).event.source ∧
      (package reconnectOccurrence).configOf
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.state
            (0 + offset + 1)) =
        ((package reconnectOccurrence).eventRecord
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.event
            (0 + offset))).event.target ∧
      ((package reconnectOccurrence).eventRecord
        ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.event
          (0 + offset))).event.signatureVersion =
        ((package reconnectOccurrence).configOf
          ((canonicalCompleteTrajectory reconnectOccurrence).trajectory.state 0)
        ).signatureVersion :=
  InfiniteEventTrajectory.segment_dpo_replay_epoch_alignment
    (canonicalCompleteTrajectory reconnectOccurrence).trajectory 0 1

/--
The concrete occurrence theorem contains positive event support, exact
`DPOEvent` identity and replay, finite-prefix native paths, runtime epoch
agreement, opportunity alignment, and eventual hitting on one probability
space.
-/
example :=
  supported_complete_execution_epoch_trajectory_almost_sure
    reconnectOccurrence

local instance : MeasurableSpace PUnit := ⊤

noncomputable def unitSeedMeasure : MeasureTheory.Measure (Nat → PUnit) :=
  MeasureTheory.Measure.dirac (fun _ => PUnit.unit)

noncomputable instance :
    MeasureTheory.IsProbabilityMeasure unitSeedMeasure := by
  unfold unitSeedMeasure
  infer_instance

/--
The randomized version retains the same event/epoch/replay agreement while
allowing the event identity to depend on a seed stream.
-/
example :=
  p1c_complete_random_execution_epoch_trajectory_almost_sure
    mismatchOccurrence PUnit unitSeedMeasure

end

end Cantilune.Tests.ExecutionEpochTrajectory
