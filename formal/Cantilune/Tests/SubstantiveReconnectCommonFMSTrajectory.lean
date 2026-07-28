import Cantilune.Theorems.SubstantiveReconnectCommonFMSTrajectory

/-! # Regression checks for the substantive reconnect common-FMS path -/

namespace Cantilune.Tests.SubstantiveReconnectCommonFMSTrajectory

open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cOperationRegistry
open Cantilune.Theorems.SubstantiveReconnectCommonFMSTrajectory

#check productFMSLabelling_nonempty
#check canonicalCommonFMSTrajectory_nonempty
#check first_selected_mark
#check first_metadata_from_selected_replay
#check first_native
#check first_replay
#check later_selected_mark
#check first_hold_endpoint_seam

example :
    businessRow.operation = instanceReconnectOperation :=
  businessRow_operation

example :
    businessRow.family = SourceEvent.instanceReconnect :=
  businessRow_family

example :
    (canonicalCommonFMSTrajectory.row 0).sourceDenotation =
      normativeSourceAgent .instanceReconnect :=
  first_source_denotation

example :
    (canonicalCommonFMSTrajectory.row 0).targetDenotation =
      normativeTargetAgent .instanceReconnect :=
  first_target_denotation

#print axioms productFMSLabelling_nonempty
#print axioms canonicalCommonFMSTrajectory_nonempty
#print axioms first_metadata_from_selected_replay
#print axioms first_replay
#print axioms first_hold_endpoint_seam

end Cantilune.Tests.SubstantiveReconnectCommonFMSTrajectory
