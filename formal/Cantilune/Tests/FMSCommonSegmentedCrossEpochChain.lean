import Cantilune.Theorems.FMSCommonSegmentedCrossEpochChain

/-!
# Segmented common-FMS composition regression
-/

namespace Cantilune.Tests.FMSCommonSegmentedCrossEpochChain

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Pi
open Cantilune.Pi.FMSExactAcceptance
open Cantilune.Theorems

#check ExactFMSSegmentPath
#check ExactFMSSegmentPath.native
#check ExactFMSSegmentPath.prefixNative
#check ExactFMSSegmentPath.endpointAppend
#check ExactFMSSegmentPath.actions_endpointAppend
#check ExactFMSSegmentPath.prefixActions_endpointAppend
#check ExactFMSSegmentPath.endpointAppend_actions_assoc
#check EpochChain.traceEvents_endpointAppend_length
#check
  FiniteCommonFMSPathAgreement.no_full_concat_positions_of_shared_events

/--
Negative regression: when the shared epoch has at least one source event,
ordinary concatenation of the two full action lists cannot be positionally
aligned with the nonduplicating endpoint-appended trace.
-/
example
    {universes : ProjectionUniverses}
    {fms : ExactFMSAcceptancePackage}
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}
    (headAgreement :
      FiniteCommonFMSPathAgreement fms head)
    (tailAgreement :
      FiniteCommonFMSPathAgreement fms tail)
    (sharedNonempty : middle.source.epoch.events ≠ [])
    (sourceAction :
      ChainEvent universes
        (FiniteCrossEpochProductChain.endpointAppend
          head tail).sourceChain →
        Raw.Action) :
    ¬ List.Forall₂
        (fun sourceEvent action =>
          sourceAction sourceEvent = action)
        (traceEvents
          (FiniteCrossEpochProductChain.endpointAppend
            head tail).sourceChain)
        (headAgreement.actions ++ tailAgreement.actions) :=
  Cantilune.Theorems.FiniteCommonFMSPathAgreement.no_full_concat_positions_of_shared_events
    headAgreement tailAgreement sharedNonempty sourceAction

#print axioms ExactFMSSegmentPath.endpointAppend
#print axioms ExactFMSSegmentPath.actions_endpointAppend
#print axioms ExactFMSSegmentPath.endpointAppend_actions_assoc
#print axioms EpochChain.traceEvents_endpointAppend_length
#print axioms
  FiniteCommonFMSPathAgreement.no_full_concat_positions_of_shared_events

end Cantilune.Tests.FMSCommonSegmentedCrossEpochChain
