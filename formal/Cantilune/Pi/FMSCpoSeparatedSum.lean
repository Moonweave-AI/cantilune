import Mathlib.Order.Category.OmegaCompletePartialOrder
import Mathlib.Data.Sum.Order

/-!
# Separated coproducts of omega-CPOs

The ordinary disjoint-sum order makes values in different summands
incomparable.  Every increasing omega-chain therefore remains in the
summand selected at index zero, and its supremum is computed in that
summand.  This file packages that observation as an omega-CPO instance and
constructs continuous maps induced by a pair of continuous component maps.

This is the categorical coproduct shape needed for the finite separated
action constructors of the FMS functor.  It does not add a bottom shared by
the summands.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoSeparatedSum

open OmegaCompletePartialOrder

universe u v w

variable {α : Type u} {β : Type v}
variable [OmegaCompletePartialOrder α]
variable [OmegaCompletePartialOrder β]

private theorem chain_left_exists
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first)
    (index : Nat) :
    ∃ value : α, chain index = Sum.inl value := by
  cases atIndex : chain index with
  | inl value =>
      exact ⟨value, rfl⟩
  | inr value =>
      have ordered :=
        chain.monotone (Nat.zero_le index)
      change chain 0 ≤ chain index at ordered
      rw [atZero, atIndex] at ordered
      exact (Sum.not_inl_le_inr ordered).elim

private theorem chain_right_exists
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first)
    (index : Nat) :
    ∃ value : β, chain index = Sum.inr value := by
  cases atIndex : chain index with
  | inl value =>
      have ordered :=
        chain.monotone (Nat.zero_le index)
      change chain 0 ≤ chain index at ordered
      rw [atZero, atIndex] at ordered
      exact (Sum.not_inr_le_inl ordered).elim
  | inr value =>
      exact ⟨value, rfl⟩

private def leftValue
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first)
    (index : Nat) :
    α :=
  Classical.choose
    (chain_left_exists chain atZero index)

private theorem leftValue_spec
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first)
    (index : Nat) :
    chain index =
      Sum.inl (leftValue chain atZero index) :=
  Classical.choose_spec
    (chain_left_exists chain atZero index)

private def rightValue
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first)
    (index : Nat) :
    β :=
  Classical.choose
    (chain_right_exists chain atZero index)

private theorem rightValue_spec
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first)
    (index : Nat) :
    chain index =
      Sum.inr (rightValue chain atZero index) :=
  Classical.choose_spec
    (chain_right_exists chain atZero index)

private def leftChain
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first) :
    Chain α where
  toFun index := leftValue chain atZero index
  monotone' := by
    intro lower upper ordered
    have mapped := chain.monotone ordered
    change chain lower ≤ chain upper at mapped
    rw [
      leftValue_spec chain atZero lower,
      leftValue_spec chain atZero upper] at mapped
    exact Sum.inl_le_inl_iff.1 mapped

private def rightChain
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first) :
    Chain β where
  toFun index := rightValue chain atZero index
  monotone' := by
    intro lower upper ordered
    have mapped := chain.monotone ordered
    change chain lower ≤ chain upper at mapped
    rw [
      rightValue_spec chain atZero lower,
      rightValue_spec chain atZero upper] at mapped
    exact Sum.inr_le_inr_iff.1 mapped

private theorem left_isLUB
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first) :
    IsLUB (Set.range chain)
      (Sum.inl
        (ωSup (leftChain chain atZero))) := by
  constructor
  · intro value member
    rcases member with ⟨index, rfl⟩
    rw [leftValue_spec chain atZero index]
    exact
      Sum.inl_le_inl_iff.2
        (le_ωSup (leftChain chain atZero) index)
  · intro upper isUpper
    cases upper with
    | inl bound =>
        apply Sum.inl_le_inl_iff.2
        apply ωSup_le
        intro index
        have ordered :=
          isUpper ⟨index, rfl⟩
        rw [leftValue_spec chain atZero index] at ordered
        exact Sum.inl_le_inl_iff.1 ordered
    | inr bound =>
        have impossible :=
          isUpper ⟨0, rfl⟩
        rw [atZero] at impossible
        exact (Sum.not_inl_le_inr impossible).elim

private theorem right_isLUB
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first) :
    IsLUB (Set.range chain)
      (Sum.inr
        (ωSup (rightChain chain atZero))) := by
  constructor
  · intro value member
    rcases member with ⟨index, rfl⟩
    rw [rightValue_spec chain atZero index]
    exact
      Sum.inr_le_inr_iff.2
        (le_ωSup (rightChain chain atZero) index)
  · intro upper isUpper
    cases upper with
    | inl bound =>
        have impossible :=
          isUpper ⟨0, rfl⟩
        rw [atZero] at impossible
        exact (Sum.not_inr_le_inl impossible).elim
    | inr bound =>
        apply Sum.inr_le_inr_iff.2
        apply ωSup_le
        intro index
        have ordered :=
          isUpper ⟨index, rfl⟩
        rw [rightValue_spec chain atZero index] at ordered
        exact Sum.inr_le_inr_iff.1 ordered

private theorem chain_isLUB
    (chain : Chain (α ⊕ β)) :
    ∃ supremum : α ⊕ β,
      IsLUB (Set.range chain) supremum := by
  cases atZero : chain 0 with
  | inl first =>
      exact
        ⟨Sum.inl
            (ωSup (leftChain chain atZero)),
          left_isLUB chain atZero⟩
  | inr first =>
      exact
        ⟨Sum.inr
            (ωSup (rightChain chain atZero)),
          right_isLUB chain atZero⟩

private def sumOmegaSup
    (chain : Chain (α ⊕ β)) :
    α ⊕ β :=
  Classical.choose (chain_isLUB chain)

private theorem sumOmegaSup_isLUB
    (chain : Chain (α ⊕ β)) :
    IsLUB (Set.range chain)
      (sumOmegaSup chain) :=
  Classical.choose_spec (chain_isLUB chain)

private theorem sum_le_omegaSup
    (chain : Chain (α ⊕ β))
    (index : Nat) :
    chain index ≤ sumOmegaSup chain :=
  (sumOmegaSup_isLUB chain).1
    ⟨index, rfl⟩

private theorem sum_omegaSup_le
    (chain : Chain (α ⊕ β))
    (upper : α ⊕ β)
    (isUpper : ∀ index, chain index ≤ upper) :
    sumOmegaSup chain ≤ upper :=
  (sumOmegaSup_isLUB chain).2
    (by
      intro value member
      rcases member with ⟨index, rfl⟩
      exact isUpper index)

/--
The disjoint sum of omega-CPOs is an omega-CPO.  Its omega-chains cannot
change summand.
-/
noncomputable instance :
    OmegaCompletePartialOrder (α ⊕ β) where
  ωSup := sumOmegaSup
  le_ωSup := sum_le_omegaSup
  ωSup_le := sum_omegaSup_le

@[simp]
theorem omegaSup_of_left
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first) :
    ωSup chain =
      Sum.inl (ωSup (leftChain chain atZero)) := by
  exact
    (ωSup_eq_of_isLUB
      (left_isLUB chain atZero)).symm

@[simp]
theorem omegaSup_of_right
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first) :
    ωSup chain =
      Sum.inr (ωSup (rightChain chain atZero)) := by
  exact
    (ωSup_eq_of_isLUB
      (right_isLUB chain atZero)).symm

/-- Lift an omega-chain into the left component of a separated coproduct. -/
def inlChain
    (chain : Chain α) :
    Chain (α ⊕ β) where
  toFun index := Sum.inl (chain index)
  monotone' := by
    intro first second ordered
    exact Sum.inl_le_inl_iff.2 (chain.monotone ordered)

@[simp]
theorem inlChain_apply
    (chain : Chain α)
    (index : Nat) :
    inlChain (β := β) chain index =
      Sum.inl (chain index) :=
  rfl

/-- Lift an omega-chain into the right component of a separated coproduct. -/
def inrChain
    (chain : Chain β) :
    Chain (α ⊕ β) where
  toFun index := Sum.inr (chain index)
  monotone' := by
    intro first second ordered
    exact Sum.inr_le_inr_iff.2 (chain.monotone ordered)

@[simp]
theorem inrChain_apply
    (chain : Chain β)
    (index : Nat) :
    inrChain (α := α) chain index =
      Sum.inr (chain index) :=
  rfl

/-- The separated-sum supremum of a left-injected chain stays on the left. -/
@[simp]
theorem omegaSup_inlChain
    (chain : Chain α) :
    ωSup (inlChain (β := β) chain) =
      Sum.inl (ωSup chain) := by
  let atZero :
      inlChain (β := β) chain 0 =
        Sum.inl (chain 0) :=
    rfl
  rw [omegaSup_of_left
    (inlChain (β := β) chain) atZero]
  apply congrArg Sum.inl
  have componentChain :
      leftChain
          (inlChain (β := β) chain)
          atZero =
        chain := by
    apply Chain.ext
    funext index
    apply Sum.inl.inj
    calc
      Sum.inl
          (leftValue
            (inlChain (β := β) chain)
            atZero index) =
        inlChain (β := β) chain index :=
          (leftValue_spec
            (inlChain (β := β) chain)
            atZero index).symm
      _ = Sum.inl (chain index) := rfl
  rw [componentChain]

/-- The separated-sum supremum of a right-injected chain stays on the right. -/
@[simp]
theorem omegaSup_inrChain
    (chain : Chain β) :
    ωSup (inrChain (α := α) chain) =
      Sum.inr (ωSup chain) := by
  let atZero :
      inrChain (α := α) chain 0 =
        Sum.inr (chain 0) :=
    rfl
  rw [omegaSup_of_right
    (inrChain (α := α) chain) atZero]
  apply congrArg Sum.inr
  have componentChain :
      rightChain
          (inrChain (α := α) chain)
          atZero =
        chain := by
    apply Chain.ext
    funext index
    apply Sum.inr.inj
    calc
      Sum.inr
          (rightValue
            (inrChain (α := α) chain)
            atZero index) =
        inrChain (α := α) chain index :=
          (rightValue_spec
            (inrChain (α := α) chain)
            atZero index).symm
      _ = Sum.inr (chain index) := rfl
  rw [componentChain]

variable {γ : Type w} {δ : Type*}
variable [OmegaCompletePartialOrder γ]
variable [OmegaCompletePartialOrder δ]

/-- Order-hom action induced by a pair of component maps. -/
def mapOrderHom
    (left : α →𝒄 γ)
    (right : β →𝒄 δ) :
    (α ⊕ β) →o (γ ⊕ δ) where
  toFun
    | Sum.inl value => Sum.inl (left value)
    | Sum.inr value => Sum.inr (right value)
  monotone' := by
    intro lower upper ordered
    cases lower <;> cases upper
    · exact Sum.inl_le_inl_iff.2
        (left.monotone
          (Sum.inl_le_inl_iff.1 ordered))
    · exact (Sum.not_inl_le_inr ordered).elim
    · exact (Sum.not_inr_le_inl ordered).elim
    · exact Sum.inr_le_inr_iff.2
        (right.monotone
          (Sum.inr_le_inr_iff.1 ordered))

@[simp]
theorem mapOrderHom_inl
    (left : α →𝒄 γ)
    (right : β →𝒄 δ)
    (value : α) :
    mapOrderHom left right (Sum.inl value) =
      Sum.inl (left value) :=
  rfl

@[simp]
theorem mapOrderHom_inr
    (left : α →𝒄 γ)
    (right : β →𝒄 δ)
    (value : β) :
    mapOrderHom left right (Sum.inr value) =
      Sum.inr (right value) :=
  rfl

/-- Pair of continuous maps acting on a separated coproduct. -/
def map
    (left : α →𝒄 γ)
    (right : β →𝒄 δ) :
    (α ⊕ β) →𝒄 (γ ⊕ δ) where
  toOrderHom := mapOrderHom left right
  map_ωSup' := by
    intro chain
    cases atZero : chain 0 with
    | inl first =>
        let mapped :
            Chain (γ ⊕ δ) :=
          chain.map (mapOrderHom left right)
        have mappedAtZero :
            mapped 0 = Sum.inl (left first) := by
          change
            mapOrderHom left right (chain 0) =
              Sum.inl (left first)
          rw [atZero]
          rfl
        have componentChain :
            leftChain mapped mappedAtZero =
              (leftChain chain atZero).map
                left.toOrderHom := by
          apply Chain.ext
          funext index
          apply Sum.inl.inj
          calc
            Sum.inl
                (leftValue mapped mappedAtZero index) =
              mapped index :=
                (leftValue_spec
                  mapped mappedAtZero index).symm
            _ =
              mapOrderHom left right
                (chain index) := rfl
            _ =
              Sum.inl
                (left
                  (leftValue chain atZero index)) := by
                    rw [
                      leftValue_spec chain atZero index]
                    rfl
        rw [omegaSup_of_left chain atZero]
        change
          Sum.inl
              (left
                (ωSup (leftChain chain atZero))) =
            ωSup mapped
        rw [omegaSup_of_left mapped mappedAtZero]
        apply congrArg Sum.inl
        rw [componentChain]
        exact left.continuous (leftChain chain atZero)
    | inr first =>
        let mapped :
            Chain (γ ⊕ δ) :=
          chain.map (mapOrderHom left right)
        have mappedAtZero :
            mapped 0 = Sum.inr (right first) := by
          change
            mapOrderHom left right (chain 0) =
              Sum.inr (right first)
          rw [atZero]
          rfl
        have componentChain :
            rightChain mapped mappedAtZero =
              (rightChain chain atZero).map
                right.toOrderHom := by
          apply Chain.ext
          funext index
          apply Sum.inr.inj
          calc
            Sum.inr
                (rightValue mapped mappedAtZero index) =
              mapped index :=
                (rightValue_spec
                  mapped mappedAtZero index).symm
            _ =
              mapOrderHom left right
                (chain index) := rfl
            _ =
              Sum.inr
                (right
                  (rightValue chain atZero index)) := by
                    rw [
                      rightValue_spec chain atZero index]
                    rfl
        rw [omegaSup_of_right chain atZero]
        change
          Sum.inr
              (right
                (ωSup (rightChain chain atZero))) =
            ωSup mapped
        rw [omegaSup_of_right mapped mappedAtZero]
        apply congrArg Sum.inr
        rw [componentChain]
        exact right.continuous (rightChain chain atZero)

@[simp]
theorem map_inl
    (left : α →𝒄 γ)
    (right : β →𝒄 δ)
    (value : α) :
    map left right (Sum.inl value) =
      Sum.inl (left value) :=
  rfl

@[simp]
theorem map_inr
    (left : α →𝒄 γ)
    (right : β →𝒄 δ)
    (value : β) :
    map left right (Sum.inr value) =
      Sum.inr (right value) :=
  rfl

section Concrete

variable {α₀ β₀ γ₀ δ₀ : Type u}
variable [OmegaCompletePartialOrder α₀]
variable [OmegaCompletePartialOrder β₀]
variable [OmegaCompletePartialOrder γ₀]
variable [OmegaCompletePartialOrder δ₀]

@[simp]
theorem concrete_map_inl
    (left : α₀ →𝒄 γ₀)
    (right : β₀ →𝒄 δ₀)
    (value : α₀) :
    CategoryTheory.ConcreteCategory.hom
        (C := ωCPO)
        (X := ωCPO.of (α₀ ⊕ β₀))
        (Y := ωCPO.of (γ₀ ⊕ δ₀))
        ((map left right) :
          ωCPO.of (α₀ ⊕ β₀) ⟶ ωCPO.of (γ₀ ⊕ δ₀))
        (Sum.inl value) =
      Sum.inl (left value) :=
  rfl

@[simp]
theorem concrete_map_inr
    (left : α₀ →𝒄 γ₀)
    (right : β₀ →𝒄 δ₀)
    (value : β₀) :
    CategoryTheory.ConcreteCategory.hom
        (C := ωCPO)
        (X := ωCPO.of (α₀ ⊕ β₀))
        (Y := ωCPO.of (γ₀ ⊕ δ₀))
        ((map left right) :
          ωCPO.of (α₀ ⊕ β₀) ⟶ ωCPO.of (γ₀ ⊕ δ₀))
        (Sum.inr value) =
      Sum.inr (right value) :=
  rfl

end Concrete

end Cantilune.Pi.FMSCpoSeparatedSum
