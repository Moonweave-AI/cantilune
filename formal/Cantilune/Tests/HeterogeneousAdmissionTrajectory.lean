import Cantilune.Feedback.HeterogeneousAdmissionTrajectory

/-!
# Regression checks for the heterogeneous admission probability bridge
-/

namespace Cantilune.Tests.HeterogeneousAdmissionTrajectory

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference

example :
    EpochChain.ReplayAgreement epochChain :=
  epochChain_replay

example :
    (globalLTS boundary).Path
      (.old OldState.start)
      (traceEvents boundary)
      (.new NewState.live) :=
  globalTrace

example :
    EventReplay boundary (.old OldEvent.advance) :=
  phase_replay .oldStart

example :
    EventReplay boundary (.admission) :=
  phase_replay .oldDone

example :
    EventReplay boundary (.new NewEvent.hold) :=
  phase_replay .newLive

example (source : Phase) :
    EventEpochAlignment boundary (phaseLabel source) :=
  (selectedEvent source).epochAlignment

example {path : Nat → Phase}
    (trajectory : HeterogeneousCommonTrajectory path) :
    (trajectory.replay.event 1).label =
      (GlobalEvent.admission :
        GlobalEvent oldSome newSome) :=
  trajectory.admission_label_at_one

example :
    ∀ᵐ path ∂
        stochasticKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (HeterogeneousCommonTrajectory path) :=
  almost_sure_heterogeneous_common_trajectory

example :
    ∀ᵐ path ∂
        stochasticKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (EventReplayEpochTrajectory path) :=
  almost_sure_event_replay_epoch_trajectory

end Cantilune.Tests.HeterogeneousAdmissionTrajectory
