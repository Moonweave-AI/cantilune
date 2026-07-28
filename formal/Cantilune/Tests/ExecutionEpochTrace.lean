import Cantilune.Pi.P1cExecutionEpoch
import Cantilune.Tests.P1cAdmittedOperations

/-!
# Replay-verified execution epoch regressions

These checks keep fixed-signature multi-step replay and heterogeneous
signature admission visibly separate.
-/

namespace Cantilune.Tests.ExecutionEpochTrace

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi.P1cExecutionEpoch
open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Tests.P1cAdmittedOperations

example :
    (businessThenHoldEpoch mismatchOccurrence).events.length = 2 := by
  rfl

example :
    replayEvents (package mismatchOccurrence)
        (businessThenHoldEpoch mismatchOccurrence).events
        mismatchOccurrence.source =
      some mismatchOccurrence.target :=
  business_then_hold_replay_agreement mismatchOccurrence

example :
    ((package reconnectOccurrence).eventRecord
        .business).event.signatureVersion =
      (businessThenHoldEpoch reconnectOccurrence).executionEpoch :=
  business_record_execution_epoch reconnectOccurrence

example :
    ((package deleteOccurrence).eventRecord
        .completedExternalHold).event.signatureVersion =
      (businessThenHoldEpoch deleteOccurrence).executionEpoch :=
  completed_hold_record_execution_epoch deleteOccurrence

example :
    (∃ source target,
      (package mismatchOccurrence).lts.ObservableStep
        source .business target ∧
      ((package mismatchOccurrence).eventRecord .business).Replays
        ((package mismatchOccurrence).configOf source)
        ((package mismatchOccurrence).configOf target)) ∧
    (∃ source target,
      (package mismatchOccurrence).lts.ObservableStep
        source .completedExternalHold target ∧
      ((package mismatchOccurrence).eventRecord
        .completedExternalHold).Replays
        ((package mismatchOccurrence).configOf source)
        ((package mismatchOccurrence).configOf target)) :=
  business_and_hold_have_verified_replay mismatchOccurrence

namespace Admission

open Cantilune.Pi.AdmissionCertificate

example
    (source : Config ReferenceSignature.source)
    (sourceVersion :
      source.signatureVersion = ReferenceSignature.event.fromVersion) :
    source.signatureVersion <
      (admissionTarget ReferenceSignature.event source).signatureVersion :=
  ReferenceAdmission.strictly_advances source sourceVersion

end Admission

end Cantilune.Tests.ExecutionEpochTrace
