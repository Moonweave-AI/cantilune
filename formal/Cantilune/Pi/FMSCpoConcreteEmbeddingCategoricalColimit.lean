import Cantilune.Pi.FMSCpoConcreteEmbeddingColimit
import Mathlib.CategoryTheory.Category.Preorder

/-!
# Mathlib categorical colimit for the concrete embedding chain

`FMSCpoConcreteEmbeddingColimit` proves the successor-chain universal
property directly.  This module packages exactly that theorem as a genuine
mathlib `Cocone` and `CategoryTheory.Limits.IsColimit`.

The indexing category is a fresh wrapper around the natural-number order.
It must not reuse `Nat` directly: Cantilune's finite-world category has
`World = Nat` but morphisms are finite injections, not order proofs.

This is an ordinary categorical colimit in `World ⥤ ωCPO`.  No enriched
colimit or general algebraic-compactness statement is claimed here.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSModel

/-! ## The ordered successor-chain diagram -/

/--
A separate index type for the concrete embedding tower.

Its category structure is mathlib's thin category associated to the natural
order.
-/
@[ext]
structure ConcreteEmbeddingIndex where
  stage : Nat
deriving DecidableEq

instance : Preorder ConcreteEmbeddingIndex where
  le first second := first.stage ≤ second.stage
  le_refl _ := Nat.le_refl _
  le_trans _ _ _ := Nat.le_trans

/--
Forward canonical stage maps compose exactly.
-/
theorem concreteStageMap_forward_comp
    (first middle last : Nat)
    (firstMiddle : first ≤ middle)
    (middleLast : middle ≤ last) :
    concreteStageMap first middle ≫
        concreteStageMap middle last =
      concreteStageMap first last := by
  induction last with
  | zero =>
      have firstZero : first = 0 := by omega
      have middleZero : middle = 0 := by omega
      subst first
      subst middle
      rw [concreteStageMap_diagonal]
      exact Category.id_comp _
  | succ last inductionHypothesis =>
      by_cases middleFinal : middle = last.succ
      · subst middle
        rw [concreteStageMap_diagonal]
        exact Category.comp_id _
      · have middleEarlier : middle ≤ last := by omega
        have firstEarlier : first ≤ last :=
          firstMiddle.trans middleEarlier
        calc
          concreteStageMap first middle ≫
              concreteStageMap middle last.succ =
            concreteStageMap first middle ≫
              (concreteStageMap middle last ≫
                (concreteActualIterationPair last).embedding) := by
                  rw [
                    ConcreteEmbeddingCocone.concreteStageMap_target_embedding
                        middle last middleEarlier]
          _ =
            (concreteStageMap first middle ≫
              concreteStageMap middle last) ≫
                (concreteActualIterationPair last).embedding :=
                  (Category.assoc _ _ _).symm
          _ =
            concreteStageMap first last ≫
              (concreteActualIterationPair last).embedding := by
                rw [inductionHypothesis
                  middleEarlier]
          _ =
            concreteStageMap first last.succ :=
              ConcreteEmbeddingCocone.concreteStageMap_target_embedding
                  first last firstEarlier

/-- A one-step forward stage map is the adjacent tower embedding. -/
theorem concreteStageMap_succ_eq_embedding
    (stage : Nat) :
    concreteStageMap stage stage.succ =
      (concreteActualIterationPair stage).embedding := by
  calc
    concreteStageMap stage stage.succ =
      concreteStageMap stage stage ≫
        (concreteActualIterationPair stage).embedding := by
          exact
            (ConcreteEmbeddingCocone.concreteStageMap_target_embedding
                stage stage le_rfl).symm
    _ =
      𝟙 (ConcreteActualIteration stage) ≫
        (concreteActualIterationPair stage).embedding := by
          rw [concreteStageMap_diagonal]
    _ = (concreteActualIterationPair stage).embedding :=
      Category.id_comp _

/-- The actual finite-stage embedding diagram indexed by the natural order. -/
def concreteEmbeddingDiagram :
    ConcreteEmbeddingIndex ⥤ (World ⥤ ωCPO) where
  obj index := ConcreteActualIteration index.stage
  map {source target} _ :=
    concreteStageMap source.stage target.stage
  map_id index :=
    concreteStageMap_diagonal index.stage
  map_comp first second := by
    exact
      (concreteStageMap_forward_comp
        _ _ _ first.le second.le).symm

/-! ## The canonical mathlib cocone -/

/-- The finite-stage embeddings as a mathlib cocone with apex the EP limit. -/
def concreteEmbeddingCategoricalCocone :
    Cocone concreteEmbeddingDiagram where
  pt := concreteIterationLimit
  ι :=
    { app := fun index =>
        concreteIterationLimitEmbedding index.stage
      naturality := by
        intro source target morphism
        change
          concreteStageMap source.stage target.stage ≫
              concreteIterationLimitEmbedding target.stage =
            concreteIterationLimitEmbedding source.stage ≫
              𝟙 concreteIterationLimit
        rw [Category.comp_id]
        exact
          concreteIterationEmbeddingCocone.forward_stageMap_fac
            source.stage target.stage morphism.le }

/-! ## Conversion of arbitrary categorical cocones -/

/--
Every mathlib cocone over the ordered diagram yields an adjacent-compatible
explicit cocone.
-/
def ConcreteEmbeddingCocone.ofCategorical
    (cocone : Cocone concreteEmbeddingDiagram) :
    ConcreteEmbeddingCocone cocone.pt where
  leg n := cocone.ι.app ⟨n⟩
  compatible n := by
    let successor :
        (⟨n⟩ : ConcreteEmbeddingIndex) ⟶
          (⟨n + 1⟩ : ConcreteEmbeddingIndex) :=
      homOfLE (Nat.le_succ n)
    have naturality := cocone.ι.naturality successor
    have mappedSuccessor :
        concreteEmbeddingDiagram.map successor =
          (concreteActualIterationPair n).embedding := by
      change
        concreteStageMap n (n + 1) =
          (concreteActualIterationPair n).embedding
      exact concreteStageMap_succ_eq_embedding n
    rw [mappedSuccessor] at naturality
    change
      (concreteActualIterationPair n).embedding ≫
          cocone.ι.app ⟨n + 1⟩ =
        cocone.ι.app ⟨n⟩ ≫ 𝟙 cocone.pt at naturality
    erw [Category.comp_id] at naturality
    exact naturality

@[simp]
theorem ConcreteEmbeddingCocone.ofCategorical_leg
    (cocone : Cocone concreteEmbeddingDiagram)
    (n : Nat) :
    (ConcreteEmbeddingCocone.ofCategorical cocone).leg n =
      cocone.ι.app ⟨n⟩ :=
  rfl

/-! ## Genuine `CategoryTheory.Limits.IsColimit` -/

/--
The canonical concrete embedding cocone satisfies mathlib's full categorical
colimit universal property.
-/
def concreteEmbeddingCategoricalIsColimit :
    IsColimit concreteEmbeddingCategoricalCocone :=
  IsColimit.mk
    (fun cocone =>
      concreteEmbeddingCoconeIsColimit.desc
        (ConcreteEmbeddingCocone.ofCategorical cocone))
    (fun cocone index =>
      concreteEmbeddingCoconeIsColimit.fac
        (ConcreteEmbeddingCocone.ofCategorical cocone)
        index.stage)
    (fun cocone candidate fac =>
      concreteEmbeddingCoconeIsColimit.uniq
        (ConcreteEmbeddingCocone.ofCategorical cocone)
        candidate
        (fun n => fac ⟨n⟩))

@[simp]
theorem concreteEmbeddingCategoricalIsColimit_desc
    (cocone : Cocone concreteEmbeddingDiagram) :
    concreteEmbeddingCategoricalIsColimit.desc cocone =
      concreteEmbeddingCoconeIsColimit.desc
        (ConcreteEmbeddingCocone.ofCategorical cocone) :=
  rfl

end Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
