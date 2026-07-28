import Cantilune.Feedback.Core

/-!
# Conditional probabilistic progress for finite-height feedback

This module deliberately separates three statements that are easy to conflate.

* `StableFairWindow` records the semantic side conditions: the signature is
  fixed after a declared epoch and observed opportunities continue forever.
* `TailProbabilityContract` records a *local* uniform progress hypothesis as
  the recurrence
  `miss (n + 1) ≤ (1 - ε) * miss n`, with `0 < ε ≤ 1`.
  The global geometric bound and convergence to zero are proved from that
  recurrence; neither is a field of the contract.
* `HittingEventBridge` identifies that tail with the measures of a decreasing
  family of measurable “not yet hit” events in an explicit probability space.
  Continuity from above then gives a null never-hit event and an almost-everywhere
  eventual-hitting theorem.
* `FiniteHeightProgressContract` gives one such waiting-time tail for each
  remaining strict evidence increase.  With the stronger no-gap
  `EpochwiseFair` field, its tail-sum expected epoch count is proved at most
  `height / ε`.

The index in these theorems counts eligible observed opportunities, not wall
clock epochs.  `EpochwiseFair` is the additional, explicit assumption under
which opportunities occur at every epoch after the stable-window boundary, so
the same numeric expectation bound can be read as an epoch bound.

No claim is made when the signature keeps changing, observed opportunities are
not cofinal, or no positive uniform `ε` is available.
-/

namespace Cantilune.Feedback.Probability

open Filter MeasureTheory
open scoped BigOperators Topology

/--
An infinite observed-opportunity schedule inside a stable-signature suffix.

`opportunityEpoch n` is the epoch at which opportunity `n` occurs.  Strict
monotonicity prevents duplicating one observation, while `cofinal` is the
fairness condition saying that opportunities do not stop.
-/
structure StableFairWindow where
  signatureVersion : Nat → Nat
  observed : Nat → Prop
  startEpoch : Nat
  opportunityEpoch : Nat → Nat
  signature_stable :
    ∀ offset, signatureVersion (startEpoch + offset) =
      signatureVersion startEpoch
  opportunity_after_start :
    ∀ n, startEpoch ≤ opportunityEpoch n
  opportunity_strictMono :
    StrictMono opportunityEpoch
  opportunity_observed :
    ∀ n, observed (opportunityEpoch n)
  cofinal :
    ∀ epoch, startEpoch ≤ epoch →
      ∃ n, epoch ≤ opportunityEpoch n

/--
The stronger schedule assumption needed to reinterpret an opportunity-count
bound as a post-window epoch-count bound.
-/
def EpochwiseFair (window : StableFairWindow) : Prop :=
  ∀ n, window.opportunityEpoch n = window.startEpoch + n

/--
A local conditional progress contract for the probability of still missing a
stable region after `n` eligible opportunities.

The recurrence is the tail form of the statement that every still-unstable
opportunity has conditional progress probability at least `ε`.  It is strictly
local: the geometric tail bound and its limit are derived below.
-/
structure TailProbabilityContract (ε : ℝ) where
  window : StableFairWindow
  missProbability : Nat → ℝ
  epsilon_pos : 0 < ε
  epsilon_le_one : ε ≤ 1
  miss_nonnegative : ∀ n, 0 ≤ missProbability n
  miss_initial : missProbability 0 ≤ 1
  miss_step :
    ∀ n, missProbability (n + 1) ≤
      (1 - ε) * missProbability n

/--
A measure-theoretic interpretation of an abstract miss-probability tail.

`notHit n` is the event that the stable region has not been reached after the
first `n` eligible opportunities.  These events must be measurable and
decrease with `n`.  The final field is the explicit bridge from the arithmetic
tail in `TailProbabilityContract` to event probabilities in `μ`.

This structure intentionally does not claim that `μ` or `notHit` arise from an
`ExecutionPackage` or a stochastic kernel.  Constructing such a bridge is a
separate, model-specific proof obligation.
-/
structure HittingEventBridge {Ω : Type*} [MeasurableSpace Ω]
    (μ : Measure Ω) [IsProbabilityMeasure μ] {ε : ℝ}
    (contract : TailProbabilityContract ε) where
  notHit : Nat → Set Ω
  measurable_notHit : ∀ n, MeasurableSet (notHit n)
  antitone_notHit : Antitone notHit
  measure_notHit :
    ∀ n, μ (notHit n) =
      ENNReal.ofReal (contract.missProbability n)

namespace HittingEventBridge

variable {Ω : Type*} [MeasurableSpace Ω]
  {μ : Measure Ω} [IsProbabilityMeasure μ] {ε : ℝ}
  {contract : TailProbabilityContract ε}
  (bridge : HittingEventBridge μ contract)

/-- The event that no finite eligible opportunity ever reaches the region. -/
def neverHit : Set Ω :=
  ⋂ n, bridge.notHit n

/--
A sample path eventually hits when, after some finite opportunity, it remains
outside every later `notHit` event.  Antitonicity makes this equivalent to
leaving one `notHit` event.
-/
def EventuallyHits (ω : Ω) : Prop :=
  ∃ n, ∀ m, n ≤ m → ω ∉ bridge.notHit m

theorem eventuallyHits_iff_not_mem_neverHit (ω : Ω) :
    bridge.EventuallyHits ω ↔ ω ∉ bridge.neverHit := by
  constructor
  · rintro ⟨n, leftAfter⟩ never
    exact leftAfter n le_rfl (Set.mem_iInter.mp never n)
  · intro never
    simp only [neverHit, Set.mem_iInter, not_forall] at never
    obtain ⟨n, leftAt⟩ := never
    refine ⟨n, fun m hnm inLater => leftAt ?_⟩
    exact bridge.antitone_notHit hnm inLater

end HittingEventBridge

namespace TailProbabilityContract

variable {ε : ℝ} (contract : TailProbabilityContract ε)
include contract

theorem one_sub_epsilon_nonnegative : 0 ≤ 1 - ε := by
  linarith [contract.epsilon_le_one]

theorem one_sub_epsilon_lt_one : 1 - ε < 1 := by
  linarith [contract.epsilon_pos]

/-- The local progress recurrence entails the global geometric tail bound. -/
theorem miss_le_geometric (n : Nat) :
    contract.missProbability n ≤ (1 - ε) ^ n := by
  induction n with
  | zero =>
      simpa using contract.miss_initial
  | succ n ih =>
      calc
        contract.missProbability (n + 1) ≤
            (1 - ε) * contract.missProbability n :=
          contract.miss_step n
        _ ≤ (1 - ε) * (1 - ε) ^ n :=
          mul_le_mul_of_nonneg_left ih
            contract.one_sub_epsilon_nonnegative
        _ = (1 - ε) ^ (n + 1) := by
          rw [pow_succ]
          ring

theorem geometric_tendsto_zero :
    Tendsto (fun n : Nat => (1 - ε) ^ n) atTop (𝓝 0) := by
  apply tendsto_pow_atTop_nhds_zero_of_abs_lt_one
  rw [abs_of_nonneg contract.one_sub_epsilon_nonnegative]
  exact contract.one_sub_epsilon_lt_one

/--
The recurrence on the abstract miss-probability sequence entails convergence
to zero.  This arithmetic result does not itself identify the sequence with a
hitting event in a probability space; that measure/execution bridge remains a
separate obligation.
-/
theorem tail_contract_tendsto_zero :
    Tendsto contract.missProbability atTop (𝓝 0) := by
  exact tendsto_of_tendsto_of_tendsto_of_le_of_le'
    tendsto_const_nhds
    contract.geometric_tendsto_zero
    (Filter.Eventually.of_forall contract.miss_nonnegative)
    (Filter.Eventually.of_forall contract.miss_le_geometric)

/--
The event of never reaching the stable region has measure zero.

This is continuity from above for the decreasing measurable `notHit` events,
combined with the geometric tail limit.  The probability-space bridge is an
explicit argument, so the theorem does not silently assume a stochastic
semantics for an execution package.
-/
theorem measure_neverHit_zero {Ω : Type*} [MeasurableSpace Ω]
    (μ : Measure Ω) [IsProbabilityMeasure μ]
    (bridge : HittingEventBridge μ contract) :
    μ bridge.neverHit = 0 := by
  have eventLimit :
      Tendsto (fun n => μ (bridge.notHit n)) atTop
        (𝓝 (μ bridge.neverHit)) := by
    exact tendsto_measure_iInter_atTop
      (fun n => (bridge.measurable_notHit n).nullMeasurableSet)
      bridge.antitone_notHit
      ⟨0, measure_ne_top μ (bridge.notHit 0)⟩
  have zeroLimit :
      Tendsto (fun n => μ (bridge.notHit n)) atTop (𝓝 0) := by
    have tailLimit :
        Tendsto
          (fun n =>
            ENNReal.ofReal (contract.missProbability n))
          atTop (𝓝 0) := by
      simpa using
        ENNReal.tendsto_ofReal contract.tail_contract_tendsto_zero
    exact Tendsto.congr'
      (Filter.Eventually.of_forall
        (fun n => (bridge.measure_notHit n).symm))
      tailLimit
  exact tendsto_nhds_unique eventLimit zeroLimit

/--
Almost every sample path reaches the stable region after finitely many
eligible opportunities and stays outside all later miss events.
-/
theorem feedback_almost_sure_hitting {Ω : Type*} [MeasurableSpace Ω]
    (μ : Measure Ω) [IsProbabilityMeasure μ]
    (bridge : HittingEventBridge μ contract) :
    ∀ᵐ ω ∂μ, bridge.EventuallyHits ω := by
  rw [MeasureTheory.ae_iff]
  have neverHitZero := contract.measure_neverHit_zero μ bridge
  simpa only [
    HittingEventBridge.eventuallyHits_iff_not_mem_neverHit,
    Classical.not_not,
    Set.setOf_mem_eq
  ] using neverHitZero

theorem geometric_summable :
    Summable (fun n : Nat => (1 - ε) ^ n) := by
  apply summable_geometric_of_abs_lt_one
  rw [abs_of_nonneg contract.one_sub_epsilon_nonnegative]
  exact contract.one_sub_epsilon_lt_one

theorem miss_summable : Summable contract.missProbability := by
  exact Summable.of_nonneg_of_le
    contract.miss_nonnegative
    contract.miss_le_geometric
    contract.geometric_summable

/--
The tail-sum expectation of one strict-progress waiting phase is at most
`1 / ε`.
-/
theorem miss_tsum_le_inv :
    ∑' n : Nat, contract.missProbability n ≤ ε⁻¹ := by
  calc
    ∑' n : Nat, contract.missProbability n
        ≤ ∑' n : Nat, (1 - ε) ^ n :=
      Summable.tsum_le_tsum
        contract.miss_le_geometric
        contract.miss_summable
        contract.geometric_summable
    _ = ε⁻¹ := by
      rw [tsum_geometric_of_abs_lt_one]
      · ring_nf
      · rw [abs_of_nonneg contract.one_sub_epsilon_nonnegative]
        exact contract.one_sub_epsilon_lt_one

end TailProbabilityContract

/--
One waiting-time tail for every remaining strict increase in a finite-height
evidence order.  The phases may have different tail functions, but share the
same stable-signature/fair-observation window and the same positive lower
bound `ε`.
-/
structure FiniteHeightProgressContract (height : Nat) (ε : ℝ) where
  window : StableFairWindow
  /--
  The `H / ε` bound below is an epoch bound only under this no-gap
  strengthening of qualitative fairness.
  -/
  epochwise_fair : EpochwiseFair window
  epsilon_pos : 0 < ε
  epsilon_le_one : ε ≤ 1
  phaseMissProbability : Fin height → Nat → ℝ
  phase_nonnegative :
    ∀ phase n, 0 ≤ phaseMissProbability phase n
  phase_initial :
    ∀ phase, phaseMissProbability phase 0 ≤ 1
  phase_step :
    ∀ phase n, phaseMissProbability phase (n + 1) ≤
      (1 - ε) * phaseMissProbability phase n

namespace FiniteHeightProgressContract

variable {height : Nat} {ε : ℝ}
  (contract : FiniteHeightProgressContract height ε)

/-- View one remaining evidence increase as a single-phase tail contract. -/
def phaseContract (phase : Fin height) : TailProbabilityContract ε where
  window := contract.window
  missProbability := contract.phaseMissProbability phase
  epsilon_pos := contract.epsilon_pos
  epsilon_le_one := contract.epsilon_le_one
  miss_nonnegative := contract.phase_nonnegative phase
  miss_initial := contract.phase_initial phase
  miss_step := contract.phase_step phase

/--
Tail-sum expected number of post-window epochs spent across all remaining
strict evidence increases.  `epochwise_fair` identifies the opportunity index
used by each phase tail with the post-window epoch index.
-/
noncomputable def expectedEpochCount : ℝ :=
  ∑ phase : Fin height,
    ∑' n : Nat, contract.phaseMissProbability phase n

/--
Arithmetic tail-sum bound for the declared phase sequences.  The
`epochwise_fair` field records the intended epoch interpretation, but this
proof does not yet connect those sequences to a stochastic execution kernel.
-/
theorem expectedEpochCount_le :
    contract.expectedEpochCount ≤ (height : ℝ) / ε := by
  calc
    contract.expectedEpochCount
        ≤ ∑ _phase : Fin height, ε⁻¹ := by
      apply Finset.sum_le_sum
      intro phase _phase_mem
      exact (contract.phaseContract phase).miss_tsum_le_inv
    _ = (height : ℝ) / ε := by
      simp [div_eq_mul_inv]

end FiniteHeightProgressContract

end Cantilune.Feedback.Probability
