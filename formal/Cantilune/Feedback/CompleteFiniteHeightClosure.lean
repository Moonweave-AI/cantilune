import Cantilune.Feedback.AuthorizedFeedbackClosure
import Cantilune.Feedback.KernelFiniteHeightProgress
import Cantilune.Feedback.PositiveEventTrajectory

/-!
# Complete finite-height feedback closure

This module combines the deterministic and probabilistic feedback theorems
without turning product-specific operating facts into axioms.

`FiniteHeightFeedbackClosure` records one finite-height join-evidence model,
one replayable execution package, and one finite native Markov kernel.  The
same kernel supplies:

* every phase tail used in the `H / epsilon` expectation bound;
* the Ionescu--Tulcea path law used for almost-sure hitting; and
* the positive event labelling used for exact `DPOEvent` replay and epoch
  alignment.

The package keeps the local progress, stable-window, fairness, and positive
`epsilon` assumptions explicit.  It does not claim those facts for a
production package.
-/

noncomputable section

namespace Cantilune.Feedback.CompleteFiniteHeightClosure

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete

variable {signature : FinSignature}
variable {EvidenceState : Type} [SemilatticeSup EvidenceState]
variable {State : Type} [Fintype State] [DecidableEq State]
variable {epsilon : Real}

/--
All load-bearing premises for finite-height feedback over one native
execution/kernel pair.

`hittingPhase` identifies the phase whose Boolean stable predicate is exactly
the declared upward-closed evidence region.  The remaining phases are local
waiting phases used by the finite-height expectation decomposition.
-/
structure FiniteHeightFeedbackClosure
    (signature : FinSignature)
    (EvidenceState : Type) [SemilatticeSup EvidenceState]
    (State : Type) [Fintype State] [DecidableEq State]
    (epsilon : Real) where
  package : ExecutionPackage signature
  evidenceOrder : RankedJoinEvidence EvidenceState
  stableRegion : RankedJoinEvidence.StableRegion EvidenceState
  stateEvidence : package.lts.State → EvidenceState
  evidence_monotone :
    ∀ {source event target},
      package.lts.ObservableStep source event target →
      stateEvidence source ≤ stateEvidence target
  kernel : NativeMarkovKernel signature package State
  progress :
    KernelFiniteHeightProgress kernel evidenceOrder.height epsilon
  hittingPhase : Fin evidenceOrder.height
  hitting_stable_iff :
    ∀ state,
      (progress.phase hittingPhase).stable state = true ↔
        stableRegion.holds (stateEvidence (kernel.stateEquiv state))
  labelling : PositiveEventLabelling kernel
  alignment :
    PositiveEpochKernelAlignment labelling progress.window

namespace FiniteHeightFeedbackClosure

variable
    (closure :
      FiniteHeightFeedbackClosure
        signature EvidenceState State epsilon)

/--
The deterministic hard layer: every finite list of legal join updates keeps
an already stable evidence value in the upward-closed stable region.
-/
theorem hard_forward_invariant
    (initial : EvidenceState) (deltas : List EvidenceState)
    (stable : closure.stableRegion.holds initial) :
    closure.stableRegion.holds
      (RankedJoinEvidence.accumulate initial deltas) :=
  feedback_stable_set closure.evidenceOrder closure.stableRegion
    initial deltas stable

/-- Every native execution step is monotone in the declared evidence order. -/
theorem native_step_evidence_monotone
    {source target : closure.package.lts.State}
    {event : closure.package.lts.Event}
    (step : closure.package.lts.ObservableStep source event target) :
    closure.stateEvidence source ≤ closure.stateEvidence target :=
  closure.evidence_monotone step

/--
Every positive kernel edge is evidence-monotone because its selected label is
a genuine native step of the same execution package.
-/
theorem positive_edge_evidence_monotone
    {source target : State}
    (positive : 0 < closure.kernel.probability source target) :
    closure.stateEvidence (closure.kernel.stateEquiv source) ≤
      closure.stateEvidence (closure.kernel.stateEquiv target) :=
  closure.evidence_monotone (closure.labelling.native positive)

/-- Evidence is monotone along every positive-mass state path. -/
theorem positive_path_evidence_monotone
    (path : PositiveStatePath closure.kernel) :
    Monotone
      (fun n =>
        closure.stateEvidence
          (closure.kernel.stateEquiv (path.state n))) := by
  intro first second firstLeSecond
  induction firstLeSecond with
  | refl =>
      exact le_rfl
  | @step second firstLeSecond ih =>
      exact ih.trans
        (closure.positive_edge_evidence_monotone
          (path.positive second))

/-- The declared stable evidence region persists along a positive path. -/
theorem positive_path_stable_persistent
    (path : PositiveStatePath closure.kernel)
    {first second : Nat} (firstLeSecond : first ≤ second)
    (stable :
      closure.stableRegion.holds
        (closure.stateEvidence
          (closure.kernel.stateEquiv (path.state first)))) :
    closure.stableRegion.holds
      (closure.stateEvidence
        (closure.kernel.stateEquiv (path.state second))) :=
  closure.stableRegion.upward_closed
    (closure.positive_path_evidence_monotone path firstLeSecond)
    stable

/--
The existing epoch ranking bounds every finite all-internal path by its
initial rank.
-/
theorem internal_path_length_le
    {source target : closure.package.lts.State}
    {events : List closure.package.lts.Event}
    (path : closure.package.lts.Path source events target)
    (allInternal : events.Forall closure.package.ranking.internal) :
    events.length ≤ closure.package.ranking.rank source :=
  InternalRanking.internal_path_length_le
    closure.package.ranking path allInternal

/-- Internal paths stay within one epoch. -/
theorem internal_path_epoch_preserved
    {source target : closure.package.lts.State}
    {events : List closure.package.lts.Event}
    (path : closure.package.lts.Path source events target)
    (allInternal : events.Forall closure.package.ranking.internal) :
    closure.package.ranking.epoch target =
      closure.package.ranking.epoch source :=
  InternalRanking.internal_path_epoch_preserved
    closure.package.ranking path allInternal

/-- A natural-valued strict epoch rank rules out infinite internal oscillation. -/
theorem no_internal_oscillation
    (trace : InfiniteExecution closure.package.lts)
    (allInternal :
      ∀ n, closure.package.ranking.internal (trace.event n)) :
    False :=
  Cantilune.Feedback.no_infinite_internal_oscillation
    closure.package.ranking trace allInternal

/--
Every declared phase has an Ionescu--Tulcea almost-sure hitting theorem
generated from the same finite native kernel.
-/
theorem phase_almost_sure_hitting
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (index : Fin closure.evidenceOrder.height) :
    ∀ᵐ path ∂
        closure.kernel.toMarkovExecutionKernel.trajectoryMeasure
          (closure.progress.initial index).toMeasure,
      HittingEventBridge.EventuallyHits
        (closure.progress.phase index).toKernelProgressAssumption.hittingBridge
        path :=
  (closure.progress.phase index).finite_kernel_feedback_almost_sure_hitting

/--
The phase-tail expectation is kernel-derived and bounded by `H / epsilon`.
Epochwise fairness is a field of `closure.progress`, so the opportunity count
has the declared post-window epoch interpretation.
-/
theorem expected_epoch_count_le :
    closure.progress.expectedKernelEpochCount ≤
      (closure.evidenceOrder.height : Real) / epsilon :=
  closure.progress.expectedKernelEpochCount_le

/-- Eventual permanent membership in the declared evidence-stable region. -/
def EventuallyInStableRegion (path : Nat → State) : Prop :=
  ∃ first, ∀ second, first ≤ second →
    closure.stableRegion.holds
      (closure.stateEvidence
        (closure.kernel.stateEquiv (path second)))

/--
For a positive path, hitting the distinguished phase is not a transient
visit: phase stability is the declared evidence region, native edges are
evidence-monotone, and the region is upward closed.
-/
theorem hitting_implies_eventually_stable
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (path : PositiveStatePath closure.kernel)
    (hits :
      HittingEventBridge.EventuallyHits
        (closure.progress.phase closure.hittingPhase
          ).toKernelProgressAssumption.hittingBridge
        path.state) :
    closure.EventuallyInStableRegion path.state := by
  rcases hits with ⟨bound, missesAfterBound⟩
  have notMissesAtBound := missesAfterBound bound le_rfl
  have hitByBound :
      ∃ first, first ≤ bound ∧
        (closure.progress.phase closure.hittingPhase).stable
          (path.state first) = true := by
    by_contra noHit
    push Not at noHit
    apply notMissesAtBound
    change
      ∀ first, first ≤ bound →
        ¬(closure.progress.phase closure.hittingPhase).stable
          (path.state first) = true
    exact noHit
  rcases hitByBound with ⟨first, _firstLeBound, phaseStable⟩
  refine ⟨first, ?_⟩
  intro second firstLeSecond
  exact closure.positive_path_stable_persistent path firstLeSecond
    ((closure.hitting_stable_iff (path.state first)).mp phaseStable)

/--
One phase-level common-trajectory proposition.  It requires simultaneous:

* kernel-derived stable-set hitting;
* a positive-mass state path with exactly the sampled states;
* selected native event identity and exact `DPOEvent` replay; and
* stable-window epoch/signature alignment.
-/
def PhaseCompleteTrajectory
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (index : Fin closure.evidenceOrder.height) : Prop :=
  ∀ᵐ rawPath ∂
      closure.kernel.toMarkovExecutionKernel.trajectoryMeasure
        (closure.progress.initial index).toMeasure,
    HittingEventBridge.EventuallyHits
        (closure.progress.phase index).toKernelProgressAssumption.hittingBridge
        rawPath ∧
      (index = closure.hittingPhase →
        closure.EventuallyInStableRegion rawPath) ∧
      ∃ path : PositiveStatePath closure.kernel,
        path.state = rawPath ∧
          Nonempty (closure.labelling.TrajectoryAgreement path) ∧
          Nonempty
            (EpochAlignedTrajectory closure.progress.window
              (closure.labelling.decorate path))

/--
Almost every phase trajectory carries one common witness for hitting, event
labels, exact replay, and epoch alignment.  No state-only coupling premise is
accepted from callers.
-/
theorem phase_complete_trajectory
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (index : Fin closure.evidenceOrder.height) :
    closure.PhaseCompleteTrajectory index := by
  filter_upwards
    [closure.phase_almost_sure_hitting index,
      replayable_epoch_aligned_trajectory_exists_almost_surely
        closure.labelling (closure.progress.initial index)
        closure.alignment] with
      rawPath hits common
  rcases common with
    ⟨path, stateEquality, agreement, epochAlignment⟩
  have eventualStable :
      index = closure.hittingPhase →
        closure.EventuallyInStableRegion rawPath := by
    intro indexEq
    subst index
    have pathHits :
        HittingEventBridge.EventuallyHits
          (closure.progress.phase closure.hittingPhase
            ).toKernelProgressAssumption.hittingBridge
          path.state := by
      rw [stateEquality]
      exact hits
    rw [← stateEquality]
    exact closure.hitting_implies_eventually_stable path pathHits
  exact
    ⟨hits, eventualStable, path, stateEquality, agreement, epochAlignment⟩

/--
Central probabilistic closure theorem: conditional almost-sure hitting is
coupled to native event identity, exact replay, and epoch alignment.
-/
theorem feedback_almost_sure_hitting_with_replay
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (index : Fin closure.evidenceOrder.height) :
    closure.PhaseCompleteTrajectory index :=
  closure.phase_complete_trajectory index

end FiniteHeightFeedbackClosure

/-! ## Concrete five-state authorized reference inhabitant -/

namespace AuthorizedReference

open Cantilune.Feedback.AuthorizedFeedbackExecution
open Cantilune.Feedback.AuthorizedFeedbackProbability

abbrev ReferenceState :=
  Cantilune.Feedback.AuthorizedFeedbackExecution.State

local instance : MeasurableSpace ReferenceState := ⊤

/-- A three-point evidence carrier with qualitative height two. -/
abbrev ReferenceEvidence := Fin 3

def evidenceOrder : RankedJoinEvidence ReferenceEvidence where
  height := 2
  rank := Fin.val
  rank_bounded := by
    intro evidence
    omega
  rank_strict := by
    intro less more strict
    exact strict

/-- The reference stable region is the approval-or-higher evidence upset. -/
def stableRegion :
    RankedJoinEvidence.StableRegion ReferenceEvidence where
  holds evidence := 1 ≤ evidence.val
  upward_closed := by
    intro less more lessMore stable
    exact stable.trans lessMore

/-- Evidence grades of the five authorized feedback states. -/
def stateEvidence : ReferenceState → ReferenceEvidence
  | .empty => ⟨0, by omega⟩
  | .approval => ⟨1, by omega⟩
  | .conflict => ⟨2, by omega⟩
  | .accepted => ⟨2, by omega⟩
  | .rejected => ⟨2, by omega⟩

theorem native_evidence_monotone
    {source target : ReferenceState}
    {event :
      Cantilune.Feedback.AuthorizedFeedbackExecution.Event}
    (step : lts.ObservableStep source event target) :
    stateEvidence source ≤ stateEvidence target := by
  rcases step with ⟨native, _observable⟩
  cases native <;> decide

theorem first_phase_stable_iff
    (signature : FinSignature) (state : ReferenceState) :
    (phaseProgress signature 0).stable state = true ↔
      stableRegion.holds (stateEvidence state) := by
  cases state <;>
    simp [phaseProgress, phaseStable, stableRegion, stateEvidence]

/--
The nonempty reference closure uses the already replayable five-state package,
its deterministic native kernel, its two genuine progress phases, and its
positive event labels.
-/
def closure (signature : FinSignature) :
    FiniteHeightFeedbackClosure
      signature ReferenceEvidence ReferenceState (1 : Real) where
  package := package signature
  evidenceOrder := evidenceOrder
  stableRegion := stableRegion
  stateEvidence := stateEvidence
  evidence_monotone := native_evidence_monotone
  kernel := kernel signature
  progress := twoPhaseProgress signature
  hittingPhase := ⟨0, by simp [evidenceOrder]⟩
  hitting_stable_iff := first_phase_stable_iff signature
  labelling := positiveLabelling signature
  alignment := positiveAlignment signature

/--
A concrete witness stores the common event/replay/epoch trajectory theorem,
the hard closure theorem, the kernel expectation bound, and the internal
non-oscillation theorem for the same canonical closure.
-/
structure Witness (signature : FinSignature) where
  core :
    FiniteHeightFeedbackClosure
      signature ReferenceEvidence ReferenceState (1 : Real)
  canonical : core = closure signature
  hard_stable :
    core.stableRegion.holds
      (RankedJoinEvidence.accumulate
        (stateEvidence .conflict) ([] : List ReferenceEvidence))
  expected_epochs :
    core.progress.expectedKernelEpochCount ≤ 2
  complete_trajectory :
    ∀ index : Fin core.evidenceOrder.height,
      core.PhaseCompleteTrajectory index
  no_internal_oscillation :
    ∀ trace : InfiniteExecution core.package.lts,
      (∀ n, core.package.ranking.internal (trace.event n)) →
        False

def witness (signature : FinSignature) : Witness signature where
  core := closure signature
  canonical := rfl
  hard_stable := by
    norm_num [closure, stableRegion, stateEvidence,
      RankedJoinEvidence.accumulate]
  expected_epochs := by
    simpa [closure, evidenceOrder] using
      expected_kernel_epochs_le_two signature
  complete_trajectory := by
    intro index
    exact (closure signature).phase_complete_trajectory index
  no_internal_oscillation := by
    intro trace allInternal
    exact (closure signature).no_internal_oscillation trace allInternal

theorem witness_nonempty (signature : FinSignature) :
    Nonempty (Witness signature) :=
  ⟨witness signature⟩

end AuthorizedReference

end Cantilune.Feedback.CompleteFiniteHeightClosure
