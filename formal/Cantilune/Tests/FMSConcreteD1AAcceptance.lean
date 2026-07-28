import Cantilune.Pi.FMSConcreteD1AAcceptance

/-! Kernel regressions for the concrete, non-parametric D1-A acceptance. -/

noncomputable section

namespace Cantilune.Tests.FMSConcreteD1AAcceptance

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.OpenSMCPolarisedAdequacy
open Cantilune.Pi.RecursiveActionAlpha
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSConcreteD1AAcceptance

example : Nonempty ConcreteAcceptance :=
  ⟨concreteAcceptance⟩

example :
    concreteAcceptance.core =
      concreteSourceAlignedUnseparatedCore :=
  concreteAcceptance_core

example :
    concreteAcceptance.restriction = agentRestriction :=
  concreteAcceptance_hiding

example (event : SourceEvent) :
    RepresentativeTraceCommutation
      (normativeRepresentative event) :=
  concreteAcceptance_normative_commutation event

example (event : SourceEvent) :
    RecursiveAlphaOperational.AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (normativeRepresentative event).source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := (normativeRepresentative event).action
           target := (normativeRepresentative event).target } :
          LabelledDerivative)) :=
  (concreteAcceptance_normative_commutation event).alphaNative

example (event : SourceEvent) :
    representativeTracePoint (normativeRepresentative event) ∈
      Cantilune.Pi.FMSCpoOmegaScottPower.carrier
        (Cantilune.Pi.FMSGuardedHoareTrace.denote
          (normativeRepresentative event).source) :=
  (concreteAcceptance_normative_commutation event).traceMembership

example :
    Fintype.card SourceEvent = 15 :=
  normative_commutation_family_count

example (left right : RecursiveProc) :
    Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote left =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote right ↔
      Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
        left right :=
  concreteAcceptance_guarded_contextual_full_abstraction left right

#print axioms accepted_power_is_lower_omegaScott
#print axioms accepted_fubini_multiplication_coherence
#print axioms accepted_fubini_symmetry
#print axioms acceptedDomainIso
#print axioms acceptedFoldIsInitial
#print axioms acceptedUnfoldIsTerminal
#print axioms accepted_hiding_world_natural
#print axioms accepted_hiding_unroll
#print axioms accepted_hiding_unique
#print axioms accepted_finite_hoare_adequacy
#print axioms accepted_finite_hoare_full_abstraction
#print axioms accepted_finite_hoare_definability
#print axioms accepted_guarded_hoare_adequacy
#print axioms accepted_guarded_hoare_full_abstraction
#print axioms accepted_guarded_contextual_hoare_full_abstraction
#print axioms accepted_guarded_context_congruence
#print axioms accepted_guarded_contextual_source_interpretation
#print axioms accepted_guarded_contextual_definability
#print axioms accepted_guarded_divergence_deadlock_separation
#print axioms open_pi_fms_commutes_d1a_representative_level
#print axioms normative_open_pi_fms_commutes
#print axioms concreteAcceptance_normative_commutation
#print axioms concreteAcceptance_guarded_contextual_source_interpretation
#print axioms concreteAcceptance_guarded_contextual_definability
#print axioms concreteAcceptance_strong_no_go
#print axioms concreteAcceptance_all_domain_no_go

end Cantilune.Tests.FMSConcreteD1AAcceptance
