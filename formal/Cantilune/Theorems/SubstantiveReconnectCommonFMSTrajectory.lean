import Cantilune.Feedback.ProductCommonFMSTrajectory
import Cantilune.Theorems.P1cProductRuleProofBundle

/-!
# A substantive reconnect common-FMS trajectory

This module instantiates the generic event-level common-FMS bridge with the
non-identity reconnect occurrence from `P1cProductRuleProofBundle.Reference`.
The stochastic path performs the admitted reconnect business event with
probability one and then remains on the explicit completed-state external
hold.

The business edge is classified by the closed registry operation
`instanceReconnectOperation`; its family is therefore definitionally
`familyAt instanceReconnectOperation`.  Its metadata is decoded from the
same verified `DPOEvent` that replays the graph update.  The hold is not
misreported as a normative registry event.
-/

noncomputable section

namespace Cantilune.Theorems.SubstantiveReconnectCommonFMSTrajectory

open Cantilune.Core
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Pi.P1cOperationRegistry
open Cantilune.Theorems.P1cProductRuleProofBundle

/-! ## The non-identity reference execution package -/

abbrev signature : FinSignature :=
  P1cProductRuleProofBundle.Reference.signature

abbrev occurrence :
    Cantilune.Pi.P1cAdmittedOperations.Occurrence signature :=
  P1cProductRuleProofBundle.Reference.occurrence

abbrev productPackage : ExecutionPackage signature :=
  Cantilune.Pi.P1cAdmittedTrajectory.package occurrence

abbrev productKernel :
    NativeMarkovKernel signature productPackage Bool :=
  Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence

def positiveLabelling :
    PositiveEventLabelling productKernel :=
  P1cProductRuleProofBundle.positiveLabelling occurrence

/-- Metadata is decoded from the exact verified business replay record. -/
def businessMetadata : StableMetadata :=
  canonicalStableMetadata
    (productPackage.eventRecord
      Cantilune.Pi.P1cAdmittedTrajectory.Event.business).event

/-- The reconnect row cannot carry an independently selected family. -/
def businessRow : NormativeRegistryRow where
  operation := instanceReconnectOperation
  metadata := businessMetadata

@[simp]
theorem businessRow_operation :
    businessRow.operation = instanceReconnectOperation :=
  rfl

@[simp]
theorem businessRow_family :
    businessRow.family = .instanceReconnect := by
  simp [businessRow, NormativeRegistryRow.family]

@[simp]
theorem businessRow_metadata_canonical :
    businessRow.metadata =
      canonicalStableMetadata
        (productPackage.eventRecord
          Cantilune.Pi.P1cAdmittedTrajectory.Event.business).event :=
  rfl

/-- Business is normative; all administrative/hold labels remain holds. -/
def classify :
    productPackage.lts.Event → ProductEventMark
  | .business => .normative businessRow
  | .pendingExternalHold
  | .completedExternalHold
  | .nullPathAdministrativeReset => .externalHold

/-- The two stochastic states are the exact actual-Agent reconnect endpoints. -/
def denote : Bool → ActualFMSEndpoint
  | false => normativeSourceAgent .instanceReconnect
  | true => normativeTargetAgent .instanceReconnect

/-! ## A nonempty product FMS labelling -/

/--
Every positive edge of the actual reconnect kernel has a complete FMS
certificate.  The only positive edges are business `false → true` and the
external hold `true → true`.
-/
def productFMSLabelling :
    ProductFMSLabelling positiveLabelling where
  classify := classify
  denote := denote
  positiveEdge := by
    intro source target positive
    cases source <;> cases target
    · norm_num [
        Cantilune.Pi.P1cAdmittedTrajectory.stateKernel,
        Cantilune.Pi.P1cAdmittedTrajectory.transition] at positive
    · refine
        ProductFMSLabelling.edgeOfMeaning
          classify denote positive ?_ ?_
      · exact
          EventFMSMeaning.normative businessRow
            (totalCompiledNormativeCommutation businessRow.family)
            (by simp [denote])
            (by simp [denote])
      · rfl
    · norm_num [
        Cantilune.Pi.P1cAdmittedTrajectory.stateKernel,
        Cantilune.Pi.P1cAdmittedTrajectory.transition] at positive
    · refine
        ProductFMSLabelling.edgeOfMeaning
          classify denote positive ?_ ?_
      · exact EventFMSMeaning.externalHold rfl
      · trivial

theorem productFMSLabelling_nonempty :
    Nonempty (ProductFMSLabelling positiveLabelling) :=
  ⟨productFMSLabelling⟩

/-! ## The canonical positive path and common-FMS trajectory -/

/-- One reconnect step followed by productive external holds. -/
def canonicalStatePath : Nat → Bool
  | 0 => false
  | _ + 1 => true

def canonicalPositivePath : PositiveStatePath productKernel where
  state := canonicalStatePath
  positive := by
    intro n
    cases n <;>
      norm_num [canonicalStatePath,
        Cantilune.Pi.P1cAdmittedTrajectory.stateKernel,
        Cantilune.Pi.P1cAdmittedTrajectory.transition]

def canonicalTrajectoryAgreement :
    positiveLabelling.TrajectoryAgreement canonicalPositivePath :=
  positiveLabelling.trajectoryAgreement canonicalPositivePath

def canonicalCommonFMSTrajectory :
    CommonFMSTrajectory
      positiveLabelling productFMSLabelling
      canonicalPositivePath canonicalTrajectoryAgreement :=
  CommonFMSTrajectory.ofTrajectoryAgreement

theorem canonicalCommonFMSTrajectory_nonempty :
    Nonempty
      (CommonFMSTrajectory
        positiveLabelling productFMSLabelling
        canonicalPositivePath canonicalTrajectoryAgreement) :=
  common_fms_trajectory_of_positive_path
    positiveLabelling productFMSLabelling
    canonicalPositivePath canonicalTrajectoryAgreement

/-! ## Exact first-row facts -/

@[simp]
theorem first_selected_event :
    canonicalTrajectoryAgreement.trajectory.event 0 =
      Cantilune.Pi.P1cAdmittedTrajectory.Event.business :=
  rfl

@[simp]
theorem first_selected_mark :
    (canonicalCommonFMSTrajectory.row 0).mark =
      .normative businessRow :=
  rfl

@[simp]
theorem first_source_denotation :
    (canonicalCommonFMSTrajectory.row 0).sourceDenotation =
      normativeSourceAgent .instanceReconnect :=
  rfl

@[simp]
theorem first_target_denotation :
    (canonicalCommonFMSTrajectory.row 0).targetDenotation =
      normativeTargetAgent .instanceReconnect :=
  rfl

/-- The selected business row metadata is fixed by its replay record. -/
theorem first_metadata_from_selected_replay :
    businessRow.metadata =
      canonicalStableMetadata
        (productPackage.eventRecord
          (canonicalTrajectoryAgreement.trajectory.event 0)).event :=
  CommonFMSTrajectory.ofTrajectoryAgreement_normative_metadata
    (alignment := productFMSLabelling)
    0 businessRow first_selected_mark

/-- The first row retains the genuine package transition. -/
theorem first_native :
    productPackage.lts.ObservableStep
      (canonicalTrajectoryAgreement.trajectory.state 0)
      (canonicalTrajectoryAgreement.trajectory.event 0)
      (canonicalTrajectoryAgreement.trajectory.state 1) :=
  (canonicalCommonFMSTrajectory.row 0).native

/-- The first row retains exact replay of the non-identity graph update. -/
theorem first_replay :
    (productPackage.eventRecord
      (canonicalTrajectoryAgreement.trajectory.event 0)).Replays
      (productPackage.configOf
        (canonicalTrajectoryAgreement.trajectory.state 0))
      (productPackage.configOf
        (canonicalTrajectoryAgreement.trajectory.state 1)) :=
  (canonicalCommonFMSTrajectory.row 0).replay

/-- Every later selected edge is the explicit external hold. -/
@[simp]
theorem later_selected_mark (n : Nat) :
    (canonicalCommonFMSTrajectory.row (n + 1)).mark =
      .externalHold := by
  rfl

/-- The first target and next hold source share one literal Agent endpoint. -/
theorem first_hold_endpoint_seam :
    (canonicalCommonFMSTrajectory.row 0).targetDenotation =
      (canonicalCommonFMSTrajectory.row 1).sourceDenotation :=
  canonicalCommonFMSTrajectory.adjacentDenotation 0

end Cantilune.Theorems.SubstantiveReconnectCommonFMSTrajectory
