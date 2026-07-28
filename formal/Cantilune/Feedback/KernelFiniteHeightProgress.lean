import Cantilune.Feedback.StochasticExecution

/-!
# Finite-height progress tails constructed from one native execution kernel

`FiniteHeightProgressContract` proves the arithmetic `H / ε` bound for a
family of phase tails.  This module ties every phase tail to the survivor mass
of one concrete finite native Markov kernel.  With measurable finite states,
each tail is also proved equal to the corresponding Ionescu--Tulcea
not-yet-hit probability.

The remaining premise is semantic and explicit: a caller must identify the
initial distribution and stable predicate of each strict evidence phase and
prove the same positive progress bound for that phase.
-/

namespace Cantilune.Feedback.StochasticExecution.FiniteDiscrete

open Cantilune.Core
open Cantilune.Feedback.Probability

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]

/--
One finite native kernel, equipped with a genuine kernel-derived progress
bridge for every one of the remaining strict evidence phases.
-/
structure KernelFiniteHeightProgress
    (kernel : NativeMarkovKernel signature package State)
    (height : Nat) (epsilon : Real) where
  window : StableFairWindow
  epochwiseFair : EpochwiseFair window
  epsilon_pos : 0 < epsilon
  epsilon_le_one : epsilon ≤ 1
  initial : Fin height → InitialDistribution State
  phase :
    (index : Fin height) →
      ProgressBridge kernel (initial index) epsilon
  phase_window :
    ∀ index, (phase index).window = window

namespace KernelFiniteHeightProgress

variable
    {kernel : NativeMarkovKernel signature package State}
    {height : Nat} {epsilon : Real}

/--
The finite-height arithmetic contract whose phase tails are the actual
survivor masses recursively computed from `kernel`.
-/
def toFiniteHeightProgressContract
    (progress :
      KernelFiniteHeightProgress kernel height epsilon) :
    FiniteHeightProgressContract height epsilon where
  window := progress.window
  epochwise_fair := progress.epochwiseFair
  epsilon_pos := progress.epsilon_pos
  epsilon_le_one := progress.epsilon_le_one
  phaseMissProbability := fun index =>
    missProbability kernel (progress.initial index)
      (progress.phase index).stable
  phase_nonnegative := by
    intro index n
    exact
      missProbability_nonnegative kernel
        (progress.initial index) (progress.phase index).stable n
  phase_initial := by
    intro index
    exact
      missProbability_initial_le_one kernel
        (progress.initial index) (progress.phase index).stable
  phase_step := by
    intro index n
    exact
      missProbability_step kernel
        (progress.initial index) (progress.phase index).stable
        (progress.phase index).pointwise_progress n

/-- The tail-sum expectation now refers definitionally to kernel survivor mass. -/
noncomputable def expectedKernelEpochCount
    (progress :
      KernelFiniteHeightProgress kernel height epsilon) : Real :=
  progress.toFiniteHeightProgressContract.expectedEpochCount

/--
For one native execution kernel, `height` kernel-derived phase tails have
total expected opportunity count at most `height / epsilon`.
-/
theorem expectedKernelEpochCount_le
    (progress :
      KernelFiniteHeightProgress kernel height epsilon) :
    progress.expectedKernelEpochCount ≤
      (height : Real) / epsilon :=
  progress.toFiniteHeightProgressContract.expectedEpochCount_le

/--
On finite measurable state spaces, each declared phase tail is exactly the
not-yet-hit probability under the Ionescu--Tulcea trajectory measure generated
by the same native kernel and that phase's initial distribution.
-/
theorem phase_tail_is_trajectory_probability
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (progress :
      KernelFiniteHeightProgress kernel height epsilon)
    (index : Fin height) (n : Nat) :
    kernel.toMarkovExecutionKernel.missProbability
        (progress.initial index).toMeasure
        (fun state => (progress.phase index).stable state = true) n =
      progress.toFiniteHeightProgressContract.phaseMissProbability
        index n := by
  simpa [toFiniteHeightProgressContract] using
    (progress.phase index).trajectory_missProbability_eq n

end KernelFiniteHeightProgress

end Cantilune.Feedback.StochasticExecution.FiniteDiscrete
