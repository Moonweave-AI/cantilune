import Cantilune.Pi.P1cAdmittedP1aCertificates
import Cantilune.Tests.P1cAdmittedOperations

/-! Regression checks for concrete mismatch/reconnect/delete P1a packages. -/

namespace Cantilune.Tests.P1cAdmittedP1aCertificates

open Cantilune.Core
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedP1aCertificates
open Cantilune.Tests.P1cAdmittedOperations

example : SharedOccurrenceEvidence mismatchOccurrence :=
  sharedOccurrenceEvidence mismatchOccurrence

example : SharedOccurrenceEvidence reconnectOccurrence :=
  sharedOccurrenceEvidence reconnectOccurrence

example : SharedOccurrenceEvidence deleteOccurrence :=
  sharedOccurrenceEvidence deleteOccurrence

example :
    (sourcePackage reconnectOccurrence).configOf
        (.ready (family reconnectOccurrence)) =
      reconnectOccurrence.source ∧
    (sourcePackage reconnectOccurrence).configOf
        (.completed (family reconnectOccurrence)) =
      reconnectOccurrence.target :=
  ⟨rfl, rfl⟩

example :
    ((sourcePackage mismatchOccurrence).eventRecord
      (family mismatchOccurrence)).Replays
        mismatchOccurrence.source mismatchOccurrence.target :=
  source_replay_exact mismatchOccurrence (family mismatchOccurrence)

example :
    Cantilune.Pi.P1cAdmittedOperations.DAG.Step
      reconnectOccurrence.source reconnectOccurrence.request
      reconnectOccurrence.target := by
  have step :=
    (sharedOccurrenceEvidence reconnectOccurrence).dag.1
  exact Cantilune.Pi.P1cAdmittedP1aCertificates.DAG.step_native step

example :
    Cantilune.Pi.P1cAdmittedOperations.Petri.Step
      mismatchOccurrence.source mismatchOccurrence.request
      mismatchOccurrence.target := by
  have step :=
    (sharedOccurrenceEvidence mismatchOccurrence).petri.1
  exact Cantilune.Pi.P1cAdmittedP1aCertificates.Petri.step_native step

example :
    Cantilune.Pi.P1cAdmittedOperations.Morphism.Step
      deleteOccurrence.source deleteOccurrence.request
      deleteOccurrence.target := by
  have step :=
    (sharedOccurrenceEvidence deleteOccurrence).morphism.1
  exact Cantilune.Pi.P1cAdmittedP1aCertificates.Morphism.step_native step

example :
    (sourcePackage deleteOccurrence).deletionPermitted
      (.ready (family deleteOccurrence)) := by
  refine ⟨⟨family deleteOccurrence, rfl⟩, 0, ?_⟩
  rfl

example :
    (sourcePackage deleteOccurrence).resourcesClear
      (.ready (family deleteOccurrence)) :=
  (sourcePackage deleteOccurrence).deletion_resource_safe (by
    refine ⟨⟨family deleteOccurrence, rfl⟩, 0, ?_⟩
    rfl)

example :
    (sourcePackage deleteOccurrence).sessionsQuiescent
      (.ready (family deleteOccurrence)) :=
  (sourcePackage deleteOccurrence).deletion_session_safe (by
    refine ⟨⟨family deleteOccurrence, rfl⟩, 0, ?_⟩
    rfl)

example :
    ResourceProjectionCompatibility
      (Cantilune.Pi.P1cAdmittedP1aCertificates.DAG.certificate
        deleteOccurrence) :=
  dagResources deleteOccurrence

example :
    TerminalProjectionCompatibility
      (Cantilune.Pi.P1cAdmittedP1aCertificates.Petri.certificate
        mismatchOccurrence) :=
  petriTerminals mismatchOccurrence

end Cantilune.Tests.P1cAdmittedP1aCertificates
