import Cantilune.Feedback.StochasticExecution
import Cantilune.Tests.FeedbackExecution

/-!
# Regression checks for kernel-generated execution paths
-/

namespace Cantilune.Tests.StochasticExecution

open MeasureTheory ProbabilityTheory
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution

private instance : MeasurableSpace Bool := ⊤

private noncomputable def initial : Measure Bool :=
  Measure.dirac false

private noncomputable instance : IsProbabilityMeasure initial := by
  unfold initial
  infer_instance

private noncomputable def kernel : MarkovExecutionKernel Bool where
  stepKernel := ProbabilityTheory.Kernel.deterministic id measurable_id
  isMarkov := by
    infer_instance

private def window : StableFairWindow where
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

private noncomputable def progress :
    KernelProgressAssumption kernel initial (1 / 2 : Real) where
  window := window
  stable := fun _ => True
  measurable_stable := by simp
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  kernel_progress := by
    intro state notStable
    exact False.elim (notStable trivial)
  tail_step_from_kernel := by
    intro n
    have empty :
        MarkovExecutionKernel.notHit (fun _ : Bool => True) n = ∅ := by
      ext path
      simp only [MarkovExecutionKernel.notHit, Set.mem_setOf_eq,
        Set.mem_empty_iff_false, iff_false]
      intro misses
      exact misses 0 (Nat.zero_le n) trivial
    have emptyNext :
        MarkovExecutionKernel.notHit (fun _ : Bool => True) (n + 1) = ∅ := by
      ext path
      simp only [MarkovExecutionKernel.notHit, Set.mem_setOf_eq,
        Set.mem_empty_iff_false, iff_false]
      intro misses
      exact misses 0 (Nat.zero_le (n + 1)) trivial
    simp [MarkovExecutionKernel.missProbability, empty, emptyNext]

example :
    IsProbabilityMeasure (kernel.trajectoryMeasure initial) := by
  infer_instance

example :
    Antitone
      (MarkovExecutionKernel.notHit (fun state : Bool => state)) :=
  MarkovExecutionKernel.notHit_antitone _

example :
    ∀ᵐ path ∂kernel.trajectoryMeasure initial,
      progress.hittingBridge.EventuallyHits path :=
  progress.kernel_feedback_almost_sure_hitting

namespace FiniteBridge

open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

abbrev package :=
  Cantilune.Tests.FeedbackExecution.executionPackage

noncomputable def transition : Bool → Bool → Real
  | false, false => 1 / 2
  | false, true => 1 / 2
  | true, false => 0
  | true, true => 1

noncomputable def nativeKernel :
    NativeMarkovKernel
      Cantilune.Tests.FeedbackExecution.emptySignature package Bool where
  stateEquiv := Equiv.refl Bool
  probability := transition
  probability_nonnegative := by
    intro source target
    cases source <;> cases target <;> norm_num [transition]
  row_sum := by
    intro source
    cases source <;>
      rw [Fintype.sum_bool] <;>
      norm_num [transition]
  native_support_of_change := by
    intro source target positive different
    cases source <;> cases target
    · exact False.elim (different rfl)
    · exact
        ⟨(),
          Cantilune.Tests.FeedbackExecution.one_step⟩
    · norm_num [transition] at positive
    · exact False.elim (different rfl)

noncomputable def initialDistribution : InitialDistribution Bool where
  probability
    | false => 1
    | true => 0
  probability_nonnegative := by
    intro state
    cases state <;> norm_num
  total := by
    rw [Fintype.sum_bool]
    norm_num

def finiteWindow : StableFairWindow where
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

def stable : Bool → Bool :=
  id

noncomputable def finiteProgress :
    ProgressBridge nativeKernel initialDistribution (1 / 2 : Real) where
  window := finiteWindow
  stable := stable
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  pointwise_progress := by
    intro state unstable
    cases state
    · change
        (1 / 2 : Real) ≤
          ∑ target ∈
            (Finset.univ.filter fun target : Bool => target = true),
            transition false target
      rw [Finset.sum_filter, Fintype.sum_bool]
      norm_num [transition]
    · exact False.elim (unstable rfl)

/-- The finite matrix induces a genuine mathlib Markov kernel. -/
example :
    IsMarkovKernel nativeKernel.toMarkovExecutionKernel.stepKernel :=
  nativeKernel.toMarkovExecutionKernel.isMarkov

/-- The same matrix lower bound holds on that induced kernel. -/
example :
    ENNReal.ofReal (1 / 2 : Real) ≤
      nativeKernel.toMarkovExecutionKernel.stepKernel false
        {target | finiteProgress.stable target = true} :=
  finiteProgress.pointwise_kernel_progress false (by decide)

/-- The killed-chain tail starts at one and halves after one opportunity. -/
example :
    FiniteDiscrete.missProbability
      nativeKernel initialDistribution stable 0 = 1 := by
  norm_num [FiniteDiscrete.missProbability, survivorMass, unstableStates,
    stable, initialDistribution, Fintype.sum_bool]

example :
    FiniteDiscrete.missProbability
      nativeKernel initialDistribution stable 1 = 1 / 2 := by
  norm_num [FiniteDiscrete.missProbability, survivorMass, unstableStates,
    stable, initialDistribution, nativeKernel, transition]

/--
The actual Ionescu--Tulcea trajectory law assigns probability `1 / 2` to
avoiding the stable state through the first transition.  No agreement
hypothesis is supplied.
-/
example :
    (nativeKernel.toMarkovExecutionKernel.trajectoryMeasure
        initialDistribution.toMeasure)
      (MarkovExecutionKernel.notHit
        (fun state => finiteProgress.stable state = true) 1) =
      ENNReal.ofReal (1 / 2 : Real) := by
  rw [trajectory_notHit_eq_missProbability]
  norm_num [FiniteDiscrete.missProbability, survivorMass, unstableStates,
    stable, finiteProgress, initialDistribution, nativeKernel, transition]

/-- The real-valued trajectory miss probability is also derived internally. -/
example :
    nativeKernel.toMarkovExecutionKernel.missProbability
        initialDistribution.toMeasure
        (fun state => finiteProgress.stable state = true) 1 =
      1 / 2 := by
  rw [finiteProgress.trajectory_missProbability_eq]
  norm_num [FiniteDiscrete.missProbability, survivorMass, unstableStates,
    stable, finiteProgress, initialDistribution, nativeKernel, transition]

/-- The recurrence is derived from the pointwise matrix bound. -/
example (n : Nat) :
    finiteProgress.tailContract.missProbability (n + 1) ≤
      (1 - (1 / 2 : Real)) *
        finiteProgress.tailContract.missProbability n :=
  finiteProgress.tailContract.miss_step n

/--
The nontrivial finite kernel reaches stability almost surely, with no
caller-provided trajectory-agreement proof.
-/
example :
    ∀ᵐ path
      ∂nativeKernel.toMarkovExecutionKernel.trajectoryMeasure
        initialDistribution.toMeasure,
      finiteProgress.toKernelProgressAssumption.hittingBridge.EventuallyHits
        path :=
  finiteProgress.finite_kernel_feedback_almost_sure_hitting

end FiniteBridge

end Cantilune.Tests.StochasticExecution
