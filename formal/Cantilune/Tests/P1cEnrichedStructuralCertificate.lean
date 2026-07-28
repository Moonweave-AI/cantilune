import Cantilune.Pi.P1cEnrichedStructuralCertificate

namespace Cantilune.Tests.P1cEnrichedStructuralCertificate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1cEnrichedStructuralCertificate
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.P1cOperationRegistry

#check certificate
#check complete_enriched_structural_p1c_certificate
#check step_iff_raw_representative
#check quotient_sound
#check quotient_reflect
#check stable_identifiers_preserved
#check all_registry_first_native
#check all_registry_first_target_step
#check refined_step_target_observable
#check bare_raw_transition_recovery_no_go
#check ProductOccurrenceAlignment
#check ProductOccurrenceAlignment.rawStructuralStep
#check ProductOccurrenceAlignment.enrichedTargetStep

#print axioms certificate
#print axioms complete_enriched_structural_p1c_certificate
#print axioms ProductOccurrenceAlignment.enrichedTargetStep

example :
    Fintype.card P1cMatrix.SourceEvent = 15 :=
  complete_enriched_structural_p1c_certificate.familyCount

example :
    Fintype.card OperationId = 60 :=
  complete_enriched_structural_p1c_certificate.registryCount

example :
    Function.Surjective familyAt :=
  complete_enriched_structural_p1c_certificate.registryCoversFamilies

example
    (operation : OperationId) (metadata : StableMetadata) :
    Late.NativeStep
      (readyProcess (familyAt operation))
      (firstAction (familyAt operation))
      (firstTarget (familyAt operation)) :=
  complete_enriched_structural_p1c_certificate
    |>.everyRegistryFirstIsNative operation metadata

example
    {source : RawState} {event : RawAction} {target : RawState}
    (step : RawStep source event target) :
    targetLTS.ObservableStep
      (mapState source) (mapAction event) (mapState target) :=
  certificate.sound ⟨step, trivial⟩

end Cantilune.Tests.P1cEnrichedStructuralCertificate
