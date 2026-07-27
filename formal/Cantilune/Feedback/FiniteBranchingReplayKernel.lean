import Cantilune.Feedback.HeterogeneousAdmissionTrajectory

/-!
# Finite branching kernels with sampled replay labels

`ReplayMarkovKernel` attaches one dependent witness to every positive pair of
states.  A state-only matrix cannot, however, distinguish two native events
with the same source and target.  This module moves the finite business choice
into the sampled successor state.

The construction is generic in the replay evidence.  In particular,
`ReplayEvent source target` may contain a native LTS derivation, an executable
`DPOEvent` (or signature-admission) replay, and runtime-epoch alignment.
Different positive choices remain different stochastic successors even when
their unmarked endpoints coincide.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteBranchingReplayKernel

open MeasureTheory ProbabilityTheory
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference

universe u v w

/--
A finite event-level stochastic matrix.

Rows are indexed by the declared source of each business choice, rather than
by endpoint pairs.  Thus distinct events with equal endpoints retain separate
probability mass.
-/
structure BranchingReplayModel
    (State : Type v) (Choice : Type w)
    [Fintype State] [DecidableEq State]
    [Fintype Choice] [DecidableEq Choice]
    (ReplayEvent : State → State → Type u) where
  source : Choice → State
  target : Choice → State
  replay : ∀ choice, ReplayEvent (source choice) (target choice)
  weight : Choice → Real
  weight_nonnegative : ∀ choice, 0 ≤ weight choice
  row_sum :
    ∀ state,
      (∑ choice,
        if source choice = state then weight choice else 0) = 1

namespace BranchingReplayModel

variable {State : Type v} {Choice : Type w}
variable [Fintype State] [DecidableEq State]
variable [Fintype Choice] [DecidableEq Choice]
variable {ReplayEvent : State → State → Type u}

/--
The stochastic state records the underlying execution state and, after the
first transition, the exact business choice which reached it.  Invalid pairs
exist in the finite carrier but receive zero probability.
-/
abbrev MarkedState := State × Option Choice

/-- Forget the sampled event identity. -/
def forget : MarkedState (State := State) (Choice := Choice) → State :=
  Prod.fst

/-- The marked successor selected by one business choice. -/
def markedTarget
    (model : BranchingReplayModel State Choice ReplayEvent)
    (choice : Choice) :
    MarkedState (State := State) (Choice := Choice) :=
  (model.target choice, some choice)

/--
A positive edge contains the exact business choice.  Its underlying replay
witness is not reconstructed from the endpoint pair.
-/
inductive MarkedEvent
    (model : BranchingReplayModel State Choice ReplayEvent) :
    MarkedState (State := State) (Choice := Choice) →
      MarkedState (State := State) (Choice := Choice) → Type (max u w)
  | business
      {sourceState targetState :
        MarkedState (State := State) (Choice := Choice)}
      (choice : Choice)
      (source_eq : model.source choice = sourceState.1)
      (target_eq : targetState = model.markedTarget choice) :
      MarkedEvent model sourceState targetState

namespace MarkedEvent

variable {model : BranchingReplayModel State Choice ReplayEvent}
variable {sourceState targetState :
  MarkedState (State := State) (Choice := Choice)}

/-- The business choice stored by a marked edge. -/
def choice
    (event : MarkedEvent model sourceState targetState) : Choice :=
  match event with
  | .business choice _ _ => choice

/-- The sampled edge has the declared unmarked source. -/
theorem source_eq
    (event : MarkedEvent model sourceState targetState) :
    model.source event.choice = sourceState.1 := by
  cases event
  assumption

/-- The sampled edge has the declared unmarked target. -/
theorem target_eq
    (event : MarkedEvent model sourceState targetState) :
    model.target event.choice = targetState.1 := by
  cases event with
  | business choice source_eq target_eq =>
      subst targetState
      rfl

/-- The target state records exactly the sampled choice. -/
theorem target_mark
    (event : MarkedEvent model sourceState targetState) :
    targetState.2 = some event.choice := by
  cases event with
  | business choice source_eq target_eq =>
      subst targetState
      rfl

/--
The actual dependent replay witness transported to the sampled unmarked
endpoints.
-/
def replay
    (event : MarkedEvent model sourceState targetState) :
    ReplayEvent sourceState.1 targetState.1 := by
  cases event with
  | business choice source_eq target_eq =>
      subst targetState
      rw [← source_eq]
      exact model.replay choice

end MarkedEvent

/-- Probability of a marked successor. -/
def markedProbability
    (model : BranchingReplayModel State Choice ReplayEvent)
    (sourceState targetState :
      MarkedState (State := State) (Choice := Choice)) : Real :=
  match targetState.2 with
  | none => 0
  | some choice =>
      if model.source choice = sourceState.1 ∧
          model.target choice = targetState.1 then
        model.weight choice
      else
        0

private theorem markedProbability_row_sum
    (model : BranchingReplayModel State Choice ReplayEvent)
    (sourceState : MarkedState (State := State) (Choice := Choice)) :
    ∑ targetState, model.markedProbability sourceState targetState = 1 := by
  classical
  rw [Fintype.sum_prod_type]
  simp_rw [Fintype.sum_option]
  simp only [markedProbability, zero_add]
  rw [Finset.sum_comm]
  rw [← model.row_sum sourceState.1]
  apply Finset.sum_congr rfl
  intro choice _choiceMember
  by_cases sourceMatches : model.source choice = sourceState.1
  · simp [sourceMatches]
  · simp [sourceMatches]

/--
The genuine finite Markov kernel over event-marked states.  Multiple choices
with identical unmarked endpoints are distinct target states.
-/
def markedKernel
    (model : BranchingReplayModel State Choice ReplayEvent) :
    ReplayMarkovKernel
      (MarkedState (State := State) (Choice := Choice))
      (MarkedEvent model) where
  probability := model.markedProbability
  probability_nonnegative := by
    intro sourceState targetState
    cases targetMark : targetState.2 with
    | none =>
        simp [markedProbability, targetMark]
    | some choice =>
        by_cases edgeMatches :
            model.source choice = sourceState.1 ∧
              model.target choice = targetState.1
        · simp [markedProbability, targetMark, edgeMatches,
            model.weight_nonnegative choice]
        · simp [markedProbability, targetMark, edgeMatches]
  row_sum := model.markedProbability_row_sum
  event_of_positive := by
    intro sourceState targetState positive
    cases targetMark : targetState.2 with
    | none =>
        simp [markedProbability, targetMark] at positive
    | some choice =>
        have edgeMatches :
            model.source choice = sourceState.1 ∧
              model.target choice = targetState.1 := by
          by_contra different
          simp [markedProbability, targetMark, different] at positive
        refine .business choice edgeMatches.1 ?_
        apply Prod.ext
        · exact edgeMatches.2.symm
        · simpa [markedTarget] using targetMark

/-- Dirac initial state before any event has been sampled. -/
def initialState
    (state : State) :
    MarkedState (State := State) (Choice := Choice) :=
  (state, none)

/--
A complete sampled event trajectory: every transition exposes the exact
choice, its marked successor, and its dependent replay witness.
-/
structure CompleteBranchingTrajectory
    (model : BranchingReplayModel State Choice ReplayEvent)
    (path :
      Nat → MarkedState (State := State) (Choice := Choice)) where
  positive :
    ∀ n,
      0 <
        model.markedProbability (path n) (path (n + 1))
  edge :
    ∀ n, MarkedEvent model (path n) (path (n + 1))
  choice : Nat → Choice
  choice_eq : ∀ n, choice n = (edge n).choice
  source_eq :
    ∀ n, model.source (choice n) = (path n).1
  target_eq :
    ∀ n, model.target (choice n) = (path (n + 1)).1
  target_mark :
    ∀ n, (path (n + 1)).2 = some (choice n)

namespace CompleteBranchingTrajectory

variable {model : BranchingReplayModel State Choice ReplayEvent}
variable {path :
  Nat → MarkedState (State := State) (Choice := Choice)}

/--
Replay provenance is definitionally the replay witness of the sampled edge;
there is no independently fillable trajectory field.
-/
def sampledReplay
    (trajectory : CompleteBranchingTrajectory model path)
    (n : Nat) :
    ReplayEvent (path n).1 (path (n + 1)).1 :=
  (trajectory.edge n).replay

end CompleteBranchingTrajectory

/-- Build complete event data from the kernel's positive-edge trajectory. -/
def CompleteBranchingTrajectory.ofReplayTrajectory
    (model : BranchingReplayModel State Choice ReplayEvent)
    {path :
      Nat → MarkedState (State := State) (Choice := Choice)}
    (trajectory :
      ReplayMarkovKernel.ReplayTrajectory model.markedKernel path) :
    CompleteBranchingTrajectory model path where
  positive := trajectory.positive
  edge := trajectory.event
  choice n := (trajectory.event n).choice
  choice_eq _ := rfl
  source_eq n := (trajectory.event n).source_eq
  target_eq n := (trajectory.event n).target_eq
  target_mark n := (trajectory.event n).target_mark

/--
Almost every Ionescu--Tulcea path of the branching kernel carries the exact
ordered business-event identities and their replay evidence.
-/
theorem complete_branching_trajectory_almost_sure
    [MeasurableSpace
      (MarkedState (State := State) (Choice := Choice))]
    [MeasurableSingletonClass
      (MarkedState (State := State) (Choice := Choice))]
    (model : BranchingReplayModel State Choice ReplayEvent)
    (initial : Measure
      (MarkedState (State := State) (Choice := Choice)))
    [IsProbabilityMeasure initial] :
    ∀ᵐ path ∂
        model.markedKernel.toMarkovExecutionKernel.trajectoryMeasure initial,
      Nonempty (CompleteBranchingTrajectory model path) := by
  filter_upwards
    [model.markedKernel.almost_sure_replay_trajectory initial] with
      path replayTrajectory
  rcases replayTrajectory with ⟨trajectory⟩
  exact ⟨CompleteBranchingTrajectory.ofReplayTrajectory model trajectory⟩

/--
Two distinct positive choices from one source remain distinct stochastic
successors even when their unmarked targets coincide.
-/
theorem distinct_choices_remain_distinct
    (model : BranchingReplayModel State Choice ReplayEvent)
    {left right : Choice}
    (distinct : left ≠ right) :
    model.markedTarget left ≠ model.markedTarget right := by
  intro equality
  have markEquality :=
    congrArg
      (fun state :
        MarkedState (State := State) (Choice := Choice) => state.2)
      equality
  simp [markedTarget] at markEquality
  exact distinct markEquality

/--
Every positive business choice appears with its own positive marked
transition probability.
-/
theorem positive_choice_has_positive_edge
    (model : BranchingReplayModel State Choice ReplayEvent)
    (choice : Choice)
    (positive : 0 < model.weight choice)
    (mark : Option Choice) :
    0 <
      model.markedProbability
        (model.source choice, mark)
        (model.markedTarget choice) := by
  simpa [markedProbability, markedTarget] using positive

end BranchingReplayModel

end Cantilune.Feedback.FiniteBranchingReplayKernel
