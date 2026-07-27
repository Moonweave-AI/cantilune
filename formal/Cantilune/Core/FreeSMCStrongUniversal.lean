import Cantilune.Core.FreeSMCUniversal

/-!
# Strong symmetric-monoidal packaging of the free-SMC interpretation

`FreeSMCUniversal` constructs the quotient interpretation through the
auxiliary category `SemanticWord`.  In that category the object map preserves
word concatenation and the empty word definitionally.  This module packages
the already proved preservation equations as mathlib `Monoidal` and `Braided`
instances, and hence equips the arbitrary-target interpretation itself with a
strong symmetric-monoidal structure.
-/

namespace Cantilune.Core.FreeSMCUniversal

open CategoryTheory
open CategoryTheory.Category
open CategoryTheory.MonoidalCategory
open CategoryTheory.BraidedCategory
open FreeSMCQuotient

universe u

section Target

variable {σ : FinSignature}
variable {C : Type u} [Category.{0} C] [MonoidalCategory C]
  [SymmetricCategory C]

namespace InterpretationData

/--
The quotient-to-semantic-word functor is strict on the presented tensor:
both its unit comparison and tensorator are identity morphisms.
-/
instance quotientToSemanticLaxMonoidal (D : InterpretationData σ C) :
    (quotientToSemantic D).LaxMonoidal :=
  Functor.LaxMonoidal.ofTensorHom
    (F := quotientToSemantic D)
    (𝟙 _)
    (fun _ _ => 𝟙 _)
    (by
      intro A B X Y f g
      rw [quotientToSemantic_map_tensor]
      change
        D.tensor ((quotientToSemantic D).map f)
              ((quotientToSemantic D).map g) ≫ 𝟙 _ =
          𝟙 _ ≫
            D.tensor ((quotientToSemantic D).map f)
              ((quotientToSemantic D).map g)
      simp)
    (by
      intro A B E
      change
        D.tensor (𝟙 _) (𝟙 _) ≫ 𝟙 _ ≫
              (quotientToSemantic D).map (α_ A B E).hom =
          (α_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)
              (SemanticWord.wrap D E)).hom ≫
            D.tensor (𝟙 _) (𝟙 _) ≫ 𝟙 _
      simp only [D.tensor_identity, Category.id_comp, Category.comp_id]
      calc
        (quotientToSemantic D).map (α_ A B E).hom =
            (α_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)
              (SemanticWord.wrap D E)).hom :=
          quotientToSemantic_map_associator D A B E
        _ = (α_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)
              (SemanticWord.wrap D E)).hom ≫ 𝟙 _ :=
          (Category.comp_id _).symm)
    (by
      intro A
      change
        (λ_ (SemanticWord.wrap D A)).hom =
          D.tensor (𝟙 _) (𝟙 _) ≫ 𝟙 _ ≫
            (quotientToSemantic D).map (λ_ A).hom
      simp only [D.tensor_identity, Category.id_comp, Category.comp_id]
      exact (quotientToSemantic_map_leftUnitor D A).symm)
    (by
      intro A
      change
        (ρ_ (SemanticWord.wrap D A)).hom =
          D.tensor (𝟙 _) (𝟙 _) ≫ 𝟙 _ ≫
            (quotientToSemantic D).map (ρ_ A).hom
      simp only [D.tensor_identity, Category.id_comp, Category.comp_id]
      exact (quotientToSemantic_map_rightUnitor D A).symm)

/-- The strict lax structure is strong because all comparisons are identities. -/
noncomputable instance quotientToSemanticMonoidal
    (D : InterpretationData σ C) :
    (quotientToSemantic D).Monoidal := by
  letI : IsIso (Functor.LaxMonoidal.ε (quotientToSemantic D)) := by
    change IsIso (𝟙 (𝟙_ (SemanticWord D)))
    infer_instance
  letI (A B : Word σ) :
      IsIso (Functor.LaxMonoidal.μ (quotientToSemantic D) A B) := by
    change IsIso (𝟙 ((quotientToSemantic D).obj (A ⊗ B)))
    infer_instance
  exact Functor.Monoidal.ofLaxMonoidal (quotientToSemantic D)

/-- The quotient-to-semantic-word functor preserves the presented braiding. -/
instance quotientToSemanticLaxBraided (D : InterpretationData σ C) :
    (quotientToSemantic D).LaxBraided where
  braided A B := by
    change
      𝟙 _ ≫ (quotientToSemantic D).map (β_ A B).hom =
        (β_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)).hom ≫ 𝟙 _
    simpa using quotientToSemantic_map_braiding D A B

/-- The strong quotient interpretation is braided, hence symmetric-monoidal. -/
noncomputable instance quotientToSemanticBraided
    (D : InterpretationData σ C) :
    (quotientToSemantic D).Braided where
  toMonoidal := quotientToSemanticMonoidal D
  braided := Functor.LaxBraided.braided
    (F := quotientToSemantic D)

/--
The arbitrary-target interpretation is a strong monoidal functor.  Its
structure is the composite of the strict quotient-to-semantic-word functor
and the strong semantic realization.
-/
noncomputable instance interpretationFunctorMonoidal
    (D : InterpretationData σ C) :
    (interpretationFunctor D).Monoidal := by
  dsimp only [interpretationFunctor]
  infer_instance

/-- The arbitrary-target interpretation is braided as a functor. -/
noncomputable instance interpretationFunctorBraided
    (D : InterpretationData σ C) :
    (interpretationFunctor D).Braided := by
  dsimp only [interpretationFunctor]
  infer_instance

/-- Kernel-checkable strong symmetric-monoidal existence for arbitrary data. -/
theorem arbitrary_object_strong_symmetric_functor_exists
    (D : InterpretationData σ C) :
    Nonempty ((interpretationFunctor D).Monoidal) ∧
      Nonempty ((interpretationFunctor D).Braided) :=
  ⟨⟨inferInstance⟩, ⟨inferInstance⟩⟩

end InterpretationData

end Target

end Cantilune.Core.FreeSMCUniversal
