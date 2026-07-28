import Cantilune.Theorems.SubstantiveReconnectConformance

namespace Cantilune.Tests.SubstantiveReconnectConformance

open Cantilune.Theorems.SubstantiveReconnectConformance

#check substantive_reference_complete
#check substantive_reference_consistency
#check admission_connects_selected_rule_occurrence
#check every_positive_path_has_exact_event_replay
#check core.piFMSAlignment.nativeRealization
#check core.piFMSAlignment.source_to_family
#check core.piFMSAlignment.derivative_to_family
#check reconfigurablePetri.complete_cross_epoch_incidence
#check legacyPetriTransition_nonempty
#print axioms substantive_reference_complete
#print axioms every_positive_path_has_exact_event_replay
#print axioms reconfigurablePetri
#print axioms legacyPetriTransition_nonempty

example : SubstantiveReferenceComplete :=
  substantive_reference_complete

example :
    sourceAdmissionOccurrence.afterState = candidate.before :=
  substantive_reference_complete.admissionConnects

example :
    ¬Function.Surjective admission.extension.gen :=
  reconfigurablePetri.complete_cross_epoch_incidence.1

example :
    kernel.probability reconnectSource reconnectTarget = 1 :=
  substantive_reference_complete.probabilityOne

example :
    ((sourcePackage newSignature).eventRecord reconnectEvent).Replays
      ((sourcePackage newSignature).configOf reconnectSource)
      ((sourcePackage newSignature).configOf reconnectTarget) :=
  substantive_reference_complete.sourceReplay

example :
    (configOf newSignature reconnectTarget).edges ≠
      (configOf newSignature reconnectSource).edges :=
  substantive_reference_complete.graphChanges

example :
    core.piFMSAlignment.family = .instanceReconnect :=
  rfl

example :
    core.piFMSAlignment.metadata =
      ({ version := 3
         rule := 41
         session := 0
         correlation := 0
         occurrence := 41 } :
        Cantilune.Pi.P1cOperationRegistry.StableMetadata) := by
  rfl

example :
    core.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before) =
      Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        .instanceReconnect :=
  rfl

example :
    core.piFMSAlignment.operational.actionPayload
        ((piFamily.operational newSignature).mapEvent candidate.event) =
      Cantilune.Pi.P1cFullNativeRefinement.firstAction
        .instanceReconnect :=
  rfl

example :
    core.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.after) =
      Cantilune.Pi.P1cFullNativeRefinement.firstTarget
        .instanceReconnect :=
  rfl

example :
    Cantilune.Pi.Late.NativeStep
      (core.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before))
      (core.piFMSAlignment.operational.actionPayload
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (core.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.after)) :=
  core.piFMSAlignment.nativeRealization

example :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.TotalCompiledNormativeCommutation
      .instanceReconnect :=
  core.piFMSAlignment.actual

end Cantilune.Tests.SubstantiveReconnectConformance
