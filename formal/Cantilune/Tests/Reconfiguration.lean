import Mathlib
import Cantilune.Core.Reconfiguration

/-!
# Quiescent reconfiguration regression

The positive fixture deletes one isolated node through an endpoint-free replay
kernel.  The negative checks show that the same package cannot issue deletion
permission while a resource token or active-session name remains.
-/

namespace Cantilune.Tests.Reconfiguration

open Cantilune.Core

def signature : FinSignature where
  Obj := PUnit
  Gen := PUnit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => []
  output := fun _ => []
  mode := fun _ => .linear
  contract := fun _ => {}

def sourceConfig : Config signature where
  signatureVersion := 0
  nodes := {0}
  edges := ∅
  nodeLabel := fun node =>
    if node = 0 then some PUnit.unit else none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 0
  tombstones := ∅

theorem source_wellFormed : sourceConfig.WellFormed := by
  constructor
  · intro node
    simp [sourceConfig]
  · intro edge member
    simp [sourceConfig] at member

/-- Executable node-zero deletion used by the replay kernel. -/
def deleteZero (source : Config signature) : Config signature where
  signatureVersion := source.signatureVersion
  nodes := source.nodes.erase 0
  edges := source.edges
  nodeLabel := fun node =>
    if node = 0 then none else source.nodeLabel node
  dataTokens := source.dataTokens
  resourceTokens := source.resourceTokens
  names := source.names
  dataOwner := source.dataOwner
  resourceOwner := source.resourceOwner
  sessionOwner := source.sessionOwner
  externalObservations := source.externalObservations
  policyState := source.policyState + 1
  tombstones := insert 0 source.tombstones

def targetConfig : Config signature :=
  deleteZero sourceConfig

theorem target_wellFormed : targetConfig.WellFormed := by
  constructor
  · intro node
    simp [targetConfig, deleteZero, sourceConfig]
  · intro edge member
    simp [targetConfig, deleteZero, sourceConfig] at member

/--
The recipe contains no stored endpoint.  Rule 17 computes deletion from the
supplied source; other rule identifiers are rejected.
-/
def kernel : DPOEvent.ReplayKernel signature where
  run := fun recipe source =>
    if recipe.ruleId = 17 then some (deleteZero source) else none

def deletionEvent : DPOEvent signature where
  signatureVersion := 0
  ruleId := 17
  source := sourceConfig
  target := targetConfig
  matchDomainSize := 1
  matchCodomainSize := 1
  matchEmbedding := Function.Embedding.refl (Fin 1)
  complementTag := 23
  freshNames := ∅
  policyEvidence := []
  externalEvidence := [100]
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp [sourceConfig]
  sourceWellFormed := source_wellFormed
  targetWellFormed := target_wellFormed

def verifiedDeletion : DPOEvent.Verified kernel where
  event := deletionEvent
  replay_correct := by
    simp [kernel, deletionEvent, DPOEvent.replayRecipe, targetConfig]

def lts : ObservableLTS :=
  dpoObservableLTS kernel (fun _ => False) (fun _ => False)

def resourcesClear (state : Config signature) : Prop :=
  state.resourceTokens = ∅

def sessionsQuiescent (state : Config signature) : Prop :=
  state.names = ∅

def package : ExecutionPackage signature where
  lts := lts
  configOf := id
  replayKernel := kernel
  eventRecord := id
  eventEndpoints := by
    intro source event target step
    exact step.1
  stateVersion := by
    intro state
    rfl
  resourcesClear := resourcesClear
  sessionsQuiescent := sessionsQuiescent
  deletionPermitted := fun state =>
    resourcesClear state ∧ sessionsQuiescent state
  deletion_requires_resources := by
    intro state permitted
    exact permitted.1
  deletion_requires_quiescence := by
    intro state permitted
    exact permitted.2
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => 0
      decreases := by
        intro source event target step impossible
        contradiction
      epoch_preserved := by
        intro source event target step impossible
        contradiction }

theorem deletion_step :
    lts.ObservableStep sourceConfig verifiedDeletion targetConfig := by
  exact
    ⟨DPOEvent.Verified.replays_recorded verifiedDeletion, trivial⟩

def referenceDeletion : QuiescentDeletion package where
  source := sourceConfig
  event := verifiedDeletion
  target := targetConfig
  observableStep := deletion_step
  permitted := by
    constructor <;> rfl
  deletedNodes := {0}
  deletesSomething := by simp
  danglingFree := by
    change NodeOnlyDanglingFree sourceConfig {0}
    simp [NodeOnlyDanglingFree, sourceConfig]
  targetNodes := by
    change targetConfig.nodes = sourceConfig.nodes \ {0}
    simp [targetConfig, deleteZero, sourceConfig]
  targetEdges := rfl
  tombstonesRecorded := by
    change {0} ⊆ targetConfig.tombstones
    simp [targetConfig, deleteZero, sourceConfig]

/-- The package step is backed by deterministic endpoint-free replay. -/
example :
    (package.eventRecord referenceDeletion.event).Replays
      (package.configOf referenceDeletion.source)
      (package.configOf referenceDeletion.target) :=
  referenceDeletion.verified_replay

/-- The positive deletion discharges all explicit safety obligations. -/
example :
    package.resourcesClear referenceDeletion.source ∧
      package.sessionsQuiescent referenceDeletion.source ∧
      NodeOnlyDanglingFree
        (package.configOf referenceDeletion.source)
        referenceDeletion.deletedNodes ∧
      referenceDeletion.deletedNodes ⊆
        (package.configOf referenceDeletion.target).tombstones :=
  referenceDeletion.permitted_deletion_safe

def liveResourceConfig : Config signature :=
  { sourceConfig with resourceTokens := {9} }

def activeSessionConfig : Config signature :=
  { sourceConfig with names := {5} }

/-- A live resource token makes deletion permission uninhabited. -/
example : ¬package.deletionPermitted liveResourceConfig := by
  simp [package, resourcesClear, sessionsQuiescent, liveResourceConfig]

/-- An active-session name makes deletion permission uninhabited. -/
example : ¬package.deletionPermitted activeSessionConfig := by
  simp [package, resourcesClear, sessionsQuiescent, activeSessionConfig]

end Cantilune.Tests.Reconfiguration
