import Cantilune.Pi.FMSActualAgentNormativeCommutation

namespace Cantilune.Tests.FMSActualAgentNormativeCommutation

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoAgentOperationalBridge
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.FMSActualAgentNormativeCommutation

example (event : SourceEvent) :
    ActualNormativeCommutation event :=
  normativeActualCommutation event

example :
    Fintype.card SourceEvent = 15 :=
  all_fifteen_actual_agent_commute.2

example (event : SourceEvent) :
    (normativeActualCommutation event).sourceRaw =
      readyProcess event :=
  (normativeActualCommutation event).sourceRaw_eq

example (event : SourceEvent) :
    (normativeActualCommutation event).targetRaw =
      firstTarget event :=
  (normativeActualCommutation event).targetRaw_eq

example (event : SourceEvent) :
    LayerContinuesToEndpoint event normativeBaseWorld
      (normativeAgentAction event) :=
  (normativeActualCommutation event).sourceToTargetSemanticContinuation

example :
    agentUnfold.app normativeBaseWorld
        (normativeTargetAgent .openClose) =
      principalRaw
        (tauAction normativeBaseWorld
          (normativeTerminalAgent .openClose)) := by
  rw [normativeTargetAgent_unfold]
  rfl

example :
    agentUnfold.app normativeBaseWorld
        (normativeTargetAgent .restriction) =
      principalRaw
        (tauAction normativeBaseWorld
          (normativeTerminalAgent .restriction)) := by
  rw [normativeTargetAgent_unfold]
  rfl

example :
    normativeTargetAgent .openClose ≠
      normativeTerminalAgent .openClose :=
  normative_payload_target_ne_terminal .openClose (Or.inl rfl)

example :
    normativeTargetAgent .restriction ≠
      normativeTerminalAgent .restriction :=
  normative_payload_target_ne_terminal .restriction (Or.inr rfl)

example (event : SourceEvent) :
    RawFirstTargetClassification event
      (firstTarget event) (terminalProcess event) :=
  rawFirstTarget_classification event

example (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    LayerContinuesToEndpoint event target
      (normativeActionAt event injection) :=
  (normativeActualCommutation event).mappedSourceToTargetSemanticContinuation
    injection

#check normativeTargetTree_world_extension
#check inputTargetTree_transport
#check normativeAgentAction_continues
#check normativeActionAt_continues
#check rawFirstTarget_classification

#print axioms normativeAgentAction_represents
#print axioms fixedPrefixAgent_world_natural
#print axioms normativeTargetTree_world_extension
#print axioms inputTargetTree_transport
#print axioms normativeAgentAction_continues
#print axioms normativeActionAt_continues
#print axioms principalAction_ne_effectBottom
#print axioms normative_payload_target_ne_terminal
#print axioms rawFirstTarget_classification
#print axioms normativeActualCommutation
#print axioms all_fifteen_actual_agent_commute

end Cantilune.Tests.FMSActualAgentNormativeCommutation
