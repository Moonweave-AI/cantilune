import Cantilune.Feedback.ProductCommonFMSTrajectory
import Cantilune.Theorems.SubstantiveReconnectConformance

/-!
# Nonempty admission-to-reconnect actual-FMS seam

This module instantiates the heterogeneous common-FMS boundary with the
substantive reference admission and its already admitted reconnect
candidate.  Admission is the visible strong input phase; its actual-Agent
target is literally the source of the following genuine reconnect tau step.

The two rows carry one transaction identity and target-epoch version.  Their
families are selected by the closed sixty-operation registry, not by a free
event-family field.
-/

noncomputable section

namespace Cantilune.Theorems.SubstantiveAdmissionReconnectFMSAlignment

open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cOperationRegistry

namespace Reference

open Cantilune.Theorems.SubstantiveReconnectConformance

/--
One replay-stable transaction identity, decoded from the exact admitted
reconnect candidate rather than manufactured independently.
-/
def transactionMetadata : StableMetadata :=
  canonicalStableMetadata
    ((sourcePackage newSignature).eventRecord reconnectEvent).event

theorem transactionMetadata_is_candidate_canonical :
    transactionMetadata =
      canonicalStableMetadata
        ((sourcePackage newSignature).eventRecord reconnectEvent).event :=
  rfl

/-- The visible signature-admission phase. -/
def admissionRow : NormativeRegistryRow where
  operation := dynamicPartnerAdmissionOperation
  metadata := transactionMetadata

/-- The following fixed-epoch reconnect phase of the same transaction. -/
def reconnectRow : NormativeRegistryRow where
  operation := instanceReconnectOperation
  metadata := transactionMetadata

@[simp]
theorem admissionRow_family :
    admissionRow.family = .dynamicPartnerAdmission := by
  simp [admissionRow, NormativeRegistryRow.family]

@[simp]
theorem reconnectRow_family :
    reconnectRow.family = .instanceReconnect := by
  simp [reconnectRow, NormativeRegistryRow.family]

/--
The reference heterogeneous seam is inhabited with literal actual-Agent
endpoint equality.
-/
def alignment :
    HeterogeneousAdmissionFMSAlignment
      admission admissionRow reconnectRow
      (normativeTargetAgent .dynamicPartnerAdmission)
      (normativeSourceAgent .instanceReconnect) where
  admissionOperationRefinesTo := by
    decide
  admissionCommutation := by
    change TotalCompiledNormativeCommutation admissionRow.family
    rw [admissionRow_family]
    exact totalCompiledNormativeCommutation .dynamicPartnerAdmission
  nextBusinessCommutation := by
    change TotalCompiledNormativeCommutation reconnectRow.family
    rw [reconnectRow_family]
    exact totalCompiledNormativeCommutation .instanceReconnect
  admissionTarget_exact := by
    change
      normativeTargetAgent .dynamicPartnerAdmission =
        normativeTargetAgent admissionRow.family
    rw [admissionRow_family]
  nextBusinessSource_exact := by
    change
      normativeSourceAgent .instanceReconnect =
        normativeSourceAgent reconnectRow.family
    rw [reconnectRow_family]
  endpointSeam := dynamic_admission_target_eq_reconnect_source
  admissionVersion := by
    rfl
  nextBusinessVersion := by
    rfl
  rule_preserved := by
    rfl
  session_preserved := by
    rfl
  correlation_preserved := by
    rfl
  occurrence_preserved := by
    rfl

theorem nonempty_alignment :
    Nonempty
      (HeterogeneousAdmissionFMSAlignment
        admission admissionRow reconnectRow
        (normativeTargetAgent .dynamicPartnerAdmission)
        (normativeSourceAgent .instanceReconnect)) :=
  ⟨alignment⟩

theorem exact_endpoint_seam :
    normativeTargetAgent .dynamicPartnerAdmission =
      normativeSourceAgent .instanceReconnect :=
  alignment.normative_endpoint_seam

theorem target_epoch_is_three :
    admissionRow.metadata.version = 3 ∧
      reconnectRow.metadata.version = 3 := by
  exact alignment.target_epoch_versions

#print axioms alignment
#print axioms nonempty_alignment
#print axioms exact_endpoint_seam

end Reference

end Cantilune.Theorems.SubstantiveAdmissionReconnectFMSAlignment
