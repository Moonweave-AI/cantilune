import Cantilune.Feedback.FiniteHeterogeneousProbability

/-!
# Caller-supplied kernels for finite heterogeneous schedules

`FiniteHeterogeneousProbability.phaseKernel` constructs the canonical
deterministic matrix.  This module instead accepts a caller-supplied genuine
mathlib `Kernel`, packaged as a `MarkovExecutionKernel`.

The contract deliberately fixes the phase successor with probability one:
every nonterminal phase advances once, and the terminal phase is absorbing.
Thus the caller may use a different kernel representation, but its law on
the phase space is still Dirac.  This does **not** model random event choice.
Event identity, DPO/admission replay, and execution-epoch alignment continue
to come from the ordered dependent `EpochChain` trace.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteHeterogeneousRandomKernel

open Filter MeasureTheory ProbabilityTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Feedback.FiniteHeterogeneousProbability

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}

/-- The administrative terminal phase is a fixed point of `advance`. -/
@[simp]
theorem advance_terminal
    (chain : EpochChain universes first last) :
    advance chain (terminalPhase chain) = terminalPhase chain := by
  apply Fin.ext
  simp only [advance, terminalPhase, phaseAt]
  omega

/--
A caller-supplied genuine Markov kernel whose phase schedule is almost surely
the canonical successor schedule.

The two probability-one fields intentionally separate the native-event
prefix from administrative terminal absorption.
-/
structure AlmostSureSuccessorPhaseKernel
    (chain : EpochChain universes first last) where
  semantics : MarkovExecutionKernel (Phase chain)
  nonterminalSuccessor :
    ∀ source, source ≠ terminalPhase chain →
      semantics.stepKernel source {advance chain source} = 1
  terminalAbsorbing :
    semantics.stepKernel (terminalPhase chain)
      {terminalPhase chain} = 1

namespace AlmostSureSuccessorPhaseKernel

variable {chain : EpochChain universes first last}

/-- Both branches of the contract give unit mass to `advance`. -/
theorem successor_probability_one
    (kernel : AlmostSureSuccessorPhaseKernel chain)
    (source : Phase chain) :
    kernel.semantics.stepKernel source {advance chain source} = 1 := by
  by_cases terminal : source = terminalPhase chain
  · subst source
    simpa using kernel.terminalAbsorbing
  · exact kernel.nonterminalSuccessor source terminal

/-- One row of the caller kernel is almost surely its unique successor. -/
theorem step_ae_eq_advance
    (kernel : AlmostSureSuccessorPhaseKernel chain)
    (source : Phase chain) :
    ∀ᵐ target ∂kernel.semantics.stepKernel source,
      target = advance chain source := by
  letI : IsMarkovKernel kernel.semantics.stepKernel :=
    kernel.semantics.isMarkov
  rw [MeasureTheory.ae_iff_prob_eq_one
    (measurable_of_finite
      (fun target : Phase chain => target = advance chain source))]
  simpa only [Set.setOf_eq_eq_singleton] using
    kernel.successor_probability_one source

/-- The caller-kernel trajectory projected through time `n`. -/
noncomputable def finiteMarginal
    (kernel : AlmostSureSuccessorPhaseKernel chain)
    (n : Nat) :
    Measure ((i : Finset.Iic n) → Phase chain) :=
  (kernel.semantics.trajectoryMeasure (initial chain)).map
    (Preorder.frestrictLe n)

/-- Time zero of the caller-kernel marginal is the supplied Dirac law. -/
theorem finiteMarginal_zero
    (kernel : AlmostSureSuccessorPhaseKernel chain) :
    kernel.finiteMarginal 0 =
      (initial chain).map (MeasurableEquiv.piUnique _).symm := by
  unfold finiteMarginal MarkovExecutionKernel.trajectoryMeasure
  rw [ProbabilityTheory.Kernel.trajMeasure,
    Measure.map_comp _ _ (Preorder.measurable_frestrictLe 0),
    ProbabilityTheory.Kernel.traj_map_frestrictLe,
    ProbabilityTheory.Kernel.partialTraj_self]
  simp

/-- A trajectory from the canonical initial Dirac law starts there a.s. -/
theorem trajectory_ae_starts_at_initial
    (kernel : AlmostSureSuccessorPhaseKernel chain) :
    ∀ᵐ path ∂kernel.semantics.trajectoryMeasure (initial chain),
      path 0 = initialPhase chain := by
  have historyStart :
      ∀ᵐ history ∂kernel.finiteMarginal 0,
        history ⟨0, Finset.mem_Iic.mpr le_rfl⟩ =
          initialPhase chain := by
    rw [kernel.finiteMarginal_zero]
    simp [initial]
  unfold finiteMarginal at historyStart
  have pulled :=
    (ae_map_iff
      (Preorder.measurable_frestrictLe 0).aemeasurable
      (Set.toFinite
        {history : (i : Finset.Iic 0) → Phase chain |
          history ⟨0, Finset.mem_Iic.mpr le_rfl⟩ =
            initialPhase chain}).measurableSet).1 historyStart
  simpa [Preorder.frestrictLe_apply] using pulled

set_option maxHeartbeats 400000 in
/--
At one fixed time, the Ionescu--Tulcea sample follows the unique successor
almost surely.
-/
theorem trajectory_ae_follows_advance_at
    (kernel : AlmostSureSuccessorPhaseKernel chain)
    (n : Nat) :
    ∀ᵐ path ∂kernel.semantics.trajectoryMeasure (initial chain),
      path (n + 1) = advance chain (path n) := by
  have joint :
      ∀ᵐ pair ∂
          (kernel.semantics.trajectoryMeasure
              (initial chain)).map (Preorder.frestrictLe n) ⊗ₘ
            kernel.semantics.historyKernel n,
        pair.2 =
          advance chain
            (pair.1 ⟨n, Finset.mem_Iic.mpr le_rfl⟩) := by
    apply Measure.ae_compProd_of_ae_ae
    · exact
        (Set.toFinite
          {pair :
              ((i : Finset.Iic n) → Phase chain) × Phase chain |
            pair.2 =
              advance chain
                (pair.1 ⟨n, Finset.mem_Iic.mpr le_rfl⟩)}).measurableSet
    · exact Filter.Eventually.of_forall fun history => by
        have row :=
          kernel.step_ae_eq_advance
            (history ⟨n, Finset.mem_Iic.mpr le_rfl⟩)
        simpa [MarkovExecutionKernel.historyKernel] using row
  unfold MarkovExecutionKernel.trajectoryMeasure at joint ⊢
  have jointMeasureEq :=
    ProbabilityTheory.Kernel.map_frestrictLe_trajMeasure_compProd_eq_map_trajMeasure
      (X := fun _ => Phase chain)
      (μ₀ := initial chain)
      (κ := kernel.semantics.historyKernel)
      (a := n)
  rw [jointMeasureEq] at joint
  have pulled :=
    (ae_map_iff
      (Preorder.measurable_frestrictLe n |>.prod
        (measurable_pi_apply (n + 1))).aemeasurable
      (Set.toFinite
        {pair :
            ((i : Finset.Iic n) → Phase chain) × Phase chain |
          pair.2 =
            advance chain
              (pair.1 ⟨n, Finset.mem_Iic.mpr le_rfl⟩)}).measurableSet).1 joint
  simpa [Preorder.frestrictLe_apply] using pulled

/-- Every sampled edge follows `advance` almost surely. -/
theorem trajectory_ae_follows_advance
    (kernel : AlmostSureSuccessorPhaseKernel chain) :
    ∀ᵐ path ∂kernel.semantics.trajectoryMeasure (initial chain),
      ∀ n, path (n + 1) = advance chain (path n) := by
  rw [ae_all_iff]
  exact kernel.trajectory_ae_follows_advance_at

/--
The probability-one successor contract collapses the sampled phase path to
the exact canonical schedule.
-/
theorem trajectory_ae_eq_phaseAt
    (kernel : AlmostSureSuccessorPhaseKernel chain) :
    ∀ᵐ path ∂kernel.semantics.trajectoryMeasure (initial chain),
      ∀ n, path n = phaseAt chain n := by
  filter_upwards
    [kernel.trajectory_ae_starts_at_initial,
      kernel.trajectory_ae_follows_advance] with path starts steps
  exact path_eq_phaseAt chain path starts steps

/--
Almost every caller-kernel path carries the complete event-labelled common
trajectory: ordered event identity, exact DPO/admission replay, execution
epoch alignment, and terminal absorption.
-/
theorem common_trajectory_almost_sure
    (kernel : AlmostSureSuccessorPhaseKernel chain) :
    ∀ᵐ path ∂kernel.semantics.trajectoryMeasure (initial chain),
      CompleteFiniteChainTrajectory chain path := by
  filter_upwards [kernel.trajectory_ae_eq_phaseAt] with path schedule
  exact completeFiniteChainTrajectory chain path schedule

end AlmostSureSuccessorPhaseKernel

end Cantilune.Feedback.FiniteHeterogeneousRandomKernel
