import Cantilune.Core.ExecutionEpochTrace
import Cantilune.Pi.AdmissionCertificate
import Cantilune.Pi.P1cAdmittedTrajectory

/-!
# Concrete execution-epoch witnesses for admitted P1c operations

This module instantiates the generic replay-epoch layer with:

* one admitted P1c business event followed by a productive external hold, both
  inside the same runtime signature version; and
* the reference four-view signature admission, replayed as a heterogeneous
  boundary with a strictly larger version.

No observation-opportunity index is used as an execution epoch.
-/

noncomputable section

namespace Cantilune.Pi.P1cExecutionEpoch

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi.P1cAdmittedOperations

variable {σ : FinSignature}

/-- The concrete native path used by `businessThenHoldEpoch`. -/
theorem businessThenHoldPath
    (occurrence : Occurrence σ) :
    (P1cAdmittedTrajectory.package occurrence).lts.Path
      false [.business, .completedExternalHold] true :=
  ObservableLTS.Path.cons
    (P1cAdmittedTrajectory.native_business occurrence)
    (ObservableLTS.Path.cons
      (P1cAdmittedTrajectory.native_completed_hold occurrence)
      (ObservableLTS.Path.nil
        (L := (P1cAdmittedTrajectory.package occurrence).lts) true))

/--
Two replay-verified events share one execution epoch: first the native P1c
business step, then the explicit productive completed-state hold.
-/
def businessThenHoldEpoch
    (occurrence : Occurrence σ) :
    ReplayEpoch (P1cAdmittedTrajectory.package occurrence) where
  executionEpoch := occurrence.source.signatureVersion
  source := false
  target := true
  events :=
    [.business, .completedExternalHold]
  path := businessThenHoldPath occurrence
  source_epoch :=
    P1cAdmittedTrajectory.configOf_signatureVersion occurrence false

/-- The two-event sequence is independently replayed from endpoint-free recipes. -/
theorem business_then_hold_replay_agreement
    (occurrence : Occurrence σ) :
    replayEvents (P1cAdmittedTrajectory.package occurrence)
        (businessThenHoldEpoch occurrence).events
        occurrence.source =
      some occurrence.target := by
  change
    replayEvents (P1cAdmittedTrajectory.package occurrence)
        (businessThenHoldEpoch occurrence).events
        ((P1cAdmittedTrajectory.package occurrence).configOf false) =
      some ((P1cAdmittedTrajectory.package occurrence).configOf true)
  exact (businessThenHoldEpoch occurrence).replay_agreement

/-- The business record carries the concrete runtime execution epoch. -/
theorem business_record_execution_epoch
    (occurrence : Occurrence σ) :
    ((P1cAdmittedTrajectory.package occurrence).eventRecord
        .business).event.signatureVersion =
      (businessThenHoldEpoch occurrence).executionEpoch := by
  apply (businessThenHoldEpoch occurrence).event_signature_epoch
  simp [businessThenHoldEpoch]

/-- The following external hold carries the same runtime execution epoch. -/
theorem completed_hold_record_execution_epoch
    (occurrence : Occurrence σ) :
    ((P1cAdmittedTrajectory.package occurrence).eventRecord
        .completedExternalHold).event.signatureVersion =
      (businessThenHoldEpoch occurrence).executionEpoch := by
  apply (businessThenHoldEpoch occurrence).event_signature_epoch
  simp [businessThenHoldEpoch]

/--
Both concrete labels have native endpoints and replay-verified DPO records.
-/
theorem business_and_hold_have_verified_replay
    (occurrence : Occurrence σ) :
    (∃ source target,
      (P1cAdmittedTrajectory.package occurrence).lts.ObservableStep
        source .business target ∧
      ((P1cAdmittedTrajectory.package occurrence).eventRecord
        .business).Replays
          ((P1cAdmittedTrajectory.package occurrence).configOf source)
          ((P1cAdmittedTrajectory.package occurrence).configOf target)) ∧
    (∃ source target,
      (P1cAdmittedTrajectory.package occurrence).lts.ObservableStep
        source .completedExternalHold target ∧
      ((P1cAdmittedTrajectory.package occurrence).eventRecord
        .completedExternalHold).Replays
          ((P1cAdmittedTrajectory.package occurrence).configOf source)
          ((P1cAdmittedTrajectory.package occurrence).configOf target)) := by
  constructor
  · apply (businessThenHoldEpoch occurrence).event_has_verified_replay
    simp [businessThenHoldEpoch]
  · apply (businessThenHoldEpoch occurrence).event_has_verified_replay
    simp [businessThenHoldEpoch]

namespace ReferenceAdmission

open Cantilune.Pi.AdmissionCertificate

/--
The concrete reference admission replays from every correctly versioned source
configuration to its deterministic heterogeneous reindexing.
-/
theorem replays
    (source : Config ReferenceSignature.source)
    (sourceVersion :
      source.signatureVersion = ReferenceSignature.event.fromVersion) :
    AdmissionReplays ReferenceSignature.event source
      (admissionTarget ReferenceSignature.event source) :=
  ⟨sourceVersion, rfl⟩

/-- The concrete reference boundary strictly advances the runtime version. -/
theorem strictly_advances
    (source : Config ReferenceSignature.source)
    (sourceVersion :
      source.signatureVersion = ReferenceSignature.event.fromVersion) :
    source.signatureVersion <
      (admissionTarget ReferenceSignature.event source).signatureVersion :=
  (replays source sourceVersion).version_strict

end ReferenceAdmission

end Cantilune.Pi.P1cExecutionEpoch
