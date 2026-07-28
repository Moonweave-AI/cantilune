import Cantilune.Theorems.SubstantiveAdmissionReconnectFMSAlignment

/-! Regression checks for the nonempty admission/reconnect actual-FMS seam. -/

noncomputable section

namespace Cantilune.Tests.SubstantiveAdmissionReconnectFMSAlignment

open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Theorems.SubstantiveAdmissionReconnectFMSAlignment.Reference

/-- Admission is a genuine visible input to reconnect-ready raw syntax. -/
example :
    Late.NativeStep
      (readyProcess .dynamicPartnerAdmission)
      (firstAction .dynamicPartnerAdmission)
      (stateProcess .admissionEstablished) :=
  native_sound (Step.execute .dynamicPartnerAdmission)

/-- The explicit second phase is the genuine reconnect tau step. -/
example :
    Late.NativeStep
      (stateProcess .admissionEstablished)
      (mapEvent .admissionReconnect)
      (stateProcess (.completed .dynamicPartnerAdmission)) :=
  native_sound Step.admissionReconnect

/-- The corresponding actual-Agent endpoint is literally shared. -/
example :
    normativeTargetAgent .dynamicPartnerAdmission =
      normativeSourceAgent .instanceReconnect :=
  exact_endpoint_seam

#check nonempty_alignment
#print axioms nonempty_alignment
#print axioms exact_endpoint_seam

end Cantilune.Tests.SubstantiveAdmissionReconnectFMSAlignment
