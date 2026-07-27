import Cantilune.Core.FreeSMCArbitraryUniversal

/-!
# Categorical Free-SMC regressions

These checks exercise the actual mathlib SMC instances, the arbitrary-object
lawful quotient algebra, its quotient functor, and both stages of the strong
symmetric-monoidal interpretation.
-/

namespace Cantilune.Tests.FreeSMCUniversal

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.FreeSMC
open Cantilune.Core.FreeSMCQuotient
open Cantilune.Core.FreeSMCUniversal
open Cantilune.Core.FreeSMCArbitraryUniversal

noncomputable section

def signature : FinSignature where
  Obj := Unit
  Gen := Unit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => [()]
  output := fun _ => [()]
  mode := fun _ => .cartesian
  contract := fun _ => {}

def qGenerator : Hom signature [()] [()] :=
  ofRaw (.generator ())

example : Category (Word signature) := inferInstance
example : MonoidalCategory (Word signature) := inferInstance
example : SymmetricCategory (Word signature) := inferInstance

def targetData :
    InterpretationData signature (Word signature) where
  object := fun _ => [()]
  generator := fun _ => qGenerator
  copy := fun X h => ofRaw (.copy X h)
  discard := fun X h => ofRaw (.discard X h)

example : LawfulAlgebra signature :=
  semanticLawfulAlgebra targetData

example : Word signature ⥤ Word signature :=
  interpretationFunctor targetData

example :
    (interpretationFunctor targetData).map
        (ofRaw (.generator ())) =
      qGenerator :=
  interpretationFunctor_map_generator targetData ()

example :
    Nonempty ((SemanticWord.realization targetData).Monoidal) ∧
      Nonempty ((SemanticWord.realization targetData).Braided) :=
  semantic_realization_strong_symmetric targetData

example : (quotientToSemantic targetData).Monoidal := inferInstance

example : (quotientToSemantic targetData).Braided := inferInstance

example : (interpretationFunctor targetData).Monoidal := inferInstance

example : (interpretationFunctor targetData).Braided := inferInstance

example :
    Nonempty ((interpretationFunctor targetData).Monoidal) ∧
      Nonempty ((interpretationFunctor targetData).Braided) :=
  InterpretationData.arbitrary_object_strong_symmetric_functor_exists
    targetData

section ArbitraryUniqueness

universe u

variable {σ : FinSignature}
variable {C : Type u} [Category.{0} C] [MonoidalCategory C]
  [SymmetricCategory C]
variable {D : InterpretationData σ C} {F : Word σ ⥤ C}
  [F.Braided]
variable (A : AtomicComparison D F)
  (H : AtomicComparison.PrimitiveCompatibility A)

example : interpretationFunctor D ≅ F :=
  AtomicComparison.comparisonNatIso A H

example :
    NatTrans.IsMonoidal
      (AtomicComparison.comparisonNatIso A H).hom :=
  AtomicComparison.comparisonNatIso_isMonoidal A H

example {source target : Word σ} (f : source ⟶ target) :
    (interpretationFunctor D).map f ≫ (A.wordIso target).hom =
      (A.wordIso source).hom ≫ F.map f :=
  AtomicComparison.PrimitiveCompatibility.quotient_naturality H f

example
    (e : interpretationFunctor D ≅ F)
    (monoidal : NatTrans.IsMonoidal e.hom)
    (singleton :
      ∀ X : σ.Obj, e.hom.app [X] = (A.wordIso [X]).hom) :
    e.hom = (AtomicComparison.comparisonNatIso A H).hom :=
  by
    exact
      AtomicComparison.comparisonNatIso_hom_unique_explicit
        (D := D) (F := F) A H e monoidal singleton

example :
    ∃ comparison : interpretationFunctor D ≅ F,
      NatTrans.IsMonoidal comparison.hom ∧
      NatTrans.IsMonoidal comparison.inv ∧
      ∀ candidate : interpretationFunctor D ≅ F,
        NatTrans.IsMonoidal candidate.hom →
        (∀ X : σ.Obj,
          candidate.hom.app [X] = (A.wordIso [X]).hom) →
        candidate.hom = comparison.hom :=
  AtomicComparison.freeSMC_arbitrary_universal A H

end ArbitraryUniqueness

end

end Cantilune.Tests.FreeSMCUniversal
