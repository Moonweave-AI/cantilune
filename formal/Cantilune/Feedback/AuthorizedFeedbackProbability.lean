import Cantilune.Feedback.AuthorizedFeedbackExecution
import Cantilune.Feedback.KernelFiniteHeightProgress
import Cantilune.Feedback.PositiveEventTrajectory

/-!
# Kernel-derived finite-height progress for the authorized feedback execution

The reference feedback package has two strict evidence increases:

1. empty evidence to an approval quorum; and
2. approval evidence to an explicit approval/rejection conflict.

This module builds one genuine finite native Markov kernel whose positive
off-diagonal support is exactly those two replayable execution edges.  The two
phase tails used by the `H / epsilon` theorem are therefore derived from that
kernel rather than postulated.
-/

noncomputable section

namespace Cantilune.Feedback.AuthorizedFeedbackProbability

open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Feedback.AuthorizedFeedbackExecution
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete

variable {σ : FinSignature}

local instance : MeasurableSpace State := ⊤

/-- Deterministic evidence progress; stable/decision states hold. -/
def next : State → State
  | .empty => .approval
  | .approval => .conflict
  | .conflict => .conflict
  | .accepted => .accepted
  | .rejected => .rejected

def transition (source target : State) : Real :=
  if target = next source then 1 else 0

/--
The stochastic matrix is supported by native edges of the same replayable
execution package.
-/
def kernel (σ : FinSignature) :
    NativeMarkovKernel σ (package σ) State where
  stateEquiv := Equiv.refl State
  probability := transition
  probability_nonnegative := by
    intro source target
    by_cases equality : target = next source <;>
      simp [transition, equality]
  row_sum := by
    intro source
    classical
    simp [transition]
  native_support_of_change := by
    intro source target positive different
    have targetEq : target = next source := by
      by_contra targetNe
      simp [transition, targetNe] at positive
    subst target
    cases source with
    | empty =>
        exact ⟨.recordApproval, Event.native .recordApproval⟩
    | approval =>
        exact ⟨.recordRejection, Event.native .recordRejection⟩
    | conflict =>
        exact False.elim (different rfl)
    | accepted =>
        exact False.elim (different rfl)
    | rejected =>
        exact False.elim (different rfl)

/-- Dirac initial distribution at a selected finite state. -/
def initialAt (selected : State) : InitialDistribution State where
  probability state := if state = selected then 1 else 0
  probability_nonnegative := by
    intro state
    by_cases equality : state = selected <;>
      simp [equality]
  total := by
    classical
    simp

def window : StableFairWindow where
  signatureVersion := fun _ => 0
  observed := fun _ => True
  startEpoch := 0
  opportunityEpoch := id
  signature_stable := by simp
  opportunity_after_start := by simp
  opportunity_strictMono := strictMono_id
  opportunity_observed := by simp
  cofinal := by
    intro epoch _afterStart
    exact ⟨epoch, le_rfl⟩

theorem window_epochwiseFair : EpochwiseFair window := by
  intro n
  simp [window]

/--
Phase zero is unstable only at `empty`; phase one is unstable only at
`approval`.  This makes every remaining qualitative increase a one-step,
probability-one kernel phase.
-/
def phaseStable (index : Fin 2) : State → Bool :=
  if index = 0 then
    fun state => decide (state ≠ .empty)
  else
    fun state => decide (state ≠ .approval)

def phaseInitialState (index : Fin 2) : State :=
  if index = 0 then .empty else .approval

def phaseInitial (index : Fin 2) : InitialDistribution State :=
  initialAt (phaseInitialState index)

def phaseProgress (σ : FinSignature) (index : Fin 2) :
    ProgressBridge (kernel σ) (phaseInitial index) (1 : Real) where
  window := window
  stable := phaseStable index
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  pointwise_progress := by
    intro state unstable
    fin_cases index
    · cases state with
      | empty =>
          calc
            (1 : Real) =
                (kernel σ).probability .empty .approval := by
              simp [kernel, transition, next]
            _ ≤
                ∑ target ∈ stableStates (phaseStable 0),
                  (kernel σ).probability .empty target :=
              Finset.single_le_sum
                (fun target _member =>
                  (kernel σ).probability_nonnegative .empty target)
                (by simp [stableStates, phaseStable])
      | approval | conflict | accepted | rejected =>
          simp [phaseStable] at unstable
    · cases state with
      | approval =>
          calc
            (1 : Real) =
                (kernel σ).probability .approval .conflict := by
              simp [kernel, transition, next]
            _ ≤
                ∑ target ∈ stableStates (phaseStable 1),
                  (kernel σ).probability .approval target :=
              Finset.single_le_sum
                (fun target _member =>
                  (kernel σ).probability_nonnegative .approval target)
                (by simp [stableStates, phaseStable])
      | empty | conflict | accepted | rejected =>
          simp [phaseStable] at unstable

/-- Both kernel-derived phases inhabit one finite-height progress package. -/
def twoPhaseProgress (σ : FinSignature) :
    KernelFiniteHeightProgress (kernel σ) 2 (1 : Real) where
  window := window
  epochwiseFair := window_epochwiseFair
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  initial := phaseInitial
  phase := phaseProgress σ
  phase_window := by
    intro index
    rfl

/--
The expected number of eligible epochs for the two strict evidence increases
is at most two.  Both tails are survivor masses of `kernel`.
-/
theorem expected_kernel_epochs_le_two (σ : FinSignature) :
    (twoPhaseProgress σ).expectedKernelEpochCount ≤ 2 := by
  simpa using (twoPhaseProgress σ).expectedKernelEpochCount_le

/-- Each phase tail is also the probability of a genuine trajectory cylinder. -/
theorem phase_tail_is_generated_probability
    (σ : FinSignature) (index : Fin 2) (n : Nat) :
    (kernel σ).toMarkovExecutionKernel.missProbability
        (phaseInitial index).toMeasure
        (fun state => (phaseProgress σ index).stable state = true) n =
      ((twoPhaseProgress σ).toFiniteHeightProgressContract
        ).phaseMissProbability index n := by
  exact (twoPhaseProgress σ).phase_tail_is_trajectory_probability index n

/-- The deterministic kernel reaches the final conflict stage after two steps. -/
theorem two_native_progress_steps (σ : FinSignature) :
    (package σ).lts.ObservableStep
        .empty .recordApproval .approval ∧
      (package σ).lts.ObservableStep
        .approval .recordRejection .conflict ∧
      transition .empty .approval = 1 ∧
      transition .approval .conflict = 1 := by
  exact
    ⟨Event.native .recordApproval, Event.native .recordRejection,
      by simp [transition, next], by simp [transition, next]⟩

/-! ## Positive-mass event identity and replayable common trajectories -/

/-- The unique native event selected by each positive kernel row. -/
def kernelEvent : State → Event
  | .empty => .recordApproval
  | .approval => .recordRejection
  | .conflict => .conflictExternalHold
  | .accepted => .acceptedExternalHold
  | .rejected => .rejectedExternalHold

theorem kernelEvent_native (source : State) :
    lts.ObservableStep source (kernelEvent source) (next source) := by
  cases source with
  | empty =>
      simpa [kernelEvent, next, Event.source, Event.target] using
        Event.native .recordApproval
  | approval =>
      simpa [kernelEvent, next, Event.source, Event.target] using
        Event.native .recordRejection
  | conflict =>
      simpa [kernelEvent, next, Event.source, Event.target] using
        Event.native .conflictExternalHold
  | accepted =>
      simpa [kernelEvent, next, Event.source, Event.target] using
        Event.native .acceptedExternalHold
  | rejected =>
      simpa [kernelEvent, next, Event.source, Event.target] using
        Event.native .rejectedExternalHold

/--
Only positive-mass pairs receive an event label.  Impossible zero-mass pairs
are not represented by administrative source events.
-/
def positiveLabelling (σ : FinSignature) :
    PositiveEventLabelling (kernel σ) where
  event := fun {source _target} _positive => kernelEvent source
  native := by
    intro source target positive
    have targetEq : target = next source := by
      by_contra targetNe
      simp [kernel, transition, targetNe] at positive
    subst target
    change lts.ObservableStep source (kernelEvent source) (next source)
    exact kernelEvent_native source

theorem positiveAlignment (σ : FinSignature) :
    PositiveEpochKernelAlignment (positiveLabelling σ) window where
  stable_state_version := by
    intro state
    rfl
  opportunity_noninternal := by
    intro source target positive
    change ¬ False
    simp

/--
Under the generated trajectory measure, almost every sampled path has one
common witness carrying the same state path, selected native event identity,
exact `DPOEvent` replay, and epoch alignment.
-/
theorem complete_positive_common_trajectory_almost_surely
    (σ : FinSignature) :
    ∀ᵐ rawPath ∂
        (kernel σ).toMarkovExecutionKernel.trajectoryMeasure
          (initialAt .empty).toMeasure,
      ∃ path : PositiveStatePath (kernel σ),
        path.state = rawPath ∧
          Nonempty ((positiveLabelling σ).TrajectoryAgreement path) ∧
          Nonempty
            (EpochAlignedTrajectory window
              ((positiveLabelling σ).decorate path)) :=
  replayable_epoch_aligned_trajectory_exists_almost_surely
    (positiveLabelling σ) (initialAt .empty) (positiveAlignment σ)

/-- Positivity itself forces the exact deterministic next state. -/
theorem positive_path_next
    (σ : FinSignature) (path : PositiveStatePath (kernel σ)) (n : Nat) :
    path.state (n + 1) = next (path.state n) := by
  by_contra targetNe
  have positive := path.positive n
  simp [kernel, transition, targetNe] at positive

/-- A positive path starting empty reaches the final conflict evidence in two steps. -/
theorem positive_path_reaches_conflict_in_two
    (σ : FinSignature) (path : PositiveStatePath (kernel σ))
    (startsEmpty : path.state 0 = .empty) :
    path.state 2 = .conflict := by
  have first := positive_path_next σ path 0
  have second := positive_path_next σ path 1
  rw [startsEmpty] at first
  simp [next] at first
  rw [first] at second
  simpa [next] using second

end Cantilune.Feedback.AuthorizedFeedbackProbability
