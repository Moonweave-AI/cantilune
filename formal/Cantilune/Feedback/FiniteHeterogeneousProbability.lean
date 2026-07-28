import Cantilune.Feedback.FiniteHeterogeneousTrajectory

/-!
# Probability-one schedules for finite heterogeneous epoch chains

The heterogeneous native events themselves live above universe zero, whereas
the Markov trajectory API samples a fixed measurable state type.  For a
finite `EpochChain` we therefore sample the canonical type-zero phase space

`Fin (number of native/admission labels + 1)`.

The deterministic kernel advances through every recorded label once and then
stays at an administrative terminal phase.  A separate Prop-valued agreement
decorates each pre-terminal edge with the actual dependent `ChainEvent`.
Consequently the terminal self-loop is never misreported as a DPO event or a
signature admission.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteHeterogeneousProbability

open MeasureTheory ProbabilityTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference
open Cantilune.Feedback.FiniteHeterogeneousTrajectory

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}

/-- Number of genuine native/admission labels in the finite chain. -/
def eventCount (chain : EpochChain universes first last) : Nat :=
  (traceEvents chain).length

/-- Type-zero stochastic phase space, including one terminal phase. -/
abbrev Phase (chain : EpochChain universes first last) :=
  Fin (eventCount chain + 1)

/-- Phase reached after `n` scheduler ticks, clamped at the terminal phase. -/
def phaseAt
    (chain : EpochChain universes first last) (n : Nat) :
    Phase chain :=
  ⟨min n (eventCount chain),
    Nat.lt_succ_of_le (Nat.min_le_right _ _)⟩

/-- Initial scheduler phase. -/
def initialPhase
    (chain : EpochChain universes first last) : Phase chain :=
  phaseAt chain 0

/-- Terminal administrative phase. -/
def terminalPhase
    (chain : EpochChain universes first last) : Phase chain :=
  phaseAt chain (eventCount chain)

/-- Advance once, clamping at the terminal phase. -/
def advance
    (chain : EpochChain universes first last) (source : Phase chain) :
    Phase chain :=
  phaseAt chain (source.1 + 1)

@[simp] theorem phaseAt_zero
    (chain : EpochChain universes first last) :
    phaseAt chain 0 = initialPhase chain :=
  rfl

/-- Advancing the phase at time `n` gives the phase at time `n+1`. -/
theorem advance_phaseAt
    (chain : EpochChain universes first last) (n : Nat) :
    advance chain (phaseAt chain n) = phaseAt chain (n + 1) := by
  apply Fin.ext
  simp only [advance, phaseAt]
  omega

/-- Every phase at or after the event count is the terminal phase. -/
theorem phaseAt_eq_terminal
    (chain : EpochChain universes first last)
    {n : Nat} (after : eventCount chain ≤ n) :
    phaseAt chain n = terminalPhase chain := by
  apply Fin.ext
  simp [phaseAt, terminalPhase, Nat.min_eq_right after]

/-- Deterministic transition matrix for the finite phase schedule. -/
def transitionProbability
    (chain : EpochChain universes first last)
    (source target : Phase chain) : Real :=
  if target = advance chain source then 1 else 0

theorem positive_target_eq_advance
    (chain : EpochChain universes first last)
    {source target : Phase chain}
    (positive : 0 < transitionProbability chain source target) :
    target = advance chain source := by
  by_contra different
  simp [transitionProbability, different] at positive

/--
The genuine finite stochastic kernel.  `Unit` is only an administrative
support witness; actual dependent event labels are attached below from
`traceEvents`.
-/
def phaseKernel
    (chain : EpochChain universes first last) :
    ReplayMarkovKernel (Phase chain) (fun _ _ => Unit) where
  probability := transitionProbability chain
  probability_nonnegative := by
    intro source target
    by_cases equality : target = advance chain source <;>
      simp [transitionProbability, equality]
  row_sum := by
    intro source
    simp [transitionProbability]
  event_of_positive := by
    intro source target _positive
    exact ()

/-- Dirac law at the initial phase. -/
noncomputable def initial
    (chain : EpochChain universes first last) :
    Measure (Phase chain) :=
  Measure.dirac (initialPhase chain)

noncomputable instance initial_isProbabilityMeasure
    (chain : EpochChain universes first last) :
    IsProbabilityMeasure (initial chain) := by
  unfold initial
  infer_instance

/-- Positive support forces every sampled edge to follow `advance`. -/
theorem trajectory_ae_follows_advance
    (chain : EpochChain universes first last) :
    ∀ᵐ path ∂
        (phaseKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ n, path (n + 1) = advance chain (path n) := by
  filter_upwards
    [(phaseKernel chain).trajectory_ae_positive_probability
      (initial chain)] with path positive
  intro n
  exact positive_target_eq_advance chain (positive n)

/-- The deterministic recurrence uniquely fixes the whole phase path. -/
theorem path_eq_phaseAt
    (chain : EpochChain universes first last)
    (path : Nat → Phase chain)
    (starts : path 0 = initialPhase chain)
    (steps : ∀ n, path (n + 1) = advance chain (path n)) :
    ∀ n, path n = phaseAt chain n := by
  intro n
  induction n with
  | zero =>
      exact starts
  | succ n ih =>
      calc
        path (n + 1) = advance chain (path n) := steps n
        _ = advance chain (phaseAt chain n) := by rw [ih]
        _ = phaseAt chain (n + 1) := advance_phaseAt chain n

/-- Almost every Ionescu--Tulcea sample follows the exact finite schedule. -/
theorem trajectory_ae_eq_phaseAt
    (chain : EpochChain universes first last) :
    ∀ᵐ path ∂
        (phaseKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ n, path n = phaseAt chain n := by
  filter_upwards
    [(phaseKernel chain).trajectory_ae_starts_at (initialPhase chain),
      trajectory_ae_follows_advance chain] with path starts steps
  exact path_eq_phaseAt chain path starts steps

/--
Full event-level agreement for one sampled finite phase path.

The event at every `n < eventCount` is the actual dependent list entry.
Replay and execution-epoch evidence are obtained from the chain theorem, not
from the administrative `Unit` support witness of the Markov matrix.
-/
structure CompleteFiniteChainTrajectory
    (chain : EpochChain universes first last)
    (path : Nat → Phase chain) : Prop where
  schedule : ∀ n, path n = phaseAt chain n
  chainAgreement : ChainTraceAgreement chain
  eventReplay :
    ∀ (n : Nat) (before : n < eventCount chain),
      EventReplay universes
        ((traceEvents chain).get
          ⟨n, by simpa [eventCount] using before⟩)
  eventExecutionEpochAligned :
    ∀ (n : Nat) (before : n < eventCount chain),
      ExecutionEpochAligned universes
        ((traceEvents chain).get
          ⟨n, by simpa [eventCount] using before⟩)
  reachesTerminal :
    path (eventCount chain) = terminalPhase chain
  remainsTerminal :
    ∀ (n : Nat), eventCount chain ≤ n →
      path n = terminalPhase chain

/-- Construct all dependent event evidence from an exact phase schedule. -/
theorem completeFiniteChainTrajectory
    (chain : EpochChain universes first last)
    (path : Nat → Phase chain)
    (schedule : ∀ n, path n = phaseAt chain n) :
    CompleteFiniteChainTrajectory chain path where
  schedule := schedule
  chainAgreement := complete_chain_trace_agreement chain
  eventReplay := by
    intro n before
    apply trace_event_replay chain
    exact List.get_mem _ _
  eventExecutionEpochAligned := by
    intro n before
    apply trace_event_execution_epoch_aligned chain
    exact List.get_mem _ _
  reachesTerminal := by
    rw [schedule]
    rfl
  remainsTerminal := by
    intro n after
    rw [schedule]
    exact phaseAt_eq_terminal chain after

/--
For every finite heterogeneous epoch chain, the genuine Ionescu--Tulcea law
almost surely carries the complete ordered native-event, DPO/admission replay,
and runtime execution-epoch agreement.
-/
theorem finite_chain_common_trajectory_almost_sure
    (chain : EpochChain universes first last) :
    ∀ᵐ path ∂
        (phaseKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      CompleteFiniteChainTrajectory chain path := by
  filter_upwards [trajectory_ae_eq_phaseAt chain] with path schedule
  exact completeFiniteChainTrajectory chain path schedule

end Cantilune.Feedback.FiniteHeterogeneousProbability
