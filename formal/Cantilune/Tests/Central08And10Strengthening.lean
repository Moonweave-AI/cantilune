import Cantilune.Theorems.TechnicalClosure

/-!
Regression checks for the strengthened CENTRAL-08 and CENTRAL-10 boundaries.
-/

namespace Cantilune.Tests.Central08And10Strengthening

noncomputable section

open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.OpenSMCPolarisedProofCarrying
open Cantilune.Projection.CanonicalDAGTarget
open Cantilune.Theorems.TechnicalClosure

/-! ## CENTRAL-10: proof-carrying typed/polarised Hom plus native closure -/

def mixedBoundary : Object :=
  ofPorts
    [{ payload := .data, polarity := .positive },
      { payload := .channel, polarity := .negative }]

def mixedIdentity : TypedPolarisedHom mixedBoundary mixedBoundary :=
  TypedPolarisedHom.identity mixedBoundary

/-- Payload and polarity remain data in the public Hom value. -/
example : mixedIdentity.sourceProfile = mixedBoundary.ports :=
  completeOpenPiSMCOperationalBoundary.proofCarrying.sourceProfileRetained
    mixedIdentity

example : mixedIdentity.targetProfile = mixedBoundary.ports :=
  completeOpenPiSMCOperationalBoundary.proofCarrying.targetProfileRetained
    mixedIdentity

/-- Category and symmetric-monoidal laws are exposed at the same layer. -/
example :
    TypedPolarisedHom.compose
        (TypedPolarisedHom.identity mixedBoundary) mixedIdentity =
      mixedIdentity :=
  completeOpenPiSMCOperationalBoundary.proofCarrying.identityLeft
    mixedIdentity

#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.tensorInterchange
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.structuralIsomorphisms
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.associatorNaturality
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.braidNaturality
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.symmetry
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.globalCoherence
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.tensorNative
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.plugNative
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.hideNative
#check
  completeOpenPiSMCOperationalBoundary.proofCarrying.restrictionNative

/-! ## CENTRAL-08: independent canonical SCC/rank target LTS -/

noncomputable def referenceDAGView :=
  reference_dag_projection

/-
The actual regression checks use the independent target view directly; its
state exposes graph/SCC data that the source state carrier does not supply.
-/
#check referenceDAGView.targetNative
#check
  Cantilune.Projection.CanonicalDAGTarget.NativeStep.exact_endpoints
    referenceDAGView.targetNative.1
#check referenceDAGView.sourceNative
#check referenceDAGView.productTargetNative
#check referenceDAGView.target_and_product_event_agree
#check referenceDAGView.before.graph
#check referenceDAGView.before.condensation
#check referenceDAGView.before.condensation_acyclic
#check referenceDAGView.after.condensation_acyclic

example :
    referenceDAGView.before.graph =
      Cantilune.Projection.P1aSemanticCertificate.configDependencyGraph
        referenceDAGView.before.config referenceDAGView.before.wellFormed :=
  referenceDAGView.before_graph_exact

example :
    referenceDAGView.after.graph =
      Cantilune.Projection.P1aSemanticCertificate.configDependencyGraph
        referenceDAGView.after.config referenceDAGView.after.wellFormed :=
  referenceDAGView.after_graph_exact

#print axioms
  Cantilune.Pi.OpenSMCPolarisedProofCarrying.proofCarryingOpenPiAcceptance
#print axioms
  Cantilune.Theorems.TechnicalClosure.completeOpenPiSMCOperationalBoundary
#print axioms
  Cantilune.Projection.CanonicalDAGTarget.CanonicalDAGProjection.ofSemanticCertificate
#print axioms
  Cantilune.Theorems.TechnicalClosure.generic_dag_projection

end

end Cantilune.Tests.Central08And10Strengthening
