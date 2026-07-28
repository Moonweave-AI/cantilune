import Cantilune.Core.CoherentProjection
import Cantilune.Theorems.CompleteFourProjection

/-!
# Four-projection consistency with static/operational coherence

The earlier composition theorem extracts five independently supplied layers.
This strengthened theorem additionally requires, for every view, that the
static symmetric-monoidal functor and the operational LTS certificate realize
the same states and rewrite squares in the corresponding arrow category.

Like every sound composition theorem, it consumes concrete certificates; it
does not manufacture the still-missing production DAG/Petri/pi/morphism
instances.
-/

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core

universe vₛ vₜ uₛ uₜ

/-- Four cross-layer-coherent complete projection certificates. -/
structure FourCoherentProjectionCertificates
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
  sourceRealization :
    CategoricalLTSRealization Source SourceCategory
  dagTargetRealization :
    CategoricalLTSRealization DagTarget DagCategory
  petriTargetRealization :
    CategoricalLTSRealization PetriTarget PetriCategory
  piTargetRealization :
    CategoricalLTSRealization PiTarget PiCategory
  morphismTargetRealization :
    CategoricalLTSRealization MorphismTarget MorphismCategory
  dag :
    CoherentCompleteProjectionCertificate
      SourceCategory DagCategory Source DagTarget admission
      sourceRealization dagTargetRealization
  petri :
    CoherentCompleteProjectionCertificate
      SourceCategory PetriCategory Source PetriTarget admission
      sourceRealization petriTargetRealization
  pi :
    CoherentCompleteProjectionCertificate
      SourceCategory PiCategory Source PiTarget admission
      sourceRealization piTargetRealization
  morphism :
    CoherentCompleteProjectionCertificate
      SourceCategory MorphismCategory Source MorphismTarget admission
      sourceRealization morphismTargetRealization

namespace FourCoherentProjectionCertificates

variable
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
      FourCoherentProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission)

/-- Forget only the cross-layer witnesses and recover the five-layer bundle. -/
def toComplete :
    FourCompleteProjectionCertificates
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission where
  dag := certificates.dag.complete
  petri := certificates.petri.complete
  pi := certificates.pi.complete
  morphism := certificates.morphism.complete

end FourCoherentProjectionCertificates

/-- The old five-layer result plus all four categorical rewrite coherences. -/
structure CoherentFourProjectionConsistency
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
  layers :
    FourProjectionConsistency
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission
  sourceRealization :
    CategoricalLTSRealization Source SourceCategory
  dagTargetRealization :
    CategoricalLTSRealization DagTarget DagCategory
  petriTargetRealization :
    CategoricalLTSRealization PetriTarget PetriCategory
  piTargetRealization :
    CategoricalLTSRealization PiTarget PiCategory
  morphismTargetRealization :
    CategoricalLTSRealization MorphismTarget MorphismCategory
  dagCrossLayer :
    StaticOperationalCoherence layers.dag.static layers.dag.operational
      sourceRealization dagTargetRealization
  petriCrossLayer :
    StaticOperationalCoherence layers.petri.static layers.petri.operational
      sourceRealization petriTargetRealization
  piCrossLayer :
    StaticOperationalCoherence layers.pi.static layers.pi.operational
      sourceRealization piTargetRealization
  morphismCrossLayer :
    StaticOperationalCoherence
      layers.morphism.static layers.morphism.operational
      sourceRealization morphismTargetRealization

/--
Four concrete coherent certificates give the strengthened consistency result.
No `True`-valued compatibility predicate or silent static/operational
decoupling is used.
-/
def buildCoherentFourProjectionConsistency
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
      FourCoherentProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :
    CoherentFourProjectionConsistency
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission := by
  let layers :=
    buildFourProjectionConsistency certificates.toComplete
  exact
    { layers := layers
      sourceRealization := certificates.sourceRealization
      dagTargetRealization := certificates.dagTargetRealization
      petriTargetRealization := certificates.petriTargetRealization
      piTargetRealization := certificates.piTargetRealization
      morphismTargetRealization := certificates.morphismTargetRealization
      dagCrossLayer := certificates.dag.crossLayer
      petriCrossLayer := certificates.petri.crossLayer
      piCrossLayer := certificates.pi.crossLayer
      morphismCrossLayer := certificates.morphism.crossLayer }

theorem coherent_four_projection_consistency
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
      FourCoherentProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :
    Nonempty
      (CoherentFourProjectionConsistency
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :=
  ⟨buildCoherentFourProjectionConsistency certificates⟩

end Cantilune.Theorems
