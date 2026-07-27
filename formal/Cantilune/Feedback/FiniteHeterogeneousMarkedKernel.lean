import Cantilune.Feedback.FiniteHeterogeneousProbability

/-!
# A genuinely marked kernel for a finite heterogeneous epoch chain

`FiniteHeterogeneousProbability.phaseKernel` samples only an administrative
phase.  This module lifts that canonical finite schedule to a state whose
nonterminal component contains the actual dependent `ChainEvent`, its native
`ChainStep`, and both endpoints.  Replay and execution-epoch alignment are
then derived from the sampled mark itself.

The kernel is deliberately the canonical deterministic schedule.  It does not
claim to model competing random events or a caller-supplied observation
scheduler.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteHeterogeneousMarkedKernel

open Filter MeasureTheory ProbabilityTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Feedback.FiniteHeterogeneousProbability

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}

namespace ChainPath

/-- Every indexed label of a heterogeneous path has an actual native edge. -/
theorem exists_step_get
    {chain : EpochChain universes first last}
    {source target : ChainState universes chain}
    {events : List (ChainEvent universes chain)}
    (path : ChainPath universes chain source events target)
    (index : Fin events.length) :
    ∃ edgeSource edgeTarget,
      ChainStep universes chain edgeSource
        (events.get index) edgeTarget := by
  induction path with
  | nil state =>
      exact Fin.elim0 index
  | @cons source middle target event events step path ih =>
      refine Fin.cases ?_ (fun tailIndex => ?_) index
      · exact ⟨source, middle, step⟩
      · simpa using ih tailIndex

end ChainPath

/--
The mark carried by a nonterminal stochastic state.  Unlike an index-only
annotation, it stores the actual heterogeneous event and the native
`ChainStep` witnessing its endpoints.
-/
structure ChainStepMark
    (chain : EpochChain universes first last) where
  index : Fin (traceEvents chain).length
  source : ChainState universes chain
  event : ChainEvent universes chain
  target : ChainState universes chain
  step : ChainStep universes chain source event target
  event_eq : event = (traceEvents chain).get index

/-- Canonical native mark at one position of the finite trace. -/
noncomputable def canonicalMark
    (chain : EpochChain universes first last)
    (index : Fin (traceEvents chain).length) :
    ChainStepMark chain := by
  let existence :=
    ChainPath.exists_step_get (trace_path chain) index
  let source := Classical.choose existence
  let targetExistence := Classical.choose_spec existence
  let target := Classical.choose targetExistence
  let step := Classical.choose_spec targetExistence
  exact
    { index := index
      source := source
      event := (traceEvents chain).get index
      target := target
      step := step
      event_eq := rfl }

namespace ChainStepMark

/-- Replay is a property of the sampled native mark itself. -/
theorem eventReplay
    {chain : EpochChain universes first last}
    (mark : ChainStepMark chain) :
    EventReplay universes mark.event := by
  rw [mark.event_eq]
  exact trace_event_replay chain _ (List.get_mem _ _)

/-- Runtime epoch alignment is likewise recovered from the sampled mark. -/
theorem executionEpochAligned
    {chain : EpochChain universes first last}
    (mark : ChainStepMark chain) :
    ExecutionEpochAligned universes mark.event := by
  rw [mark.event_eq]
  exact
    trace_event_execution_epoch_aligned chain _ (List.get_mem _ _)

end ChainStepMark

/-- The next native mark at a phase, or none at the terminal phase. -/
noncomputable def markAt
    (chain : EpochChain universes first last)
    (phase : Phase chain) :
    Option (ChainStepMark chain) :=
  if before : phase.1 < eventCount chain then
    some
      (canonicalMark chain
        ⟨phase.1, by simpa [eventCount] using before⟩)
  else
    none

/--
A stochastic state carries both its current phase and its actual next native
mark.  The equality field prevents a caller from attaching an unrelated
event to a phase.
-/
structure MarkedState
    (chain : EpochChain universes first last) where
  phase : Phase chain
  nextMark : Option (ChainStepMark chain)
  nextMark_eq : nextMark = markAt chain phase

namespace MarkedState

/-- The unique marked state above one administrative phase. -/
noncomputable def atPhase
    (chain : EpochChain universes first last)
    (phase : Phase chain) :
    MarkedState chain where
  phase := phase
  nextMark := markAt chain phase
  nextMark_eq := rfl

@[ext]
theorem ext
    {chain : EpochChain universes first last}
    {left right : MarkedState chain}
    (phase_eq : left.phase = right.phase) :
    left = right := by
  cases left
  cases right
  simp_all

/-- Marked states are exactly phases, with no extra stochastic choices. -/
noncomputable def phaseEquiv
    (chain : EpochChain universes first last) :
    MarkedState chain ≃ Phase chain where
  toFun := phase
  invFun := atPhase chain
  left_inv _ := ext rfl
  right_inv _ := rfl

noncomputable instance
    (chain : EpochChain universes first last) :
    Fintype (MarkedState chain) :=
  Fintype.ofEquiv (Phase chain) (phaseEquiv chain).symm

noncomputable instance
    (chain : EpochChain universes first last) :
    DecidableEq (MarkedState chain) :=
  Classical.decEq _

instance
    (chain : EpochChain universes first last) :
    MeasurableSpace (MarkedState chain) :=
  ⊤

/-- The deterministic successor retains the canonical mark of the next phase. -/
noncomputable def advance
    (chain : EpochChain universes first last)
    (state : MarkedState chain) :
    MarkedState chain :=
  atPhase chain
    (FiniteHeterogeneousProbability.advance chain state.phase)

@[simp]
theorem atPhase_phase
    (chain : EpochChain universes first last)
    (phase : Phase chain) :
    (atPhase chain phase).phase = phase :=
  rfl

@[simp]
theorem advance_phase
    (chain : EpochChain universes first last)
    (state : MarkedState chain) :
    (advance chain state).phase =
      FiniteHeterogeneousProbability.advance chain state.phase :=
  rfl

end MarkedState

/--
The dependent label actually carried by a positive marked-kernel edge.
Business edges contain the native heterogeneous mark itself.  Once the finite
schedule is exhausted, the absorbing self-loop is explicitly administrative
and carries no fabricated `DPOEvent` or admission.
-/
inductive MarkedKernelEvent
    (chain : EpochChain universes first last)
    (source target : MarkedState chain)
  | business
      (mark : ChainStepMark chain)
      (sourceMark : source.nextMark = some mark)
      (target_eq : target = MarkedState.advance chain source)
  | administrative
      (sourceMark : source.nextMark = none)
      (target_eq : target = MarkedState.advance chain source)

/-- Delta transition probability on marked successors. -/
def transitionProbability
    (chain : EpochChain universes first last)
    (source target : MarkedState chain) : Real :=
  if target = MarkedState.advance chain source then 1 else 0

/--
The marked stochastic matrix.  Its states, rather than a later proposition,
carry the next dependent native event.
-/
noncomputable def markedKernel
    (chain : EpochChain universes first last) :
    ReplayMarkovKernel
      (MarkedState chain) (MarkedKernelEvent chain) where
  probability := transitionProbability chain
  probability_nonnegative := by
    intro source target
    by_cases equality : target = MarkedState.advance chain source <;>
      simp [transitionProbability, equality]
  row_sum := by
    intro source
    simp [transitionProbability]
  event_of_positive := by
    intro source target positive
    have target_eq :
        target = MarkedState.advance chain source := by
      by_contra different
      simp [transitionProbability, different] at positive
    cases markEquality : source.nextMark with
    | none =>
        exact .administrative markEquality target_eq
    | some mark =>
        exact .business mark markEquality target_eq

/-- The initial marked state contains the first mark when the trace is nonempty. -/
noncomputable def initialState
    (chain : EpochChain universes first last) :
    MarkedState chain :=
  MarkedState.atPhase chain (initialPhase chain)

/-- Dirac initial law for the genuinely marked state space. -/
noncomputable def initial
    (chain : EpochChain universes first last) :
    Measure (MarkedState chain) :=
  Measure.dirac (initialState chain)

noncomputable instance initial_isProbabilityMeasure
    (chain : EpochChain universes first last) :
    IsProbabilityMeasure (initial chain) := by
  unfold initial
  infer_instance

/-- Positive marked probability uniquely determines the canonical successor. -/
theorem positive_target_eq_advance
    (chain : EpochChain universes first last)
    {source target : MarkedState chain}
    (positive : 0 < transitionProbability chain source target) :
    target = MarkedState.advance chain source := by
  by_contra different
  simp [transitionProbability, different] at positive

/--
At matrix level, forgetting marks recovers exactly the existing canonical
phase transition probability.
-/
theorem transitionProbability_projects
    (chain : EpochChain universes first last)
    (source target : MarkedState chain) :
    transitionProbability chain source target =
      FiniteHeterogeneousProbability.transitionProbability
        chain source.phase target.phase := by
  by_cases equality : target = MarkedState.advance chain source
  · subst target
    simp [transitionProbability,
      FiniteHeterogeneousProbability.transitionProbability]
  · have phase_ne :
        target.phase ≠
          FiniteHeterogeneousProbability.advance chain source.phase := by
      intro phase_eq
      apply equality
      apply MarkedState.ext
      exact phase_eq
    simp [transitionProbability,
      FiniteHeterogeneousProbability.transitionProbability,
      equality, phase_ne]

/-- One marked transition row is the Dirac measure at its marked successor. -/
theorem marked_stepKernel_eq_dirac
    (chain : EpochChain universes first last)
    (source : MarkedState chain) :
    (markedKernel chain).toMarkovExecutionKernel.stepKernel source =
      Measure.dirac (MarkedState.advance chain source) := by
  change (markedKernel chain).toKernel source =
    Measure.dirac (MarkedState.advance chain source)
  rw [ReplayMarkovKernel.toKernel_apply]
  unfold ReplayMarkovKernel.stateMeasure
  rw [Finset.sum_eq_single (MarkedState.advance chain source)]
  · simp [markedKernel, transitionProbability]
  · intro other _member other_ne
    simp [markedKernel, transitionProbability, other_ne]
  · simp

/-- One phase transition row is the same Dirac successor measure. -/
theorem phase_stepKernel_eq_dirac
    (chain : EpochChain universes first last)
    (source : Phase chain) :
    (phaseKernel chain).toMarkovExecutionKernel.stepKernel source =
      Measure.dirac
        (FiniteHeterogeneousProbability.advance chain source) := by
  change (phaseKernel chain).toKernel source =
    Measure.dirac
      (FiniteHeterogeneousProbability.advance chain source)
  rw [ReplayMarkovKernel.toKernel_apply]
  unfold ReplayMarkovKernel.stateMeasure
  rw [Finset.sum_eq_single
    (FiniteHeterogeneousProbability.advance chain source)]
  · simp [phaseKernel,
      FiniteHeterogeneousProbability.transitionProbability]
  · intro other _member other_ne
    simp [phaseKernel,
      FiniteHeterogeneousProbability.transitionProbability, other_ne]
  · simp

/--
At actual mathlib-kernel level, mapping a marked row to phases is the pullback
of the existing phase kernel along the source-state projection.
-/
theorem stepKernel_projects
    (chain : EpochChain universes first last) :
    ProbabilityTheory.Kernel.map
        (markedKernel chain).toMarkovExecutionKernel.stepKernel
        MarkedState.phase =
      ProbabilityTheory.Kernel.comap
        (phaseKernel chain).toMarkovExecutionKernel.stepKernel
        MarkedState.phase Measurable.of_discrete := by
  ext source
  rw [ProbabilityTheory.Kernel.map_apply _ Measurable.of_discrete]
  rw [ProbabilityTheory.Kernel.comap_apply]
  rw [marked_stepKernel_eq_dirac, phase_stepKernel_eq_dirac]
  simp

/-- Positive support forces each sampled marked edge to use `advance`. -/
theorem trajectory_ae_follows_marked_advance
    (chain : EpochChain universes first last) :
    ∀ᵐ path ∂
        (markedKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ n, path (n + 1) = MarkedState.advance chain (path n) := by
  filter_upwards
    [(markedKernel chain).trajectory_ae_positive_probability
      (initial chain)] with path positive
  intro n
  exact positive_target_eq_advance chain (positive n)

/-- The marked recurrence fixes both phases and all stored marks. -/
theorem marked_path_eq_atPhase
    (chain : EpochChain universes first last)
    (path : Nat → MarkedState chain)
    (starts : path 0 = initialState chain)
    (steps :
      ∀ n, path (n + 1) = MarkedState.advance chain (path n)) :
    ∀ n, path n = MarkedState.atPhase chain (phaseAt chain n) := by
  intro n
  induction n with
  | zero =>
      exact starts
  | succ n ih =>
      calc
        path (n + 1) =
            MarkedState.advance chain (path n) := steps n
        _ = MarkedState.advance chain
            (MarkedState.atPhase chain (phaseAt chain n)) := by rw [ih]
        _ = MarkedState.atPhase chain
            (FiniteHeterogeneousProbability.advance chain
              (phaseAt chain n)) := rfl
        _ = MarkedState.atPhase chain (phaseAt chain (n + 1)) := by
            rw [advance_phaseAt]

/-- Almost every marked trajectory is the exact canonical marked schedule. -/
theorem trajectory_ae_eq_marked_atPhase
    (chain : EpochChain universes first last) :
    ∀ᵐ path ∂
        (markedKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ n, path n = MarkedState.atPhase chain (phaseAt chain n) := by
  filter_upwards
    [(markedKernel chain).trajectory_ae_starts_at (initialState chain),
      trajectory_ae_follows_marked_advance chain] with path starts steps
  exact marked_path_eq_atPhase chain path starts steps

/--
Agreement carried by one sampled nonterminal edge.  The `mark` field contains
the actual native `ChainStep`; replay and epoch alignment are derived from
that same sampled value.
-/
structure SampledMarkedEdge
    (chain : EpochChain universes first last)
    (n : Nat) (before : n < eventCount chain)
    (source target : MarkedState chain) where
  mark : ChainStepMark chain
  kernelEvent : MarkedKernelEvent chain source target
  sourcePhase : source.phase = phaseAt chain n
  targetPhase : target.phase = phaseAt chain (n + 1)
  sampledMark : source.nextMark = some mark
  markIndex : mark.index.1 = n
  markEvent :
    mark.event =
      (traceEvents chain).get
        ⟨n, by simpa [eventCount] using before⟩
  eventReplay : EventReplay universes mark.event
  executionEpochAligned :
    ExecutionEpochAligned universes mark.event

/-- Build sampled-edge agreement from the exact marked schedule. -/
noncomputable def sampledMarkedEdge_of_schedule
    (chain : EpochChain universes first last)
    (path : Nat → MarkedState chain)
    (schedule :
      ∀ n, path n = MarkedState.atPhase chain (phaseAt chain n))
    (n : Nat) (before : n < eventCount chain) :
    SampledMarkedEdge chain n before (path n) (path (n + 1)) := by
  let index : Fin (traceEvents chain).length :=
    ⟨n, by simpa [eventCount] using before⟩
  let mark : ChainStepMark chain := canonicalMark chain index
  have phase_value :
      (phaseAt chain n).1 = n := by
    simp [phaseAt, Nat.min_eq_left (Nat.le_of_lt before)]
  have markAt_eq :
      markAt chain (phaseAt chain n) = some mark := by
    unfold markAt mark index
    simp only [phase_value, before, dif_pos]
  have sourceMark : (path n).nextMark = some mark := by
    rw [schedule]
    exact markAt_eq
  have target_eq :
      path (n + 1) = MarkedState.advance chain (path n) := by
    rw [schedule (n + 1), schedule n]
    apply MarkedState.ext
    exact (advance_phaseAt chain n).symm
  refine
    { mark := mark
      kernelEvent := .business mark sourceMark target_eq
      sourcePhase := by
        simpa using
          congrArg MarkedState.phase (schedule n)
      targetPhase := by
        simpa using
          congrArg MarkedState.phase (schedule (n + 1))
      sampledMark := sourceMark
      markIndex := ?_
      markEvent := ?_
      eventReplay := mark.eventReplay
      executionEpochAligned := mark.executionEpochAligned }
  · rfl
  · exact mark.event_eq

/--
Almost surely, every nonterminal sampled state contains exactly the
`traceEvents.get` mark at that phase, together with its native endpoints,
DPO/admission replay, and execution-epoch alignment.
-/
theorem sampled_marks_common_trajectory_almost_sure
    (chain : EpochChain universes first last) :
    ∀ᵐ path ∂
        (markedKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ (n : Nat) (before : n < eventCount chain),
        Nonempty
          (SampledMarkedEdge chain n before
            (path n) (path (n + 1))) := by
  filter_upwards [trajectory_ae_eq_marked_atPhase chain] with path schedule
  intro n before
  exact
    ⟨sampledMarkedEdge_of_schedule chain path schedule n before⟩

end Cantilune.Feedback.FiniteHeterogeneousMarkedKernel
