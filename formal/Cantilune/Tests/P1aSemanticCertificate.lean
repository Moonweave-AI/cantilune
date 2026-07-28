import Cantilune.Projection.P1aSemanticCertificate
import Cantilune.Theorems.SubstantiveReconnectConformance

/-!
# Regression checks for non-vacuous P1a semantic certificates

The substantive reconnect reference instantiates both semantic certificates
at the same selected candidate.  This test is intentionally not a production
package conformance claim.
-/

noncomputable section

namespace Cantilune.Tests.P1aSemanticCertificate

open Cantilune.Projection.P1aSemanticCertificate
open Cantilune.Theorems.ProductRuleProofBundle
open Cantilune.Theorems.SubstantiveReconnectConformance

abbrev source :=
  sourcePackage newSignature

abbrev dag :=
  viewPackage .dag newSignature

abbrev petri :=
  viewPackage .petri newSignature

abbrev dagProjection :=
  operationalProjection .dag newSignature

abbrev petriProjection :=
  operationalProjection .petri newSignature

def reconnectDAG :
    DAGSemanticCertificate source dag dagProjection candidate where
  sourceOccurrence := SourceOccurrenceEvidence.ofNative reconnectNative
  occurrence := dagEvidence
  eventRecordExact := rfl
  beforeConfig := rfl
  afterConfig := rfl

def reconnectDeclaration : PetriRuleDeclaration where
  signatureVersion :=
    (source.eventRecord candidate.event).event.signatureVersion
  ruleId :=
    (source.eventRecord candidate.event).event.ruleId
  ordinal := 0

def reconnectNet :
    OrderedPreNet
      (Cantilune.Core.DPO.FiniteSupportEvent
        (ProvenanceToken newSignature)) where
  declarations := [reconnectDeclaration]
  uniqueRuleKeys := by simp
  strictDeclarationOrder := by simp
  transitionOf := by
    intro declaration declared
    have exactDeclaration : declaration = reconnectDeclaration := by
      simpa using declared
    subst declaration
    exact
      endpointDelta
        (source.eventRecord candidate.event).event.source
        (source.eventRecord candidate.event).event.target

def reconnectPetri :
    PetriSemanticCertificate
      source petri petriProjection candidate where
  sourceOccurrence := SourceOccurrenceEvidence.ofNative reconnectNative
  occurrence := petriEvidence
  eventRecordExact := rfl
  beforeConfig := rfl
  afterConfig := rfl
  net := reconnectNet
  selectedDeclaration := reconnectDeclaration
  selectedDeclared := by simp [reconnectNet]
  selectedVersion := rfl
  selectedRule := rfl
  selectedIncidenceExact := rfl

#check configDependencyGraph
#check DAGSemanticCertificate.beforeCondensation_acyclic
#check DAGSemanticCertificate.after_edge_internal_or_condensed
#check DAGSemanticCertificate.dag_event_record_exact
#check DAGSemanticCertificate.dag_replay_recipe_exact
#check PetriSemanticCertificate.petri_event_record_exact
#check PetriSemanticCertificate.petri_replay_recipe_exact
#check PetriSemanticCertificate.selectedTransition_incidence_exact
#check PetriSemanticCertificate.selectedTransition_enabled
#check PetriSemanticCertificate.selectedTransition_fires
#check PetriSemanticCertificate.selected_native_enabled_fires
#check PetriSemanticCertificate.selected_occurrence_incidence_closure
#check PetriSemanticCertificate.selectedTransition_retained_identity
#check reindexProvenanceToken_injective
#check reindexProvenanceToken_refl
#check reindexProvenanceToken_trans
#check reindexFiniteSupportEvent_erase
#check reindexFiniteSupportEvent_insert
#check reindexFiniteSupportEvent_refl
#check reindexFiniteSupportEvent_trans
#check PreNetExtension.old_declaration_is_prefix
#check PreNetExtension.old_incidence_reindexed
#check PreNetExtension.signatures_genuinely_differ
#check ReconfigurablePetriCertificate.legacy_incidence_preserved
#check ReconfigurablePetriCertificate.complete_cross_epoch_incidence
#check reconfigurablePetri.complete_cross_epoch_incidence

example
    (component : reconnectDAG.afterGraph.SCC) :
    ¬ Cantilune.Projection.RankableDAG.Path
        reconnectDAG.afterCondensation component component :=
  reconnectDAG.afterCondensation_acyclic component

example :
    reconnectPetri.selectedTransition.apply reconnectPetri.beforeMarking =
      reconnectPetri.afterMarking :=
  reconnectPetri.selectedTransition_fires

example :
    reconnectPetri.selectedTransition =
      endpointDelta reconnectPetri.selectedEvent.source
        reconnectPetri.selectedEvent.target :=
  reconnectPetri.selectedTransition_incidence_exact

example :
    source.lts.ObservableStep
        candidate.before candidate.event candidate.after ∧
      petri.lts.ObservableStep
        (petriProjection.mapState candidate.before)
        (petriProjection.mapEvent candidate.event)
        (petriProjection.mapState candidate.after) ∧
      reconnectPetri.selectedTransition.Enabled
        reconnectPetri.beforeMarking ∧
      reconnectPetri.selectedTransition.apply
          reconnectPetri.beforeMarking =
        reconnectPetri.afterMarking :=
  reconnectPetri.selected_native_enabled_fires

example :
    (reconnectPetri.selectedDeclaration.signatureVersion,
      reconnectPetri.selectedDeclaration.ruleId) =
      (reconnectPetri.selectedEvent.signatureVersion,
        reconnectPetri.selectedEvent.ruleId) :=
  reconnectPetri.selected_declaration_key

example :
    ¬Function.Surjective admission.extension.gen :=
  reconfigurablePetri.complete_cross_epoch_incidence.1

example :
    ProvenanceToken.policy 1 ∈ legacyPetriTransition.insert :=
  legacyPetriTransition_nonempty

#print axioms DAGSemanticCertificate.after_edge_internal_or_condensed
#print axioms DAGSemanticCertificate.dag_event_record_exact
#print axioms DAGSemanticCertificate.dag_replay_recipe_exact
#print axioms PetriSemanticCertificate.petri_event_record_exact
#print axioms PetriSemanticCertificate.petri_replay_recipe_exact
#print axioms PetriSemanticCertificate.selectedTransition_incidence_exact
#print axioms PetriSemanticCertificate.selectedTransition_enabled
#print axioms PetriSemanticCertificate.selectedTransition_fires
#print axioms PetriSemanticCertificate.selected_native_enabled_fires
#print axioms PetriSemanticCertificate.selected_occurrence_incidence_closure
#print axioms PetriSemanticCertificate.selectedTransition_retained_identity
#print axioms reindexProvenanceToken_injective
#print axioms reindexProvenanceToken_refl
#print axioms reindexProvenanceToken_trans
#print axioms reindexFiniteSupportEvent_refl
#print axioms reindexFiniteSupportEvent_trans
#print axioms PreNetExtension.old_declaration_is_prefix
#print axioms PreNetExtension.old_incidence_reindexed
#print axioms PreNetExtension.signatures_genuinely_differ
#print axioms ReconfigurablePetriCertificate.legacy_incidence_preserved
#print axioms ReconfigurablePetriCertificate.complete_cross_epoch_incidence

end Cantilune.Tests.P1aSemanticCertificate
