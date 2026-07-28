import Cantilune.Core.FreeSMCArbitraryUniversal
import Cantilune.Core.DPOConcurrency
import Cantilune.Core.SignatureCoherence
import Cantilune.Core.Execution
import Cantilune.Core.Projection
import Cantilune.Pi.OperationalBridge
import Cantilune.Pi.P1bNominalIncidenceClosure
import Cantilune.Pi.P1cEnrichedStructuralCertificate
import Cantilune.Pi.P1cTerminalExecutionClassification
import Cantilune.Theorems.TechnicalClosure

/-!
# Central proof-obligation symbol regression

This file is deliberately boring: every `leanSymbol` recorded by
`formal/proof-obligations.json` is resolved by the same pinned Lean
environment as the regression suite.  Renaming or deleting a central theorem
therefore fails the build before governance evidence can become stale.
-/

#check
  Cantilune.Core.FreeSMCArbitraryUniversal.AtomicComparison.freeSMC_arbitrary_universal
#check Cantilune.Core.dpo_result_unique
#check
  Cantilune.Core.DPOConcurrency.ParallelIndependent.parallel_independent_concurrency
#check Cantilune.Core.signature_extension_coherent
#check Cantilune.Core.ObservableLTS.rewrite_respects_equiv
#check Cantilune.Core.DPOEvent.event_replay_unique
#check
  Cantilune.Core.ProjectionCertificate.projection_paths_lift_and_reflect
#check Cantilune.Theorems.TechnicalClosure.generic_p1a_projection_scope
#check Cantilune.Theorems.TechnicalClosure.generic_petri_projection
#check Cantilune.Theorems.TechnicalClosure.completeOpenPiSMCOperationalBoundary
#check Cantilune.Pi.Step.standard_typed_pi_erasure_operational
#check Cantilune.Theorems.TechnicalClosure.maximum_compatible_d1a_fms_closure
#check Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate
#check
  Cantilune.Pi.P1cEnrichedStructuralCertificate.complete_enriched_structural_p1c_certificate
#check
  Cantilune.Feedback.CompleteFiniteHeightClosure.FiniteHeightFeedbackClosure.hard_forward_invariant
#check
  Cantilune.Feedback.CompleteFiniteHeightClosure.FiniteHeightFeedbackClosure.feedback_almost_sure_hitting_with_replay
#check
  Cantilune.Pi.P1cTerminalExecutionClassification.p1c_terminal_classification_iff
#check
  Cantilune.Theorems.TechnicalClosure.generic_four_projection_consistency

/-! The final load-bearing anti-vacuity seams are also stable API. -/

#check
  Cantilune.Projection.P1aSemanticCertificate.PetriSemanticCertificate.selected_occurrence_incidence_closure
#check
  Cantilune.Projection.P1aSemanticCertificate.ReconfigurablePetriCertificate.complete_cross_epoch_incidence
#check
  Cantilune.Projection.P1aSemanticCertificate.ReconfigurablePetriCertificate.legacy_incidence_preserved
#check
  Cantilune.Theorems.CoreConformance.Reference.legacyPetriTransition_nonempty
#check
  Cantilune.Theorems.SubstantiveReconnectConformance.legacyPetriTransition_nonempty
#check
  Cantilune.Theorems.SubstantiveReconnectConformance.legacyPetriAntiVacuity
#check
  Cantilune.Theorems.CoreConformance.ProductAdmissionPiFMSAlignment.nativeRealization
#check
  Cantilune.Theorems.CoreConformance.ProductAdmissionPiFMSAlignment.admissionBoundaryMetadataExact
#check
  Cantilune.Theorems.CoreConformance.ProductAdmissionPiFMSAlignment.familyIsDynamicPartnerAdmission
#check
  Cantilune.Theorems.CoreConformance.ProductAdmissionPiFMSAlignment.actualTargetIsSelectedBusinessSource
#check Cantilune.Theorems.TechnicalClosure.reference_technical_closure
