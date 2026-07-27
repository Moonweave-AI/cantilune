import Cantilune.Core.SignatureCoherence
import Cantilune.Core.FreeSMCStrongUniversal

/-!
# Free-SMC coherence across signature admission

Declaration-level coherence is not enough for replay: an old intrinsically
typed diagram must also have the same image when two epoch extensions are
crossed separately or through their composite.  The two result types contain
propositionally equal list maps, so the raw statement is heterogeneous.
-/

namespace Cantilune.Core

namespace FreeSMC

/-- `Eq.mpr` changes only a type index, hence is heterogeneously invisible. -/
theorem eqMpr_heq {α β : Sort _} (equal : α = β) (value : β) :
    HEq (Eq.mpr equal value) value := by
  cases equal
  rfl

/-- Transport both intrinsic boundaries of one raw diagram. -/
def castBoundary {σ : FinSignature}
    {source₁ target₁ source₂ target₂ : List σ.Obj}
    (sourceEq : source₁ = source₂) (targetEq : target₁ = target₂)
    (diagram : FreeSMC σ source₁ target₁) :
    FreeSMC σ source₂ target₂ := by
  subst source₂
  subst target₂
  exact diagram

/-- Boundary transport is heterogeneously invisible. -/
theorem castBoundary_heq {σ : FinSignature}
    {source₁ target₁ source₂ target₂ : List σ.Obj}
    (sourceEq : source₁ = source₂) (targetEq : target₁ = target₂)
    (diagram : FreeSMC σ source₁ target₁) :
    HEq (castBoundary sourceEq targetEq diagram) diagram := by
  subst source₂
  subst target₂
  rfl

/--
Reindexing respects a heterogeneous term equality once the two intrinsic
boundaries are explicitly identified.
-/
theorem reindex_respects_heq {σ τ : FinSignature}
    (ι : SignatureExtension σ τ)
    {source₁ target₁ source₂ target₂ : List σ.Obj}
    {left : FreeSMC σ source₁ target₁}
    {right : FreeSMC σ source₂ target₂}
    (sourceEq : source₁ = source₂) (targetEq : target₁ = target₂)
    (equal : HEq left right) :
    HEq (reindex ι left) (reindex ι right) := by
  subst source₂
  subst target₂
  exact heq_of_eq
    (congrArg (fun diagram => reindex ι diagram) (eq_of_heq equal))

/-- Sequential composition transports heterogeneous component equalities. -/
theorem sequential_heq {σ : FinSignature}
    {a₁ b₁ c₁ a₂ b₂ c₂ : List σ.Obj}
    {first₁ : FreeSMC σ a₁ b₁} {second₁ : FreeSMC σ b₁ c₁}
    {first₂ : FreeSMC σ a₂ b₂} {second₂ : FreeSMC σ b₂ c₂}
    (aEq : a₁ = a₂) (bEq : b₁ = b₂) (cEq : c₁ = c₂)
    (first : HEq first₁ first₂) (second : HEq second₁ second₂) :
    HEq (first₁ ≫ₛ second₁) (first₂ ≫ₛ second₂) := by
  subst a₂
  subst b₂
  subst c₂
  exact heq_of_eq
    (congrArg₂ (fun first second => first ≫ₛ second)
      (eq_of_heq first) (eq_of_heq second))

/-- Tensor composition transports heterogeneous component equalities. -/
theorem tensor_heq {σ : FinSignature}
    {a₁ b₁ c₁ d₁ a₂ b₂ c₂ d₂ : List σ.Obj}
    {first₁ : FreeSMC σ a₁ b₁} {second₁ : FreeSMC σ c₁ d₁}
    {first₂ : FreeSMC σ a₂ b₂} {second₂ : FreeSMC σ c₂ d₂}
    (aEq : a₁ = a₂) (bEq : b₁ = b₂)
    (cEq : c₁ = c₂) (dEq : d₁ = d₂)
    (first : HEq first₁ first₂) (second : HEq second₁ second₂) :
    HEq (first₁ ⊗ₛ second₁) (first₂ ⊗ₛ second₂) := by
  subst a₂
  subst b₂
  subst c₂
  subst d₂
  exact heq_of_eq
    (congrArg₂ (fun first second => first ⊗ₛ second)
      (eq_of_heq first) (eq_of_heq second))

/-- A reindexed generator differs only by intrinsic boundary transports. -/
theorem reindex_generator_heq {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (generator : σ.Gen) :
    HEq
      (reindex ι (FreeSMC.generator generator))
      (FreeSMC.generator (ι.gen generator)) := by
  simp only [reindex]
  exact
    (eqMpr_heq _ _).trans (eqMpr_heq _ _)

/-- A reindexed tensor differs only by the `map_append` boundary transport. -/
theorem reindex_tensor_heq {σ τ : FinSignature}
    (ι : SignatureExtension σ τ)
    {a b c d : List σ.Obj}
    (first : FreeSMC σ a b) (second : FreeSMC σ c d) :
    HEq
      (reindex ι (first ⊗ₛ second))
      (reindex ι first ⊗ₛ reindex ι second) := by
  simp only [reindex]
  exact cast_heq _ _

/--
Reindexing a symmetry only transports the two `map_append` boundary
equalities.
-/
theorem reindex_symmetry_heq {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (left right : List σ.Obj) :
    HEq
      (reindex ι (FreeSMC.symmetry left right))
      (FreeSMC.symmetry (ι.reindexWord left) (ι.reindexWord right)) := by
  simp only [reindex]
  exact cast_heq _ _

/-- Canonical transport of a copy permission across one extension. -/
theorem reindexCopyAllowed {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (object : σ.Obj)
    (allowed : (σ.mode object).AllowsCopy) :
    (τ.mode (ι.obj object)).AllowsCopy := by
  rw [← ι.mode_preserved object]
  exact allowed

/-- Canonical transport of a discard permission across one extension. -/
theorem reindexDropAllowed {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (object : σ.Obj)
    (allowed : (σ.mode object).AllowsDrop) :
    (τ.mode (ι.obj object)).AllowsDrop := by
  rw [← ι.mode_preserved object]
  exact allowed

/-- Reindexing an explicit copy preserves the node up to proof transport. -/
theorem reindex_copy_heq {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (object : σ.Obj)
    (allowed : (σ.mode object).AllowsCopy) :
    HEq
      (reindex ι (FreeSMC.copy object allowed))
      (FreeSMC.copy (ι.obj object)
        (reindexCopyAllowed ι object allowed)) := by
  simp only [reindex]
  apply heq_of_eq
  congr

/-- Reindexing an explicit discard preserves the node up to proof transport. -/
theorem reindex_discard_heq {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (object : σ.Obj)
    (allowed : (σ.mode object).AllowsDrop) :
    HEq
      (reindex ι (FreeSMC.discard object allowed))
      (FreeSMC.discard (ι.obj object)
        (reindexDropAllowed ι object allowed)) := by
  simp only [reindex]
  apply heq_of_eq
  congr

/--
Reindexing a raw intrinsically typed diagram along a composite signature
extension is heterogeneously equal to successive reindexing.

This is the term-level coherence missing from declaration-only admission:
all generator and structural proof transports are erased by `HEq`, while the
non-definitional `List.map_map` boundary equalities are tracked explicitly.
-/
theorem reindex_trans_heq {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
    {source target : List σ.Obj}
    (diagram : FreeSMC σ source target) :
    HEq
      (reindex (SignatureExtension.trans ι κ) diagram)
      (reindex κ (reindex ι diagram)) := by
  induction diagram with
  | identity ports =>
      exact congr_arg_heq
        (fun word => FreeSMC.identity (σ := υ) word)
        (SignatureExtension.reindexWord_trans ι κ ports)
  | generator generator =>
      have rightToGenerator :
          HEq
            (reindex κ
              (reindex ι (FreeSMC.generator generator)))
            (FreeSMC.generator (κ.gen (ι.gen generator))) :=
        (reindex_respects_heq κ
          (SignatureExtension.reindex_input ι generator)
          (SignatureExtension.reindex_output ι generator)
          (reindex_generator_heq ι generator)).trans
          (reindex_generator_heq κ (ι.gen generator))
      exact
        (reindex_generator_heq
          (SignatureExtension.trans ι κ) generator).trans
          rightToGenerator.symm
  | sequential first second firstIH secondIH =>
      exact sequential_heq
        (SignatureExtension.reindexWord_trans ι κ _)
        (SignatureExtension.reindexWord_trans ι κ _)
        (SignatureExtension.reindexWord_trans ι κ _)
        firstIH secondIH
  | @tensor a b c d first second firstIH secondIH =>
      have components :
          HEq
            (reindex (SignatureExtension.trans ι κ) first ⊗ₛ
              reindex (SignatureExtension.trans ι κ) second)
            (reindex κ (reindex ι first) ⊗ₛ
              reindex κ (reindex ι second)) :=
        tensor_heq
          (SignatureExtension.reindexWord_trans ι κ a)
          (SignatureExtension.reindexWord_trans ι κ b)
          (SignatureExtension.reindexWord_trans ι κ c)
          (SignatureExtension.reindexWord_trans ι κ d)
          firstIH secondIH
      have rightToComponents :
          HEq
            (reindex κ (reindex ι (first ⊗ₛ second)))
            (reindex κ (reindex ι first) ⊗ₛ
              reindex κ (reindex ι second)) :=
        (reindex_respects_heq κ
          (by simp [SignatureExtension.reindexWord])
          (by simp [SignatureExtension.reindexWord])
          (reindex_tensor_heq ι first second)).trans
          (reindex_tensor_heq κ (reindex ι first) (reindex ι second))
      exact
        (reindex_tensor_heq
          (SignatureExtension.trans ι κ) first second).trans
          (components.trans rightToComponents.symm)
  | symmetry left right =>
      have components :
          HEq
            (FreeSMC.symmetry
              ((SignatureExtension.trans ι κ).reindexWord left)
              ((SignatureExtension.trans ι κ).reindexWord right))
            (FreeSMC.symmetry
              (κ.reindexWord (ι.reindexWord left))
              (κ.reindexWord (ι.reindexWord right))) := by
        have pairEq :
            (((SignatureExtension.trans ι κ).reindexWord left),
              ((SignatureExtension.trans ι κ).reindexWord right)) =
            ((κ.reindexWord (ι.reindexWord left)),
              (κ.reindexWord (ι.reindexWord right))) :=
          Prod.ext
          (SignatureExtension.reindexWord_trans ι κ left)
          (SignatureExtension.reindexWord_trans ι κ right)
        exact congr_arg_heq
          (fun pair : List υ.Obj × List υ.Obj =>
            FreeSMC.symmetry (σ := υ) pair.1 pair.2)
          pairEq
      have rightToComponents :
          HEq
            (reindex κ
              (reindex ι (FreeSMC.symmetry left right)))
            (FreeSMC.symmetry
              (κ.reindexWord (ι.reindexWord left))
              (κ.reindexWord (ι.reindexWord right))) :=
        (reindex_respects_heq κ
          (by simp [SignatureExtension.reindexWord])
          (by simp [SignatureExtension.reindexWord])
          (reindex_symmetry_heq ι left right)).trans
          (reindex_symmetry_heq κ
            (ι.reindexWord left) (ι.reindexWord right))
      exact
        (reindex_symmetry_heq
          (SignatureExtension.trans ι κ) left right).trans
          (components.trans rightToComponents.symm)
  | copy object allowed =>
      have rightToCopy :
          HEq
            (reindex κ
              (reindex ι (FreeSMC.copy object allowed)))
            (FreeSMC.copy (κ.obj (ι.obj object))
              (reindexCopyAllowed κ (ι.obj object)
                (reindexCopyAllowed ι object allowed))) :=
        (reindex_respects_heq κ
          (by simp [SignatureExtension.reindexWord])
          (by simp [SignatureExtension.reindexWord])
          (reindex_copy_heq ι object allowed)).trans
          (reindex_copy_heq κ (ι.obj object)
            (reindexCopyAllowed ι object allowed))
      have copiesAgree :
          HEq
            (FreeSMC.copy
              ((SignatureExtension.trans ι κ).obj object)
              (reindexCopyAllowed
                (SignatureExtension.trans ι κ) object allowed))
            (FreeSMC.copy (κ.obj (ι.obj object))
              (reindexCopyAllowed κ (ι.obj object)
                (reindexCopyAllowed ι object allowed))) := by
        apply heq_of_eq
        congr
      exact
        (reindex_copy_heq
          (SignatureExtension.trans ι κ) object allowed).trans
          (copiesAgree.trans rightToCopy.symm)
  | discard object allowed =>
      have rightToDiscard :
          HEq
            (reindex κ
              (reindex ι (FreeSMC.discard object allowed)))
            (FreeSMC.discard (κ.obj (ι.obj object))
              (reindexDropAllowed κ (ι.obj object)
                (reindexDropAllowed ι object allowed))) :=
        (reindex_respects_heq κ
          (by simp [SignatureExtension.reindexWord])
          (by simp [SignatureExtension.reindexWord])
          (reindex_discard_heq ι object allowed)).trans
          (reindex_discard_heq κ (ι.obj object)
            (reindexDropAllowed ι object allowed))
      have discardsAgree :
          HEq
            (FreeSMC.discard
              ((SignatureExtension.trans ι κ).obj object)
              (reindexDropAllowed
                (SignatureExtension.trans ι κ) object allowed))
            (FreeSMC.discard (κ.obj (ι.obj object))
              (reindexDropAllowed κ (ι.obj object)
                (reindexDropAllowed ι object allowed))) := by
        apply heq_of_eq
        congr
      exact
        (reindex_discard_heq
          (SignatureExtension.trans ι κ) object allowed).trans
          (discardsAgree.trans rightToDiscard.symm)

end FreeSMC

namespace SignatureFreeSMC

open CategoryTheory
open FreeSMCQuotient
open FreeSMCUniversal

noncomputable section

/--
Right-associated tensoring of singleton target words is exactly ordinary
word reindexing.
-/
theorem foldExtensionObject_eq_reindexWord {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (ports : Word σ) :
    foldObj (fun object => [ι.obj object]) ports =
      ι.reindexWord ports := by
  induction ports with
  | nil => rfl
  | cons object ports ih =>
      change
        ι.obj object ::
            foldObj (fun old => [ι.obj old]) ports =
          ι.obj object :: ι.reindexWord ports
      exact congrArg (List.cons (ι.obj object)) ih

/--
Interpret an old signature directly in the free SMC of an extended signature.
The primitive arrows are the actual raw reindexings, so generator, copy, and
discard meanings cannot drift at an admission boundary.
-/
def extensionInterpretation {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) :
    InterpretationData σ (Word τ) where
  object object := [ι.obj object]
  generator generator :=
    ofRaw (castRaw
      (foldExtensionObject_eq_reindexWord ι (σ.input generator)).symm
      (foldExtensionObject_eq_reindexWord ι (σ.output generator)).symm
      (FreeSMC.reindex ι (FreeSMC.generator generator)))
  copy object allowed :=
    ofRaw (castRaw
      (foldExtensionObject_eq_reindexWord ι [object]).symm
      (foldExtensionObject_eq_reindexWord ι [object, object]).symm
      (FreeSMC.reindex ι (FreeSMC.copy object allowed)))
  discard object allowed :=
    ofRaw (castRaw
      (foldExtensionObject_eq_reindexWord ι [object]).symm
      (foldExtensionObject_eq_reindexWord ι []).symm
      (FreeSMC.reindex ι (FreeSMC.discard object allowed)))

/--
The quotient/category-level functor induced by one monotone signature
extension. This uses the already kernel-checked free-SMC quotient universal
construction, rather than defining a second ad-hoc quotient map.
-/
def extensionFunctor {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) :
    Word σ ⥤ Word τ :=
  interpretationFunctor (extensionInterpretation ι)

@[simp]
theorem extensionFunctor_obj {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (ports : Word σ) :
    (extensionFunctor ι).obj ports = ι.reindexWord ports := by
  exact foldExtensionObject_eq_reindexWord ι ports

@[simp]
theorem extensionFunctor_map_generator {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (generator : σ.Gen) :
    (extensionFunctor ι).map
        (ofRaw (FreeSMC.generator generator)) =
      (extensionInterpretation ι).generator generator := by
  exact interpretationFunctor_map_generator
    (extensionInterpretation ι) generator

@[simp]
theorem extensionFunctor_map_copy {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (object : σ.Obj)
    (allowed : (σ.mode object).AllowsCopy) :
    (extensionFunctor ι).map
        (ofRaw (FreeSMC.copy object allowed)) =
      (extensionInterpretation ι).copy object allowed := by
  exact interpretationFunctor_map_copy
    (extensionInterpretation ι) object allowed

@[simp]
theorem extensionFunctor_map_discard {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (object : σ.Obj)
    (allowed : (σ.mode object).AllowsDrop) :
    (extensionFunctor ι).map
        (ofRaw (FreeSMC.discard object allowed)) =
      (extensionInterpretation ι).discard object allowed := by
  exact interpretationFunctor_map_discard
    (extensionInterpretation ι) object allowed

/--
Every signature-extension functor carries the strong monoidal and braided
structures constructed by the free-SMC universal theorem.
-/
theorem extensionFunctor_strong_symmetric {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) :
    Nonempty ((extensionFunctor ι).Monoidal) ∧
      Nonempty ((extensionFunctor ι).Braided) :=
  InterpretationData.arbitrary_object_strong_symmetric_functor_exists
    (extensionInterpretation ι)

end

end SignatureFreeSMC

end Cantilune.Core
