import Cantilune.Pi.P1cTerminalExecutionClassification
import Cantilune.Tests.P1cAdmittedOperations

namespace Cantilune.Tests.P1cTerminalExecutionClassification

open Cantilune.Core
open Cantilune.Pi.P1cTerminalExecutionClassification
open Cantilune.Tests.P1cAdmittedOperations

example :
    (package mismatchOccurrence).lts.SuccessfulTermination .successful := by
  exact (successfulTermination_iff mismatchOccurrence .successful).mpr rfl

example :
    (package mismatchOccurrence).lts.ExternalWait .waiting := by
  exact (externalWait_iff mismatchOccurrence .waiting).mpr rfl

example :
    (package mismatchOccurrence).lts.Deadlocked .deadlocked := by
  exact (deadlocked_iff mismatchOccurrence .deadlocked).mpr rfl

example : SteadyProductive mismatchOccurrence .productive :=
  productive_steady mismatchOccurrence

example (state : State) :
    (package mismatchOccurrence).lts.ObservableStep .ready .business state ↔
      (package mismatchOccurrence).lts.SuccessfulTermination state ∨
        (package mismatchOccurrence).lts.ExternalWait state ∨
        (package mismatchOccurrence).lts.Deadlocked state ∨
        SteadyProductive mismatchOccurrence state :=
  p1c_terminal_classification_iff mismatchOccurrence state

example (state : State) :
    (¬((package mismatchOccurrence).lts.SuccessfulTermination state ∧
      (package mismatchOccurrence).lts.ExternalWait state)) ∧
    (¬((package mismatchOccurrence).lts.SuccessfulTermination state ∧
      (package mismatchOccurrence).lts.Deadlocked state)) ∧
    (¬((package mismatchOccurrence).lts.ExternalWait state ∧
      (package mismatchOccurrence).lts.Deadlocked state)) ∧
    (¬((package mismatchOccurrence).lts.SuccessfulTermination state ∧
      SteadyProductive mismatchOccurrence state)) ∧
    (¬((package mismatchOccurrence).lts.ExternalWait state ∧
      SteadyProductive mismatchOccurrence state)) ∧
    ¬((package mismatchOccurrence).lts.Deadlocked state ∧
      SteadyProductive mismatchOccurrence state) :=
  terminal_or_productive_pairwise_disjoint mismatchOccurrence state

example :
    ClassifiedEndpointEvidence mismatchOccurrence .waiting :=
  classified_endpoint_evidence mismatchOccurrence .waiting
    (native_business_wait mismatchOccurrence)

example :
    ClassifiedEndpointEvidence deleteOccurrence .productive :=
  classified_endpoint_evidence deleteOccurrence .productive
    (native_business_productive deleteOccurrence)

example :
    (package deleteOccurrence).deletionPermitted .ready := by
  simp [package, deletionPermitted, deleteOccurrence]

example :
    (package deleteOccurrence).resourcesClear .ready :=
  (package deleteOccurrence).deletion_resource_safe (by
    simp [package, deletionPermitted, deleteOccurrence])

example :
    (package deleteOccurrence).sessionsQuiescent .ready :=
  (package deleteOccurrence).deletion_session_safe (by
    simp [package, deletionPermitted, deleteOccurrence])

end Cantilune.Tests.P1cTerminalExecutionClassification
