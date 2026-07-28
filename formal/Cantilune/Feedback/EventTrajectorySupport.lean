import Cantilune.Feedback.EventTrajectoryMeasure

/-!
# Almost-sure positive support for finite event trajectories

`TotalNativeLabelling` necessarily assigns a label even to state pairs of
zero transition mass.  This module proves that those totalisation labels are
absent almost surely under the actual Ionescu--Tulcea trajectory law.
-/

namespace Cantilune.Feedback.StochasticExecution.FiniteDiscrete

open MeasureTheory
open ProbabilityTheory
open Finset Function Preorder
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]
variable [MeasurableSpace State] [MeasurableSingletonClass State]

namespace NativeMarkovKernel

/--
One row of a finite stochastic matrix is almost surely supported exactly on
states carrying strictly positive matrix mass.
-/
theorem ae_positive_probability
    (kernel : NativeMarkovKernel signature package State)
    (source : State) :
    ∀ᵐ target ∂ kernel.toKernel source,
      0 < kernel.probability source target := by
  rw [toKernel_apply]
  unfold stateMeasure
  rw [ae_finsetSum_measure_iff]
  intro target _member
  by_cases zero : kernel.probability source target = 0
  · simp [zero]
  · have positive :
        0 < kernel.probability source target :=
      lt_of_le_of_ne
        (kernel.probability_nonnegative source target) (Ne.symm zero)
    apply Measure.ae_smul_measure
    rw [MeasureTheory.ae_dirac_iff]
    · exact positive
    · exact
        (Set.toFinite
          {target : State |
            0 < kernel.probability source target}).measurableSet

set_option maxHeartbeats 400000 in
/--
At every fixed time, an Ionescu--Tulcea sample uses a positive-mass matrix
edge almost surely.
-/
theorem trajectory_ae_positive_probability_at
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State) (n : Nat) :
    ∀ᵐ path ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      0 < kernel.probability (path n) (path (n + 1)) := by
  have joint :
      ∀ᵐ pair ∂
          (kernel.toMarkovExecutionKernel.trajectoryMeasure
              initial.toMeasure).map (frestrictLe n) ⊗ₘ
            kernel.toMarkovExecutionKernel.historyKernel n,
        0 <
          kernel.probability
            ((pair.1) ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2 := by
    apply Measure.ae_compProd_of_ae_ae
    · exact
        measurableSet_lt measurable_const
          (measurable_of_finite
            (fun pair :
                ((i : Finset.Iic n) → State) × State =>
              kernel.probability
                ((pair.1) ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2))
    · exact Filter.Eventually.of_forall fun history => by
        have row :=
          ae_positive_probability kernel
            (history ⟨n, Finset.mem_Iic.mpr le_rfl⟩)
        simpa [MarkovExecutionKernel.historyKernel,
          toMarkovExecutionKernel, toKernel_apply] using row
  unfold MarkovExecutionKernel.trajectoryMeasure at joint ⊢
  have jointMeasureEq :=
    ProbabilityTheory.Kernel.map_frestrictLe_trajMeasure_compProd_eq_map_trajMeasure
      (X := fun _ => State)
      (μ₀ := initial.toMeasure)
      (κ := kernel.toMarkovExecutionKernel.historyKernel)
      (a := n)
  rw [jointMeasureEq] at joint
  have pulled :=
    (ae_map_iff
      (measurable_frestrictLe n |>.prod
        (measurable_pi_apply (n + 1))).aemeasurable
      (measurableSet_lt measurable_const
        (measurable_of_finite
          (fun pair :
              ((i : Finset.Iic n) → State) × State =>
            kernel.probability
              ((pair.1) ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2)))).1 joint
  simpa [frestrictLe_apply] using pulled

/-- Every sampled edge has positive matrix mass almost surely. -/
theorem trajectory_ae_positive_probability
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State) :
    ∀ᵐ path ∂
        kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      ∀ n, 0 < kernel.probability (path n) (path (n + 1)) := by
  rw [ae_all_iff]
  exact kernel.trajectory_ae_positive_probability_at initial

end NativeMarkovKernel

end Cantilune.Feedback.StochasticExecution.FiniteDiscrete

namespace Cantilune.Feedback.EventTrajectory.FiniteDiscrete

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]
variable [MeasurableSpace State] [MeasurableSingletonClass State]

/--
The pushed-forward event law inherits positive support from its exact state
marginal.  Thus total labels on null state pairs are measure-theoretically
irrelevant without being confused with source rules.
-/
theorem replayable_event_measure_ae_positive_probability
    {kernel : NativeMarkovKernel signature package State}
    (labelling : TotalNativeLabelling kernel)
    (initial : InitialDistribution State) :
    ∀ᵐ path ∂ replayableEventTrajectoryMeasure labelling initial,
      ∀ n,
        0 <
          kernel.probability
            (path.stateCode n) (path.stateCode (n + 1)) := by
  have measurableSupport :
      MeasurableSet
        {path : ReplayableEventPath labelling |
          ∀ n,
            0 <
              kernel.probability
                (path.stateCode n) (path.stateCode (n + 1))} := by
    rw [show
      {path : ReplayableEventPath labelling |
        ∀ n,
          0 <
            kernel.probability
              (path.stateCode n) (path.stateCode (n + 1))} =
        ⋂ n,
          {path : ReplayableEventPath labelling |
            0 <
              kernel.probability
                (path.stateCode n) (path.stateCode (n + 1))} by
      ext path
      simp]
    apply MeasurableSet.iInter
    intro n
    have coordinates :
        Measurable
          (fun path : ReplayableEventPath labelling =>
            (path.stateCode n, path.stateCode (n + 1))) :=
      ((measurable_pi_apply n).comp
          (ReplayableEventPath.measurable_stateCode
            (labelling := labelling))).prod
        ((measurable_pi_apply (n + 1)).comp
          (ReplayableEventPath.measurable_stateCode
            (labelling := labelling)))
    exact
      measurableSet_lt measurable_const
        ((measurable_of_finite
          (fun pair : State × State =>
            kernel.probability pair.1 pair.2)).comp coordinates)
  rw [replayableEventTrajectoryMeasure]
  apply
    (ae_map_iff
      (ReplayableEventPath.measurable_ofState
        (labelling := labelling)).aemeasurable
      measurableSupport).2
  simpa using kernel.trajectory_ae_positive_probability initial

end Cantilune.Feedback.EventTrajectory.FiniteDiscrete
