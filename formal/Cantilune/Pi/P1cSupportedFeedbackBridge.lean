import Cantilune.Feedback.AuthorizedVoting
import Cantilune.Feedback.Execution
import Cantilune.Pi.P1cAdmittedTrajectory

/-!
# Feedback semantics for the positive P1c execution support

The stochastic P1c wrapper contains a zero-mass administrative reset solely
to totalize an event selector.  That reset moves `completed` back to
`pending`, so it cannot be interpreted by the monotone evidence semantics.

This module separates the two facts:

* the positive operational support (business progress followed by completed
  external holds) has a concrete `ExecutionPackage` and
  `ExecutionFeedbackBridge`; and
* the totalized LTS cannot carry a feedback map that assigns evidence levels
  zero and one to pending and completed while commuting with every native step.

Thus zero probability is not used to excuse a false pathwise theorem.
-/

noncomputable section

namespace Cantilune.Pi.P1cSupportedFeedbackBridge

open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedTrajectory

variable {σ : FinSignature}

/-- Observable LTS containing exactly the positive-probability support. -/
def supportedLTS (occurrence : Occurrence σ) : ObservableLTS where
  State := Bool
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid Bool
  step := SupportedStep
  observable := fun _ => True
  success := fun _ => False
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

theorem supported_business (occurrence : Occurrence σ) :
    (supportedLTS occurrence).ObservableStep false .business true :=
  ⟨SupportedStep.business, trivial⟩

theorem supported_completed_hold (occurrence : Occurrence σ) :
    (supportedLTS occurrence).ObservableStep
      true .completedExternalHold true :=
  ⟨SupportedStep.completedHold, trivial⟩

/--
Execution package for the actual stochastic support.  Its records and replay
kernel are the same verified records used by the total sampling wrapper.
-/
def supportedPackage (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := supportedLTS occurrence
  configOf := configOf occurrence
  replayKernel := replayKernel occurrence
  eventRecord := verifiedRecord occurrence
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨native, observed⟩
    cases native with
    | business =>
        exact
          (verifiedRecord occurrence .business).replays_recorded
    | completedHold =>
        exact
          (verifiedRecord occurrence .completedExternalHold).replays_recorded
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := fun state =>
    (configOf occurrence state).resourceTokens = ∅
  sessionsQuiescent := fun state =>
    (configOf occurrence state).names = ∅
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by simp
      epoch_preserved := by simp }

/-- Reference authorization/quorum configuration for one observed subject. -/
def feedbackSystem : FeedbackSystem Unit Unit 1 where
  quorum := 1
  quorum_le_observers := by native_decide
  authorized := fun _ _ => True
  authorized_decidable := by
    intro observer subject
    infer_instance

/-- Evidence level zero for pending, level one for completed. -/
def evidence : Bool → Evidence 1
  | false => ⟨0, by omega⟩
  | true => ⟨1, by omega⟩

def feedbackState (state : Bool) : FeedbackState 1 where
  evidence := evidence state
  accepted := false

/-- Business raises evidence; the supported external hold is evidence-neutral. -/
def feedbackEvent : Event → FeedbackEvent 1 Unit
  | .business => .evidence ⟨1, by omega⟩
  | .pendingExternalHold
  | .completedExternalHold
  | .nullPathAdministrativeReset => .evidence ⟨0, by omega⟩

/-- Concrete pathwise feedback interpretation of the positive support. -/
def bridge (occurrence : Occurrence σ) :
    ExecutionFeedbackBridge σ Unit Unit 1 Unit where
  package := supportedPackage occurrence
  feedbackSystem := feedbackSystem
  stateMap := feedbackState
  eventMap := feedbackEvent
  step_commutes := by
    intro source event target step
    rcases step with ⟨native, observed⟩
    cases native <;>
      rfl

/-- The stochastic stable predicate is exactly the evidence stable region. -/
theorem stable_iff_evidence_stable (state : Bool) :
    stable state = true ↔
      (feedbackState state).evidence.StableRegion 1 := by
  cases state <;>
    norm_num [stable, feedbackState, evidence, Evidence.StableRegion]

/-- The admitted business event is a strict qualitative evidence increase. -/
theorem business_strict_progress :
    Productive (feedbackState false) (feedbackEvent .business) := by
  norm_num [Productive, feedbackState, feedbackEvent, evidence,
    applyEvent, Evidence.sup]

/-- The completed external hold preserves hard stability. -/
theorem completed_hold_preserves_hard_stable :
    (applyEvent
      (feedbackState true)
      (feedbackEvent .completedExternalHold)).evidence =
        (feedbackState true).evidence :=
  rfl

/-- Every feedback event is monotone in evidence level. -/
theorem applyEvent_evidence_monotone
    {height : Nat} {Payload : Type}
    (state : FeedbackState height)
    (event : FeedbackEvent height Payload) :
    state.evidence.level ≤ (applyEvent state event).evidence.level := by
  cases event with
  | evidence delta =>
      exact Evidence.level_le_sup state.evidence delta
  | externalAccept payload =>
      exact le_rfl
  | externalReject payload =>
      exact le_rfl

/--
The zero-mass totalizer cannot be included in a pathwise monotone feedback
bridge with the intended pending/completed evidence interpretation.
-/
theorem no_totalized_feedback_map
    (occurrence : Occurrence σ)
    (stateMap : Bool → FeedbackState 1)
    (eventMap : Event → FeedbackEvent 1 Unit)
    (commutes :
      ∀ {source event target},
        (lts occurrence).ObservableStep source event target →
          stateMap target = applyEvent (stateMap source) (eventMap event))
    (pendingLevel : (stateMap false).evidence.level = 0)
    (completedLevel : (stateMap true).evidence.level = 1) :
    False := by
  have resetEquality :=
    commutes (native_null_reset occurrence)
  have monotone :=
    applyEvent_evidence_monotone
      (stateMap true) (eventMap .nullPathAdministrativeReset)
  have endpointLevel :
      (stateMap false).evidence.level =
        (applyEvent
          (stateMap true)
          (eventMap .nullPathAdministrativeReset)).evidence.level :=
    congrArg (fun state => state.evidence.level) resetEquality
  omega

end Cantilune.Pi.P1cSupportedFeedbackBridge
