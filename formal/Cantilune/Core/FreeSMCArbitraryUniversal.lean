import Cantilune.Core.FreeSMCStrongUniversal

/-!
# Uniqueness data for arbitrary strong symmetric-monoidal realizations

This file starts the uniqueness half of the free-SMC universal property
without assuming a natural isomorphism.  Given only isomorphisms on generating
objects, it recursively constructs the comparison on every source word.
-/

namespace Cantilune.Core.FreeSMCArbitraryUniversal

open CategoryTheory
open CategoryTheory.Category
open CategoryTheory.MonoidalCategory
open CategoryTheory.Functor.LaxMonoidal
open CategoryTheory.Functor.Monoidal
open Cantilune.Core.FreeSMCQuotient
open Cantilune.Core.FreeSMCUniversal

universe u

variable {σ : FinSignature}
variable {C : Type u} [Category.{0} C] [MonoidalCategory C]
  [SymmetricCategory C]

noncomputable section

-- Avoid the reducibility-sensitive instance diamond through the braided
-- packaging when only the explicitly constructed monoidal structures are
-- needed below.
attribute [-instance]
  InterpretationData.quotientToSemanticBraided
  InterpretationData.interpretationFunctorBraided
  SemanticWord.realizationBraided

/--
Atomic comparison data.  No word-level family or naturality assumption is
stored: those are constructed below.
-/
structure AtomicComparison
    (D : InterpretationData σ C) (F : Word σ ⥤ C)
    [F.Braided] where
  atom : ∀ X : σ.Obj, D.object X ≅ F.obj [X]

namespace AtomicComparison

variable {D : InterpretationData σ C} {F : Word σ ⥤ C}
  [F.Braided]

@[simp] theorem quotient_ε :
    ε (quotientToSemantic D) =
      𝟙 (𝟙_ (SemanticWord D)) := by
  change
    (InterpretationData.quotientToSemanticMonoidal D).toLaxMonoidal.ε =
      𝟙 (𝟙_ (SemanticWord D))
  unfold InterpretationData.quotientToSemanticMonoidal
  rfl

@[simp] theorem quotient_μ (left right : Word σ) :
    μ (quotientToSemantic D) left right =
      𝟙 ((quotientToSemantic D).obj (left ⊗ right)) := by
  change
    (InterpretationData.quotientToSemanticMonoidal D).toLaxMonoidal.μ
        left right =
      𝟙 ((quotientToSemantic D).obj (left ⊗ right))
  unfold InterpretationData.quotientToSemanticMonoidal
  rfl

@[simp] theorem realization_ε :
    ε (SemanticWord.realization D) = 𝟙 (𝟙_ C) := by
  change
    (SemanticWord.realizationMonoidal D).toLaxMonoidal.ε =
      𝟙 (𝟙_ C)
  unfold SemanticWord.realizationMonoidal
  rfl

@[simp] theorem canonical_ε :
    ε (interpretationFunctor D) = 𝟙 (𝟙_ C) := by
  change
    ε (quotientToSemantic D ⋙ SemanticWord.realization D) =
      𝟙 (𝟙_ C)
  rw [Functor.LaxMonoidal.comp_ε]
  rw [realization_ε, quotient_ε]
  change 𝟙 (𝟙_ C) ≫ 𝟙 (𝟙_ C) = 𝟙 (𝟙_ C)
  rw [Category.comp_id]

@[simp] theorem canonical_μ (left right : Word σ) :
    μ (interpretationFunctor D) left right =
      (appendIso D.object left right).inv := by
  change
    μ (quotientToSemantic D ⋙ SemanticWord.realization D) left right =
      (appendIso D.object left right).inv
  rw [Functor.LaxMonoidal.comp_μ, SemanticWord.realization_μ]
  rw [quotient_μ]
  change
    (appendIso D.object left right).inv ≫
        𝟙 (foldObj D.object (left ++ right)) =
      (appendIso D.object left right).inv
  rw [Category.comp_id]

/-- Recursive comparison from the canonical folded object to `F` on a word. -/
def wordIso (A : AtomicComparison D F) :
    ∀ word : Word σ,
      foldObj D.object word ≅ F.obj word
  | [] => εIso F
  | X :: Xs =>
      (A.atom X ⊗ᵢ A.wordIso Xs) ≪≫ μIso F [X] Xs

@[simp] theorem wordIso_nil (A : AtomicComparison D F) :
    A.wordIso [] = εIso F := rfl

@[simp] theorem wordIso_cons (A : AtomicComparison D F)
    (X : σ.Obj) (Xs : Word σ) :
    A.wordIso (X :: Xs) =
      (A.atom X ⊗ᵢ A.wordIso Xs) ≪≫ μIso F [X] Xs := rfl

@[simp] theorem wordIso_nil_hom (A : AtomicComparison D F) :
    (A.wordIso []).hom = ε F := by
  simp [wordIso, εIso]

@[simp] theorem wordIso_cons_hom (A : AtomicComparison D F)
    (X : σ.Obj) (Xs : Word σ) :
    (A.wordIso (X :: Xs)).hom =
      ((A.atom X).hom ⊗ₘ (A.wordIso Xs).hom) ≫ μ F [X] Xs := by
  simp [wordIso, μIso]

@[simp] theorem canonical_map_ofRaw
    (D : InterpretationData σ C)
    {source target : Word σ} (raw : Raw σ source target) :
    (interpretationFunctor D).map (ofRaw raw) = D.evalRaw raw := by
  change FreeSMC.fold (semanticAlgebra D) raw = D.evalRaw raw
  induction raw with
  | identity ports => rfl
  | generator g => rfl
  | sequential f g ihf ihg =>
      change
        FreeSMC.fold (semanticAlgebra D) f ≫
            FreeSMC.fold (semanticAlgebra D) g =
          D.evalRaw f ≫ D.evalRaw g
      rw [ihf, ihg]
  | tensor f g ihf ihg =>
      change
        D.tensor (FreeSMC.fold (semanticAlgebra D) f)
            (FreeSMC.fold (semanticAlgebra D) g) =
          D.tensor (D.evalRaw f) (D.evalRaw g)
      rw [ihf, ihg]
  | symmetry left right => rfl
  | copy X h => rfl
  | discard X h => rfl

theorem wordIso_unit_hom (A : AtomicComparison D F) :
    ε (interpretationFunctor D) ≫ (A.wordIso []).hom = ε F := by
  rw [canonical_ε, wordIso_nil_hom]
  change 𝟙 (𝟙_ C) ≫ ε F = ε F
  rw [Category.id_comp]

theorem wordIso_tensor_nil_hom (A : AtomicComparison D F)
    (right : Word σ) :
    (appendIso D.object [] right).inv ≫
        (A.wordIso right).hom =
      ((A.wordIso []).hom ⊗ₘ (A.wordIso right).hom) ≫
        μ F [] right := by
  have source_left_inv : (λ_ right).inv = 𝟙 right := by
    rfl
  have h := Functor.LaxMonoidal.ε_tensorHom_comp_μ
    (F := F) (A.wordIso right).hom
  simp only [quotient_tensorUnit_eq, quotient_tensorObj_eq,
    List.nil_append, source_left_inv, F.map_id,
    Category.comp_id] at h
  exact
    (h.trans
      (MonoidalCategory.leftUnitor_naturality
        (A.wordIso right).hom)).symm

theorem map_singleton_associator_hom
    (X : σ.Obj) (middle right : Word σ) :
    F.map (α_ ([X] : Word σ) middle right).hom =
      𝟙 (F.obj (X :: (middle ++ right))) := by
  convert F.map_id (X :: (middle ++ right)) using 1 <;> rfl

theorem singleton_lax_associativity
    (X : σ.Obj) (middle right : Word σ) :
    (α_ (F.obj [X]) (F.obj middle) (F.obj right)).hom ≫
        F.obj [X] ◁ μ F middle right ≫
        μ F [X] (middle ++ right) =
      (μ F [X] middle ▷ F.obj right) ≫
        μ F (X :: middle) right := by
  have coherence :=
    Functor.LaxMonoidal.associativity F [X] middle right
  rw [map_singleton_associator_hom (F := F) X middle right] at coherence
  simpa [quotient_tensorObj_eq] using coherence.symm

theorem wordIso_tensor_hom (A : AtomicComparison D F) :
    ∀ left right : Word σ,
      (appendIso D.object left right).inv ≫
          (A.wordIso (left ++ right)).hom =
        ((A.wordIso left).hom ⊗ₘ (A.wordIso right).hom) ≫
          μ F left right
  | [], right => A.wordIso_tensor_nil_hom right
  | X :: left, right => by
      rw [appendIso_cons_inv]
      simp only [List.cons_append]
      rw [wordIso_cons_hom, wordIso_cons_hom]
      dsimp only [foldObj]
      rw [Category.assoc]
      erw [MonoidalCategory.tensorHom_comp_tensorHom_assoc]
      rw [Category.id_comp]
      rw [A.wordIso_tensor_hom left right]
      have tensorStep :
          (A.atom X).hom ⊗ₘ
              (((A.wordIso left).hom ⊗ₘ
                  (A.wordIso right).hom) ≫ μ F left right) =
            (((A.atom X).hom ⊗ₘ
                ((A.wordIso left).hom ⊗ₘ
                  (A.wordIso right).hom)) ≫
              (𝟙 (F.obj [X]) ⊗ₘ μ F left right)) := by
        calc
          (A.atom X).hom ⊗ₘ
                (((A.wordIso left).hom ⊗ₘ
                    (A.wordIso right).hom) ≫ μ F left right) =
              ((A.atom X).hom ≫ 𝟙 (F.obj [X])) ⊗ₘ
                (((A.wordIso left).hom ⊗ₘ
                    (A.wordIso right).hom) ≫ μ F left right) := by
              rw [Category.comp_id]
          _ = (((A.atom X).hom ⊗ₘ
                ((A.wordIso left).hom ⊗ₘ
                  (A.wordIso right).hom)) ≫
              (𝟙 (F.obj [X]) ⊗ₘ μ F left right)) :=
            (MonoidalCategory.tensorHom_comp_tensorHom
              (A.atom X).hom
              ((A.wordIso left).hom ⊗ₘ (A.wordIso right).hom)
              (𝟙 (F.obj [X]))
              (μ F left right)).symm
      erw [tensorStep]
      rw [Category.assoc]
      rw [← MonoidalCategory.associator_naturality_assoc]
      rw [MonoidalCategory.id_tensorHom]
      slice_lhs 2 4 =>
        erw [singleton_lax_associativity (F := F) X left right]
      have mergeLeft :
          (((A.atom X).hom ⊗ₘ (A.wordIso left).hom) ⊗ₘ
              (A.wordIso right).hom) ≫
              (μ F [X] left ▷ F.obj right) =
            (((A.atom X).hom ⊗ₘ (A.wordIso left).hom) ≫
                μ F [X] left) ⊗ₘ
              (A.wordIso right).hom :=
        MonoidalCategory.tensorHom_comp_whiskerRight
          ((A.atom X).hom ⊗ₘ (A.wordIso left).hom)
          (μ F [X] left) (A.wordIso right).hom
      have merged :=
        congrArg
          (fun morphism =>
            morphism ≫ μ F (X :: left) right)
          mergeLeft
      exact
        (Category.assoc
          (((A.atom X).hom ⊗ₘ (A.wordIso left).hom) ⊗ₘ
            (A.wordIso right).hom)
          (μ F [X] left ▷ F.obj right)
          (μ F (X :: left) right)).symm.trans merged

/--
Compatibility on the non-coherence generators of the presentation.

This is deliberately generator-local: it contains no arbitrary-morphism
naturality field.  Naturality for identities, composition, tensor and
symmetry is derived below from functoriality, monoidality and braidedness.
-/
structure PrimitiveCompatibility (A : AtomicComparison D F) : Prop where
  generator (g : σ.Gen) :
    D.generator g ≫ (A.wordIso (σ.output g)).hom =
      (A.wordIso (σ.input g)).hom ≫
        F.map (ofRaw (.generator g))
  copy (X : σ.Obj) (h : (σ.mode X).AllowsCopy) :
    D.copy X h ≫ (A.wordIso [X, X]).hom =
      (A.wordIso [X]).hom ≫ F.map (ofRaw (.copy X h))
  discard (X : σ.Obj) (h : (σ.mode X).AllowsDrop) :
    D.discard X h ≫ (A.wordIso []).hom =
      (A.wordIso [X]).hom ≫ F.map (ofRaw (.discard X h))

namespace PrimitiveCompatibility

variable {A : AtomicComparison D F} (H : PrimitiveCompatibility A)

/--
The recursive comparison can equivalently be expanded from the tensor of its
two factors.  This form is convenient for raw-syntax induction because every
object is definitionally a `foldObj`, with no functor-object transport.
-/
theorem wordIso_tensor_expanded (A : AtomicComparison D F)
    (left right : Word σ) :
    (A.wordIso (left ++ right)).hom =
      (appendIso D.object left right).hom ≫
        ((A.wordIso left).hom ⊗ₘ (A.wordIso right).hom) ≫
          μ F left right := by
  rw [← cancel_epi (appendIso D.object left right).inv]
  rw [A.wordIso_tensor_hom]
  simp

/--
Tensor closure for raw terms.  The hypotheses concern only the two immediate
subterms; the result follows from the target tensorator naturality.
-/
theorem raw_tensor_naturality
    {left₀ left₁ right₀ right₁ : Word σ}
    (f : Raw σ left₀ left₁) (g : Raw σ right₀ right₁)
    (hf :
      D.evalRaw f ≫ (A.wordIso left₁).hom =
        (A.wordIso left₀).hom ≫ F.map (ofRaw f))
    (hg :
      D.evalRaw g ≫ (A.wordIso right₁).hom =
        (A.wordIso right₀).hom ≫ F.map (ofRaw g)) :
    D.evalRaw (.tensor f g) ≫ (A.wordIso (left₁ ++ right₁)).hom =
      (A.wordIso (left₀ ++ right₀)).hom ≫
        F.map (ofRaw (.tensor f g)) := by
  unfold InterpretationData.evalRaw InterpretationData.tensor
  simp only [Category.assoc]
  rw [A.wordIso_tensor_hom left₁ right₁]
  rw [MonoidalCategory.tensorHom_comp_tensorHom_assoc]
  rw [hf, hg]
  rw [← MonoidalCategory.tensorHom_comp_tensorHom]
  simp only [Category.assoc]
  slice_lhs 3 4 =>
    rw [Functor.LaxMonoidal.μ_natural]
  slice_lhs 1 3 =>
    rw [← wordIso_tensor_expanded A left₀ right₀]
  change
    (A.wordIso (left₀ ++ right₀)).hom ≫
        F.map (FreeSMCQuotient.tensor (ofRaw f) (ofRaw g)) =
      (A.wordIso (left₀ ++ right₀)).hom ≫
        F.map (FreeSMCQuotient.tensor (ofRaw f) (ofRaw g))
  rfl

/--
Braiding closure for a raw symmetry.  No primitive symmetry compatibility is
assumed: it follows from the braided-functor law and target braiding
naturality.
-/
theorem raw_braiding_naturality (left right : Word σ) :
    D.evalRaw (.symmetry left right) ≫
        (A.wordIso (right ++ left)).hom =
      (A.wordIso (left ++ right)).hom ≫
        F.map (ofRaw (.symmetry left right)) := by
  unfold InterpretationData.evalRaw InterpretationData.symmetry
  simp only [Category.assoc]
  rw [A.wordIso_tensor_hom right left]
  rw [← BraidedCategory.braiding_naturality_assoc]
  slice_lhs 3 4 =>
    rw [← Functor.LaxBraided.braided]
  slice_lhs 1 3 =>
    rw [← wordIso_tensor_expanded A left right]
  rw [show
    ofRaw (FreeSMC.symmetry left right) = (β_ left right).hom from rfl]

/--
Raw-syntax induction deriving naturality from the three primitive
compatibility families.  In particular the tensor and symmetry cases are
theorems, not fields of `PrimitiveCompatibility`.
-/
theorem raw_naturality (H : PrimitiveCompatibility A) :
    ∀ {source target : Word σ} (raw : Raw σ source target),
      D.evalRaw raw ≫ (A.wordIso target).hom =
        (A.wordIso source).hom ≫ F.map (ofRaw raw)
  | _, _, .identity ports => by
      have hid :
          ofRaw (FreeSMC.identity ports) = (𝟙 ports : ports ⟶ ports) :=
        rfl
      rw [hid, F.map_id]
      change
        𝟙 (foldObj D.object ports) ≫ (A.wordIso ports).hom =
          (A.wordIso ports).hom ≫ 𝟙 (F.obj ports)
      simp
  | _, _, .generator g => by
      simpa using PrimitiveCompatibility.generator H g
  | _, _, .sequential f g => by
      change
        (D.evalRaw f ≫ D.evalRaw g) ≫ (A.wordIso _).hom =
          (A.wordIso _).hom ≫ F.map (ofRaw f ≫ ofRaw g)
      rw [Functor.map_comp]
      simp only [Category.assoc]
      rw [raw_naturality H g]
      rw [← Category.assoc, raw_naturality H f, Category.assoc]
  | _, _, .tensor f g =>
      raw_tensor_naturality (A := A) f g
        (raw_naturality H f) (raw_naturality H g)
  | _, _, .symmetry left right =>
      raw_braiding_naturality (A := A) left right
  | _, _, .copy X h => by
      change
        D.copy X h ≫ (A.wordIso [X, X]).hom =
          (A.wordIso [X]).hom ≫ F.map (ofRaw (.copy X h))
      exact PrimitiveCompatibility.copy H X h
  | _, _, .discard X h => by
      change
        D.discard X h ≫ (A.wordIso []).hom =
          (A.wordIso [X]).hom ≫ F.map (ofRaw (.discard X h))
      exact PrimitiveCompatibility.discard H X h

/-- Naturality descends from raw representatives to every quotient arrow. -/
theorem quotient_naturality (H : PrimitiveCompatibility A)
    {source target : Word σ} (f : source ⟶ target) :
    (interpretationFunctor D).map f ≫ (A.wordIso target).hom =
      (A.wordIso source).hom ≫ F.map f := by
  refine Quotient.inductionOn f ?_
  intro raw
  rw [show
    (interpretationFunctor D).map (Quotient.mk _ raw) =
      D.evalRaw raw from canonical_map_ofRaw D raw]
  exact raw_naturality H raw

end PrimitiveCompatibility

/--
The arbitrary-target comparison as a natural isomorphism of the underlying
functors.  Monoidality is proved separately below against the same concrete
`LaxMonoidal` instances, avoiding an instance diamond through a bundled
functor wrapper.
-/
noncomputable def comparisonNatIso
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A) :
    interpretationFunctor D ≅ F :=
  NatIso.ofComponents
    (fun word => A.wordIso word)
    (fun f => PrimitiveCompatibility.quotient_naturality H f)

@[simp] theorem comparisonNatIso_hom_app
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A)
    (word : Word σ) :
    (comparisonNatIso A H).hom.app word = (A.wordIso word).hom := rfl

@[simp] theorem comparisonNatIso_inv_app
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A)
    (word : Word σ) :
    (comparisonNatIso A H).inv.app word = (A.wordIso word).inv := rfl

/-- The constructed natural isomorphism is a monoidal natural isomorphism. -/
theorem comparisonNatIso_isMonoidal
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A) :
    NatTrans.IsMonoidal (comparisonNatIso A H).hom := by
  constructor
  · exact A.wordIso_unit_hom
  · intro left right
    change
      μ (interpretationFunctor D) left right ≫
          (A.wordIso (left ++ right)).hom =
        ((A.wordIso left).hom ⊗ₘ (A.wordIso right).hom) ≫
          μ F left right
    rw [canonical_μ]
    exact A.wordIso_tensor_hom left right

/--
A monoidal natural transformation out of the canonical interpretation is
determined on every tensor word by its singleton components.

The empty-word component is forced by the monoidal unit law; the induction
step is forced by the tensor law.  Thus no arbitrary naturality or word-level
uniqueness hypothesis is assumed.
-/
theorem monoidal_component_unique
    (A : AtomicComparison D F)
    (η : interpretationFunctor D ⟶ F)
    [NatTrans.IsMonoidal η]
    (singleton :
      ∀ X : σ.Obj, η.app [X] = (A.wordIso [X]).hom) :
    ∀ word : Word σ, η.app word = (A.wordIso word).hom
  | [] => by
      have unit_η :
          ε (interpretationFunctor D) ≫ η.app [] = ε F := by
        simpa only [quotient_tensorUnit_eq] using
          (NatTrans.IsMonoidal.unit (τ := η))
      apply (cancel_epi (ε (interpretationFunctor D))).1
      exact unit_η.trans A.wordIso_unit_hom.symm
  | X :: Xs => by
      have tensor_η :
          (appendIso D.object [X] Xs).inv ≫ η.app (X :: Xs) =
            (η.app [X] ⊗ₘ η.app Xs) ≫ μ F [X] Xs := by
        simpa only [quotient_tensorObj_eq, interpretationFunctor_obj,
          canonical_μ, List.singleton_append] using
          (NatTrans.IsMonoidal.tensor (τ := η) [X] Xs)
      apply (cancel_epi (appendIso D.object [X] Xs).inv).1
      rw [tensor_η]
      rw [singleton X, monoidal_component_unique A η singleton Xs]
      exact (A.wordIso_tensor_hom [X] Xs).symm

/--
Uniqueness of the constructed monoidal natural isomorphism after fixing the
singleton comparison.  Generator/copy/discard compatibility supplies
existence and naturality; monoidality supplies this word-level uniqueness.
-/
theorem comparisonNatIso_hom_unique
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A)
    (e : interpretationFunctor D ≅ F)
    [NatTrans.IsMonoidal e.hom]
    (singleton :
      ∀ X : σ.Obj, e.hom.app [X] = (A.wordIso [X]).hom) :
    e.hom = (comparisonNatIso A H).hom := by
  ext word
  exact monoidal_component_unique A e.hom singleton word

/--
External-call form of `comparisonNatIso_hom_unique`.

Keeping the monoidality witness explicit avoids elaboration depending on which
definitionally equal monoidal-functor instance a downstream module selected.
The proposition proved is identical to the typeclass-oriented theorem above.
-/
theorem comparisonNatIso_hom_unique_explicit
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A)
    (e : interpretationFunctor D ≅ F)
    (monoidal : NatTrans.IsMonoidal e.hom)
    (singleton :
      ∀ X : σ.Obj, e.hom.app [X] = (A.wordIso [X]).hom) :
    e.hom = (comparisonNatIso A H).hom := by
  letI : NatTrans.IsMonoidal e.hom := monoidal
  exact comparisonNatIso_hom_unique A H e singleton

/-- The inverse of the constructed comparison is monoidal as well. -/
theorem comparisonNatIso_inv_isMonoidal
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A) :
    NatTrans.IsMonoidal (comparisonNatIso A H).inv := by
  letI : NatTrans.IsMonoidal (comparisonNatIso A H).hom :=
    comparisonNatIso_isMonoidal A H
  infer_instance

/--
The arbitrary-target categorical universal comparison in one theorem.

For a braided target functor, atomic object isomorphisms and compatibility on
the three non-coherence primitive families construct a monoidal natural
isomorphism from the canonical interpretation.  Its hom is the unique
monoidal comparison with the prescribed singleton components.
-/
theorem freeSMC_arbitrary_universal
    (A : AtomicComparison D F) (H : PrimitiveCompatibility A) :
    ∃ comparison : interpretationFunctor D ≅ F,
      NatTrans.IsMonoidal comparison.hom ∧
      NatTrans.IsMonoidal comparison.inv ∧
      ∀ candidate : interpretationFunctor D ≅ F,
        NatTrans.IsMonoidal candidate.hom →
        (∀ X : σ.Obj,
          candidate.hom.app [X] = (A.wordIso [X]).hom) →
        candidate.hom = comparison.hom := by
  refine
    ⟨comparisonNatIso A H,
      comparisonNatIso_isMonoidal A H,
      comparisonNatIso_inv_isMonoidal A H, ?_⟩
  intro candidate candidateMonoidal singleton
  letI : NatTrans.IsMonoidal candidate.hom := candidateMonoidal
  exact comparisonNatIso_hom_unique A H candidate singleton

end AtomicComparison

end

end Cantilune.Core.FreeSMCArbitraryUniversal
