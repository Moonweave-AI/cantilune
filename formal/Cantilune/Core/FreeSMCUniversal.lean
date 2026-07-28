import Cantilune.Core.FreeSMCQuotient
import Mathlib.CategoryTheory.Monoidal.Braided.Basic
import Mathlib.CategoryTheory.Monoidal.NaturalTransformation
import Mathlib.CategoryTheory.Monoidal.Transport

/-!
# The categorical universal property of the free symmetric monoidal category

This module exposes the hom-wise quotient in `FreeSMCQuotient` through
mathlib's actual `Category`, `MonoidalCategory`, and `SymmetricCategory`
interfaces.  It then constructs interpretations whose values on atomic
objects are arbitrary objects of a target symmetric monoidal category.
-/

namespace Cantilune.Core.FreeSMCUniversal

open CategoryTheory
open CategoryTheory.Category
open CategoryTheory.MonoidalCategory
open CategoryTheory.BraidedCategory
open FreeSMCQuotient

universe v u

/-- The quotient homs form an actual mathlib category. -/
instance quotientCategory (σ : FinSignature) : Category (Word σ) where
  Hom := Hom σ
  id := FreeSMCQuotient.id σ
  comp := FreeSMCQuotient.comp
  id_comp := FreeSMCQuotient.id_comp
  comp_id := FreeSMCQuotient.comp_id
  assoc := FreeSMCQuotient.comp_assoc

@[simp] theorem category_id_eq (σ : FinSignature) (X : Word σ) :
    (𝟙 X : X ⟶ X) = FreeSMCQuotient.id σ X := rfl

@[simp] theorem category_comp_eq {σ : FinSignature} {X Y Z : Word σ}
    (f : X ⟶ Y) (g : Y ⟶ Z) :
    f ≫ g = FreeSMCQuotient.comp f g := rfl

/-- The quotient tensor, unit, associator, and unitors as mathlib data. -/
instance quotientMonoidalStruct (σ : FinSignature) :
    MonoidalCategoryStruct (Word σ) where
  tensorObj := List.append
  whiskerLeft := fun X {_ _} f =>
    FreeSMCQuotient.tensor (FreeSMCQuotient.id σ X) f
  whiskerRight := fun {_ _} f Y =>
    FreeSMCQuotient.tensor f (FreeSMCQuotient.id σ Y)
  tensorHom := FreeSMCQuotient.tensor
  tensorUnit := []
  associator X Y Z :=
    { hom := FreeSMCQuotient.associator σ X Y Z
      inv := FreeSMCQuotient.associatorInv σ X Y Z
      hom_inv_id := FreeSMCQuotient.associator_hom_inv X Y Z
      inv_hom_id := FreeSMCQuotient.associator_inv_hom X Y Z }
  leftUnitor X :=
    { hom := FreeSMCQuotient.leftUnitor σ X
      inv := FreeSMCQuotient.leftUnitorInv σ X
      hom_inv_id := FreeSMCQuotient.leftUnitor_hom_inv X
      inv_hom_id := FreeSMCQuotient.leftUnitor_inv_hom X }
  rightUnitor X :=
    { hom := FreeSMCQuotient.rightUnitor σ X
      inv := FreeSMCQuotient.rightUnitorInv σ X
      hom_inv_id := FreeSMCQuotient.rightUnitor_hom_inv X
      inv_hom_id := FreeSMCQuotient.rightUnitor_inv_hom X }

@[simp] theorem quotient_tensorObj_eq (σ : FinSignature)
    (A B : Word σ) :
    A ⊗ B = A ++ B := rfl

@[simp] theorem quotient_tensorUnit_eq (σ : FinSignature) :
    (𝟙_ (Word σ)) = [] := rfl

/-- The quotient is an actual mathlib monoidal category. -/
instance quotientMonoidalCategory (σ : FinSignature) :
    MonoidalCategory (Word σ) :=
  MonoidalCategory.ofTensorHom
    (C := Word σ)
    (by
      intro X Y
      change
        FreeSMCQuotient.tensor
            (FreeSMCQuotient.id σ X) (FreeSMCQuotient.id σ Y) =
          FreeSMCQuotient.id σ (X ++ Y)
      exact FreeSMCQuotient.tensor_id X Y)
    (by
      intro X Y₁ Y₂ f
      change
        FreeSMCQuotient.tensor (FreeSMCQuotient.id σ X) f =
          FreeSMCQuotient.tensor (FreeSMCQuotient.id σ X) f
      rfl)
    (by
      intro X₁ X₂ f Y
      change
        FreeSMCQuotient.tensor f (FreeSMCQuotient.id σ Y) =
          FreeSMCQuotient.tensor f (FreeSMCQuotient.id σ Y)
      rfl)
    (by
      intro X₁ Y₁ Z₁ X₂ Y₂ Z₂ f₁ f₂ g₁ g₂
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor f₁ f₂)
            (FreeSMCQuotient.tensor g₁ g₂) =
          FreeSMCQuotient.tensor
            (FreeSMCQuotient.comp f₁ g₁)
            (FreeSMCQuotient.comp f₂ g₂)
      exact (FreeSMCQuotient.tensor_comp f₁ g₁ f₂ g₂).symm)
    (by
      intro X₁ X₂ X₃ Y₁ Y₂ Y₃ f₁ f₂ f₃
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.tensor f₁ f₂) f₃)
            (FreeSMCQuotient.associator σ Y₁ Y₂ Y₃) =
          FreeSMCQuotient.comp
            (FreeSMCQuotient.associator σ X₁ X₂ X₃)
            (FreeSMCQuotient.tensor f₁
              (FreeSMCQuotient.tensor f₂ f₃))
      exact FreeSMCQuotient.associator_natural f₁ f₂ f₃)
    (by
      intro X Y f
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor (FreeSMCQuotient.id σ []) f)
            (FreeSMCQuotient.leftUnitor σ Y) =
          FreeSMCQuotient.comp
            (FreeSMCQuotient.leftUnitor σ X) f
      exact FreeSMCQuotient.left_unitor_natural f)
    (by
      intro X Y f
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor f (FreeSMCQuotient.id σ []))
            (FreeSMCQuotient.rightUnitor σ Y) =
          FreeSMCQuotient.comp
            (FreeSMCQuotient.rightUnitor σ X) f
      exact FreeSMCQuotient.right_unitor_natural f)
    (by
      intro W X Y Z
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.associator σ W X Y)
              (FreeSMCQuotient.id σ Z))
            (FreeSMCQuotient.comp
              (FreeSMCQuotient.associator σ W (X ++ Y) Z)
              (FreeSMCQuotient.tensor (FreeSMCQuotient.id σ W)
                (FreeSMCQuotient.associator σ X Y Z))) =
          FreeSMCQuotient.comp
            (FreeSMCQuotient.associator σ (W ++ X) Y Z)
            (FreeSMCQuotient.associator σ W X (Y ++ Z))
      rw [← FreeSMCQuotient.comp_assoc]
      exact (FreeSMCQuotient.pentagon W X Y Z).symm)
    (by
      intro X Y
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.associator σ X [] Y)
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.id σ X)
              (FreeSMCQuotient.leftUnitor σ Y)) =
          FreeSMCQuotient.tensor
            (FreeSMCQuotient.rightUnitor σ X)
            (FreeSMCQuotient.id σ Y)
      exact FreeSMCQuotient.triangle X Y)

/-- The quotient symmetry bundled as an isomorphism. -/
def quotientBraidingIso (σ : FinSignature) (X Y : Word σ) :
    X ⊗ Y ≅ Y ⊗ X where
  hom := FreeSMCQuotient.symmetry σ X Y
  inv := FreeSMCQuotient.symmetry σ Y X
  hom_inv_id := FreeSMCQuotient.symmetry_involutive X Y
  inv_hom_id := FreeSMCQuotient.symmetry_involutive Y X

/--
The generated quotient is a genuine symmetric monoidal category in mathlib.

The reverse hexagon is not postulated separately.  It is obtained by taking
the inverse of the existing forward hexagon and using involutivity of the
chosen braiding.
-/
instance quotientSymmetricCategory (σ : FinSignature) :
    SymmetricCategory (Word σ) where
  braiding := quotientBraidingIso σ
  braiding_naturality_right := by
    intro X Y Z f
    change
      FreeSMCQuotient.comp
          (FreeSMCQuotient.tensor (FreeSMCQuotient.id σ X) f)
          (FreeSMCQuotient.symmetry σ X Z) =
        FreeSMCQuotient.comp
          (FreeSMCQuotient.symmetry σ X Y)
          (FreeSMCQuotient.tensor f (FreeSMCQuotient.id σ X))
    exact FreeSMCQuotient.symmetry_natural
      (FreeSMCQuotient.id σ X) f
  braiding_naturality_left := by
    intro X Y f Z
    change
      FreeSMCQuotient.comp
          (FreeSMCQuotient.tensor f (FreeSMCQuotient.id σ Z))
          (FreeSMCQuotient.symmetry σ Y Z) =
        FreeSMCQuotient.comp
          (FreeSMCQuotient.symmetry σ X Z)
          (FreeSMCQuotient.tensor (FreeSMCQuotient.id σ Z) f)
    exact FreeSMCQuotient.symmetry_natural f
      (FreeSMCQuotient.id σ Z)
  hexagon_forward := by
    intro X Y Z
    change
      FreeSMCQuotient.comp
          (FreeSMCQuotient.associator σ X Y Z)
          (FreeSMCQuotient.comp
            (FreeSMCQuotient.symmetry σ X (Y ++ Z))
            (FreeSMCQuotient.associator σ Y Z X)) =
        FreeSMCQuotient.comp
          (FreeSMCQuotient.tensor
            (FreeSMCQuotient.symmetry σ X Y)
            (FreeSMCQuotient.id σ Z))
          (FreeSMCQuotient.comp
            (FreeSMCQuotient.associator σ Y X Z)
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.id σ Y)
              (FreeSMCQuotient.symmetry σ X Z)))
    simpa only [← FreeSMCQuotient.comp_assoc] using
      FreeSMCQuotient.hexagon X Y Z
  hexagon_reverse := by
    intro X Y Z
    let lhsIso :
        (Z ⊗ X) ⊗ Y ≅ X ⊗ (Y ⊗ Z) :=
      (α_ Z X Y) ≪≫
        quotientBraidingIso σ Z (X ⊗ Y) ≪≫
          (α_ X Y Z)
    let rhsIso :
        (Z ⊗ X) ⊗ Y ≅ X ⊗ (Y ⊗ Z) :=
      (quotientBraidingIso σ Z X ⊗ᵢ Iso.refl Y) ≪≫
        (α_ X Z Y) ≪≫
          (Iso.refl X ⊗ᵢ quotientBraidingIso σ Z Y)
    have hom_eq : lhsIso.hom = rhsIso.hom := by
      dsimp [lhsIso, rhsIso]
      change
        FreeSMCQuotient.comp
            (FreeSMCQuotient.associator σ Z X Y)
            (FreeSMCQuotient.comp
              (FreeSMCQuotient.symmetry σ Z (X ++ Y))
              (FreeSMCQuotient.associator σ X Y Z)) =
          FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.symmetry σ Z X)
              (FreeSMCQuotient.id σ Y))
            (FreeSMCQuotient.comp
              (FreeSMCQuotient.associator σ X Z Y)
              (FreeSMCQuotient.tensor
                (FreeSMCQuotient.id σ X)
                (FreeSMCQuotient.symmetry σ Z Y)))
      rw [← FreeSMCQuotient.comp_assoc,
        ← FreeSMCQuotient.comp_assoc]
      exact FreeSMCQuotient.hexagon Z X Y
    have inv_eq : lhsIso.inv = rhsIso.inv :=
      (Iso.inv_eq_inv lhsIso rhsIso).2 hom_eq
    dsimp [lhsIso, rhsIso, quotientBraidingIso] at inv_eq
    change
      FreeSMCQuotient.comp
          (FreeSMCQuotient.associatorInv σ X Y Z)
          (FreeSMCQuotient.comp
            (FreeSMCQuotient.symmetry σ (X ++ Y) Z)
            (FreeSMCQuotient.associatorInv σ Z X Y)) =
        FreeSMCQuotient.comp
          (FreeSMCQuotient.tensor
            (FreeSMCQuotient.id σ X)
            (FreeSMCQuotient.symmetry σ Y Z))
          (FreeSMCQuotient.comp
            (FreeSMCQuotient.associatorInv σ X Z Y)
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.symmetry σ X Z)
              (FreeSMCQuotient.id σ Y)))
    simp only [Iso.trans_inv, tensorIso_inv, Iso.refl_inv] at inv_eq
    change
      FreeSMCQuotient.comp
          (FreeSMCQuotient.comp
            (FreeSMCQuotient.associatorInv σ X Y Z)
            (FreeSMCQuotient.symmetry σ (X ++ Y) Z))
          (FreeSMCQuotient.associatorInv σ Z X Y) =
        FreeSMCQuotient.comp
          (FreeSMCQuotient.comp
            (FreeSMCQuotient.tensor
              (FreeSMCQuotient.id σ X)
              (FreeSMCQuotient.symmetry σ Y Z))
            (FreeSMCQuotient.associatorInv σ X Z Y)
          )
          (FreeSMCQuotient.tensor
            (FreeSMCQuotient.symmetry σ X Z)
            (FreeSMCQuotient.id σ Y)) at inv_eq
    rw [FreeSMCQuotient.comp_assoc,
      FreeSMCQuotient.comp_assoc] at inv_eq
    exact inv_eq
  symmetry := by
    intro X Y
    change
      FreeSMCQuotient.comp
          (FreeSMCQuotient.symmetry σ X Y)
          (FreeSMCQuotient.symmetry σ Y X) =
        FreeSMCQuotient.id σ (X ++ Y)
    exact FreeSMCQuotient.symmetry_involutive X Y

section Target

variable {σ : FinSignature}
variable {C : Type u} [Category.{0} C] [MonoidalCategory C]

/--
Right-associated interpretation of a word of generating objects.

The empty word is interpreted by the tensor unit.  No strictness assumption
on the target category is made.
-/
def foldObj (object : σ.Obj → C) : Word σ → C
  | [] => 𝟙_ C
  | X :: Xs => object X ⊗ foldObj object Xs

@[simp] theorem foldObj_nil (object : σ.Obj → C) :
    foldObj object [] = 𝟙_ C := rfl

@[simp] theorem foldObj_cons (object : σ.Obj → C) (X : σ.Obj)
    (Xs : Word σ) :
    foldObj object (X :: Xs) = object X ⊗ foldObj object Xs := rfl

/--
Canonical coherence isomorphism comparing word concatenation with the
target tensor.  It is the tensorator of the eventual strong monoidal
interpretation, in the oplax direction.
-/
def appendIso (object : σ.Obj → C) :
    ∀ Xs Ys : Word σ,
      foldObj object (Xs ++ Ys) ≅
        foldObj object Xs ⊗ foldObj object Ys
  | [], Ys => (λ_ (foldObj object Ys)).symm
  | X :: Xs, Ys =>
      (Iso.refl (object X) ⊗ᵢ appendIso object Xs Ys) ≪≫
        (α_ (object X) (foldObj object Xs) (foldObj object Ys)).symm

@[simp] theorem appendIso_nil_hom (object : σ.Obj → C)
    (Ys : Word σ) :
    (appendIso object [] Ys).hom =
      (λ_ (foldObj object Ys)).inv := rfl

@[simp] theorem appendIso_nil_inv (object : σ.Obj → C)
    (Ys : Word σ) :
    (appendIso object [] Ys).inv =
      (λ_ (foldObj object Ys)).hom := rfl

@[simp] theorem appendIso_cons_hom (object : σ.Obj → C)
    (X : σ.Obj) (Xs Ys : Word σ) :
    (appendIso object (X :: Xs) Ys).hom =
      (𝟙 (object X) ⊗ₘ (appendIso object Xs Ys).hom) ≫
        (α_ (object X) (foldObj object Xs) (foldObj object Ys)).inv := rfl

@[simp] theorem appendIso_cons_inv (object : σ.Obj → C)
    (X : σ.Obj) (Xs Ys : Word σ) :
    (appendIso object (X :: Xs) Ys).inv =
      (α_ (object X) (foldObj object Xs) (foldObj object Ys)).hom ≫
        (𝟙 (object X) ⊗ₘ (appendIso object Xs Ys).inv) := rfl

variable [SymmetricCategory C]

/--
Semantic values for the non-coherence generators.

Copy and discard remain explicit: even when an object is declared
cartesian, the caller must supply their semantic arrows.
-/
structure InterpretationData (σ : FinSignature) (C : Type u)
    [Category.{0} C] [MonoidalCategory C] where
  object : σ.Obj → C
  generator :
    ∀ g : σ.Gen,
      foldObj object (σ.input g) ⟶ foldObj object (σ.output g)
  copy :
    ∀ (X : σ.Obj) (h : (σ.mode X).AllowsCopy),
      foldObj object [X] ⟶ foldObj object [X, X]
  discard :
    ∀ (X : σ.Obj) (h : (σ.mode X).AllowsDrop),
      foldObj object [X] ⟶ foldObj object []

namespace InterpretationData

/-- The semantic transport induced by an equality of source words. -/
def equalityHom (D : InterpretationData σ C)
    {A B : Word σ} (h : A = B) :
    foldObj D.object A ⟶ foldObj D.object B :=
  eqToHom (congrArg (foldObj D.object) h)

@[simp] theorem equalityHom_rfl (D : InterpretationData σ C)
    (A : Word σ) :
    D.equalityHom (Eq.refl A) = 𝟙 (foldObj D.object A) := rfl

theorem equalityHom_cons (D : InterpretationData σ C)
    {A B : Word σ} (X : σ.Obj) (h : A = B) :
    D.equalityHom (congrArg (List.cons X) h) =
      𝟙 (D.object X) ⊗ₘ D.equalityHom h := by
  subst B
  simp [equalityHom]

theorem equalityHom_append_assoc_cons (D : InterpretationData σ C)
    (X : σ.Obj) (A B E : Word σ) :
    D.equalityHom (List.append_assoc (X :: A) B E) =
      𝟙 (D.object X) ⊗ₘ
        D.equalityHom (List.append_assoc A B E) := by
  have proof_eq :
      List.append_assoc (X :: A) B E =
        congrArg (List.cons X) (List.append_assoc A B E) :=
    Subsingleton.elim _ _
  rw [proof_eq]
  exact D.equalityHom_cons X _

theorem equalityHom_append_nil_cons (D : InterpretationData σ C)
    (X : σ.Obj) (A : Word σ) :
    D.equalityHom (List.append_nil (X :: A)) =
      𝟙 (D.object X) ⊗ₘ D.equalityHom (List.append_nil A) := by
  have proof_eq :
      List.append_nil (X :: A) =
        congrArg (List.cons X) (List.append_nil A) :=
    Subsingleton.elim _ _
  rw [proof_eq]
  exact D.equalityHom_cons X _

/-- Tensor two interpreted arrows, conjugating by the word-fold coherence. -/
def tensor (D : InterpretationData σ C)
    {A B X Y : Word σ}
    (f : foldObj D.object A ⟶ foldObj D.object B)
    (g : foldObj D.object X ⟶ foldObj D.object Y) :
    foldObj D.object (A ++ X) ⟶ foldObj D.object (B ++ Y) :=
  (appendIso D.object A X).hom ≫
    (f ⊗ₘ g) ≫
      (appendIso D.object B Y).inv

/-- The target coherence interpreting a block swap. -/
def symmetry (D : InterpretationData σ C) (A B : Word σ) :
    foldObj D.object (A ++ B) ⟶ foldObj D.object (B ++ A) :=
  (appendIso D.object A B).hom ≫
    (β_ (foldObj D.object A) (foldObj D.object B)).hom ≫
      (appendIso D.object B A).inv

/-- Evaluate a raw string diagram in an arbitrary symmetric monoidal target. -/
def evalRaw (D : InterpretationData σ C) :
    {A B : Word σ} →
      Raw σ A B →
        (foldObj D.object A ⟶ foldObj D.object B)
  | _, _, .identity _ => 𝟙 _
  | _, _, .generator g => D.generator g
  | _, _, .sequential f g => evalRaw D f ≫ evalRaw D g
  | _, _, .tensor f g => D.tensor (evalRaw D f) (evalRaw D g)
  | _, _, .symmetry A B => D.symmetry A B
  | _, _, .copy X h => D.copy X h
  | _, _, .discard X h => D.discard X h

@[simp] theorem evalRaw_identity (D : InterpretationData σ C)
    (A : Word σ) :
    D.evalRaw (.identity A) = 𝟙 (foldObj D.object A) := rfl

@[simp] theorem evalRaw_generator (D : InterpretationData σ C)
    (g : σ.Gen) :
    D.evalRaw (.generator g) = D.generator g := rfl

@[simp] theorem evalRaw_sequential (D : InterpretationData σ C)
    {A B X : Word σ} (f : Raw σ A B) (g : Raw σ B X) :
    D.evalRaw (.sequential f g) = D.evalRaw f ≫ D.evalRaw g := rfl

@[simp] theorem evalRaw_tensor (D : InterpretationData σ C)
    {A B X Y : Word σ} (f : Raw σ A B) (g : Raw σ X Y) :
    D.evalRaw (.tensor f g) = D.tensor (D.evalRaw f) (D.evalRaw g) := rfl

@[simp] theorem evalRaw_symmetry (D : InterpretationData σ C)
    (A B : Word σ) :
    D.evalRaw (.symmetry A B) = D.symmetry A B := rfl

theorem evalRaw_equalityRaw (D : InterpretationData σ C)
    {A B : Word σ} (h : A = B) :
    D.evalRaw (FreeSMCQuotient.equalityRaw h) =
      D.equalityHom h := by
  subst B
  rfl

theorem evalRaw_associator (D : InterpretationData σ C)
    (A B E : Word σ) :
    D.evalRaw (FreeSMCQuotient.associatorRaw σ A B E) =
      D.equalityHom (List.append_assoc A B E) :=
  D.evalRaw_equalityRaw _

theorem evalRaw_associatorInv (D : InterpretationData σ C)
    (A B E : Word σ) :
    D.evalRaw (FreeSMCQuotient.associatorInvRaw σ A B E) =
      D.equalityHom (List.append_assoc A B E).symm :=
  D.evalRaw_equalityRaw _

theorem evalRaw_leftUnitor (D : InterpretationData σ C)
    (A : Word σ) :
    D.evalRaw (FreeSMCQuotient.leftUnitorRaw σ A) =
      𝟙 (foldObj D.object A) := rfl

theorem evalRaw_rightUnitor (D : InterpretationData σ C)
    (A : Word σ) :
    D.evalRaw (FreeSMCQuotient.rightUnitorRaw σ A) =
      D.equalityHom (List.append_nil A) :=
  D.evalRaw_equalityRaw _

@[simp] theorem tensor_identity (D : InterpretationData σ C)
    (A B : Word σ) :
    D.tensor (𝟙 (foldObj D.object A)) (𝟙 (foldObj D.object B)) =
      𝟙 (foldObj D.object (A ++ B)) := by
  simp [tensor]

theorem tensor_comp (D : InterpretationData σ C)
    {A B E X Y Z : Word σ}
    (f : foldObj D.object A ⟶ foldObj D.object B)
    (g : foldObj D.object B ⟶ foldObj D.object E)
    (p : foldObj D.object X ⟶ foldObj D.object Y)
    (q : foldObj D.object Y ⟶ foldObj D.object Z) :
    D.tensor (f ≫ g) (p ≫ q) =
      D.tensor f p ≫ D.tensor g q := by
  simp [tensor, Category.assoc]

theorem appendIso_associativity (D : InterpretationData σ C)
    (A B E : Word σ) :
    (appendIso D.object (A ++ B) E).hom ≫
        ((appendIso D.object A B).hom ⊗ₘ
          𝟙 (foldObj D.object E)) ≫
        (α_ (foldObj D.object A) (foldObj D.object B)
          (foldObj D.object E)).hom =
      D.equalityHom (List.append_assoc A B E) ≫
        (appendIso D.object A (B ++ E)).hom ≫
        (𝟙 (foldObj D.object A) ⊗ₘ
          (appendIso D.object B E).hom) := by
  induction A with
  | nil =>
      simp [appendIso, equalityHom, Category.assoc]
  | cons X A ih =>
      rw [D.equalityHom_append_assoc_cons]
      simp only [List.cons_append, foldObj_cons, appendIso_cons_hom]
      simp [Category.assoc] at ih ⊢
      have ihX := congrArg (fun k => D.object X ◁ k) ih
      simp only [MonoidalCategory.whiskerLeft_comp] at ihX
      have post := congrArg
        (fun k => k ≫
          (α_ (D.object X) (foldObj D.object A)
            (foldObj D.object B ⊗ foldObj D.object E)).inv)
        ihX
      simpa only [Category.assoc] using post

theorem appendIso_right_unit (D : InterpretationData σ C)
    (A : Word σ) :
    (appendIso D.object A []).inv ≫
        D.equalityHom (List.append_nil A) =
      (ρ_ (foldObj D.object A)).hom := by
  induction A with
  | nil =>
      simp [appendIso, equalityHom]
      monoidal
  | cons X A ih =>
      rw [D.equalityHom_append_nil_cons]
      simp only [appendIso_cons_inv, foldObj_cons]
      dsimp only [foldObj] at ih ⊢
      change
        ((α_ (D.object X) (foldObj D.object A) (𝟙_ C)).hom ≫
            (𝟙 (D.object X) ⊗ₘ
              (appendIso D.object A []).inv)) ≫
            (𝟙 (D.object X) ⊗ₘ
              D.equalityHom (List.append_nil A)) =
          (ρ_ (D.object X ⊗ foldObj D.object A)).hom
      have tens :=
        MonoidalCategory.tensorHom_comp_tensorHom
          (𝟙 (D.object X))
          ((appendIso D.object A []).inv)
          (𝟙 (D.object X))
          (D.equalityHom (List.append_nil A))
      simp only [Category.id_comp] at tens
      have tensIh :
          (𝟙 (D.object X) ⊗ₘ
              (appendIso D.object A []).inv) ≫
              (𝟙 (D.object X) ⊗ₘ
                D.equalityHom (List.append_nil A)) =
            𝟙 (D.object X) ⊗ₘ
              (ρ_ (foldObj D.object A)).hom :=
        tens.trans (congrArg (fun k => 𝟙 (D.object X) ⊗ₘ k) ih)
      have pre := congrArg
        (fun k =>
          (α_ (D.object X) (foldObj D.object A)
            (foldObj D.object [])).hom ≫ k)
        tensIh
      calc
        ((α_ (D.object X) (foldObj D.object A) (𝟙_ C)).hom ≫
              (𝟙 (D.object X) ⊗ₘ
                (appendIso D.object A []).inv)) ≫
              (𝟙 (D.object X) ⊗ₘ
                D.equalityHom (List.append_nil A)) =
            (α_ (D.object X) (foldObj D.object A) (𝟙_ C)).hom ≫
              ((𝟙 (D.object X) ⊗ₘ
                  (appendIso D.object A []).inv) ≫
                (𝟙 (D.object X) ⊗ₘ
                  D.equalityHom (List.append_nil A))) := by
                    rw [Category.assoc]
        _ = (α_ (D.object X) (foldObj D.object A) (𝟙_ C)).hom ≫
              (𝟙 (D.object X) ⊗ₘ
                (ρ_ (foldObj D.object A)).hom) := by
                  simpa only [foldObj_nil] using pre
        _ = (ρ_ (D.object X ⊗ foldObj D.object A)).hom := by
              monoidal

/-- An equality of source words gives an isomorphism of interpreted objects. -/
def equalityIso (D : InterpretationData σ C)
    {A B : Word σ} (h : A = B) :
    foldObj D.object A ≅ foldObj D.object B where
  hom := D.equalityHom h
  inv := D.equalityHom h.symm
  hom_inv_id := by
    subst B
    simp [equalityHom]
  inv_hom_id := by
    subst B
    simp [equalityHom]

end InterpretationData

/--
The category of source words whose arrows are target morphisms between their
folded interpretations.

The wrapper is intentionally distinct from the syntactic quotient's object
type, so the two categories may coexist without overlapping instances.
-/
structure SemanticWord (D : InterpretationData σ C) where
  word : Word σ

namespace SemanticWord

instance (D : InterpretationData σ C) : Category.{0} (SemanticWord D) where
  Hom A B := foldObj D.object A.word ⟶ foldObj D.object B.word
  id := fun A => 𝟙 (foldObj D.object A.word)
  comp := fun f g => f ≫ g
  id_comp := by intros; apply Category.id_comp
  comp_id := by intros; apply Category.comp_id
  assoc := by intros; apply Category.assoc

/-- Concatenation of wrapped words. -/
def append (D : InterpretationData σ C)
    (A B : SemanticWord D) : SemanticWord D :=
  ⟨A.word ++ B.word⟩

/-- A word equality bundled as an isomorphism in `SemanticWord`. -/
def wordIso (D : InterpretationData σ C)
    {A B : SemanticWord D} (h : A.word = B.word) : A ≅ B where
  hom := D.equalityHom h
  inv := D.equalityHom h.symm
  hom_inv_id := by
    rcases A with ⟨A⟩
    rcases B with ⟨B⟩
    dsimp at h
    subst B
    change
      D.equalityHom rfl ≫ D.equalityHom rfl =
        𝟙 (foldObj D.object A)
    simp [InterpretationData.equalityHom]
  inv_hom_id := by
    rcases A with ⟨A⟩
    rcases B with ⟨B⟩
    dsimp at h
    subst B
    change
      D.equalityHom rfl ≫ D.equalityHom rfl =
        𝟙 (foldObj D.object A)
    simp [InterpretationData.equalityHom]

/-- Forget the word index and realize its folded target object. -/
def realization (D : InterpretationData σ C) : SemanticWord D ⥤ C where
  obj A := foldObj D.object A.word
  map f := f
  map_id := by intros; rfl
  map_comp := by intros; rfl

instance realizationFaithful (D : InterpretationData σ C) :
    (realization D).Faithful where
  map_injective h := h

/-- Regard a target isomorphism between realizations as a word isomorphism. -/
def liftIso (D : InterpretationData σ C)
    {A B : SemanticWord D}
    (e : foldObj D.object A.word ≅ foldObj D.object B.word) :
    A ≅ B where
  hom := e.hom
  inv := e.inv
  hom_inv_id := by
    change e.hom ≫ e.inv = 𝟙 (foldObj D.object A.word)
    exact e.hom_inv_id
  inv_hom_id := by
    change e.inv ≫ e.hom = 𝟙 (foldObj D.object B.word)
    exact e.inv_hom_id

/-- The explicitly typed unit comparison used by the inducing data. -/
def unitComparison (D : InterpretationData σ C) :
    𝟙_ C ≅ foldObj D.object [] :=
  eqToIso (by rfl)

/-- Associator obtained by conjugating target coherence by `appendIso`. -/
def associatorIso (D : InterpretationData σ C)
    (A B E : SemanticWord D) :
    append D (append D A B) E ≅ append D A (append D B E) :=
  liftIso D <|
    appendIso D.object (A.word ++ B.word) E.word ≪≫
      (appendIso D.object A.word B.word ⊗ᵢ
        Iso.refl (foldObj D.object E.word)) ≪≫
      α_ (foldObj D.object A.word) (foldObj D.object B.word)
        (foldObj D.object E.word) ≪≫
      (Iso.refl (foldObj D.object A.word) ⊗ᵢ
        (appendIso D.object B.word E.word).symm) ≪≫
      (appendIso D.object A.word (B.word ++ E.word)).symm

/-- Left unitor obtained by conjugating the target left unitor. -/
def leftUnitorIso (D : InterpretationData σ C)
    (A : SemanticWord D) :
    append D (⟨[]⟩ : SemanticWord D) A ≅ A :=
  liftIso D <|
    appendIso D.object [] A.word ≪≫
      ((unitComparison D).symm ⊗ᵢ
        Iso.refl (foldObj D.object A.word)) ≪≫
      λ_ (foldObj D.object A.word)

/-- Right unitor obtained by conjugating the target right unitor. -/
def rightUnitorIso (D : InterpretationData σ C)
    (A : SemanticWord D) :
    append D A (⟨[]⟩ : SemanticWord D) ≅ A :=
  liftIso D <|
    appendIso D.object A.word [] ≪≫
      (Iso.refl (foldObj D.object A.word) ⊗ᵢ
        (unitComparison D).symm) ≪≫
      ρ_ (foldObj D.object A.word)

/-- Candidate tensor data pulled back from `C` along `realization`. -/
instance monoidalStruct (D : InterpretationData σ C) :
    MonoidalCategoryStruct (SemanticWord D) where
  tensorObj := append D
  whiskerLeft A {_ _} f :=
    D.tensor (𝟙 (foldObj D.object A.word)) f
  whiskerRight {_ _} f B :=
    D.tensor f (𝟙 (foldObj D.object B.word))
  tensorHom := D.tensor
  tensorUnit := ⟨[]⟩
  associator := associatorIso D
  leftUnitor := leftUnitorIso D
  rightUnitor := rightUnitorIso D

@[simp] theorem tensorObj_eq (D : InterpretationData σ C)
    (A B : SemanticWord D) :
    A ⊗ B = append D A B := rfl

@[simp] theorem tensorUnit_eq (D : InterpretationData σ C) :
    𝟙_ (SemanticWord D) = (⟨[]⟩ : SemanticWord D) := rfl

@[simp] theorem wrap_tensor (D : InterpretationData σ C)
    (A B : Word σ) :
    (⟨A⟩ : SemanticWord D) ⊗ (⟨B⟩ : SemanticWord D) =
      (⟨A ++ B⟩ : SemanticWord D) := rfl

@[simp] theorem tensorHom_eq_tensor (D : InterpretationData σ C)
    {A B X Y : Word σ}
    (f : (⟨A⟩ : SemanticWord D) ⟶ ⟨B⟩)
    (g : (⟨X⟩ : SemanticWord D) ⟶ ⟨Y⟩) :
    f ⊗ₘ g = D.tensor f g := rfl

@[simp] theorem whiskerRight_eq_tensor (D : InterpretationData σ C)
    {A B : Word σ} (f : (⟨A⟩ : SemanticWord D) ⟶ ⟨B⟩)
    (X : Word σ) :
    f ▷ (⟨X⟩ : SemanticWord D) =
      D.tensor f (𝟙 (foldObj D.object X)) := rfl

@[simp] theorem whiskerLeft_eq_tensor (D : InterpretationData σ C)
    (X : Word σ) {A B : Word σ}
    (f : (⟨A⟩ : SemanticWord D) ⟶ ⟨B⟩) :
    (⟨X⟩ : SemanticWord D) ◁ f =
      D.tensor (𝟙 (foldObj D.object X)) f := rfl

/-- Coherence data exhibiting `realization` as an inducing functor. -/
def inducingData (D : InterpretationData σ C) :
    CategoryTheory.Monoidal.InducingFunctorData (realization D) where
  μIso A B := (appendIso D.object A.word B.word).symm
  εIso := unitComparison D
  whiskerLeft_eq := by
    intro A B E f
    dsimp +instances only [realization, monoidalStruct,
      InterpretationData.tensor, append]
    simp only [Iso.symm_inv, Iso.symm_hom,
      MonoidalCategory.id_tensorHom]
  whiskerRight_eq := by
    intro A B f E
    dsimp +instances only [realization, monoidalStruct,
      InterpretationData.tensor, append]
    simp only [Iso.symm_inv, Iso.symm_hom,
      MonoidalCategory.tensorHom_id]
  tensorHom_eq := by
    intro A B X Y f g
    rfl
  associator_eq := by
    intro A B E
    dsimp +instances only [realization, monoidalStruct,
      associatorIso, liftIso, append]
    simp only [Iso.symm_symm_eq, Iso.trans_hom, Category.assoc]
  leftUnitor_eq := by
    intro A
    dsimp +instances only [realization, monoidalStruct,
      leftUnitorIso, liftIso, append]
    simp only [Iso.symm_symm_eq, Iso.trans_hom, Category.assoc]
  rightUnitor_eq := by
    intro A
    dsimp +instances only [realization, monoidalStruct,
      rightUnitorIso, liftIso, append]
    simp only [Iso.symm_symm_eq, Iso.trans_hom, Category.assoc]

instance monoidalCategory (D : InterpretationData σ C) :
    MonoidalCategory (SemanticWord D) :=
  CategoryTheory.Monoidal.induced (realization D) (inducingData D)

instance realizationMonoidal (D : InterpretationData σ C) :
    (realization D).Monoidal :=
  CategoryTheory.Monoidal.fromInducedMonoidal
    (realization D) (inducingData D)

@[simp] theorem realization_μ (D : InterpretationData σ C)
    (A B : SemanticWord D) :
    Functor.LaxMonoidal.μ (realization D) A B =
      (appendIso D.object A.word B.word).inv := by
  rfl

/-- Braiding obtained by conjugating the target braiding by `appendIso`. -/
def braidingIso (D : InterpretationData σ C)
    (A B : SemanticWord D) :
    A ⊗ B ≅ B ⊗ A :=
  liftIso D <|
    appendIso D.object A.word B.word ≪≫
      β_ (foldObj D.object A.word) (foldObj D.object B.word) ≪≫
      (appendIso D.object B.word A.word).symm

private theorem realization_braided (D : InterpretationData σ C)
    (A B : SemanticWord D) :
    Functor.LaxMonoidal.μ (realization D) A B ≫
        (realization D).map (braidingIso D A B).hom =
      (β_ ((realization D).obj A) ((realization D).obj B)).hom ≫
        Functor.LaxMonoidal.μ (realization D) B A := by
  rw [realization_μ D A B, realization_μ D B A]
  change
    (appendIso D.object A.word B.word).inv ≫
        ((appendIso D.object A.word B.word).hom ≫
          (β_ (foldObj D.object A.word)
            (foldObj D.object B.word)).hom ≫
          (appendIso D.object B.word A.word).inv) =
      (β_ (foldObj D.object A.word)
        (foldObj D.object B.word)).hom ≫
        (appendIso D.object B.word A.word).inv
  simp [Category.assoc]

instance braidedCategory (D : InterpretationData σ C) :
    BraidedCategory (SemanticWord D) :=
  BraidedCategory.ofFaithful
    (realization D) (braidingIso D) (realization_braided D)

instance realizationBraided (D : InterpretationData σ C) :
    (realization D).Braided where
  braided := realization_braided D

instance symmetricCategory (D : InterpretationData σ C) :
    SymmetricCategory (SemanticWord D) :=
  SymmetricCategory.ofFaithful (realization D)

/-- Wrap an ordinary source word as a semantic word. -/
def wrap (D : InterpretationData σ C) (A : Word σ) : SemanticWord D :=
  ⟨A⟩

theorem associator_hom_eq_equalityHom (D : InterpretationData σ C)
    (A B E : Word σ) :
    (α_ (wrap D A) (wrap D B) (wrap D E)).hom =
      D.equalityHom (List.append_assoc A B E) := by
  change
    (associatorIso D (wrap D A) (wrap D B) (wrap D E)).hom =
      D.equalityHom (List.append_assoc A B E)
  dsimp only [associatorIso, liftIso, wrap, append]
  have h := D.appendIso_associativity A B E
  have hPost := congrArg
    (fun k =>
      k ≫
        (𝟙 (foldObj D.object A) ⊗ₘ
          (appendIso D.object B E).inv) ≫
        (appendIso D.object A (B ++ E)).inv)
    h
  simp only [Category.assoc] at hPost
  simpa [Iso.trans_hom, Category.assoc] using hPost

theorem leftUnitor_hom_eq_equalityHom (D : InterpretationData σ C)
    (A : Word σ) :
    (λ_ (wrap D A)).hom =
      D.equalityHom (by simp : List.append [] A = A) := by
  change
    (leftUnitorIso D (wrap D A)).hom =
      D.equalityHom (by simp : List.append [] A = A)
  dsimp only [leftUnitorIso, liftIso, wrap, append]
  simp [unitComparison, InterpretationData.equalityHom,
    appendIso, Iso.trans_hom, Category.assoc]

theorem rightUnitor_hom_eq_equalityHom (D : InterpretationData σ C)
    (A : Word σ) :
    (ρ_ (wrap D A)).hom =
      D.equalityHom (List.append_nil A) := by
  change
    (rightUnitorIso D (wrap D A)).hom =
      D.equalityHom (List.append_nil A)
  dsimp only [rightUnitorIso, liftIso, wrap, append]
  simp only [Iso.trans_hom, tensorIso_hom, Iso.refl_hom,
    Iso.symm_hom]
  have h := D.appendIso_right_unit A
  have pre := congrArg
    (fun k => (appendIso D.object A []).hom ≫ k) h
  simpa [unitComparison, Category.assoc] using pre.symm

theorem braiding_hom_eq_symmetry (D : InterpretationData σ C)
    (A B : Word σ) :
    (β_ (wrap D A) (wrap D B)).hom = D.symmetry A B := by
  change (braidingIso D (wrap D A) (wrap D B)).hom =
    D.symmetry A B
  rfl

end SemanticWord

/-- The raw syntax algebra carried by the semantic word category. -/
def semanticAlgebra (D : InterpretationData σ C) :
    FreeSMC.Algebra σ where
  Carrier A B := foldObj D.object A ⟶ foldObj D.object B
  identity A := 𝟙 (foldObj D.object A)
  generator := D.generator
  sequential f g := f ≫ g
  tensor := D.tensor
  symmetry := D.symmetry
  copy := D.copy
  discard := D.discard

theorem semanticFold_equalityRaw (D : InterpretationData σ C)
    {A B : Word σ} (h : A = B) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.equalityRaw h) =
      D.equalityHom h := by
  subst B
  rfl

theorem semanticFold_associator (D : InterpretationData σ C)
    (A B E : Word σ) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.associatorRaw σ A B E) =
      D.equalityHom (List.append_assoc A B E) :=
  semanticFold_equalityRaw D _

theorem semanticFold_associatorInv (D : InterpretationData σ C)
    (A B E : Word σ) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.associatorInvRaw σ A B E) =
      D.equalityHom (List.append_assoc A B E).symm :=
  semanticFold_equalityRaw D _

theorem semanticFold_leftUnitor (D : InterpretationData σ C)
    (A : Word σ) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.leftUnitorRaw σ A) =
      D.equalityHom (by simp : [] ++ A = A) :=
  semanticFold_equalityRaw D _

theorem semanticFold_leftUnitorInv (D : InterpretationData σ C)
    (A : Word σ) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.leftUnitorInvRaw σ A) =
      D.equalityHom (by simp : A = [] ++ A) :=
  semanticFold_equalityRaw D _

theorem semanticFold_rightUnitor (D : InterpretationData σ C)
    (A : Word σ) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.rightUnitorRaw σ A) =
      D.equalityHom (List.append_nil A) :=
  semanticFold_equalityRaw D _

theorem semanticFold_rightUnitorInv (D : InterpretationData σ C)
    (A : Word σ) :
    FreeSMC.fold (semanticAlgebra D)
        (FreeSMCQuotient.rightUnitorInvRaw σ A) =
      D.equalityHom (List.append_nil A).symm :=
  semanticFold_equalityRaw D _

/-- Every target interpretation satisfies the equations used by the quotient. -/
def semanticLaws (D : InterpretationData σ C) :
    FreeSMCQuotient.Laws (semanticAlgebra D) where
  id_comp := by
    intro a b f
    exact Category.id_comp f
  comp_id := by
    intro a b f
    exact Category.comp_id f
  comp_assoc := by
    intro a b c d f g h
    exact Category.assoc f g h
  tensor_id := by
    intro a b
    exact D.tensor_identity a b
  tensor_comp := by
    intro a b c d e f p q r s
    exact D.tensor_comp p q r s
  associator_natural := by
    intro a b c a' b' c' f g h
    rw [semanticFold_associator, semanticFold_associator]
    let fs : SemanticWord.wrap D a ⟶ SemanticWord.wrap D a' := f
    let gs : SemanticWord.wrap D b ⟶ SemanticWord.wrap D b' := g
    let hs : SemanticWord.wrap D c ⟶ SemanticWord.wrap D c' := h
    have hn :=
      MonoidalCategory.associator_naturality fs gs hs
    dsimp only [semanticAlgebra]
    change D.tensor (D.tensor f g) h ≫ _ =
      _ ≫ D.tensor f (D.tensor g h) at hn
    rw [SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom] at hn
    exact hn
  left_unitor_natural := by
    intro a b f
    rw [semanticFold_leftUnitor, semanticFold_leftUnitor]
    let fs : SemanticWord.wrap D a ⟶ SemanticWord.wrap D b := f
    have hn := MonoidalCategory.leftUnitor_naturality fs
    dsimp only [semanticAlgebra]
    change D.tensor (𝟙 (foldObj D.object [])) f ≫ _ = _ ≫ f at hn
    rw [SemanticWord.leftUnitor_hom_eq_equalityHom,
      SemanticWord.leftUnitor_hom_eq_equalityHom] at hn
    exact hn
  right_unitor_natural := by
    intro a b f
    rw [semanticFold_rightUnitor, semanticFold_rightUnitor]
    let fs : SemanticWord.wrap D a ⟶ SemanticWord.wrap D b := f
    have hn := MonoidalCategory.rightUnitor_naturality fs
    dsimp only [semanticAlgebra]
    change D.tensor f (𝟙 (foldObj D.object [])) ≫ _ = _ ≫ f at hn
    rw [SemanticWord.rightUnitor_hom_eq_equalityHom,
      SemanticWord.rightUnitor_hom_eq_equalityHom] at hn
    exact hn
  symmetry_natural := by
    intro a b c d f g
    let fs : SemanticWord.wrap D a ⟶ SemanticWord.wrap D b := f
    let gs : SemanticWord.wrap D c ⟶ SemanticWord.wrap D d := g
    have hn := BraidedCategory.braiding_naturality fs gs
    dsimp only [semanticAlgebra]
    change D.tensor f g ≫ _ = _ ≫ D.tensor g f at hn
    rw [SemanticWord.braiding_hom_eq_symmetry,
      SemanticWord.braiding_hom_eq_symmetry] at hn
    exact hn
  associator_hom_inv := by
    intro a b c
    simp only [FreeSMC.fold_sequential]
    rw [semanticFold_associator, semanticFold_associatorInv]
    dsimp only [semanticAlgebra]
    simp [InterpretationData.equalityHom]
  associator_inv_hom := by
    intro a b c
    simp only [FreeSMC.fold_sequential]
    rw [semanticFold_associatorInv, semanticFold_associator]
    dsimp only [semanticAlgebra]
    simp [InterpretationData.equalityHom]
  left_unitor_hom_inv := by
    intro a
    simp only [FreeSMC.fold_sequential]
    rw [semanticFold_leftUnitor, semanticFold_leftUnitorInv]
    dsimp only [semanticAlgebra]
    simp [InterpretationData.equalityHom]
  left_unitor_inv_hom := by
    intro a
    simp only [FreeSMC.fold_sequential]
    rw [semanticFold_leftUnitorInv, semanticFold_leftUnitor]
    dsimp only [semanticAlgebra]
    simp [InterpretationData.equalityHom]
  right_unitor_hom_inv := by
    intro a
    simp only [FreeSMC.fold_sequential]
    rw [semanticFold_rightUnitor, semanticFold_rightUnitorInv]
    dsimp only [semanticAlgebra]
    simp [InterpretationData.equalityHom]
  right_unitor_inv_hom := by
    intro a
    simp only [FreeSMC.fold_sequential]
    rw [semanticFold_rightUnitorInv, semanticFold_rightUnitor]
    dsimp only [semanticAlgebra]
    simp [InterpretationData.equalityHom]
  symmetry_involutive := by
    intro a b
    dsimp only [semanticAlgebra, FreeSMC.fold]
    have hs := SymmetricCategory.symmetry (SemanticWord.wrap D a)
      (SemanticWord.wrap D b)
    rw [SemanticWord.braiding_hom_eq_symmetry,
      SemanticWord.braiding_hom_eq_symmetry] at hs
    change D.symmetry a b ≫ D.symmetry b a =
      𝟙 (foldObj D.object (a ++ b)) at hs
    exact hs
  pentagon := by
    intro a b c d
    simp only [FreeSMC.fold_sequential, FreeSMC.fold_tensor,
      FreeSMC.fold_identity, semanticFold_associator]
    repeat' rw [semanticFold_associator]
    dsimp only [semanticAlgebra]
    let A := SemanticWord.wrap D a
    let B := SemanticWord.wrap D b
    let E := SemanticWord.wrap D c
    let F := SemanticWord.wrap D d
    have hp := MonoidalCategory.pentagon A B E F
    dsimp only [A, B, E, F] at hp
    change
      (α_ (SemanticWord.wrap D a) (SemanticWord.wrap D b)
          (SemanticWord.wrap D c)).hom ▷ SemanticWord.wrap D d ≫
          (α_ (SemanticWord.wrap D a) (SemanticWord.wrap D (b ++ c))
            (SemanticWord.wrap D d)).hom ≫
            SemanticWord.wrap D a ◁
              (α_ (SemanticWord.wrap D b) (SemanticWord.wrap D c)
                (SemanticWord.wrap D d)).hom =
        (α_ (SemanticWord.wrap D (a ++ b)) (SemanticWord.wrap D c)
            (SemanticWord.wrap D d)).hom ≫
          (α_ (SemanticWord.wrap D a) (SemanticWord.wrap D b)
            (SemanticWord.wrap D (c ++ d))).hom at hp
    rw [SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom] at hp
    change D.tensor (D.equalityHom _) (𝟙 _) ≫
        D.equalityHom _ ≫ D.tensor (𝟙 _) (D.equalityHom _) =
      D.equalityHom _ ≫ D.equalityHom _ at hp
    simpa only [Category.assoc, SemanticWord.tensorObj_eq,
      SemanticWord.wrap, SemanticWord.append] using hp.symm
  triangle := by
    intro a b
    simp only [FreeSMC.fold_sequential, FreeSMC.fold_tensor,
      FreeSMC.fold_identity, semanticFold_associator,
      semanticFold_leftUnitor, semanticFold_rightUnitor]
    dsimp only [semanticAlgebra]
    let A := SemanticWord.wrap D a
    let B := SemanticWord.wrap D b
    have ht := MonoidalCategory.triangle A B
    dsimp only [A, B] at ht
    change
      (α_ (SemanticWord.wrap D a) (SemanticWord.wrap D [])
          (SemanticWord.wrap D b)).hom ≫
          SemanticWord.wrap D a ◁
            (λ_ (SemanticWord.wrap D b)).hom =
        (ρ_ (SemanticWord.wrap D a)).hom ▷
          SemanticWord.wrap D b at ht
    rw [SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.leftUnitor_hom_eq_equalityHom,
      SemanticWord.rightUnitor_hom_eq_equalityHom] at ht
    change D.equalityHom _ ≫
        D.tensor (𝟙 _) (D.equalityHom _) =
      D.tensor (D.equalityHom _) (𝟙 _) at ht
    exact ht
  hexagon := by
    intro a b c
    simp only [FreeSMC.fold_sequential, FreeSMC.fold_tensor,
      FreeSMC.fold_identity, semanticFold_associator]
    repeat' rw [semanticFold_associator]
    dsimp only [semanticAlgebra, FreeSMC.fold]
    let A := SemanticWord.wrap D a
    let B := SemanticWord.wrap D b
    let E := SemanticWord.wrap D c
    have hh := BraidedCategory.hexagon_forward A B E
    dsimp only [A, B, E] at hh
    change
      (α_ (SemanticWord.wrap D a) (SemanticWord.wrap D b)
          (SemanticWord.wrap D c)).hom ≫
          (β_ (SemanticWord.wrap D a)
            (SemanticWord.wrap D (b ++ c))).hom ≫
            (α_ (SemanticWord.wrap D b) (SemanticWord.wrap D c)
              (SemanticWord.wrap D a)).hom =
        (β_ (SemanticWord.wrap D a)
            (SemanticWord.wrap D b)).hom ▷ SemanticWord.wrap D c ≫
          (α_ (SemanticWord.wrap D b) (SemanticWord.wrap D a)
            (SemanticWord.wrap D c)).hom ≫
            SemanticWord.wrap D b ◁
              (β_ (SemanticWord.wrap D a)
                (SemanticWord.wrap D c)).hom at hh
    rw [SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.associator_hom_eq_equalityHom,
      SemanticWord.braiding_hom_eq_symmetry,
      SemanticWord.braiding_hom_eq_symmetry,
      SemanticWord.braiding_hom_eq_symmetry] at hh
    change D.equalityHom _ ≫ D.symmetry a (b ++ c) ≫
        D.equalityHom _ =
      D.tensor (D.symmetry a b) (𝟙 _) ≫
        D.equalityHom _ ≫
          D.tensor (𝟙 _) (D.symmetry a c) at hh
    simpa only [Category.assoc] using hh

/-- The arbitrary object assignment determines a lawful quotient algebra. -/
def semanticLawfulAlgebra (D : InterpretationData σ C) :
    FreeSMCQuotient.LawfulAlgebra σ where
  algebra := semanticAlgebra D
  laws := semanticLaws D

/-- The quotient interpretation, landing first in the semantic word category. -/
def quotientToSemantic (D : InterpretationData σ C) :
    Word σ ⥤ SemanticWord D where
  obj A := SemanticWord.wrap D A
  map f := FreeSMCQuotient.interpret (semanticLawfulAlgebra D) f
  map_id := by
    intro A
    exact
      (FreeSMCQuotient.quotientInterpreter
        (semanticLawfulAlgebra D)).map_identity A
  map_comp := by
    intro A B E f g
    exact
      (FreeSMCQuotient.quotientInterpreter
        (semanticLawfulAlgebra D)).map_sequential f g

@[simp] theorem quotientToSemantic_map_tensor
    (D : InterpretationData σ C)
    {A B X Y : Word σ} (f : A ⟶ B) (g : X ⟶ Y) :
    (quotientToSemantic D).map (f ⊗ₘ g) =
      D.tensor ((quotientToSemantic D).map f)
        ((quotientToSemantic D).map g) := by
  exact
    (FreeSMCQuotient.quotientInterpreter
      (semanticLawfulAlgebra D)).map_tensor f g

@[simp] theorem quotientToSemantic_map_associator
    (D : InterpretationData σ C) (A B E : Word σ) :
    (quotientToSemantic D).map (α_ A B E).hom =
      (α_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)
        (SemanticWord.wrap D E)).hom := by
  change
    FreeSMCQuotient.interpret (semanticLawfulAlgebra D)
        (FreeSMCQuotient.associator σ A B E) =
      (α_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)
        (SemanticWord.wrap D E)).hom
  calc
    _ = D.equalityHom (List.append_assoc A B E) := by
      rw [show FreeSMCQuotient.associator σ A B E =
          FreeSMCQuotient.ofRaw
            (FreeSMCQuotient.associatorRaw σ A B E) from rfl,
        FreeSMCQuotient.interpret_ofRaw]
      exact semanticFold_associator D A B E
    _ = _ := (SemanticWord.associator_hom_eq_equalityHom D A B E).symm

@[simp] theorem quotientToSemantic_map_leftUnitor
    (D : InterpretationData σ C) (A : Word σ) :
    (quotientToSemantic D).map (λ_ A).hom =
      (λ_ (SemanticWord.wrap D A)).hom := by
  change
    FreeSMCQuotient.interpret (semanticLawfulAlgebra D)
        (FreeSMCQuotient.leftUnitor σ A) =
      (λ_ (SemanticWord.wrap D A)).hom
  calc
    _ = D.equalityHom (by simp : [] ++ A = A) := by
      rw [show FreeSMCQuotient.leftUnitor σ A =
          FreeSMCQuotient.ofRaw
            (FreeSMCQuotient.leftUnitorRaw σ A) from rfl,
        FreeSMCQuotient.interpret_ofRaw]
      exact semanticFold_leftUnitor D A
    _ = _ := (SemanticWord.leftUnitor_hom_eq_equalityHom D A).symm

@[simp] theorem quotientToSemantic_map_rightUnitor
    (D : InterpretationData σ C) (A : Word σ) :
    (quotientToSemantic D).map (ρ_ A).hom =
      (ρ_ (SemanticWord.wrap D A)).hom := by
  change
    FreeSMCQuotient.interpret (semanticLawfulAlgebra D)
        (FreeSMCQuotient.rightUnitor σ A) =
      (ρ_ (SemanticWord.wrap D A)).hom
  calc
    _ = D.equalityHom (List.append_nil A) := by
      rw [show FreeSMCQuotient.rightUnitor σ A =
          FreeSMCQuotient.ofRaw
            (FreeSMCQuotient.rightUnitorRaw σ A) from rfl,
        FreeSMCQuotient.interpret_ofRaw]
      exact semanticFold_rightUnitor D A
    _ = _ := (SemanticWord.rightUnitor_hom_eq_equalityHom D A).symm

@[simp] theorem quotientToSemantic_map_braiding
    (D : InterpretationData σ C) (A B : Word σ) :
    (quotientToSemantic D).map (β_ A B).hom =
      (β_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)).hom := by
  change
    FreeSMCQuotient.interpret (semanticLawfulAlgebra D)
        (FreeSMCQuotient.symmetry σ A B) =
      (β_ (SemanticWord.wrap D A) (SemanticWord.wrap D B)).hom
  calc
    _ = D.symmetry A B :=
      (FreeSMCQuotient.quotientInterpreter
        (semanticLawfulAlgebra D)).map_symmetry A B
    _ = _ := (SemanticWord.braiding_hom_eq_symmetry D A B).symm

/--
The ordinary quotient functor determined by arbitrary object, generator,
copy, and discard assignments.

`quotientToSemantic` preserves tensor, associator, unitors, and braiding by
the preceding named lemmas.  Bundling those facts into mathlib's
`Functor.Monoidal` remains a separate endpoint-transport obligation.
-/
def interpretationFunctor (D : InterpretationData σ C) : Word σ ⥤ C :=
  quotientToSemantic D ⋙ SemanticWord.realization D

@[simp] theorem interpretationFunctor_obj
    (D : InterpretationData σ C) (A : Word σ) :
    (interpretationFunctor D).obj A = foldObj D.object A := rfl

@[simp] theorem interpretationFunctor_map_generator
    (D : InterpretationData σ C) (g : σ.Gen) :
    (interpretationFunctor D).map
        (FreeSMCQuotient.ofRaw (.generator g)) =
      D.generator g := by
  rfl

@[simp] theorem interpretationFunctor_map_copy
    (D : InterpretationData σ C) (X : σ.Obj)
    (h : (σ.mode X).AllowsCopy) :
    (interpretationFunctor D).map
        (FreeSMCQuotient.ofRaw (.copy X h)) =
      D.copy X h := by
  rfl

@[simp] theorem interpretationFunctor_map_discard
    (D : InterpretationData σ C) (X : σ.Obj)
    (h : (σ.mode X).AllowsDrop) :
    (interpretationFunctor D).map
        (FreeSMCQuotient.ofRaw (.discard X h)) =
      D.discard X h := by
  rfl

/-- The semantic realization itself is an actual strong braided functor. -/
theorem semantic_realization_strong_symmetric
    (D : InterpretationData σ C) :
    Nonempty ((SemanticWord.realization D).Monoidal) ∧
      Nonempty ((SemanticWord.realization D).Braided) :=
  ⟨⟨inferInstance⟩, ⟨inferInstance⟩⟩

/-- Arbitrary object data always yields a quotient functor preserving generators. -/
theorem arbitrary_object_quotient_functor_exists
    (D : InterpretationData σ C) :
    Nonempty (Word σ ⥤ C) :=
  ⟨interpretationFunctor D⟩

end Target

end Cantilune.Core.FreeSMCUniversal
