import Cantilune.Core.CompleteProjection

/-!
# Four complete projection layers

This module is a composition boundary. Its central constructor consumes four
already-constructed `CompleteProjectionCertificate`s sharing one source LTS,
one source symmetric-monoidal category, and one signature-admission event. It
only exposes their five certified layers; it does not derive a missing
projection certificate.
-/

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core

universe vₛ vₜ uₛ uₜ

/-- The five independently checkable layers of one complete projection. -/
structure ProjectionConsistencyLayers
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type uₜ) [Category.{vₜ} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (Source Target : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  static :
    StaticSMCProjectionCertificate SourceCategory TargetCategory
  operational : ProjectionCertificate Source Target
  admission :
    AdmissionProjectionCompatibility operational admission
  resources : ResourceProjectionCompatibility operational
  terminals : TerminalProjectionCompatibility operational

namespace ProjectionConsistencyLayers

/-- Forget only the outer record of one complete certificate. -/
def ofComplete
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type uₜ} [Category.{vₜ} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {Source Target : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    (certificate :
      CompleteProjectionCertificate
        SourceCategory TargetCategory Source Target admission) :
    ProjectionConsistencyLayers
      SourceCategory TargetCategory Source Target admission where
  static := certificate.static
  operational := certificate.operational
  admission := certificate.admissionCompatible
  resources := certificate.resources
  terminals := certificate.terminals

end ProjectionConsistencyLayers

/--
Four complete target certificates with a source and admission shared by type.
The target categories and target LTSs remain independent.
-/
structure FourCompleteProjectionCertificates
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (DagCategory : Type uₜ) [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    (PetriCategory : Type uₜ) [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    (PiCategory : Type uₜ) [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    (MorphismCategory : Type uₜ) [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  dag :
    CompleteProjectionCertificate
      SourceCategory DagCategory Source DagTarget admission
  petri :
    CompleteProjectionCertificate
      SourceCategory PetriCategory Source PetriTarget admission
  pi :
    CompleteProjectionCertificate
      SourceCategory PiCategory Source PiTarget admission
  morphism :
    CompleteProjectionCertificate
      SourceCategory MorphismCategory Source MorphismTarget admission

/--
The result of combining the four complete certificates. Every field is a
layer extracted from one supplied certificate.
-/
structure FourProjectionConsistency
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (DagCategory : Type uₜ) [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    (PetriCategory : Type uₜ) [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    (PiCategory : Type uₜ) [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    (MorphismCategory : Type uₜ) [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  dag :
    ProjectionConsistencyLayers
      SourceCategory DagCategory Source DagTarget admission
  petri :
    ProjectionConsistencyLayers
      SourceCategory PetriCategory Source PetriTarget admission
  pi :
    ProjectionConsistencyLayers
      SourceCategory PiCategory Source PiTarget admission
  morphism :
    ProjectionConsistencyLayers
      SourceCategory MorphismCategory Source MorphismTarget admission

/--
Extract all five layers from each supplied complete certificate. This
construction has no fallback and creates none of the required witnesses.
-/
def buildFourProjectionConsistency
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory : Type uₜ} [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    {PetriCategory : Type uₜ} [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    {PiCategory : Type uₜ} [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    {MorphismCategory : Type uₜ} [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    (certificates :
      FourCompleteProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :
    FourProjectionConsistency
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission where
  dag := ProjectionConsistencyLayers.ofComplete certificates.dag
  petri := ProjectionConsistencyLayers.ofComplete certificates.petri
  pi := ProjectionConsistencyLayers.ofComplete certificates.pi
  morphism := ProjectionConsistencyLayers.ofComplete certificates.morphism

/--
The propositional central theorem: four supplied complete certificates make
the combined consistency package inhabited. The witness is exactly the
structure assembled by `buildFourProjectionConsistency`.
-/
theorem four_projection_consistency
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory : Type uₜ} [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    {PetriCategory : Type uₜ} [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    {PiCategory : Type uₜ} [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    {MorphismCategory : Type uₜ} [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    (certificates :
      FourCompleteProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :
    Nonempty
      (FourProjectionConsistency
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :=
  ⟨buildFourProjectionConsistency certificates⟩

end Cantilune.Theorems
