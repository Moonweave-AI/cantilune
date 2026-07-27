import Cantilune.Feedback.FiniteExecutableHeterogeneousRuntime
import Cantilune.Feedback.FiniteExecutableEpochProjectionReference

/-! Kernel-checked regressions for the generated heterogeneous scheduler. -/

namespace Cantilune.Tests.FiniteExecutableHeterogeneousRuntime

open Cantilune.Feedback.FiniteExecutableHeterogeneousRuntime
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference

#check emittedAt
#check oldBusinessOccurrence
#check admissionOccurrence
#check newBusinessOccurrence
#check complete_generated_trajectory_almost_sure
#check target_admission_native_all
#check target_admission_versions
#check target_admission_state_changes
#check GeneratedRuntimeEvent.mark_unique
#check CompleteGeneratedTrajectory.eventMark_eq_phaseLabel
#check CompleteGeneratedTrajectory.sourceOccurrence
#check CompleteGeneratedTrajectory.fourTargets
#check
  Cantilune.Feedback.FiniteExecutableEpochProjectionReference.Reference.fourTypedViews_nonempty
#check
  Cantilune.Feedback.FiniteExecutableEpochProjectionReference.Reference.target_native_all
#check
  Cantilune.Feedback.FiniteExecutableEpochProjectionReference.Reference.target_runtime_native_all
#check
  Cantilune.Feedback.FiniteExecutableEpochProjectionReference.Reference.pi_target_admission_native
#check
  Cantilune.Feedback.FiniteExecutableEpochProjectionReference.Reference.target_replays_all
#check
  Cantilune.Feedback.FiniteExecutableEpochProjectionReference.Reference.target_versions_strict_all

example : run 0 = .oldStart := rfl
example : run 1 = .oldDone := rfl
example : run 2 = .newLive := rfl

example :
    ScheduledSourceOccurrence .oldStart :=
  (emit .oldStart).occurrence

example :
    ScheduledSourceOccurrence .oldDone :=
  (emit .oldDone).occurrence

example :
    ScheduledSourceOccurrence .newLive :=
  (emit .newLive).occurrence

example :
    FourTargetDerivations .oldDone .newLive :=
  (emit .oldDone).targets

example :
    (emit .oldDone).mark = phaseLabel .oldDone :=
  GeneratedRuntimeEvent.mark_eq_phaseLabel (emit .oldDone)

example :
    (emit .newLive).mark = (emit .newLive).mark :=
  GeneratedRuntimeEvent.mark_unique (emit .newLive) (emit .newLive)

end Cantilune.Tests.FiniteExecutableHeterogeneousRuntime
