import Mathlib
import Cantilune.Feedback.Execution

/-!
# Deterministic execution-to-feedback bridge regression

This finite fixture has one native source transition.  It checks that a
non-empty execution path maps to exactly one evidence event and that the
stable-region theorem applies to the mapped endpoint.
-/

namespace Cantilune.Tests.FeedbackExecution

open Cantilune.Core Cantilune.Feedback

/-- A finite signature with no generator declarations. -/
def emptySignature : FinSignature where
  Obj := PUnit
  Gen := Empty
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := Empty.elim
  output := Empty.elim
  mode := fun _ => .linear
  contract := Empty.elim

/-- Empty graph configuration carrying only a small policy-state counter. -/
def config (policyState : Nat) : Config emptySignature where
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
  policyState := policyState
  tombstones := ∅

theorem config_wellFormed (policyState : Nat) :
    (config policyState).WellFormed := by
  constructor <;> simp [config]

/-- The fixture kernel deterministically advances to policy state one. -/
def kernel : DPOEvent.ReplayKernel emptySignature where
  run := fun _recipe _source => some (config 1)

/-- One complete replayable external event. -/
def eventRecord : DPOEvent emptySignature where
  signatureVersion := 0
  ruleId := 7
  source := config 0
  target := config 1
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := Function.Embedding.refl (Fin 0)
  complementTag := 11
  freshNames := ∅
  policyEvidence := [1]
  externalEvidence := [42]
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp [config]
  sourceWellFormed := config_wellFormed 0
  targetWellFormed := config_wellFormed 1

def verifiedEvent : DPOEvent.Verified kernel where
  event := eventRecord
  replay_correct := rfl

/-- A two-state LTS with exactly one selected native step. -/
def sourceLTS : ObservableLTS where
  State := Bool
  Event := Unit
  stateSetoid := ObservableLTS.equalitySetoid Bool
  step := fun source _event target => source = false ∧ target = true
  observable := fun _ => True
  success := fun state => state = true
  waiting := fun _ => False
  signatureVersion := fun _ => 0
  step_congr := by
    intro source source' event target target' hs ht
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

def executionPackage : ExecutionPackage emptySignature where
  lts := sourceLTS
  configOf := fun state =>
    match state with
    | false => config 0
    | true => config 1
  replayKernel := kernel
  eventRecord := fun _ => verifiedEvent
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨⟨sourceFalse, targetTrue⟩, _observable⟩
    subst source
    subst target
    cases event
    exact ⟨rfl, rfl⟩
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => 0
      decreases := by simp
      epoch_preserved := by simp }

def feedbackSystem : FeedbackSystem PUnit PUnit 1 where
  quorum := 1
  quorum_le_observers := by decide
  authorized := fun _ _ => True
  authorized_decidable := fun _ _ => inferInstance

def mappedState : Bool → FeedbackState 1
  | false =>
      { evidence := ⟨0, by omega⟩
        accepted := false }
  | true =>
      { evidence := ⟨1, by omega⟩
        accepted := false }

def mappedEvent (_ : Unit) :
    FeedbackEvent 1 Unit :=
  .evidence ⟨1, by omega⟩

def bridge :
    ExecutionFeedbackBridge
      emptySignature PUnit PUnit 1 Unit where
  package := executionPackage
  feedbackSystem := feedbackSystem
  stateMap := mappedState
  eventMap := mappedEvent
  step_commutes := by
    intro source event target step
    rcases step with ⟨⟨sourceFalse, targetTrue⟩, _observable⟩
    subst source
    subst target
    cases event
    rfl

theorem one_step :
    sourceLTS.ObservableStep false () true := by
  exact ⟨⟨rfl, rfl⟩, trivial⟩

theorem oneStepPath :
    sourceLTS.Path false [()] true :=
  ObservableLTS.Path.cons one_step
    (ObservableLTS.Path.nil (L := sourceLTS) true)

/-- The non-empty source path replays to the expected feedback endpoint. -/
example :
    applyEvents (bridge.stateMap false) (bridge.mapEvents [()]) =
      bridge.stateMap true :=
  bridge.path_replay oneStepPath

/-- Stability is preserved across the same non-empty mapped source path. -/
example :
    (bridge.stateMap true).evidence.StableRegion 0 := by
  apply bridge.path_preserves_stable oneStepPath
  change 0 ≤ (bridge.stateMap false).evidence.level
  omega

end Cantilune.Tests.FeedbackExecution
