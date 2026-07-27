import Mathlib
import Cantilune.Pi.AdmissionCertificate

/-!
# Signature-admission π projection regressions

These checks cover one finite reference event only.  They do not claim general
P1c admission, mobility, or dynamic-reconfiguration completeness.
-/

namespace Cantilune.Tests.AdmissionProjection

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.AdmissionCertificate

example :
    Fintype.card ReferenceSignature.source.Obj = 1 ∧
      Fintype.card ReferenceSignature.source.Gen = 1 ∧
      Fintype.card ReferenceSignature.target.Obj = 2 ∧
      Fintype.card ReferenceSignature.target.Gen = 2 := by
  native_decide

/-- The appended generator is not in the image of the old generator injection. -/
example :
    ¬∃ old : ReferenceSignature.source.Gen,
      ReferenceSignature.extension.gen old =
        ReferenceSignature.TargetGenerator.admitted := by
  native_decide

/-- All four views give the new generator a total interpretation. -/
example :
    (ReferenceSignature.newViews.dag.generator
        ReferenceSignature.TargetGenerator.admitted).ordinal = 1 ∧
      (ReferenceSignature.newViews.petri.generator
        ReferenceSignature.TargetGenerator.admitted).ordinal = 1 ∧
      (ReferenceSignature.newViews.pi.generator
        ReferenceSignature.TargetGenerator.admitted).ordinal = 1 ∧
      (ReferenceSignature.newViews.morphism.generator
        ReferenceSignature.TargetGenerator.admitted).ordinal = 1 := by
  native_decide

example :
    sourceLTS.ObservableStep .before .admission .after :=
  source_admission_observable

example :
    targetLTS.ObservableStep
      certifiedAdmissionWait admissionAction .zero :=
  certificate.sound source_admission_observable

/-- No target-native action is hidden by the observation policy. -/
example (action : Action) :
    targetLTS.observable action :=
  trivial

/-- The only native step from the mapped before-state reflects to admission. -/
example {action : Action} {target : Proc}
    (step : targetLTS.ObservableStep
      (certificate.mapState .before) action target) :
    ∃ event state,
      sourceLTS.ObservableStep .before event state ∧
        certificate.Lift event action ∧
        targetLTS.stateSetoid.r target (certificate.mapState state) :=
  certificate.reflect step

/-- The mapped after-state is genuinely terminal in the complete native LTS. -/
example {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step (certificate.mapState .after) action target :=
  admitted_zero_no_native_step

example :
    sourceLTS.signatureVersion admissionCompatibility.sourceBefore =
      ReferenceSignature.event.fromVersion ∧
      sourceLTS.signatureVersion admissionCompatibility.sourceAfter =
        ReferenceSignature.event.toVersion ∧
      targetLTS.signatureVersion
          (certificate.mapState admissionCompatibility.sourceBefore) =
        ReferenceSignature.event.fromVersion ∧
      targetLTS.signatureVersion
          (certificate.mapState admissionCompatibility.sourceAfter) =
        ReferenceSignature.event.toVersion :=
  ⟨admissionCompatibility.sourceBeforeVersion,
    admissionCompatibility.sourceAfterVersion,
    admissionCompatibility.targetBeforeVersion,
    admissionCompatibility.targetAfterVersion⟩

example :
    targetLTS.SuccessfulTermination (certificate.mapState .after) :=
  ⟨by
    rintro ⟨event, target, step⟩
    exact admitted_zero_no_native_step step.1,
   rfl⟩

end Cantilune.Tests.AdmissionProjection
