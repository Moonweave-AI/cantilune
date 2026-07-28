import Cantilune.Pi.P1cOperationRegistry

/-!
# Regression checks for the exact P1c operation registry
-/

namespace Cantilune.Tests.P1cOperationRegistry

open Cantilune.Pi
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cOperationRegistry

#check entries_length
#check entry_codes_nodup
#check entries_nodup
#check entries_complete
#check familyAt_surjective
#check registry_first_native
#check registry_has_genuine_strong_step
#check stable_identifiers_preserved
#check phase_is_explicit
#check native_action_exposed

example : entries.length = 60 :=
  entries_length

example : (entries.map RegistryEntry.code).Nodup :=
  entry_codes_nodup

example (index : OperationId) :
    entry index ∈ entries :=
  entry_mem index

example :
    Function.Surjective familyAt :=
  familyAt_surjective

def regressionMetadata : StableMetadata where
  version := 7
  rule := 31
  session := 101
  correlation := 202
  occurrence := 303

example (index : OperationId) :
    RegistryNativeStep
      (initialState index regressionMetadata)
      (firstEvent index regressionMetadata)
      (firstState index regressionMetadata) :=
  registry_first_native index regressionMetadata

example (index : OperationId) :
    Late.NativeStep
      (P1cFullNativeRefinement.readyProcess (familyAt index))
      (P1cFullNativeRefinement.firstAction (familyAt index))
      (P1cFullNativeRefinement.firstTarget (familyAt index)) :=
  registry_has_genuine_strong_step index

end Cantilune.Tests.P1cOperationRegistry
