import Cantilune.Pi.P1cAdmittedOperations
import Cantilune.Feedback.EventTrajectoryMeasure
import Cantilune.Feedback.EventTrajectorySupport

/-!
# Event/epoch trajectory bridge for admitted P1c operations

For any admitted mismatch, reconnect, or quiescent-delete occurrence, this
module constructs a genuine two-state execution package and deterministic
Markov kernel:

* the pending-to-completed transition is exactly the admitted business event;
* completed-state diagonal mass is carried by an explicit external hold;
* the pending hold and administrative null-path reset only totalise the event
  selector on zero-probability state pairs and are never business events; and
* every event record is verified by a package kernel which delegates business
  replay to `P1cAdmittedOperations.replayKernel`.

The LTS in this file is an auxiliary total sampling wrapper, not the source
rule LTS. The administrative reset is present solely because `TotalNativeLabelling`
requires a native event for every ordered state pair, including null paths.
Its transition probability is proved zero.  It is not a source rule and is
not used in the stochastic execution from the declared initial state.
`SupportedStep` below isolates exactly the positive-probability operational
support, so the totalizer cannot be mistaken for a reflected source rule.
-/

noncomputable section

namespace Cantilune.Pi.P1cAdmittedTrajectory

open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Pi.P1cAdmittedOperations
open MeasureTheory

variable {σ : FinSignature}

/-- Event identities are disjoint; no hold event can be confused with a rule. -/
inductive Event where
  | business
  | pendingExternalHold
  | completedExternalHold
  | nullPathAdministrativeReset
  deriving DecidableEq, Repr

inductive EventRole where
  | sourceRule
  | externalWait
  | nullPathTotalizer
  deriving DecidableEq, Repr

def Event.role : Event → EventRole
  | .business => .sourceRule
  | .pendingExternalHold | .completedExternalHold => .externalWait
  | .nullPathAdministrativeReset => .nullPathTotalizer

@[simp] theorem pending_hold_not_business :
    Event.pendingExternalHold.role ≠ .sourceRule := by decide

@[simp] theorem completed_hold_not_business :
    Event.completedExternalHold.role ≠ .sourceRule := by decide

@[simp] theorem reset_not_business :
    Event.nullPathAdministrativeReset.role ≠ .sourceRule := by decide

/-- Native package transitions, independently of the stochastic matrix. -/
inductive NativeStep : Bool → Event → Bool → Prop where
  | business : NativeStep false .business true
  | pendingHold : NativeStep false .pendingExternalHold false
  | completedHold : NativeStep true .completedExternalHold true
  | nullReset : NativeStep true .nullPathAdministrativeReset false

/-- False is pending and true is completed. -/
def lts (occurrence : Occurrence σ) : ObservableLTS where
  State := Bool
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid Bool
  step := NativeStep
  observable := fun _ => True
  -- This auxiliary sampler has an infinite external hold after completion.
  -- It is productive, rather than normally terminated.
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

theorem native_business (occurrence : Occurrence σ) :
    (lts occurrence).ObservableStep false .business true :=
  ⟨NativeStep.business, trivial⟩

theorem native_pending_hold (occurrence : Occurrence σ) :
    (lts occurrence).ObservableStep
      false .pendingExternalHold false :=
  ⟨NativeStep.pendingHold, trivial⟩

theorem native_completed_hold (occurrence : Occurrence σ) :
    (lts occurrence).ObservableStep
      true .completedExternalHold true :=
  ⟨NativeStep.completedHold, trivial⟩

theorem native_null_reset (occurrence : Occurrence σ) :
    (lts occurrence).ObservableStep
      true .nullPathAdministrativeReset false :=
  ⟨NativeStep.nullReset, trivial⟩

theorem NativeStep.business_endpoints {source target : Bool}
    (step : NativeStep source .business target) :
    source = false ∧ target = true := by
  cases step
  exact ⟨rfl, rfl⟩

/--
The operational support of the stochastic kernel.  It contains the admitted
business event and the productive external hold, but neither zero-mass
totalizer.
-/
inductive SupportedStep : Bool → Event → Bool → Prop where
  | business : SupportedStep false .business true
  | completedHold : SupportedStep true .completedExternalHold true

def configOf (occurrence : Occurrence σ) : Bool → Config σ
  | false => occurrence.source
  | true => occurrence.target

@[simp] theorem configOf_signatureVersion
    (occurrence : Occurrence σ) (state : Bool) :
    (configOf occurrence state).signatureVersion =
      occurrence.source.signatureVersion := by
  cases state
  · rfl
  · change
      (applyRequest occurrence.source occurrence.request).signatureVersion =
        occurrence.source.signatureVersion
    cases occurrence.request <;> rfl

private def pendingHoldRule : Nat := 90
private def completedHoldRule : Nat := 91
private def nullResetRule : Nat := 92

private theorem request_rule_ne_pending (request : Request) :
    request.ruleId ≠ pendingHoldRule := by
  cases request <;> norm_num [Request.ruleId, pendingHoldRule]

private theorem request_rule_ne_completed (request : Request) :
    request.ruleId ≠ completedHoldRule := by
  cases request <;> norm_num [Request.ruleId, completedHoldRule]

private theorem request_rule_ne_reset (request : Request) :
    request.ruleId ≠ nullResetRule := by
  cases request <;> norm_num [Request.ruleId, nullResetRule]

private def adminRecipeConsistent
    (recipe : DPOEvent.ReplayRecipe σ) (source : Config σ)
    (ruleId evidence : Nat) (kind : EventKind) : Prop :=
  recipe.signatureVersion = source.signatureVersion ∧
  recipe.ruleId = ruleId ∧
  recipe.matchDomainSize = 0 ∧
  recipe.matchCodomainSize = 0 ∧
  recipe.complementTag = ruleId ∧
  recipe.freshNames = ∅ ∧
  recipe.policyEvidence = [source.policyState] ∧
  recipe.externalEvidence = [evidence] ∧
  recipe.kind = kind ∧
  embeddingValues recipe.matchEmbedding = []

private instance (recipe : DPOEvent.ReplayRecipe σ) (source : Config σ)
    (ruleId evidence : Nat) (kind : EventKind) :
    Decidable (adminRecipeConsistent recipe source ruleId evidence kind) := by
  unfold adminRecipeConsistent
  infer_instance

/--
The package kernel preserves the real admitted-operation replay path.
Administrative rules have distinct identifiers and explicit semantics.
-/
def replayKernel (occurrence : Occurrence σ) : DPOEvent.ReplayKernel σ where
  run := fun recipe source =>
    if _pending : recipe.ruleId = pendingHoldRule then
      if adminRecipeConsistent recipe source pendingHoldRule 0 .external then
        some source
      else none
    else if _completed : recipe.ruleId = completedHoldRule then
      if adminRecipeConsistent recipe source completedHoldRule 1 .external then
        some source
      else none
    else if _reset : recipe.ruleId = nullResetRule then
      if adminRecipeConsistent recipe source nullResetRule 2
          .administrative then
        some occurrence.source
      else none
    else
      P1cAdmittedOperations.replayKernel.run recipe source

private def identityRecord (occurrence : Occurrence σ)
    (state : Bool) (ruleId evidence : Nat) : DPOEvent σ where
  signatureVersion := occurrence.source.signatureVersion
  ruleId := ruleId
  source := configOf occurrence state
  target := configOf occurrence state
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := Function.Embedding.refl (Fin 0)
  complementTag := ruleId
  freshNames := ∅
  policyEvidence := [(configOf occurrence state).policyState]
  externalEvidence := [evidence]
  kind := .external
  sourceVersion := configOf_signatureVersion occurrence state
  targetVersion := configOf_signatureVersion occurrence state
  freshForSource := by simp
  sourceWellFormed := by
    cases state
    · exact occurrence.source_wellFormed
    · exact occurrence.target_wellFormed
  targetWellFormed := by
    cases state
    · exact occurrence.source_wellFormed
    · exact occurrence.target_wellFormed

private def resetRecord (occurrence : Occurrence σ) : DPOEvent σ where
  signatureVersion := occurrence.source.signatureVersion
  ruleId := nullResetRule
  source := occurrence.target
  target := occurrence.source
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := Function.Embedding.refl (Fin 0)
  complementTag := nullResetRule
  freshNames := ∅
  policyEvidence := [occurrence.target.policyState]
  externalEvidence := [2]
  kind := .administrative
  sourceVersion := by
    change
      (applyRequest occurrence.source occurrence.request).signatureVersion =
        occurrence.source.signatureVersion
    cases occurrence.request <;> rfl
  targetVersion := rfl
  freshForSource := by simp
  sourceWellFormed := occurrence.target_wellFormed
  targetWellFormed := occurrence.source_wellFormed

def verifiedRecord (occurrence : Occurrence σ) :
    Event → DPOEvent.Verified (replayKernel occurrence)
  | .business =>
      { event := P1cAdmittedOperations.event occurrence
        replay_correct := by
          have core :
              P1cAdmittedOperations.replayKernel.run
                  (P1cAdmittedOperations.event occurrence).replayRecipe
                  occurrence.source =
                some occurrence.target :=
            (verifiedEvent occurrence).replay_correct
          have notPending :
              (P1cAdmittedOperations.event occurrence).replayRecipe.ruleId ≠
                pendingHoldRule := by
            exact request_rule_ne_pending occurrence.request
          have notCompleted :
              (P1cAdmittedOperations.event occurrence).replayRecipe.ruleId ≠
                completedHoldRule := by
            exact request_rule_ne_completed occurrence.request
          have notReset :
              (P1cAdmittedOperations.event occurrence).replayRecipe.ruleId ≠
                nullResetRule := by
            exact request_rule_ne_reset occurrence.request
          change
            (if occurrence.request.ruleId = pendingHoldRule then
                _
              else if occurrence.request.ruleId = completedHoldRule then
                _
              else if occurrence.request.ruleId = nullResetRule then
                _
              else
                P1cAdmittedOperations.replayKernel.run
                  (P1cAdmittedOperations.event occurrence).replayRecipe
                  occurrence.source) =
              some occurrence.target
          rw [if_neg (request_rule_ne_pending occurrence.request)]
          rw [if_neg (request_rule_ne_completed occurrence.request)]
          rw [if_neg (request_rule_ne_reset occurrence.request)]
          exact core }
  | .pendingExternalHold =>
      { event := identityRecord occurrence false pendingHoldRule 0
        replay_correct := by
          simp [replayKernel, identityRecord, DPOEvent.replayRecipe,
            adminRecipeConsistent, pendingHoldRule, completedHoldRule,
            nullResetRule, embeddingValues] }
  | .completedExternalHold =>
      { event := identityRecord occurrence true completedHoldRule 1
        replay_correct := by
          simp [replayKernel, identityRecord, DPOEvent.replayRecipe,
            adminRecipeConsistent, pendingHoldRule, completedHoldRule,
            nullResetRule, embeddingValues] }
  | .nullPathAdministrativeReset =>
      { event := resetRecord occurrence
        replay_correct := by
          simp [replayKernel, resetRecord, DPOEvent.replayRecipe,
            adminRecipeConsistent, pendingHoldRule, completedHoldRule,
            nullResetRule, embeddingValues]
          exact (configOf_signatureVersion occurrence true).symm }

/-- A finite execution package generated by one admitted occurrence. -/
def package (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := lts occurrence
  configOf := configOf occurrence
  replayKernel := replayKernel occurrence
  eventRecord := verifiedRecord occurrence
  eventEndpoints := by
    intro source packageEvent target step
    rcases step with ⟨native, _observable⟩
    cases native with
    | business =>
        exact (verifiedRecord occurrence .business).replays_recorded
    | pendingHold =>
        exact
          (verifiedRecord occurrence .pendingExternalHold).replays_recorded
    | completedHold =>
        exact
          (verifiedRecord occurrence .completedExternalHold).replays_recorded
    | nullReset =>
        exact
          (verifiedRecord occurrence
            .nullPathAdministrativeReset).replays_recorded
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

noncomputable def transition : Bool → Bool → Real
  | false, false => 0
  | false, true => 1
  | true, false => 0
  | true, true => 1

/-- The admitted business event occurs with probability one while pending. -/
noncomputable def stateKernel (occurrence : Occurrence σ) :
    NativeMarkovKernel σ (package occurrence) Bool where
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
    · exact ⟨.business, native_business occurrence⟩
    · norm_num [transition] at positive
    · exact False.elim (different rfl)

def totalLabelling (occurrence : Occurrence σ) :
    TotalNativeLabelling (stateKernel occurrence) where
  event
    | false, false => .pendingExternalHold
    | false, true => .business
    | true, false => .nullPathAdministrativeReset
    | true, true => .completedExternalHold
  native source target := by
    cases source <;> cases target
    · exact native_pending_hold occurrence
    · exact native_business occurrence
    · exact native_null_reset occurrence
    · exact native_completed_hold occurrence

noncomputable def initial : InitialDistribution Bool where
  probability
    | false => 1
    | true => 0
  probability_nonnegative := by
    intro state
    cases state <;> norm_num
  total := by
    rw [Fintype.sum_bool]
    norm_num

def window (occurrence : Occurrence σ) : StableFairWindow where
  signatureVersion := fun _ => occurrence.source.signatureVersion
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

def stable : Bool → Bool := id

noncomputable def progress (occurrence : Occurrence σ) :
    ProgressBridge (stateKernel occurrence) initial (1 : Real) where
  window := window occurrence
  stable := stable
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  pointwise_progress := by
    intro state unstable
    cases state
    · change
        (1 : Real) ≤
          ∑ target ∈
            (Finset.univ.filter fun target : Bool => target = true),
            transition false target
      rw [Finset.sum_filter, Fintype.sum_bool]
      norm_num [transition]
    · exact False.elim (unstable rfl)

theorem alignment (occurrence : Occurrence σ) :
    EpochKernelAlignment (totalLabelling occurrence)
      (progress occurrence).window where
  stable_state_version := by
    intro state
    cases state <;> rfl
  opportunity_noninternal := by
    intro source target
    change ¬False
    simp

noncomputable def eventProgress (occurrence : Occurrence σ) :
    EventProgressBridge (stateKernel occurrence) initial (1 : Real) where
  progress := progress occurrence
  labelling := totalLabelling occurrence
  alignment := alignment occurrence

/-- Both totalisation-only transitions carry zero stochastic mass. -/
theorem pending_hold_probability_zero :
    transition false false = 0 := rfl

theorem null_reset_probability_zero :
    transition true false = 0 := rfl

theorem business_probability_one :
    transition false true = 1 := rfl

theorem completed_hold_probability_one :
    transition true true = 1 := rfl

/--
Every positive-probability transition is labelled either by the admitted
business event or by the explicit completed-state external hold.
-/
theorem positive_event_classification (occurrence : Occurrence σ)
    {source target : Bool}
    (positive : 0 < (stateKernel occurrence).probability source target) :
    (totalLabelling occurrence).event source target = .business ∨
      (totalLabelling occurrence).event source target =
        .completedExternalHold := by
  cases source <;> cases target
  · norm_num [stateKernel, transition] at positive
  · exact Or.inl rfl
  · norm_num [stateKernel, transition] at positive
  · exact Or.inr rfl

/--
Positive mass is supported only by the admitted business rule and the
productive completed-state hold.  In particular, neither totalisation-only
label can occur on a positive-probability edge.
-/
theorem positive_supported_step (occurrence : Occurrence σ)
    {source target : Bool}
    (positive : 0 < (stateKernel occurrence).probability source target) :
    SupportedStep source
      ((totalLabelling occurrence).event source target) target := by
  cases source <;> cases target
  · norm_num [stateKernel, transition] at positive
  · exact SupportedStep.business
  · norm_num [stateKernel, transition] at positive
  · exact SupportedStep.completedHold

/-- The completed state remains externally productive and is not normal. -/
theorem completed_not_normal (occurrence : Occurrence σ) :
    ¬(lts occurrence).Normal true := by
  intro normal
  exact normal ⟨.completedExternalHold, true, native_completed_hold occurrence⟩

theorem completed_not_successful (occurrence : Occurrence σ) :
    ¬(lts occurrence).SuccessfulTermination true :=
  fun terminal => completed_not_normal occurrence terminal.1

theorem completed_not_external_wait (occurrence : Occurrence σ) :
    ¬(lts occurrence).ExternalWait true :=
  fun waiting => completed_not_normal occurrence waiting.1

theorem completed_not_deadlocked (occurrence : Occurrence σ) :
    ¬(lts occurrence).Deadlocked true :=
  fun deadlocked => completed_not_normal occurrence deadlocked.1

/-- The package's business record is the real admitted-operation record. -/
@[simp] theorem business_event_record (occurrence : Occurrence σ) :
    ((package occurrence).eventRecord .business).event =
      P1cAdmittedOperations.event occurrence :=
  rfl

theorem business_replays (occurrence : Occurrence σ) :
    ((package occurrence).eventRecord .business).Replays
      occurrence.source occurrence.target :=
  (package occurrence).eventEndpoints (native_business occurrence)

/--
Data tying one business-labelled trajectory step to its epoch, verified replay
record, and all four independently constructed operational projections.
-/
structure BusinessAgreement (occurrence : Occurrence σ)
    (trajectory : InfiniteEventTrajectory (package occurrence))
    (window : StableFairWindow) (n : Nat) : Prop where
  label : trajectory.event n = .business
  source_pending : trajectory.state n = false
  target_completed : trajectory.state (n + 1) = true
  record_is_admitted :
    ((package occurrence).eventRecord (trajectory.event n)).event =
      P1cAdmittedOperations.event occurrence
  replay :
    ((package occurrence).eventRecord (trajectory.event n)).Replays
      ((package occurrence).configOf (trajectory.state n))
      ((package occurrence).configOf (trajectory.state (n + 1)))
  common : CommonDerivation occurrence
  source_epoch :
    (package occurrence).lts.signatureVersion (trajectory.state n) =
      window.signatureVersion (eventEpoch window n)
  target_epoch :
    (package occurrence).lts.signatureVersion (trajectory.state (n + 1)) =
      window.signatureVersion (eventEpoch window n)

/--
Every occurrence of the business label in a complete common trajectory has
the exact admitted endpoints and carries the DPO/Petri/late-π/morphism proof.
-/
theorem business_agreement
    (occurrence : Occurrence σ)
    (path : ReplayableEventPath (eventProgress occurrence).labelling)
    (n : Nat)
    (label :
      (completeCommonTrajectory (eventProgress occurrence) path).trajectory.event n =
        .business) :
    BusinessAgreement occurrence
      (completeCommonTrajectory (eventProgress occurrence) path).trajectory
      (eventProgress occurrence).progress.window n := by
  let complete := completeCommonTrajectory (eventProgress occurrence) path
  have native := complete.trajectory.native n
  rcases native with ⟨nativeStep, _observable⟩
  have endpoints :
      complete.trajectory.state n = false ∧
        complete.trajectory.state (n + 1) = true := by
    rw [label] at nativeStep
    exact nativeStep.business_endpoints
  refine
    { label := label
      source_pending := endpoints.1
      target_completed := endpoints.2
      record_is_admitted := ?_
      replay := complete.replayable n
      common := commonDerivation occurrence
      source_epoch := complete.epoch_aligned.source_signature n
      target_epoch := complete.epoch_aligned.target_signature n }
  rw [label]
  exact business_event_record occurrence

/-- Canonical path: one admitted rule event, then explicit external holds. -/
def canonicalStatePath : Nat → Bool
  | 0 => false
  | _ + 1 => true

def canonicalEventPath (occurrence : Occurrence σ) :
    ReplayableEventPath (eventProgress occurrence).labelling :=
  ReplayableEventPath.ofState canonicalStatePath

def canonicalCompleteTrajectory (occurrence : Occurrence σ) :
    CompleteCommonTrajectory (eventProgress occurrence)
      (canonicalEventPath occurrence) :=
  completeCommonTrajectory (eventProgress occurrence)
    (canonicalEventPath occurrence)

theorem canonical_first_event (occurrence : Occurrence σ) :
    (canonicalCompleteTrajectory occurrence).trajectory.event 0 =
      .business :=
  rfl

theorem canonical_first_business_agreement (occurrence : Occurrence σ) :
    BusinessAgreement occurrence
      (canonicalCompleteTrajectory occurrence).trajectory
      (eventProgress occurrence).progress.window 0 :=
  business_agreement occurrence (canonicalEventPath occurrence) 0
    (canonical_first_event occurrence)

section ProbabilityLaw

local instance : MeasurableSpace Bool := ⊤

/--
The concrete admitted-operation execution package inherits the full
almost-sure event/state/epoch/replay trajectory theorem.
-/
theorem complete_trajectory_almost_sure (occurrence : Occurrence σ) :
    ∀ᵐ path ∂replayableEventTrajectoryMeasure
        (eventProgress occurrence).labelling initial,
      Nonempty
          (CompleteCommonTrajectory (eventProgress occurrence) path) ∧
        ((eventProgress occurrence).progress.toKernelProgressAssumption
          |>.hittingBridge).EventuallyHits path.stateCode :=
  complete_common_trajectory_almost_sure (eventProgress occurrence)

/-- Positive-support source/event/target agreement for one sampled path. -/
def SupportedReplayablePath (occurrence : Occurrence σ)
    (path :
      ReplayableEventPath (eventProgress occurrence).labelling) : Prop :=
  ∀ n,
    SupportedStep
      (path.stateCode n) (path.event n) (path.stateCode (n + 1))

/--
Under the actual Ionescu--Tulcea event law, every sampled label is in the
positive operational support.  Hence the zero-mass pending hold and
administrative reset never appear almost surely, while every step still
carries the complete replay/epoch agreement.
-/
theorem supported_complete_trajectory_almost_sure
    (occurrence : Occurrence σ) :
    ∀ᵐ path ∂ replayableEventTrajectoryMeasure
        (eventProgress occurrence).labelling initial,
      SupportedReplayablePath occurrence path ∧
        Nonempty
          (CompleteCommonTrajectory (eventProgress occurrence) path) ∧
        ((eventProgress occurrence).progress.toKernelProgressAssumption
          |>.hittingBridge).EventuallyHits path.stateCode := by
  filter_upwards
    [replayable_event_measure_ae_positive_probability
      (eventProgress occurrence).labelling initial,
     complete_trajectory_almost_sure occurrence] with path positive complete
  refine ⟨?_, complete⟩
  intro n
  change
    SupportedStep
      (path.stateCode n)
      ((totalLabelling occurrence).event
        (path.stateCode n) (path.stateCode (n + 1)))
      (path.stateCode (n + 1))
  exact positive_supported_step occurrence (positive n)

end ProbabilityLaw

end Cantilune.Pi.P1cAdmittedTrajectory
