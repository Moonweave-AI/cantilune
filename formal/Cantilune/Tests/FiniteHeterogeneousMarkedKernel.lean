import Cantilune.Feedback.FiniteHeterogeneousMarkedKernel

/-!
# Regression checks for the dependent marked heterogeneous kernel
-/

namespace Cantilune.Tests.FiniteHeterogeneousMarkedKernel

open Cantilune.Feedback.FiniteHeterogeneousMarkedKernel

#check ChainStepMark.eventReplay
#check ChainStepMark.executionEpochAligned
#check MarkedKernelEvent.business
#check MarkedKernelEvent.administrative
#check transitionProbability_projects
#check stepKernel_projects
#check trajectory_ae_eq_marked_atPhase
#check sampledMarkedEdge_of_schedule
#check sampled_marks_common_trajectory_almost_sure

end Cantilune.Tests.FiniteHeterogeneousMarkedKernel
