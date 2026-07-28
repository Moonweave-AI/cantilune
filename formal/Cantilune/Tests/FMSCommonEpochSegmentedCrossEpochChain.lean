import Cantilune.Theorems.FMSCommonEpochSegmentedCrossEpochChain

/-!
# Epoch-indexed segmented common-FMS regressions
-/

noncomputable section

namespace Cantilune.Tests.FMSCommonEpochSegmentedCrossEpochChain

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Pi
open Cantilune.Pi.FMSExactAcceptance
open Cantilune.Theorems

#check EpochIndexedExactFMSPath
#check EpochIndexedExactFMSPath.flatten_positions
#check EpochIndexedExactFMSPath.native
#check EpochIndexedExactFMSPath.prefixNative
#check EpochIndexedExactFMSPath.toSegmentPath
#check EpochIndexedExactFMSPath.toSegmentPath_actions
#check EpochIndexedExactFMSPath.toSegmentPath_prefixActions
#check EpochIndexedExactFMSPath.endpointAppend
#check EpochIndexedExactFMSPath.actions_endpointAppend
#check EpochIndexedExactFMSPath.endpointAppend_actions_assoc
#check FiniteCommonFMSSegmentedAgreement
#check FiniteCommonFMSSegmentedAgreement.endpointAppend
#check
  FiniteCommonFMSSegmentedAgreement.endpointAppend_of_nonempty_shared_epoch
#check FiniteCommonFMSSegmentedAgreement.actions_endpointAppend
#check FiniteCommonFMSSegmentedAgreement.prefixActions_endpointAppend
#check FiniteCommonFMSSegmentedAgreement.endpointAppend_actions_assoc

/--
Regression: a supplied exact package and two supplied segmented agreements
compose even when the shared epoch has a nonempty event list.  No positional
witness for a duplicated full action list is required.
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
      FiniteCommonFMSSegmentedAgreement universes fms head)
    (tailAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms tail)
    (sharedNonempty : middle.source.epoch.events ≠ [])
    (seam :
      headAgreement.lastEntry = tailAgreement.source) :
    FiniteCommonFMSSegmentedAgreement universes fms
      (FiniteCrossEpochProductChain.endpointAppend head tail) :=
  FiniteCommonFMSSegmentedAgreement.endpointAppend_of_nonempty_shared_epoch
    headAgreement tailAgreement sharedNonempty seam

/-- Flattened positions and the native path are available from the result. -/
example
    {universes : ProjectionUniverses}
    {fms : ExactFMSAcceptancePackage}
    {first last : FourProjectionReplayEpoch}
    {chain :
      FiniteCrossEpochProductChain universes first last}
    (agreement :
      FiniteCommonFMSSegmentedAgreement universes fms chain) :
    List.Forall₂
      (fun sourceEvent action =>
        agreement.sourceAction sourceEvent = action)
      (traceEvents chain.sourceChain) agreement.actions ∧
    ExactFMSNativePath fms
      agreement.source agreement.actions agreement.target :=
  ⟨agreement.flatten_positions, agreement.native⟩

#print axioms EpochIndexedExactFMSPath.flatten_positions
#print axioms EpochIndexedExactFMSPath.toSegmentPath_actions
#print axioms EpochIndexedExactFMSPath.endpointAppend
#print axioms EpochIndexedExactFMSPath.endpointAppend_actions_assoc
#print axioms FiniteCommonFMSSegmentedAgreement.endpointAppend
#print axioms
  FiniteCommonFMSSegmentedAgreement.endpointAppend_of_nonempty_shared_epoch
#print axioms
  FiniteCommonFMSSegmentedAgreement.endpointAppend_actions_assoc

end Cantilune.Tests.FMSCommonEpochSegmentedCrossEpochChain
