import Cantilune.Core.CompleteProjection
import Cantilune.Projection.GeneralP1a

/-!
# Shared five-layer generic P1a families

`GeneralP1a.Certificate` is the reusable operational theorem.  This module
adds the remaining independently checkable layers without deriving any of
them from operational simulation:

* one symmetric-monoidal functor for each target;
* one native, versioned signature-admission step;
* resource-predicate agreement; and
* the success / external-wait / deadlock trichotomy.

The structure is polymorphic in the four categories, four LTSs, and the
admission event. It also requires a shared source occurrence, a shared source
resource predicate, an externally supplied meaning relation for admission,
and externally supplied static/operational compatibility relations. Thus the
three views cannot silently certify different source events or different
resource disciplines. This remains a theorem interface over supplied layers,
not a claim that the small reference DAG and pre-net instantiate all dynamic
DPOI cases.
-/

namespace Cantilune.Projection.GeneralP1aComplete

open CategoryTheory
open Cantilune.Core

universe u v

/--
All five certificate layers for the DAG, Petri, and morphism projections of
one source semantics and one signature-admission event.
-/
structure Certificate
    (SourceCategory DagCategory PetriCategory MorphismCategory : Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (Source Dag Petri Morphism : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature))
    (sourceAdmissionSemantics :
      Source.Event →
        SignatureAdmissionEvent universes
          (source := sourceSignature) (target := targetSignature) → Prop)
    (dagCrossLayer :
      StaticSMCProjectionCertificate SourceCategory DagCategory →
        ProjectionCertificate Source Dag → Prop)
    (petriCrossLayer :
      StaticSMCProjectionCertificate SourceCategory PetriCategory →
        ProjectionCertificate Source Petri → Prop)
    (morphismCrossLayer :
      StaticSMCProjectionCertificate SourceCategory MorphismCategory →
        ProjectionCertificate Source Morphism → Prop) where
  sourceBefore : Source.State
  sourceAfter : Source.State
  sourceEvent : Source.Event
  sourceStep :
    Source.ObservableStep sourceBefore sourceEvent sourceAfter
  sourceEvent_isAdmission :
    sourceAdmissionSemantics sourceEvent admission
  sourceResourcesValid : Source.State → Prop
  dag :
    CompleteProjectionCertificate
      SourceCategory DagCategory Source Dag admission
  petri :
    CompleteProjectionCertificate
      SourceCategory PetriCategory Source Petri admission
  morphism :
    CompleteProjectionCertificate
      SourceCategory MorphismCategory Source Morphism admission
  dag_sourceBefore :
    dag.admissionCompatible.sourceBefore = sourceBefore
  dag_sourceAfter :
    dag.admissionCompatible.sourceAfter = sourceAfter
  dag_sourceEvent :
    dag.admissionCompatible.sourceEvent = sourceEvent
  petri_sourceBefore :
    petri.admissionCompatible.sourceBefore = sourceBefore
  petri_sourceAfter :
    petri.admissionCompatible.sourceAfter = sourceAfter
  petri_sourceEvent :
    petri.admissionCompatible.sourceEvent = sourceEvent
  morphism_sourceBefore :
    morphism.admissionCompatible.sourceBefore = sourceBefore
  morphism_sourceAfter :
    morphism.admissionCompatible.sourceAfter = sourceAfter
  morphism_sourceEvent :
    morphism.admissionCompatible.sourceEvent = sourceEvent
  dag_sourceResources :
    dag.resources.sourceResourcesValid = sourceResourcesValid
  petri_sourceResources :
    petri.resources.sourceResourcesValid = sourceResourcesValid
  morphism_sourceResources :
    morphism.resources.sourceResourcesValid = sourceResourcesValid
  dag_crossLayer :
    dagCrossLayer dag.static dag.operational
  petri_crossLayer :
    petriCrossLayer petri.static petri.operational
  morphism_crossLayer :
    morphismCrossLayer morphism.static morphism.operational

namespace Certificate

variable
    {SourceCategory DagCategory PetriCategory MorphismCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {Source Dag Petri Morphism : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    {sourceAdmissionSemantics :
      Source.Event →
        SignatureAdmissionEvent universes
          (source := sourceSignature) (target := targetSignature) → Prop}
    {dagCrossLayer :
      StaticSMCProjectionCertificate SourceCategory DagCategory →
        ProjectionCertificate Source Dag → Prop}
    {petriCrossLayer :
      StaticSMCProjectionCertificate SourceCategory PetriCategory →
        ProjectionCertificate Source Petri → Prop}
    {morphismCrossLayer :
      StaticSMCProjectionCertificate SourceCategory MorphismCategory →
        ProjectionCertificate Source Morphism → Prop}
    (certificate :
      Certificate
        SourceCategory DagCategory PetriCategory MorphismCategory
        Source Dag Petri Morphism admission sourceAdmissionSemantics
        dagCrossLayer petriCrossLayer morphismCrossLayer)

/-- Forget only the non-operational layers and recover the generic P1a theorem. -/
def operational :
    GeneralP1a.Certificate Source Dag Petri Morphism where
  dag := certificate.dag.operational
  petri := certificate.petri.operational
  morphism := certificate.morphism.operational

/-- Every observable source rewrite is one native target step in all P1a views. -/
theorem rewrite_native_all
    {source : Source.State} {event : Source.Event} {target : Source.State}
    (step : Source.ObservableStep source event target) :
    Dag.ObservableStep
        (certificate.dag.operational.mapState source)
        (certificate.dag.operational.mapEvent event)
        (certificate.dag.operational.mapState target) ∧
      Petri.ObservableStep
        (certificate.petri.operational.mapState source)
        (certificate.petri.operational.mapEvent event)
        (certificate.petri.operational.mapState target) ∧
      Morphism.ObservableStep
        (certificate.morphism.operational.mapState source)
        (certificate.morphism.operational.mapEvent event)
        (certificate.morphism.operational.mapState target) :=
  certificate.operational.sound_all step

/--
The one shared source admission occurrence has a native target step in all
views. The outer equalities prevent the three supplied layer packages from
choosing different source endpoints.
-/
theorem admission_native_all :
    Dag.ObservableStep
        (certificate.dag.operational.mapState certificate.sourceBefore)
        certificate.dag.admissionCompatible.targetEvent
        (certificate.dag.operational.mapState certificate.sourceAfter) ∧
      Petri.ObservableStep
        (certificate.petri.operational.mapState certificate.sourceBefore)
        certificate.petri.admissionCompatible.targetEvent
        (certificate.petri.operational.mapState certificate.sourceAfter) ∧
      Morphism.ObservableStep
        (certificate.morphism.operational.mapState certificate.sourceBefore)
        certificate.morphism.admissionCompatible.targetEvent
        (certificate.morphism.operational.mapState certificate.sourceAfter) := by
  have dagStep := certificate.dag.admissionCompatible.targetStep
  have petriStep := certificate.petri.admissionCompatible.targetStep
  have morphismStep := certificate.morphism.admissionCompatible.targetStep
  rw [certificate.dag_sourceBefore, certificate.dag_sourceAfter] at dagStep
  rw [certificate.petri_sourceBefore,
    certificate.petri_sourceAfter] at petriStep
  rw [certificate.morphism_sourceBefore,
    certificate.morphism_sourceAfter] at morphismStep
  exact ⟨dagStep, petriStep, morphismStep⟩

/-- The caller-supplied source semantics identifies the shared event as admission. -/
theorem source_event_is_admission :
    sourceAdmissionSemantics certificate.sourceEvent admission :=
  certificate.sourceEvent_isAdmission

/-- Every target resource predicate agrees with one shared source predicate. -/
theorem resources_all (state : Source.State) :
    (certificate.dag.resources.targetResourcesValid
        (certificate.dag.operational.mapState state) ↔
      certificate.sourceResourcesValid state) ∧
    (certificate.petri.resources.targetResourcesValid
        (certificate.petri.operational.mapState state) ↔
      certificate.sourceResourcesValid state) ∧
    (certificate.morphism.resources.targetResourcesValid
        (certificate.morphism.operational.mapState state) ↔
      certificate.sourceResourcesValid state) := by
  have dagResources := certificate.dag.resources.resources_iff state
  have petriResources := certificate.petri.resources.resources_iff state
  have morphismResources := certificate.morphism.resources.resources_iff state
  rw [certificate.dag_sourceResources] at dagResources
  rw [certificate.petri_sourceResources] at petriResources
  rw [certificate.morphism_sourceResources] at morphismResources
  exact ⟨dagResources, petriResources, morphismResources⟩

/--
All externally specified static/operational compatibility predicates hold.
Their mathematical content belongs to the concrete projection definitions;
this generic layer never replaces them with a built-in `True`.
-/
theorem cross_layer_compatible_all :
    dagCrossLayer certificate.dag.static certificate.dag.operational ∧
      petriCrossLayer certificate.petri.static
        certificate.petri.operational ∧
      morphismCrossLayer certificate.morphism.static
        certificate.morphism.operational :=
  ⟨certificate.dag_crossLayer,
    certificate.petri_crossLayer,
    certificate.morphism_crossLayer⟩

/-- Terminal classification follows simultaneously from the three certificates. -/
theorem terminals_all (state : Source.State) :
    ((Dag.SuccessfulTermination
          (certificate.dag.operational.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Dag.ExternalWait
          (certificate.dag.operational.mapState state) ↔
        Source.ExternalWait state) ∧
      (Dag.Deadlocked
          (certificate.dag.operational.mapState state) ↔
        Source.Deadlocked state)) ∧
    ((Petri.SuccessfulTermination
          (certificate.petri.operational.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Petri.ExternalWait
          (certificate.petri.operational.mapState state) ↔
        Source.ExternalWait state) ∧
      (Petri.Deadlocked
          (certificate.petri.operational.mapState state) ↔
        Source.Deadlocked state)) ∧
    ((Morphism.SuccessfulTermination
          (certificate.morphism.operational.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Morphism.ExternalWait
          (certificate.morphism.operational.mapState state) ↔
        Source.ExternalWait state) ∧
      (Morphism.Deadlocked
          (certificate.morphism.operational.mapState state) ↔
        Source.Deadlocked state)) :=
  certificate.operational.terminals_all state

end Certificate

end Cantilune.Projection.GeneralP1aComplete
