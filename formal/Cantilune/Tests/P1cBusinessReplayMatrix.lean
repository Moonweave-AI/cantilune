import Cantilune.Pi.P1cBusinessReplayMatrix

/-!
# Fixed-signature P1c replay-matrix regression
-/

namespace Cantilune.Tests.P1cBusinessReplayMatrix

open Cantilune.Core
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cBusinessReplayMatrix

def signature : FinSignature where
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

def source : Config signature where
  signatureVersion := 7
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

theorem source_wellFormed : source.WellFormed := by
  simp [Config.WellFormed, source]

theorem source_ownershipWellFormed :
    source.OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, source]

def freeOutput : BusinessEvent :=
  ⟨.freeOutput, by decide⟩

def occurrence : Occurrence signature where
  source := source
  business := freeOutput
  sourceWellFormed := source_wellFormed
  sourceOwnershipWellFormed := source_ownershipWellFormed

example :
    occurrence.target.policyState = 101 := by
  decide

example :
    occurrence.target.signatureVersion =
      occurrence.source.signatureVersion :=
  applyBusiness_signatureVersion _ _

example :
    occurrence.target ≠ occurrence.source :=
  occurrence.changesConfig

example :
    (verifiedEvent occurrence).Replays
      occurrence.source occurrence.target :=
  replay_exact occurrence

example :
    CommonDerivation occurrence :=
  commonDerivation occurrence

example :
    (ReferenceExecution.package signature).lts.ObservableStep
      (.ready freeOutput) freeOutput (.completed freeOutput) :=
  ReferenceExecution.event_observable freeOutput

example :
    ((ReferenceExecution.package signature).eventRecord freeOutput).Replays
      ((ReferenceExecution.package signature).configOf (.ready freeOutput))
      ((ReferenceExecution.package signature).configOf
        (.completed freeOutput)) :=
  ReferenceExecution.package_replay_exact freeOutput

example :
    CommonDerivation
      (ReferenceExecution.occurrence signature freeOutput) :=
  ReferenceExecution.package_common_derivation freeOutput

example :
    (∃ business : BusinessEvent,
        business.1 = SourceEvent.freeOutput) ∨
      SourceEvent.freeOutput = .dynamicPartnerAdmission :=
  business_or_admission .freeOutput

example :
    (∃ business : BusinessEvent,
        business.1 = SourceEvent.dynamicPartnerAdmission) ∨
      SourceEvent.dynamicPartnerAdmission = .dynamicPartnerAdmission :=
  business_or_admission .dynamicPartnerAdmission

end Cantilune.Tests.P1cBusinessReplayMatrix
