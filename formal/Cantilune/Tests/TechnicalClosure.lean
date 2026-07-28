import Cantilune.Theorems.TechnicalClosure

/-!
Kernel regression checks for the final technical-closure aggregation.

The generic fixture below checks parameter inference.  The no-argument
fixture then checks the connected admission/reconnect occurrence exposed by
`SubstantiveReconnectConformance`.
-/

namespace Cantilune.Tests.TechnicalClosure

noncomputable section

open Cantilune.Theorems.TechnicalClosure
open Cantilune.Theorems.CoreConformance

/-- The fixed semantic boundary is an actual value. -/
example : GlobalTheory :=
  globalTheory

/--
CENTRAL-12 is the complete no-argument maximum-compatible D1-A closure, not
only the event-indexed endpoint theorem and not one unified source-paper FMS
model.
-/
example : MaximumCompatibleD1AFMSClosure :=
  maximum_compatible_d1a_fms_closure

/-- The aggregate fixes the all-object monad to the lower omega-Scott monad. -/
example :
    Cantilune.Pi.FMSConcreteD1AAcceptance.acceptedCore.strongCommutative.power =
      Cantilune.Pi.FMSCpoOmegaScottPower.omegaScottPowerMonad :=
  maximum_compatible_d1a_fms_closure.lowerOmegaScottMonadExact

/-- The aggregate carries the actual continuous-natural recursive solution. -/
example :
    Nonempty
      (Cantilune.Pi.FMSConcreteD1AAcceptance.acceptedCore.domainCompactness.fixed.agent ≅
        Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualAgentFunctor.obj
          Cantilune.Pi.FMSConcreteD1AAcceptance.acceptedCore.domainCompactness.fixed.agent) :=
  by
    obtain ⟨solution, _⟩ :=
      maximum_compatible_d1a_fms_closure.continuousNaturalRecursiveSolution
    exact ⟨solution⟩

/-- Finite, guarded and contextual Hoare theorems are in the central result. -/
example : D1AOperationalAcceptance :=
  maximum_compatible_d1a_fms_closure.finiteGuardedContextualHoare

/-- The aggregate contains a non-vacuous actual-Agent guarded fixed point. -/
example :
    Cantilune.Pi.FMSCpoAgentOperationalBridge.fixedTauAgent
        0
        Cantilune.Pi.FMSActualAgentPrefixFullAbstraction.guardedTauLimit =
      Cantilune.Pi.FMSActualAgentPrefixFullAbstraction.guardedTauLimit :=
  globalTheory.actualAgentPrefix.guardedTauFixed

example :
    Cantilune.Pi.FMSActualAgentPrefixFullAbstraction.guardedTauLimit ≠
      Cantilune.Pi.FMSCpoAgentOperationalBridge.fixedInactive 0 :=
  globalTheory.actualAgentPrefix.guardedTauNonInactive

/-- The aggregate contains the total finite-control terminal mediator. -/
example : TotalSupportedOperationalBoundary :=
  globalTheory.totalSupportedOperational

/-- Every normative event has the strong operational/actual-Agent bridge. -/
example (event : Cantilune.Pi.P1cMatrix.SourceEvent) :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.TotalCompiledNormativeCommutation
      event :=
  maximum_compatible_d1a_fms_closure.actualAgentCommutation event

/-- The optional all-object definability demand remains an explicit no-go. -/
example :
    ¬ Cantilune.Pi.FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable :=
  maximum_compatible_d1a_fms_closure.allDomainDefinabilityNoGo

/--
The final global value contains an actual Hom-indexed native representative,
not merely a presented equality next to an unrelated process theorem.
-/
example :
    Cantilune.Pi.OpenSMCPolarisedHomBridge.HomRealizes
      (Cantilune.Pi.OpenSMCPolarisedOperational.comp
        Cantilune.Pi.OpenSMCPolarisedHomBridge.Reference.outputHom
        Cantilune.Pi.OpenSMCPolarisedHomBridge.Reference.inputHom)
      globalTheory.homOperationalBridge.substantiveComposition.representative.source :=
  globalTheory.homOperationalBridge.substantiveComposition.sourceRealizes

/-- All fixed-epoch proof groups expand from the complete package. -/
example :
    ProductExpansion Reference.core :=
  product_expansion Reference.core

/-
The DAG and individual-token Petri projections remain distinct public
theorems even though both are extracted from one certified rule bundle.
-/
#check generic_dag_projection Reference.core
#check generic_petri_projection Reference.core
#check generic_p1a_projection_scope Reference.core

/-- The parameterised result has a concrete nonempty reference instance. -/
example :
    Nonempty (ProductTechnicalClosure Reference.core) :=
  generic_technical_closure Reference.core

/-- The ordinary, non-existential construction is also available. -/
example :
    ProductTechnicalClosure Reference.core :=
  assemble Reference.core

/--
The generic technical closure composes with a caller-supplied exact
candidate/common-FMS path.
-/
example :
    Nonempty
      (CompleteProductTechnicalClosure
        Cantilune.Theorems.SubstantiveReconnectConformance.core
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.positiveLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.productFMSLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalPositivePath
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalTrajectoryAgreement
        0) :=
  generic_technical_closure_with_common_trajectory
    Cantilune.Theorems.SubstantiveReconnectConformance.core
    Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.completeCertificate

/--
The final generic theorem requires one dependent certificate tying the exact
selected trajectory row to the candidate-indexed P1c/enriched/FMS evidence.
P1b remains the independent global request/accept sublanguage theorem.
-/
example :
    Nonempty
      (FourProjectionConsistency
        Cantilune.Theorems.SubstantiveReconnectConformance.core
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.positiveLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.productFMSLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalPositivePath
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalTrajectoryAgreement
        0) :=
  generic_four_projection_consistency
    Cantilune.Theorems.SubstantiveProtocolTrajectoryBridge.referenceCompleteProtocolTrajectory

/-- The anti-vacuity theorem is an ordinary no-argument proposition. -/
example : SubstantiveReferenceTechnicalClosure :=
  reference_technical_closure

/-- Its package side is the generic closure instantiated at the real package. -/
example :
    Nonempty
      (ProductTechnicalClosure
        Cantilune.Theorems.SubstantiveReconnectConformance.core) :=
  reference_technical_closure.packageClosure

/--
Admission reaches the selected reconnect source; the heterogeneous admission
event and fixed-epoch reconnect event remain distinct.
-/
example :
    Cantilune.Theorems.SubstantiveReconnectConformance.sourceAdmissionOccurrence.afterState =
        Cantilune.Theorems.SubstantiveReconnectConformance.candidate.before ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.candidate.before =
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectSource ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.candidate.event =
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectEvent ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.candidate.after =
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectTarget :=
  reference_technical_closure.admissionConnection

/-- The connected reference product cell is exactly normative reconnect. -/
example :
    Cantilune.Theorems.SubstantiveReconnectConformance.core.piFMSAlignment.family =
      .instanceReconnect :=
  reference_technical_closure.selectedNormativeFamily

/-- Its selected product pi occurrence reaches the actual recursive Agent. -/
example :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.TotalCompiledNormativeCommutation
      .instanceReconnect :=
  reference_technical_closure.selectedActualFMS

/-- The no-argument reference uses the actual core candidate common path. -/
example :
    Nonempty
      (CompleteProductTechnicalClosure
        Cantilune.Theorems.SubstantiveReconnectConformance.core
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.positiveLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.productFMSLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalPositivePath
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalTrajectoryAgreement
        0) :=
  reference_technical_closure.actualCoreCommonTrajectory

/-- The substantive side exposes native pi and replay evidence directly. -/
example :
    (Cantilune.Theorems.SubstantiveReconnectConformance.viewPackage .pi
        Cantilune.Theorems.SubstantiveReconnectConformance.newSignature).lts.ObservableStep
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectSource
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectEvent
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectTarget :=
  reference_technical_closure.substantive.piNative

/--
The no-argument reference cannot discharge pre-net preservation vacuously:
its old epoch contains a nonempty incidence and retains that same incidence
after signature reindexing.
-/
example :
    Cantilune.Theorems.SubstantiveReconnectConformance.LegacyPetriAntiVacuity :=
  reference_technical_closure.legacyPetriAntiVacuity

#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_technical_closure
#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_technical_closure_with_common_trajectory
#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_four_projection_consistency
#print axioms
  Cantilune.Theorems.TechnicalClosure.product_expansion
#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_dag_projection
#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_petri_projection
#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_p1a_projection_scope
#print axioms
  Cantilune.Theorems.TechnicalClosure.globalTheory
#print axioms
  Cantilune.Theorems.TechnicalClosure.maximum_compatible_d1a_fms_closure
#print axioms
  Cantilune.Theorems.TechnicalClosure.open_pi_fms_commutes
#print axioms
  Cantilune.Theorems.TechnicalClosure.totalSupportedOperationalBoundary
#print axioms
  Cantilune.Theorems.TechnicalClosure.reference_technical_closure

end

end Cantilune.Tests.TechnicalClosure
