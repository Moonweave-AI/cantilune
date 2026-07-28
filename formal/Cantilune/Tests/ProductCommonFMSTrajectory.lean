import Cantilune.Feedback.ProductCommonFMSTrajectory

/-!
# Regression checks for event-level common-FMS trajectories

These checks keep the CENTRAL-18 boundary polymorphic in the product
signature, execution package, stochastic kernel, and positive event
labelling.  They exercise the constructive trajectory theorem and the exact
admission metadata seam without manufacturing a production package.
-/

noncomputable section

namespace Cantilune.Tests.ProductCommonFMSTrajectory

open Cantilune.Core
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.P1cOperationRegistry

#check NormativeRegistryRow.family_eq_familyAt
#check canonicalStableMetadata
#check ProductFMSLabelling.edgeOfMeaning
#check PositiveEdgeFMSAlignment.normative_metadata_eq_canonical
#check PositiveEdgeFMSAlignment.normative_metadata_fields
#check CommonFMSTrajectory.ofTrajectoryAgreement
#check CommonFMSTrajectory.ofTrajectoryAgreement_event_mark
#check CommonFMSTrajectory.ofTrajectoryAgreement_replay
#check CommonFMSTrajectory.ofTrajectoryAgreement_normative_metadata
#check CommonFMSTrajectory.ofTrajectoryAgreement_adjacent_denotation
#check common_fms_trajectory_of_positive_path
#check HeterogeneousAdmissionFMSAlignment.admission_family
#check HeterogeneousAdmissionFMSAlignment.target_is_next_business_source
#check HeterogeneousAdmissionFMSAlignment.normative_endpoint_seam
#check HeterogeneousAdmissionFMSAlignment.target_epoch_versions
#check HeterogeneousAdmissionFMSAlignment.stable_metadata_seam

variable
    {signature : FinSignature}
    {package : ExecutionPackage signature}
    {State : Type*}
    [Fintype State] [DecidableEq State]
    {kernel : NativeMarkovKernel signature package State}
    (labelling : PositiveEventLabelling kernel)
    (alignment : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path)

/-- The central constructor is usable without a total null-edge labelling. -/
example :
    Nonempty
      (CommonFMSTrajectory
        labelling alignment path agreement) :=
  common_fms_trajectory_of_positive_path
    labelling alignment path agreement

/-- Every constructed row keeps the selected event's exact replay. -/
example (n : Nat) :
    (package.eventRecord (agreement.trajectory.event n)).Replays
      (package.configOf (agreement.trajectory.state n))
      (package.configOf (agreement.trajectory.state (n + 1))) :=
  CommonFMSTrajectory.ofTrajectoryAgreement_replay
    (alignment := alignment) n

/-- The actual recursive FMS endpoint composes literally between rows. -/
example (n : Nat) :
    ((CommonFMSTrajectory.ofTrajectoryAgreement
      (alignment := alignment)
      (agreement := agreement)).row n).targetDenotation =
      ((CommonFMSTrajectory.ofTrajectoryAgreement
        (alignment := alignment)
        (agreement := agreement)).row (n + 1)).sourceDenotation :=
  CommonFMSTrajectory.ofTrajectoryAgreement_adjacent_denotation n

#print axioms CommonFMSTrajectory.ofTrajectoryAgreement
#print axioms CommonFMSTrajectory.ofTrajectoryAgreement_normative_metadata
#print axioms common_fms_trajectory_of_positive_path
#print axioms HeterogeneousAdmissionFMSAlignment.admission_family
#print axioms HeterogeneousAdmissionFMSAlignment.target_is_next_business_source
#print axioms HeterogeneousAdmissionFMSAlignment.normative_endpoint_seam
#print axioms HeterogeneousAdmissionFMSAlignment.stable_metadata_seam

end Cantilune.Tests.ProductCommonFMSTrajectory
