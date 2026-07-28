import Cantilune.Pi.P1cAdmittedExecutionTrajectory
import Cantilune.Feedback.KernelFiniteHeightProgress

/-!
# Kernel-derived expected hitting bound for admitted P1c operations

The admitted mismatch, reconnect, and quiescent-delete package has one strict
progress phase: from the pending state to the stable completed state.  This
file instantiates the finite-height kernel bridge, so its expected opportunity
bound is derived from the same native stochastic matrix that carries the
event-labelled replay trajectory.
-/

namespace Cantilune.Pi.P1cAdmittedKernelExpectation

open Cantilune.Core
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}

/-- One real kernel phase, with the identity opportunity schedule. -/
noncomputable def onePhaseProgress
    (occurrence : Occurrence signature) :
    KernelFiniteHeightProgress
      (stateKernel occurrence) 1 (1 : Real) where
  window := window occurrence
  epochwiseFair := by
    intro n
    simp [window]
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  initial := fun _ => initial
  phase := fun _ => progress occurrence
  phase_window := by
    intro _
    rfl

/--
The concrete admitted-operation execution kernel reaches its stable phase in
expected opportunity count at most one.  This is the `H / ε` theorem with
`H = 1` and `ε = 1`, not an independently supplied tail sequence.
-/
theorem expected_opportunities_le_one
    (occurrence : Occurrence signature) :
    (onePhaseProgress occurrence).expectedKernelEpochCount ≤ 1 := by
  simpa using
    (onePhaseProgress occurrence).expectedKernelEpochCount_le

end Cantilune.Pi.P1cAdmittedKernelExpectation
