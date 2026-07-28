import Cantilune.Theorems.CoreConformance

/-!
# Core conformance regressions

These checks exercise the generic composition result and its substantive
reference inhabitant.  They intentionally do not instantiate a production
package.
-/

namespace Cantilune.Tests.CoreConformance

open Cantilune.Theorems.CoreConformance

#check CoreConformancePackage
#check CoreConformancePackage.consistency
#check CoreConformancePackage.four_projection_core_consistency
#check Reference.package_nonempty
#check Reference.reference_consistency
#check Reference.reference_is_substantive
#check Reference.core.piFMSAlignment
#check Reference.core.piFMSAlignment.nativeRealization
#check Reference.core.piFMSAlignment.source_to_family
#check Reference.core.piFMSAlignment.derivative_to_family
#check Reference.core.reconfigurablePetri.complete_cross_epoch_incidence
#check Reference.legacyPetriTransition_nonempty

#print axioms CoreConformancePackage.four_projection_core_consistency
#print axioms Reference.reference_consistency
#print axioms Reference.reference_is_substantive
#print axioms Reference.reconfigurablePetri
#print axioms Reference.legacyPetriTransition_nonempty
#print axioms
  Cantilune.Theorems.CoreConformance.ProductPiFMSAlignment.nativeRealization
#print axioms
  Cantilune.Pi.P1cAdmittedOperations.PiView.native
#print axioms
  Cantilune.Pi.P1cOperationRegistry.familyAt_instanceReconnectOperation

example : Nonempty Reference.Package :=
  Reference.package_nonempty

example :
    Reference.Rule.occurrence.target.edges ≠
      Reference.Rule.occurrence.source.edges :=
  Reference.reference_is_substantive.1

example :
    Cantilune.Pi.Late.NativeStep
      (Cantilune.Pi.P1cAdmittedOperations.PiView.source
        Reference.Rule.occurrence.request)
      .tau
      (Cantilune.Pi.P1cAdmittedOperations.PiView.target
        Reference.Rule.occurrence.request) :=
  Reference.reference_is_substantive.2.2.2.1

example :
    0 < (1 : Real) :=
  (CoreConformancePackage.consistency Reference.core).epsilonPositive

example :
    ¬Function.Surjective Reference.Admission.admission.extension.gen :=
  Reference.core.reconfigurablePetri.complete_cross_epoch_incidence.1

example :
    (1 : Real) ≤ 1 :=
  (CoreConformancePackage.consistency Reference.core).epsilonAtMostOne

example :
    Reference.core.piFMSAlignment.family = .instanceReconnect :=
  rfl

example :
    Reference.core.piFMSAlignment.metadata =
      ({ version := 1
         rule := 7100
         session := 7100
         correlation := 7100
         occurrence := 7100 } :
        Cantilune.Pi.P1cOperationRegistry.StableMetadata) := by
  rfl

example :
    Reference.core.piFMSAlignment.operational.statePayload
        ((Reference.Admission.identityFamily.operational
            Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature).mapState
          Cantilune.Theorems.ProductRuleProofBundle.GateReference.candidate.before) =
      Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        .instanceReconnect :=
  rfl

example :
    Reference.core.piFMSAlignment.operational.actionPayload
        ((Reference.Admission.identityFamily.operational
            Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature).mapEvent
          Cantilune.Theorems.ProductRuleProofBundle.GateReference.candidate.event) =
      Cantilune.Pi.P1cFullNativeRefinement.firstAction
        .instanceReconnect :=
  rfl

example :
    Cantilune.Pi.Late.NativeStep
      (Reference.core.piFMSAlignment.operational.statePayload
        ((Reference.Admission.identityFamily.operational
            Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature).mapState
          Cantilune.Theorems.ProductRuleProofBundle.GateReference.candidate.before))
      (Reference.core.piFMSAlignment.operational.actionPayload
        ((Reference.Admission.identityFamily.operational
            Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature).mapEvent
          Cantilune.Theorems.ProductRuleProofBundle.GateReference.candidate.event))
      (Reference.core.piFMSAlignment.operational.statePayload
        ((Reference.Admission.identityFamily.operational
            Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature).mapState
          Cantilune.Theorems.ProductRuleProofBundle.GateReference.candidate.after)) :=
  Reference.core.piFMSAlignment.nativeRealization

example :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.TotalCompiledNormativeCommutation
      .instanceReconnect :=
  Reference.core.piFMSAlignment.actual

end Cantilune.Tests.CoreConformance
