import Cantilune.Projection.GeneralP1a
import Cantilune.Projection.GeneralP1aComplete
import Cantilune.Projection.DAGScopeObstruction
import Cantilune.Tests.CompleteProjection

/-!
# Regression checks for the general P1a certificate family
-/

namespace Cantilune.Tests.GeneralP1a

open Cantilune.Projection
open Cantilune.Projection.GeneralP1a
open Cantilune.Projection.GeneralP1aComplete
open Cantilune.Core
open Cantilune.Projection.DAGScopeObstruction

/--
An arbitrary typed open hypergraph cannot be projected to a strict DAG while
preserving every directed incidence: the well-typed self-loop is a checked
counterexample.  Production P1a must therefore require rankability/acyclicity
or weaken the target.
-/
example : ¬ HasStrictIncidenceRank loopGraph :=
  loopGraph_not_rankable

example :
    ¬ (∀ {σ : FinSignature} {inputs outputs : List σ.Obj}
        {Node Edge : Type} [DecidableEq Node] [DecidableEq Edge]
        (graph : TypedOpenHypergraph σ inputs outputs Node Edge),
        HasStrictIncidenceRank graph) :=
  no_total_strict_rank_assignment

example := reference_install_native_all

example := reference_execute_native_all

example :=
  referenceCertificate.terminals_all Reference.State.finished

example :=
  referenceCertificate.signature_versions_all Reference.State.installed

/--
Nonempty five-layer regression.  Reusing the identity fixture is an interface
test only; it does not identify the production DAG, Petri, and morphism models.
-/
def identityAdmissionSemantics :
    Cantilune.Tests.CompleteProjection.Event →
      SignatureAdmissionEvent
        Cantilune.Tests.CompleteProjection.universes
        (source := Cantilune.Tests.CompleteProjection.signature)
        (target := Cantilune.Tests.CompleteProjection.signature) → Prop :=
  fun _ _ => True

def identityCrossLayer
    (_ :
      StaticSMCProjectionCertificate (Type 0) (Type 0))
    (_ :
      ProjectionCertificate
        Cantilune.Tests.CompleteProjection.lts
        Cantilune.Tests.CompleteProjection.lts) : Prop :=
  True

def layeredIdentity :
    GeneralP1aComplete.Certificate
      (Type 0) (Type 0) (Type 0) (Type 0)
      Cantilune.Tests.CompleteProjection.lts
      Cantilune.Tests.CompleteProjection.lts
      Cantilune.Tests.CompleteProjection.lts
      Cantilune.Tests.CompleteProjection.lts
      Cantilune.Tests.CompleteProjection.admission
      identityAdmissionSemantics
      identityCrossLayer identityCrossLayer identityCrossLayer where
  sourceBefore := Cantilune.Tests.CompleteProjection.beforeState
  sourceAfter := Cantilune.Tests.CompleteProjection.afterState
  sourceEvent := .registration
  sourceStep := Cantilune.Tests.CompleteProjection.sourceAdmissionStep
  sourceEvent_isAdmission := trivial
  sourceResourcesValid :=
    Cantilune.Tests.CompleteProjection.identityComplete.resources.sourceResourcesValid
  dag := Cantilune.Tests.CompleteProjection.identityComplete
  petri := Cantilune.Tests.CompleteProjection.identityComplete
  morphism := Cantilune.Tests.CompleteProjection.identityComplete
  dag_sourceBefore := rfl
  dag_sourceAfter := rfl
  dag_sourceEvent := rfl
  petri_sourceBefore := rfl
  petri_sourceAfter := rfl
  petri_sourceEvent := rfl
  morphism_sourceBefore := rfl
  morphism_sourceAfter := rfl
  morphism_sourceEvent := rfl
  dag_sourceResources := rfl
  petri_sourceResources := rfl
  morphism_sourceResources := rfl
  dag_crossLayer := trivial
  petri_crossLayer := trivial
  morphism_crossLayer := trivial

example :=
  layeredIdentity.admission_native_all

example :=
  layeredIdentity.resources_all
    Cantilune.Tests.CompleteProjection.afterState

example :=
  layeredIdentity.source_event_is_admission

example :=
  layeredIdentity.cross_layer_compatible_all

example :=
  layeredIdentity.terminals_all
    Cantilune.Tests.CompleteProjection.afterState

end Cantilune.Tests.GeneralP1a
