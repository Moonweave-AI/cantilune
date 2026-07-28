import Cantilune.Theorems.ProductCommonTrajectoryCertificate
import Cantilune.Theorems.SubstantiveReconnectConformance

/-!
# The substantive core package on one common FMS trajectory

This module connects the exact `SubstantiveReconnectConformance.core`
candidate to the event-labelled stochastic path.  Unlike the earlier
standalone reconnect fixture, the selected row below is definitionally tied
to all of:

* `core.piFMSAlignment.operational`;
* `candidate.event` and its verified `DPOEvent`;
* the genuine source-package native transition and replay; and
* the actual recursive FMS `Agent` endpoints.

The first row performs the reconnect.  Every later positive row is the
explicit replayable hold at the target state and is not classified as a
normative operation.
-/

noncomputable section

namespace Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory

open Cantilune.Core
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.P1cOperationRegistry
open Cantilune.Theorems.CoreConformance
open Cantilune.Theorems.ProductCommonTrajectoryCertificate

namespace Reference

abbrev signature : FinSignature :=
  SubstantiveReconnectConformance.newSignature

abbrev productPackage : ExecutionPackage signature :=
  SubstantiveReconnectConformance.sourceFamily.package signature

abbrev productKernel :
    NativeMarkovKernel signature productPackage
      (SubstantiveReconnectConformance.State signature) :=
  SubstantiveReconnectConformance.kernel

abbrev core := SubstantiveReconnectConformance.core

def positiveLabelling :
    PositiveEventLabelling productKernel :=
  SubstantiveReconnectConformance.positiveLabelling

/-- The operation is decoded by the exact operational component of `core`. -/
def selectedOperation : OperationId :=
  core.piFMSAlignment.operational.operation
    ((SubstantiveReconnectConformance.operationalProjection .pi signature).mapEvent
      SubstantiveReconnectConformance.candidate.event)

/-- Metadata is the deterministic decoding of the candidate replay record. -/
def selectedMetadata : StableMetadata :=
  canonicalStableMetadata
    (productPackage.eventRecord
      SubstantiveReconnectConformance.candidate.event).event

def selectedRow : NormativeRegistryRow where
  operation := selectedOperation
  metadata := selectedMetadata

@[simp]
theorem selectedOperation_eq :
    selectedOperation = instanceReconnectOperation :=
  rfl

@[simp]
theorem selectedRow_family :
    selectedRow.family = .instanceReconnect := by
  change familyAt selectedOperation = .instanceReconnect
  rw [selectedOperation_eq]
  exact familyAt_instanceReconnectOperation

@[simp]
theorem selectedRow_family_eq_core :
    selectedRow.family = core.piFMSAlignment.family :=
  rfl

@[simp]
theorem selectedMetadata_eq_core :
    selectedMetadata = core.piFMSAlignment.metadata :=
  rfl

def classify :
    productPackage.lts.Event → ProductEventMark
  | .business _ => .normative selectedRow
  | .hold _ => .externalHold

/--
Only the exact candidate source denotes the normative source.  Every other
kernel state denotes the target, so all non-selected positive self-loops have
literal equal endpoints.
-/
def denote
    (state : SubstantiveReconnectConformance.State signature) :
    ActualFMSEndpoint :=
  if state = SubstantiveReconnectConformance.reconnectSource then
    normativeSourceAgent .instanceReconnect
  else
    normativeTargetAgent .instanceReconnect

@[simp]
theorem denote_reconnectSource :
    denote SubstantiveReconnectConformance.reconnectSource =
      normativeSourceAgent .instanceReconnect := by
  simp [denote]

@[simp]
theorem denote_reconnectTarget :
    denote SubstantiveReconnectConformance.reconnectTarget =
      normativeTargetAgent .instanceReconnect := by
  simp [denote, SubstantiveReconnectConformance.reconnectSource,
    SubstantiveReconnectConformance.reconnectTarget]

/-- Every positive edge is either the exact reconnect row or an external hold. -/
def productFMSLabelling :
    ProductFMSLabelling positiveLabelling where
  classify := classify
  denote := denote
  positiveEdge := by
    intro source target positive
    have target_eq :=
      SubstantiveReconnectConformance.target_eq_next_of_positive positive
    by_cases selected : source =
        SubstantiveReconnectConformance.reconnectSource
    · subst source
      have target_is_reconnect :
          target = SubstantiveReconnectConformance.reconnectTarget := by
        simpa [SubstantiveReconnectConformance.nextState] using target_eq
      clear target_eq
      subst target
      have event_is_reconnect :
          positiveLabelling.event positive =
            SubstantiveReconnectConformance.reconnectEvent := by
        change
          (if
            SubstantiveReconnectConformance.reconnectSource =
              SubstantiveReconnectConformance.reconnectSource
           then SubstantiveReconnectConformance.reconnectEvent
           else
             .hold SubstantiveReconnectConformance.reconnectSource) =
            SubstantiveReconnectConformance.reconnectEvent
        simp
      refine
        ProductFMSLabelling.edgeOfMeaning
          classify denote positive ?_ ?_
      · rw [event_is_reconnect]
        exact
          EventFMSMeaning.normative selectedRow
            (by
              rw [selectedRow_family_eq_core]
              exact core.piFMSAlignment.actual)
            (by
              rw [selectedRow_family]
              exact denote_reconnectSource)
            (by
              rw [selectedRow_family]
              exact denote_reconnectTarget)
      · rw [event_is_reconnect]
        rfl
    · have target_is_source : target = source := by
        simpa [SubstantiveReconnectConformance.nextState, selected] using
          target_eq
      clear target_eq
      subst target
      have event_is_hold :
          positiveLabelling.event positive = .hold source := by
        change
          (if source = SubstantiveReconnectConformance.reconnectSource
           then SubstantiveReconnectConformance.reconnectEvent
           else .hold source) =
            .hold source
        simp [selected]
      refine
        ProductFMSLabelling.edgeOfMeaning
          classify denote positive ?_ ?_
      · rw [event_is_hold]
        exact EventFMSMeaning.externalHold rfl
      · rw [event_is_hold]
        trivial

/-! ## The canonical reconnect-then-hold path -/

def canonicalStatePath :
    Nat → SubstantiveReconnectConformance.State signature
  | 0 => SubstantiveReconnectConformance.reconnectSource
  | _ + 1 => SubstantiveReconnectConformance.reconnectTarget

def canonicalPositivePath : PositiveStatePath productKernel where
  state := canonicalStatePath
  positive := by
    intro n
    cases n with
    | zero =>
        rw [show canonicalStatePath 0 =
          SubstantiveReconnectConformance.reconnectSource by rfl]
        rw [show canonicalStatePath (0 + 1) =
          SubstantiveReconnectConformance.reconnectTarget by rfl]
        rw [SubstantiveReconnectConformance.selected_kernel_edge]
        norm_num
    | succ n =>
        simp [canonicalStatePath, productKernel,
          SubstantiveReconnectConformance.kernel,
          SubstantiveReconnectConformance.kernelProbability,
          SubstantiveReconnectConformance.nextState,
          SubstantiveReconnectConformance.reconnectSource,
          SubstantiveReconnectConformance.reconnectTarget]

def canonicalTrajectoryAgreement :
    positiveLabelling.TrajectoryAgreement canonicalPositivePath :=
  positiveLabelling.trajectoryAgreement canonicalPositivePath

def canonicalCommonFMSTrajectory :
    CommonFMSTrajectory
      positiveLabelling productFMSLabelling
      canonicalPositivePath canonicalTrajectoryAgreement :=
  CommonFMSTrajectory.ofTrajectoryAgreement

/-!
The selected-row certificate is the generic anti-drift object.  In
particular, its operation, metadata, raw late-pi transition, and denotational
endpoints all come from `core`, rather than from parallel reference data.
-/
def completeCertificate :
    CompleteProductCommonTrajectoryCertificate
      core positiveLabelling productFMSLabelling
      canonicalPositivePath canonicalTrajectoryAgreement 0 where
  common := canonicalCommonFMSTrajectory
  selectedRow := selectedRow
  selectedEvent := rfl
  selectedSource := rfl
  selectedTarget := rfl
  selectedMark := rfl
  operationExact := rfl
  metadataExact := rfl
  sourceDenotation := by
    rw [← selectedRow_family_eq_core, selectedRow_family]
    exact denote_reconnectSource
  targetDenotation := by
    rw [← selectedRow_family_eq_core, selectedRow_family]
    exact denote_reconnectTarget

theorem completeCertificate_nonempty :
    Nonempty
      (CompleteProductCommonTrajectoryCertificate
        core positiveLabelling productFMSLabelling
        canonicalPositivePath canonicalTrajectoryAgreement 0) :=
  ⟨completeCertificate⟩

/-! ## Exact selected-row facts exposed for audit -/

@[simp]
theorem first_selected_event :
    canonicalTrajectoryAgreement.trajectory.event 0 =
      SubstantiveReconnectConformance.candidate.event :=
  completeCertificate.selectedEvent

@[simp]
theorem first_selected_source :
    canonicalTrajectoryAgreement.trajectory.state 0 =
      SubstantiveReconnectConformance.candidate.before :=
  completeCertificate.selectedSource

@[simp]
theorem first_selected_target :
    canonicalTrajectoryAgreement.trajectory.state 1 =
      SubstantiveReconnectConformance.candidate.after := by
  simpa using completeCertificate.selectedTarget

@[simp]
theorem first_selected_mark :
    (canonicalCommonFMSTrajectory.row 0).mark =
      .normative selectedRow :=
  completeCertificate.selectedMark

theorem first_operation_exact :
    selectedRow.operation =
      core.piFMSAlignment.operational.operation
        ((SubstantiveReconnectConformance.operationalProjection
          .pi signature).mapEvent
            SubstantiveReconnectConformance.candidate.event) :=
  completeCertificate.operationExact

theorem first_family_exact :
    selectedRow.family = core.piFMSAlignment.family :=
  completeCertificate.familyExact

theorem first_metadata_exact :
    selectedRow.metadata = core.piFMSAlignment.metadata :=
  completeCertificate.metadataExact

theorem first_metadata_from_selected_replay :
    selectedRow.metadata =
      canonicalStableMetadata
        (productPackage.eventRecord
          SubstantiveReconnectConformance.candidate.event).event :=
  completeCertificate.metadataFromSelectedReplay

theorem first_native :
    productPackage.lts.ObservableStep
      SubstantiveReconnectConformance.candidate.before
      SubstantiveReconnectConformance.candidate.event
      SubstantiveReconnectConformance.candidate.after :=
  completeCertificate.selectedNative

theorem first_replay :
    (productPackage.eventRecord
      SubstantiveReconnectConformance.candidate.event).Replays
      (productPackage.configOf
        SubstantiveReconnectConformance.candidate.before)
      (productPackage.configOf
        SubstantiveReconnectConformance.candidate.after) :=
  completeCertificate.selectedReplay

theorem first_projected_native :
    (SubstantiveReconnectConformance.viewPackage .pi signature).lts.ObservableStep
      ((SubstantiveReconnectConformance.operationalProjection
        .pi signature).mapState
          SubstantiveReconnectConformance.candidate.before)
      ((SubstantiveReconnectConformance.operationalProjection
        .pi signature).mapEvent
          SubstantiveReconnectConformance.candidate.event)
      ((SubstantiveReconnectConformance.operationalProjection
        .pi signature).mapState
          SubstantiveReconnectConformance.candidate.after) :=
  completeCertificate.selectedProjectedNative

theorem first_registry_realizes :
    core.piFMSAlignment.operational.Realizes
      (ProductPiOperationalSemantics.stableMetadataOfDPOEvent
        (productPackage.eventRecord
          SubstantiveReconnectConformance.candidate.event).event)
      core.piFMSAlignment.projectedNative :=
  completeCertificate.selectedRegistryRealizes

theorem first_raw_native :
    Late.NativeStep
      (core.piFMSAlignment.operational.statePayload
        ((SubstantiveReconnectConformance.operationalProjection
          .pi signature).mapState
            SubstantiveReconnectConformance.candidate.before))
      (core.piFMSAlignment.operational.actionPayload
        ((SubstantiveReconnectConformance.operationalProjection
          .pi signature).mapEvent
            SubstantiveReconnectConformance.candidate.event))
      (core.piFMSAlignment.operational.statePayload
        ((SubstantiveReconnectConformance.operationalProjection
          .pi signature).mapState
            SubstantiveReconnectConformance.candidate.after)) :=
  completeCertificate.selectedRawNative

theorem first_raw_source :
    Late.Struct
      (core.piFMSAlignment.operational.statePayload
        ((SubstantiveReconnectConformance.operationalProjection
          .pi signature).mapState
            SubstantiveReconnectConformance.candidate.before))
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        core.piFMSAlignment.family) :=
  completeCertificate.selectedRawSource

theorem first_raw_derivative :
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha
      { action :=
          core.piFMSAlignment.operational.actionPayload
            ((SubstantiveReconnectConformance.operationalProjection
              .pi signature).mapEvent
                SubstantiveReconnectConformance.candidate.event)
        target :=
          core.piFMSAlignment.operational.statePayload
            ((SubstantiveReconnectConformance.operationalProjection
              .pi signature).mapState
                SubstantiveReconnectConformance.candidate.after) }
      { action :=
          Cantilune.Pi.P1cFullNativeRefinement.firstAction
            core.piFMSAlignment.family
        target :=
          Cantilune.Pi.P1cFullNativeRefinement.firstTarget
            core.piFMSAlignment.family } :=
  completeCertificate.selectedRawDerivative

theorem first_source_denotation :
    (canonicalCommonFMSTrajectory.row 0).sourceDenotation =
      normativeSourceAgent core.piFMSAlignment.family :=
  completeCertificate.sourceDenotation

theorem first_target_denotation :
    (canonicalCommonFMSTrajectory.row 0).targetDenotation =
      normativeTargetAgent core.piFMSAlignment.family :=
  completeCertificate.targetDenotation

theorem first_actual_fms :
    TotalCompiledNormativeCommutation core.piFMSAlignment.family :=
  completeCertificate.selectedActualFMS

@[simp]
theorem later_selected_mark (n : Nat) :
    (canonicalCommonFMSTrajectory.row (n + 1)).mark =
      .externalHold :=
  rfl

theorem first_hold_endpoint_seam :
    (canonicalCommonFMSTrajectory.row 0).targetDenotation =
      (canonicalCommonFMSTrajectory.row 1).sourceDenotation :=
  canonicalCommonFMSTrajectory.adjacentDenotation 0

end Reference

end Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory
