import Cantilune.Feedback.Probability

/-!
# Measure-theoretic hitting regression

This finite probability space checks the bridge theorem without pretending to
construct a stochastic `ExecutionPackage`.  The unique sample is unhit at
opportunity zero and hit from opportunity one onward.
-/

namespace Cantilune.Tests.ProbabilityHitting

open Filter MeasureTheory
open Cantilune.Feedback.Probability

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

private def miss : Nat → ℝ
  | 0 => 1
  | _ + 1 => 0

private def contract : TailProbabilityContract 1 where
  window := window
  missProbability := miss
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  miss_nonnegative := by
    intro n
    cases n <;> simp [miss]
  miss_initial := by simp [miss]
  miss_step := by
    intro n
    cases n <;> simp [miss]

private abbrev Ω := Fin 1

private instance : MeasurableSpace Ω := ⊤

private noncomputable def probability : Measure Ω :=
  Measure.dirac 0

private noncomputable instance : IsProbabilityMeasure probability := by
  unfold probability
  infer_instance

private def notHit : Nat → Set Ω
  | 0 => Set.univ
  | _ + 1 => ∅

private def bridge : HittingEventBridge probability contract where
  notHit := notHit
  measurable_notHit := by
    intro n
    cases n <;> simp [notHit]
  antitone_notHit := by
    intro n m hnm
    cases n with
    | zero =>
        exact Set.subset_univ _
    | succ n =>
        cases m with
        | zero => omega
        | succ m => simp [notHit]
  measure_notHit := by
    intro n
    cases n <;> simp [notHit, miss, probability, contract]

example :
    probability bridge.neverHit = 0 :=
  contract.measure_neverHit_zero probability bridge

example :
    ∀ᵐ ω ∂probability, bridge.EventuallyHits ω :=
  contract.feedback_almost_sure_hitting probability bridge

example (ω : Ω) :
    bridge.EventuallyHits ω := by
  refine ⟨1, ?_⟩
  intro m hm
  cases m with
  | zero => omega
  | succ m => simp [bridge, notHit]

end Cantilune.Tests.ProbabilityHitting
