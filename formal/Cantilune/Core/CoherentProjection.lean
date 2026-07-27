import Mathlib.CategoryTheory.Comma.Arrow
import Cantilune.Core.CompleteProjection

/-!
# Static/operational coherence for complete projection certificates

`CompleteProjectionCertificate` deliberately keeps its static symmetric
monoidal functor and operational LTS certificate as independently checkable
layers.  Merely placing those values in one record, however, does not prove
that they describe the same states or rewrites.

This module supplies the missing anti-vacuity layer.  Every runtime state is
realized as an object of the appropriate arrow category (that is, as a typed
open morphism), and every observable source rewrite is realized as a
commutative square.  Mapping the source square through the static functor must
give the target square, conjugated only by the specified state isomorphisms.

No product API is frozen: concrete DAG, Petri, pi, and morphism projections
choose their own arrow realizations and squares.
-/

namespace Cantilune.Core

open CategoryTheory

universe v₁ v₂ u₁ u₂

/--
An independently specified realization of one observable LTS in an arrow
category.

`state_injective` rules out collapsing distinct runtime states to one
categorical arrow.  `recoverEvent` and `recover_step` make every represented
step recover its actual LTS event.  In particular, two different events with
the same endpoints cannot be represented by one constant cell.
-/
structure CategoricalLTSRealization
    (L : ObservableLTS)
    (C : Type u₁) [Category.{v₁} C] where
  stateArrow : L.State → Arrow C
  state_injective : Function.Injective stateArrow
  stateEquivIso :
    ∀ {source target : L.State},
      L.stateSetoid.r source target →
        ((stateArrow source : Arrow C) ≅
          (stateArrow target : Arrow C))
  state_iso_reflects_equiv :
    ∀ {source target : L.State},
      Nonempty
          ((stateArrow source : Arrow C) ≅
            (stateArrow target : Arrow C)) →
        L.stateSetoid.r source target
  stateEquivIso_refl :
    ∀ state,
      stateEquivIso (L.stateSetoid.iseqv.refl state) =
        Iso.refl (stateArrow state)
  stateEquivIso_symm :
    ∀ {source target : L.State}
      (equivalent : L.stateSetoid.r source target),
      stateEquivIso (L.stateSetoid.iseqv.symm equivalent) =
        (stateEquivIso equivalent).symm
  stateEquivIso_trans :
    ∀ {first middle last : L.State}
      (left : L.stateSetoid.r first middle)
      (right : L.stateSetoid.r middle last),
      stateEquivIso (L.stateSetoid.iseqv.trans left right) =
        stateEquivIso left ≪≫ stateEquivIso right
  stepCell :
    ∀ {source event target},
      L.ObservableStep source event target →
        Arrow.Hom (stateArrow source) (stateArrow target)
  recoverEvent :
    ∀ source target,
      Arrow.Hom (stateArrow source) (stateArrow target) → Option L.Event
  recover_step :
    ∀ {source event target}
      (step : L.ObservableStep source event target),
      recoverEvent source target (stepCell step) = some event
  stepCell_congr :
    ∀ {source source' event target target'}
      (sourceEquiv : L.stateSetoid.r source source')
      (targetEquiv : L.stateSetoid.r target target')
      (step : L.ObservableStep source event target),
      stepCell step ≫ (stateEquivIso targetEquiv).hom =
        (stateEquivIso sourceEquiv).hom ≫
          stepCell
            ⟨(L.step_congr sourceEquiv targetEquiv).mp step.1,
              step.2⟩

namespace CategoricalLTSRealization

variable
    {L : ObservableLTS}
    {C : Type u₁} [Category.{v₁} C]
    (realization : CategoricalLTSRealization L C)

/-- Equality of realized states reflects equality of runtime states. -/
theorem state_eq_of_arrow_eq {source target : L.State}
    (equality :
      realization.stateArrow source = realization.stateArrow target) :
    source = target :=
  realization.state_injective equality

/--
The chosen state setoid is exactly categorical isomorphism on represented
states.  This is the quotient-aware condition needed for α/structural
presentations.
-/
theorem state_equiv_iff_iso {source target : L.State} :
    L.stateSetoid.r source target ↔
      Nonempty
        (realization.stateArrow source ≅
          realization.stateArrow target) := by
  constructor
  · intro equivalent
    exact ⟨realization.stateEquivIso equivalent⟩
  · exact realization.state_iso_reflects_equiv

/--
For fixed endpoints, equality of represented step cells reflects equality of
their event labels.
-/
theorem event_eq_of_stepCell_eq
    {source target : L.State} {first second : L.Event}
    (firstStep : L.ObservableStep source first target)
    (secondStep : L.ObservableStep source second target)
    (equality :
      realization.stepCell firstStep =
        realization.stepCell secondStep) :
    first = second := by
  have recovered :=
    congrArg (realization.recoverEvent source target) equality
  rw [realization.recover_step firstStep,
    realization.recover_step secondStep] at recovered
  exact Option.some.inj recovered

/--
Changing source and target representatives produces the same rewrite square
after transport by the chosen quotient isomorphisms.
-/
theorem stepCell_representation_independent
    {source source' target target' : L.State}
    {event : L.Event}
    (sourceEquiv : L.stateSetoid.r source source')
    (targetEquiv : L.stateSetoid.r target target')
    (step : L.ObservableStep source event target) :
    realization.stepCell step ≫
        (realization.stateEquivIso targetEquiv).hom =
      (realization.stateEquivIso sourceEquiv).hom ≫
        realization.stepCell
          ⟨(L.step_congr sourceEquiv targetEquiv).mp step.1,
            step.2⟩ :=
  realization.stepCell_congr sourceEquiv targetEquiv step

end CategoricalLTSRealization

/--
The categorical state/rewrite realization shared by the static and
operational layers of one projection.

The equation `step_cell_commutes` is deliberately an equality in the target
arrow category.  Thus both vertical boundary maps and the represented open
morphism commute; a caller cannot satisfy it merely by relating event names.
-/
structure StaticOperationalCoherence
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {Source Target : ObservableLTS}
    (static :
      StaticSMCProjectionCertificate SourceCategory TargetCategory)
    (operational : ProjectionCertificate Source Target)
    (sourceRealization :
      CategoricalLTSRealization Source SourceCategory)
    (targetRealization :
      CategoricalLTSRealization Target TargetCategory) where
  stateIso :
    ∀ state,
      static.functor.mapArrow.obj
          (sourceRealization.stateArrow state) ≅
        targetRealization.stateArrow (operational.mapState state)
  step_cell_commutes :
    ∀ {source event target}
      (step : Source.ObservableStep source event target),
      static.functor.mapArrow.map
          (sourceRealization.stepCell step) =
        (stateIso source).hom ≫
          targetRealization.stepCell (operational.sound step) ≫
          (stateIso target).inv

namespace StaticOperationalCoherence

variable
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {Source Target : ObservableLTS}
    {static :
      StaticSMCProjectionCertificate SourceCategory TargetCategory}
    {operational : ProjectionCertificate Source Target}
    {sourceRealization :
      CategoricalLTSRealization Source SourceCategory}
    {targetRealization :
      CategoricalLTSRealization Target TargetCategory}
    (coherence :
      StaticOperationalCoherence static operational
        sourceRealization targetRealization)

/--
The represented horizontal open morphism of every source step is preserved
by the projection, after transporting the two endpoint arrows.
-/
theorem step_hom_commutes
    {source event target}
    (step : Source.ObservableStep source event target) :
    (static.functor.mapArrow.map
        (sourceRealization.stepCell step)).left ≫
        (coherence.stateIso target).hom.left =
      (coherence.stateIso source).hom.left ≫
        (targetRealization.stepCell
          (operational.sound step)).left := by
  have equality := congrArg Arrow.Hom.left
    (coherence.step_cell_commutes step)
  rw [equality]
  simp

/--
The represented right boundary of every source step is preserved as well.
-/
theorem step_right_commutes
    {source event target}
    (step : Source.ObservableStep source event target) :
    (static.functor.mapArrow.map
        (sourceRealization.stepCell step)).right ≫
        (coherence.stateIso target).hom.right =
      (coherence.stateIso source).hom.right ≫
        (targetRealization.stepCell
          (operational.sound step)).right := by
  have equality := congrArg Arrow.Hom.right
    (coherence.step_cell_commutes step)
  rw [equality]
  simp

end StaticOperationalCoherence

/--
A complete projection whose static and operational layers are proved to be
two presentations of the same state and rewrite semantics.
-/
structure CoherentCompleteProjectionCertificate
    (SourceCategory : Type u₁) [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type u₂) [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (Source Target : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature))
    (sourceRealization :
      CategoricalLTSRealization Source SourceCategory)
    (targetRealization :
      CategoricalLTSRealization Target TargetCategory) where
  complete :
    CompleteProjectionCertificate
      SourceCategory TargetCategory Source Target admission
  crossLayer :
    StaticOperationalCoherence complete.static complete.operational
      sourceRealization targetRealization

namespace CoherentCompleteProjectionCertificate

variable
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {Source Target : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    {sourceRealization :
      CategoricalLTSRealization Source SourceCategory}
    {targetRealization :
      CategoricalLTSRealization Target TargetCategory}
    (certificate :
      CoherentCompleteProjectionCertificate
        SourceCategory TargetCategory Source Target admission
        sourceRealization targetRealization)

/-- Static/operational coherence includes the native operational step. -/
theorem mapped_rewrite_has_native_step
    {source event target}
    (step : Source.ObservableStep source event target) :
    Target.ObservableStep
      (certificate.complete.operational.mapState source)
      (certificate.complete.operational.mapEvent event)
      (certificate.complete.operational.mapState target) :=
  certificate.complete.operational.sound step

/-- And the corresponding categorical rewrite square commutes. -/
theorem mapped_rewrite_cell_commutes
    {source event target}
    (step : Source.ObservableStep source event target) :
    certificate.complete.static.functor.mapArrow.map
        (sourceRealization.stepCell step) =
      (certificate.crossLayer.stateIso source).hom ≫
        targetRealization.stepCell
          (certificate.complete.operational.sound step) ≫
        (certificate.crossLayer.stateIso target).inv :=
  certificate.crossLayer.step_cell_commutes step

end CoherentCompleteProjectionCertificate

end Cantilune.Core
