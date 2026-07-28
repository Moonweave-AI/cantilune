import Cantilune.Pi.P1cSupportedFeedbackBridge
import Cantilune.Tests.P1cAdmittedOperations

namespace Cantilune.Tests.P1cSupportedFeedbackBridge

open Cantilune.Feedback
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Pi.P1cSupportedFeedbackBridge
open Cantilune.Tests.P1cAdmittedOperations

/-- A concrete admitted mismatch-decision occurrence inhabits the support LTS. -/
example :
    (supportedLTS mismatchOccurrence).ObservableStep
      false .business true :=
  supported_business mismatchOccurrence

/-- The concrete support step commutes with its evidence interpretation. -/
example :
    (bridge mismatchOccurrence).stateMap true =
      applyEvent
        ((bridge mismatchOccurrence).stateMap false)
        ((bridge mismatchOccurrence).eventMap .business) :=
  (bridge mismatchOccurrence).step_commutes
    (supported_business mismatchOccurrence)

/-- Pending/completed stability agrees with the evidence-level boundary. -/
example :
    stable true = true ↔
      (feedbackState true).evidence.StableRegion 1 :=
  stable_iff_evidence_stable true

-- The pathwise obstruction is part of the public regression boundary:
-- adding the zero-mass reset to the supported bridge would contradict
-- evidence monotonicity.
#check no_totalized_feedback_map

end Cantilune.Tests.P1cSupportedFeedbackBridge
