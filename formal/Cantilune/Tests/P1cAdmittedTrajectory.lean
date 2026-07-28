import Cantilune.Pi.P1cAdmittedTrajectory
import Cantilune.Tests.P1cAdmittedOperations

/-! Kernel-checked event/epoch bridge regressions for all three critical rules. -/

namespace Cantilune.Tests.P1cAdmittedTrajectory

open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Tests.P1cAdmittedOperations

example :
    BusinessAgreement mismatchOccurrence
      (canonicalCompleteTrajectory mismatchOccurrence).trajectory
      (eventProgress mismatchOccurrence).progress.window 0 :=
  canonical_first_business_agreement mismatchOccurrence

example :
    BusinessAgreement reconnectOccurrence
      (canonicalCompleteTrajectory reconnectOccurrence).trajectory
      (eventProgress reconnectOccurrence).progress.window 0 :=
  canonical_first_business_agreement reconnectOccurrence

example :
    BusinessAgreement deleteOccurrence
      (canonicalCompleteTrajectory deleteOccurrence).trajectory
      (eventProgress deleteOccurrence).progress.window 0 :=
  canonical_first_business_agreement deleteOccurrence

example :
    transition false false = 0 ∧ transition true false = 0 :=
  ⟨pending_hold_probability_zero, null_reset_probability_zero⟩

example :
    SupportedStep false
      ((totalLabelling mismatchOccurrence).event false true) true :=
  positive_supported_step mismatchOccurrence (by
    norm_num [stateKernel, transition])

example :
    ¬(lts mismatchOccurrence).SuccessfulTermination true ∧
      ¬(lts mismatchOccurrence).ExternalWait true ∧
      ¬(lts mismatchOccurrence).Deadlocked true :=
  ⟨completed_not_successful mismatchOccurrence,
    completed_not_external_wait mismatchOccurrence,
    completed_not_deadlocked mismatchOccurrence⟩

end Cantilune.Tests.P1cAdmittedTrajectory
