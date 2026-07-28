import Cantilune.Pi.P1cAdmittedOperations

/-!
# Non-fixture P1c admitted-operation regressions

The three examples below have non-empty operational preconditions and targets
computed from their source configurations.  They exercise the shared
DAG/Petri/standard-late-π/morphism derivation and endpoint-free replay bridge.
-/

namespace Cantilune.Tests.P1cAdmittedOperations

open Cantilune.Core
open Cantilune.Pi.P1cAdmittedOperations

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

def pairConfig : Config signature where
  signatureVersion := 3
  nodes := {0, 1}
  edges := ∅
  nodeLabel := fun node =>
    if node = 0 ∨ node = 1 then some PUnit.unit else none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 5
  tombstones := ∅

theorem pair_wellFormed : pairConfig.WellFormed := by
  constructor
  · intro node
    simp [pairConfig]
  · intro edge member
    simp [pairConfig] at member

theorem pair_acyclic : Acyclic pairConfig :=
  acyclic_of_edges_empty rfl

theorem pair_ownershipWellFormed : pairConfig.OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, pairConfig]

def mismatchOccurrence : Occurrence signature where
  source := pairConfig
  request := .mismatch 7 8
  admitted := by
    refine
      ⟨pair_wellFormed, pair_acyclic, by decide, ?_, ?_,
        pair_ownershipWellFormed⟩
    · constructor
      · intro node
        simp [applyRequest, pairConfig]
      · intro edge member
        simp [applyRequest, pairConfig] at member
    · apply acyclic_of_edges_empty
      rfl

theorem mismatch_common :
    CommonDerivation mismatchOccurrence :=
  commonDerivation mismatchOccurrence

theorem mismatch_has_native_late_step :
    Cantilune.Pi.Late.NativeStep
      (PiView.source mismatchOccurrence.request)
      .tau
      (PiView.target mismatchOccurrence.request) :=
  mismatch_common.piNative

theorem reconnect_target_wellFormed :
    (applyRequest pairConfig (.reconnect 0 1)).WellFormed := by
  constructor
  · intro node
    simp [applyRequest, pairConfig]
  · intro edge member
    have edgeShape : edge = (0, 1) := by
      simpa [applyRequest, pairConfig] using member
    subst edge
    decide

theorem reconnect_target_acyclic :
    Acyclic (applyRequest pairConfig (.reconnect 0 1)) := by
  apply acyclic_of_rank (rank := id)
  intro edge member
  simp [applyRequest, pairConfig] at member
  subst edge
  decide

def reconnectOccurrence : Occurrence signature where
  source := pairConfig
  request := .reconnect 0 1
  admitted := by
    exact
      ⟨pair_wellFormed, pair_acyclic, by decide,
        reconnect_target_wellFormed, reconnect_target_acyclic,
        pair_ownershipWellFormed⟩

theorem reconnect_common :
    CommonDerivation reconnectOccurrence :=
  commonDerivation reconnectOccurrence

theorem reconnect_has_native_late_step :
    Cantilune.Pi.Late.NativeStep
      (PiView.source reconnectOccurrence.request)
      .tau
      (PiView.target reconnectOccurrence.request) :=
  reconnect_common.piNative

def singletonConfig : Config signature where
  signatureVersion := 3
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
  policyState := 5
  tombstones := ∅

theorem singleton_wellFormed : singletonConfig.WellFormed := by
  constructor
  · intro node
    simp [singletonConfig]
  · intro edge member
    simp [singletonConfig] at member

theorem singleton_acyclic : Acyclic singletonConfig :=
  acyclic_of_edges_empty rfl

theorem singleton_ownershipWellFormed :
    singletonConfig.OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, singletonConfig]

theorem delete_target_wellFormed :
    (applyRequest singletonConfig (.quiescentDelete 0)).WellFormed := by
  constructor
  · intro node
    simp [applyRequest, singletonConfig]
  · intro edge member
    simp [applyRequest, singletonConfig, incidentEdges] at member

theorem delete_target_acyclic :
    Acyclic (applyRequest singletonConfig (.quiescentDelete 0)) :=
  acyclic_of_edges_empty (by
    simp [applyRequest, singletonConfig, incidentEdges])

def deleteOccurrence : Occurrence signature where
  source := singletonConfig
  request := .quiescentDelete 0
  admitted := by
    exact
      ⟨singleton_wellFormed, singleton_acyclic, by decide,
        delete_target_wellFormed, delete_target_acyclic,
        singleton_ownershipWellFormed⟩

theorem delete_common :
    CommonDerivation deleteOccurrence :=
  commonDerivation deleteOccurrence

theorem quiescent_delete_has_native_late_step :
    Cantilune.Pi.Late.NativeStep
      (PiView.source deleteOccurrence.request)
      .tau
      (PiView.target deleteOccurrence.request) :=
  delete_common.piNative

theorem delete_replays_computed_target :
    (verifiedEvent deleteOccurrence).Replays
      singletonConfig
      (applyRequest singletonConfig (.quiescentDelete 0)) :=
  replay_exact deleteOccurrence

/--
Quiescence is ownership-based: resource 9 blocks deletion of its owner 0,
even though the resource identifier is unrelated to the node identifier.
-/
def ownedResourceConfig : Config signature :=
  { pairConfig with
      resourceTokens := {9}
      resourceOwner := fun token => if token = 9 then some 0 else none }

theorem ownedResourceConfig_ownershipWellFormed :
    ownedResourceConfig.OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, ownedResourceConfig, pairConfig]

theorem owned_resource_blocks_delete :
    ¬Request.Enabled ownedResourceConfig (.quiescentDelete 0) := by
  simp [Request.Enabled, ownedResourceConfig, pairConfig]

/--
Conversely, a resource whose identifier is 0 does not block deleting node 0
when its actual owner is node 1.
-/
def differentlyOwnedResourceConfig : Config signature :=
  { pairConfig with
      resourceTokens := {0}
      resourceOwner := fun token => if token = 0 then some 1 else none }

theorem differentlyOwnedResourceConfig_ownershipWellFormed :
    differentlyOwnedResourceConfig.OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, differentlyOwnedResourceConfig, pairConfig]

theorem unrelated_owner_allows_delete :
    Request.Enabled differentlyOwnedResourceConfig (.quiescentDelete 0) := by
  simp [Request.Enabled, differentlyOwnedResourceConfig, pairConfig]

theorem ownership_preserved_by_safe_delete :
    (applyRequest differentlyOwnedResourceConfig
      (.quiescentDelete 0)).OwnershipWellFormed :=
  ownershipWellFormed_applyRequest
    differentlyOwnedResourceConfig_ownershipWellFormed
    unrelated_owner_allows_delete

end Cantilune.Tests.P1cAdmittedOperations
