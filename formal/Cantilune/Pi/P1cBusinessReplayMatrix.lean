import Cantilune.Pi.P1cAdmittedOperations
import Cantilune.Pi.P1cCompleteMatrix
import Cantilune.Pi.P1cFullNativeRefinement

/-!
# Replayable fixed-signature occurrences for the complete P1c matrix

`P1cCompleteMatrix` supplies one native derivation in each of the four
projection columns for all fifteen source families.  Three critical runtime
families additionally have concrete graph-changing `Config` occurrences in
`P1cAdmittedOperations`.

This module closes the remaining *fixed-signature event-record* layer for the
reference matrix.  The fourteen non-admission families receive one common,
endpoint-free replay record.  Its configuration effect is deliberately only
the append-only policy/audit cursor: the native DAG, Petri, pi, and morphism
effects remain the independent target derivations stored in the matrix.

`dynamicPartnerAdmission` is excluded by the type `BusinessEvent`.
Signature admission changes the signature and runtime version and therefore
must use the heterogeneous `SignatureAdmissionEvent` / `AdmissionReplays`
relation.  It is never encoded as a same-signature `DPOEvent`.
-/

noncomputable section

namespace Cantilune.Pi.P1cBusinessReplayMatrix

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1cMatrix

variable {σ : FinSignature}

namespace SourceEvent

/-- Stable, injective recipe code for each finite reference family. -/
def ruleId : SourceEvent → Nat
  | .freeOutput => 100
  | .boundOutput => 101
  | .lateInput => 102
  | .communication => 103
  | .openClose => 104
  | .restriction => 105
  | .scopeExtrusion => 106
  | .delegation => 107
  | .choiceLeft => 108
  | .choiceRight => 109
  | .matchSuccess => 110
  | .mismatchGuard => 111
  | .dynamicPartnerAdmission => 112
  | .instanceReconnect => 113
  | .instanceDeleteQuiescent => 114

/-- Partial inverse used by endpoint-free replay. -/
def decodeRuleId : Nat → Option SourceEvent
  | 100 => some .freeOutput
  | 101 => some .boundOutput
  | 102 => some .lateInput
  | 103 => some .communication
  | 104 => some .openClose
  | 105 => some .restriction
  | 106 => some .scopeExtrusion
  | 107 => some .delegation
  | 108 => some .choiceLeft
  | 109 => some .choiceRight
  | 110 => some .matchSuccess
  | 111 => some .mismatchGuard
  | 112 => some .dynamicPartnerAdmission
  | 113 => some .instanceReconnect
  | 114 => some .instanceDeleteQuiescent
  | _ => none

@[simp]
theorem decodeRuleId_ruleId (event : SourceEvent) :
    decodeRuleId (ruleId event) = some event := by
  cases event <;> rfl

theorem ruleId_injective : Function.Injective ruleId := by
  intro left right equality
  have decoded := congrArg decodeRuleId equality
  have options : some left = some right := by
    simpa only [decodeRuleId_ruleId] using decoded
  exact Option.some.inj options

end SourceEvent

/-- A P1c family whose event stays inside one fixed signature epoch. -/
abbrev BusinessEvent :=
  { event : SourceEvent // event ≠ .dynamicPartnerAdmission }

namespace BusinessEvent

def ruleId (event : BusinessEvent) : Nat :=
  SourceEvent.ruleId event.1

/-- Decode only fixed-signature business events. -/
def decodeRuleId (code : Nat) : Option BusinessEvent :=
  match SourceEvent.decodeRuleId code with
  | none => none
  | some event =>
      if business : event ≠ .dynamicPartnerAdmission then
        some ⟨event, business⟩
      else
        none

@[simp]
theorem decodeRuleId_ruleId (event : BusinessEvent) :
    decodeRuleId event.ruleId = some event := by
  rcases event with ⟨event, business⟩
  unfold decodeRuleId ruleId
  rw [SourceEvent.decodeRuleId_ruleId]
  change
    (if proof : event ≠ .dynamicPartnerAdmission then
        some (⟨event, proof⟩ : BusinessEvent)
      else none) =
      some (⟨event, business⟩ : BusinessEvent)
  rw [dif_pos business]

end BusinessEvent

/--
Append the business-family code to the deterministic policy/audit cursor.
No graph, resource, name, ownership, or signature field is modified.
-/
def applyBusiness (source : Config σ) (event : BusinessEvent) : Config σ :=
  { source with
    policyState := source.policyState + event.ruleId + 1 }

@[simp]
theorem applyBusiness_signatureVersion
    (source : Config σ) (event : BusinessEvent) :
    (applyBusiness source event).signatureVersion =
      source.signatureVersion :=
  rfl

@[simp]
theorem applyBusiness_policyState
    (source : Config σ) (event : BusinessEvent) :
    (applyBusiness source event).policyState =
      source.policyState + event.ruleId + 1 :=
  rfl

theorem applyBusiness_wellFormed
    {source : Config σ} (event : BusinessEvent)
    (wellFormed : source.WellFormed) :
    (applyBusiness source event).WellFormed :=
  wellFormed

theorem applyBusiness_ownershipWellFormed
    {source : Config σ} (event : BusinessEvent)
    (wellFormed : source.OwnershipWellFormed) :
    (applyBusiness source event).OwnershipWellFormed :=
  wellFormed

theorem applyBusiness_ne
    (source : Config σ) (event : BusinessEvent) :
    applyBusiness source event ≠ source := by
  intro equality
  have policyEquality :=
    congrArg (fun config : Config σ => config.policyState) equality
  simp only [applyBusiness_policyState] at policyEquality
  omega

/-- One admitted fixed-signature occurrence of a reference P1c family. -/
structure Occurrence (σ : FinSignature) where
  source : Config σ
  business : BusinessEvent
  sourceWellFormed : source.WellFormed
  sourceOwnershipWellFormed : source.OwnershipWellFormed

namespace Occurrence

def target (occurrence : Occurrence σ) : Config σ :=
  applyBusiness occurrence.source occurrence.business

theorem targetWellFormed (occurrence : Occurrence σ) :
    occurrence.target.WellFormed :=
  applyBusiness_wellFormed occurrence.business occurrence.sourceWellFormed

theorem targetOwnershipWellFormed (occurrence : Occurrence σ) :
    occurrence.target.OwnershipWellFormed :=
  applyBusiness_ownershipWellFormed
    occurrence.business occurrence.sourceOwnershipWellFormed

theorem changesConfig (occurrence : Occurrence σ) :
    occurrence.target ≠ occurrence.source :=
  applyBusiness_ne occurrence.source occurrence.business

end Occurrence

/-- The unique empty finite-ordinal match into the current node fibre. -/
def emptyMatchEmbedding (source : Config σ) :
    Fin 0 ↪ Fin source.nodes.card where
  toFun := Fin.elim0
  inj' := fun impossible => Fin.elim0 impossible

/--
Every replay-relevant field is checked.  The empty match is unique; its
endpoint-independent fingerprint is the empty list.
-/
def recipeConsistent
    (recipe : DPOEvent.ReplayRecipe σ)
    (source : Config σ) (event : BusinessEvent) : Prop :=
  recipe.signatureVersion = source.signatureVersion ∧
  recipe.ruleId = event.ruleId ∧
  recipe.matchDomainSize = 0 ∧
  recipe.matchCodomainSize = source.nodes.card ∧
  recipe.complementTag = event.ruleId ∧
  recipe.freshNames = ∅ ∧
  recipe.policyEvidence = [source.policyState] ∧
  recipe.externalEvidence = [event.ruleId] ∧
  recipe.kind = .external ∧
  P1cAdmittedOperations.embeddingValues recipe.matchEmbedding = []

instance (recipe : DPOEvent.ReplayRecipe σ)
    (source : Config σ) (event : BusinessEvent) :
    Decidable (recipeConsistent recipe source event) := by
  unfold recipeConsistent
  infer_instance

/--
Decode the family, reject signature admission, validate the full recipe, and
recompute the endpoint from the supplied source configuration.
-/
def replayKernel : DPOEvent.ReplayKernel σ where
  run := fun recipe source =>
    match BusinessEvent.decodeRuleId recipe.ruleId with
    | none => none
    | some event =>
        if recipeConsistent recipe source event then
          some (applyBusiness source event)
        else
          none

/-- A complete replayable record for one fixed-signature occurrence. -/
def event (occurrence : Occurrence σ) : DPOEvent σ where
  signatureVersion := occurrence.source.signatureVersion
  ruleId := occurrence.business.ruleId
  source := occurrence.source
  target := occurrence.target
  matchDomainSize := 0
  matchCodomainSize := occurrence.source.nodes.card
  matchEmbedding := emptyMatchEmbedding occurrence.source
  complementTag := occurrence.business.ruleId
  freshNames := ∅
  policyEvidence := [occurrence.source.policyState]
  externalEvidence := [occurrence.business.ruleId]
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp
  sourceWellFormed := occurrence.sourceWellFormed
  targetWellFormed := occurrence.targetWellFormed

@[simp]
theorem event_recipe_decodes (occurrence : Occurrence σ) :
    BusinessEvent.decodeRuleId (event occurrence).replayRecipe.ruleId =
      some occurrence.business := by
  exact BusinessEvent.decodeRuleId_ruleId occurrence.business

theorem event_recipe_consistent (occurrence : Occurrence σ) :
    recipeConsistent (event occurrence).replayRecipe
      occurrence.source occurrence.business := by
  simp [recipeConsistent, event, DPOEvent.replayRecipe,
    P1cAdmittedOperations.embeddingValues, emptyMatchEmbedding]

/-- Replay recomputes the recorded endpoint; it is not read from the record. -/
def verifiedEvent (occurrence : Occurrence σ) :
    DPOEvent.Verified (replayKernel (σ := σ)) where
  event := event occurrence
  replay_correct := by
    change
      (match
          BusinessEvent.decodeRuleId
            (event occurrence).replayRecipe.ruleId with
      | none => none
      | some business =>
          if recipeConsistent (event occurrence).replayRecipe
              occurrence.source business then
            some (applyBusiness occurrence.source business)
          else none) =
        some occurrence.target
    rw [event_recipe_decodes occurrence]
    simp only
    rw [if_pos (event_recipe_consistent occurrence)]
    rfl

theorem replay_exact (occurrence : Occurrence σ) :
    (verifiedEvent occurrence).Replays
      occurrence.source occurrence.target :=
  (verifiedEvent occurrence).replays_recorded

/-! ## One occurrence, four native projections, and standard late pi -/

/-- Extract the native matrix derivation for any of the four columns. -/
def matrixDerivation
    (occurrence : Occurrence σ) (projection : Projection) :
    NativeDerivation P1cCompleteMatrix.completeTargets
      occurrence.business.1 projection :=
  Cell.nativeDerivation
    (P1cCompleteMatrix.completeMatrix.cell
      occurrence.business.1 projection)
    (P1cCompleteMatrix.p1c_rule_matrix_complete.everyCell
      occurrence.business.1 projection)

/--
The same source-family occurrence has all four independently defined native
target derivations, a genuine standard strong-late pi step, and exact replay.
-/
structure CommonDerivation (occurrence : Occurrence σ) where
  dag :
    NativeDerivation P1cCompleteMatrix.completeTargets
      occurrence.business.1 .dag
  petri :
    NativeDerivation P1cCompleteMatrix.completeTargets
      occurrence.business.1 .petri
  pi :
    NativeDerivation P1cCompleteMatrix.completeTargets
      occurrence.business.1 .pi
  morphism :
    NativeDerivation P1cCompleteMatrix.completeTargets
      occurrence.business.1 .morphism
  standardLate :
    Late.NativeStep
      (P1cFullNativeRefinement.readyProcess occurrence.business.1)
      (P1cFullNativeRefinement.firstAction occurrence.business.1)
      (P1cFullNativeRefinement.firstTarget occurrence.business.1)
  replay :
    (verifiedEvent occurrence).Replays
      occurrence.source occurrence.target

def commonDerivation (occurrence : Occurrence σ) :
    CommonDerivation occurrence where
  dag := matrixDerivation occurrence .dag
  petri := matrixDerivation occurrence .petri
  pi := matrixDerivation occurrence .pi
  morphism := matrixDerivation occurrence .morphism
  standardLate :=
    P1cFullNativeRefinement.first_native occurrence.business.1
  replay := replay_exact occurrence

/--
Every source family is classified without weakening: it is either a
fixed-signature business event or exactly the heterogeneous admission family.
-/
theorem business_or_admission (sourceEvent : SourceEvent) :
    (∃ business : BusinessEvent, business.1 = sourceEvent) ∨
      sourceEvent = .dynamicPartnerAdmission := by
  by_cases admission : sourceEvent = .dynamicPartnerAdmission
  · exact Or.inr admission
  · exact Or.inl ⟨⟨sourceEvent, admission⟩, rfl⟩

/-! ## A nonempty execution package containing all fourteen business events -/

namespace ReferenceExecution

/-- Each family has its own pre/post state; the event identity is not erased. -/
inductive State
  | ready (event : BusinessEvent)
  | completed (event : BusinessEvent)
  deriving DecidableEq, Repr

abbrev Event := BusinessEvent

inductive Step : State → Event → State → Prop
  | execute (event : BusinessEvent) :
      Step (.ready event) event (.completed event)

def success : State → Prop
  | .ready _ => False
  | .completed _ => True

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := fun _ => 0
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

/-- Empty graph and resource fibres, used only as the replay audit carrier. -/
def baseConfig (σ : FinSignature) : Config σ where
  signatureVersion := 0
  nodes := ∅
  edges := ∅
  nodeLabel := fun _ => none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 0
  tombstones := ∅

theorem baseConfig_wellFormed (σ : FinSignature) :
    (baseConfig σ).WellFormed := by
  simp [Config.WellFormed, baseConfig]

theorem baseConfig_ownershipWellFormed (σ : FinSignature) :
    (baseConfig σ).OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, baseConfig]

def occurrence (σ : FinSignature) (event : BusinessEvent) :
    Occurrence σ where
  source := baseConfig σ
  business := event
  sourceWellFormed := baseConfig_wellFormed σ
  sourceOwnershipWellFormed := baseConfig_ownershipWellFormed σ

def configOf (σ : FinSignature) : State → Config σ
  | .ready _ => baseConfig σ
  | .completed event => applyBusiness (baseConfig σ) event

/--
All fourteen fixed-signature families inhabit one actual execution package.
The package's event record is exactly the independently replayed occurrence
record above.
-/
def package (σ : FinSignature) : ExecutionPackage σ where
  lts := lts
  configOf := configOf σ
  replayKernel := replayKernel
  eventRecord := fun event => verifiedEvent (occurrence σ event)
  eventEndpoints := by
    rintro source event target ⟨step, _observed⟩
    cases step
    exact replay_exact (occurrence σ event)
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by
    intro _ impossible
    contradiction
  deletion_requires_quiescence := by
    intro _ impossible
    contradiction
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => 0
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

theorem event_observable (event : BusinessEvent) :
    (package σ).lts.ObservableStep
      (.ready event) event (.completed event) :=
  ⟨Step.execute event, trivial⟩

theorem package_replay_exact (event : BusinessEvent) :
    ((package σ).eventRecord event).Replays
      ((package σ).configOf (.ready event))
      ((package σ).configOf (.completed event)) :=
  (package σ).eventEndpoints (event_observable event)

def package_common_derivation (event : BusinessEvent) :
    CommonDerivation (occurrence σ event) :=
  commonDerivation (occurrence σ event)

end ReferenceExecution

end Cantilune.Pi.P1cBusinessReplayMatrix
