import Cantilune.Feedback.FiniteBranchingReplayKernel

namespace Cantilune.Tests.FiniteBranchingReplayKernel

open Cantilune.Feedback.FiniteBranchingReplayKernel

abbrev State := Unit
abbrev Choice := Bool

inductive Replay : State → State → Type
  | left : Replay () ()
  | right : Replay () ()

noncomputable def model : BranchingReplayModel State Choice Replay where
  source := fun _ => ()
  target := fun _ => ()
  replay
    | false => .left
    | true => .right
  weight := fun _ => (1 : Real) / 2
  weight_nonnegative := by
    intro choice
    cases choice <;> norm_num
  row_sum := by
    intro state
    cases state
    rw [Fintype.sum_bool]
    norm_num

example :
    model.markedTarget false ≠ model.markedTarget true :=
  model.distinct_choices_remain_distinct (by decide)

example :
    0 <
      model.markedProbability
        ((), none)
        (model.markedTarget false) :=
  model.positive_choice_has_positive_edge false (by norm_num [model]) none

#check BranchingReplayModel.markedKernel
#check BranchingReplayModel.complete_branching_trajectory_almost_sure
#check BranchingReplayModel.CompleteBranchingTrajectory.sampledReplay
#check BranchingReplayModel.distinct_choices_remain_distinct
#check BranchingReplayModel.positive_choice_has_positive_edge

end Cantilune.Tests.FiniteBranchingReplayKernel
