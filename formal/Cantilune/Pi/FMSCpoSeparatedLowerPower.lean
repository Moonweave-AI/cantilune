import Cantilune.Pi.FMSCpoFiniteHoareMonad
import Mathlib.Data.ENat.Lattice
import Mathlib.Order.UpperLower.CompleteLattice
import Mathlib.Order.UpperLower.Principal

/-!
# A separated lower-set lifting and its exact boundary

For every partial order `α`, this file studies the direct candidate

`Pₛ α = (LowerSet α)⊥`.

The fresh outer bottom is divergence.  The embedded empty lower set is
deadlock, so the two nullary computations are definitionally separated.
Nonempty lower sets embed the finite Hoare carrier already used elsewhere.

On finite omega-CPOs, lower direct image, principal return, and strict choice
are genuine continuous maps.  They form an endofunctor with a natural unit on
the full subcategory of finite omega-CPOs.

This is deliberately not called the Abramsky powerdomain.  The final
obstruction theorems show why the construction cannot simply be extended to
the desired all-omega-CPO monad:

* principal lower-set return is not omega-Scott-continuous on a concrete
  omega-chain with a new limit; and
* every nonempty lower set of a pointed carrier contains its least element,
  so a naive strict flattening would send every returned computation to
  divergence.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoSeparatedLowerPower

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFiniteHoareMonad
open Cantilune.Pi.FMSCpoFiniteStrictPower

universe u

/-! ## The general separated carrier -/

/--
All lower sets, including the empty lower set, with one fresh least element
strictly below them.
-/
abbrev SeparatedLowerPower
    (α : Type u) [Preorder α] :=
  WithBot (LowerSet α)

/-- The carrier is an actual omega-CPO for every preorder. -/
abbrev separatedLowerCpo
    (α : Type u) [Preorder α] : ωCPO :=
  ωCPO.of (SeparatedLowerPower α)

/-- Divergence is the fresh outer least element. -/
def divergence
    (α : Type u) [Preorder α] :
    SeparatedLowerPower α :=
  ⊥

/-- Deadlock is the embedded empty lower set. -/
def deadlock
    (α : Type u) [Preorder α] :
    SeparatedLowerPower α :=
  (↑(⊥ : LowerSet α) : WithBot (LowerSet α))

theorem divergence_ne_deadlock
    (α : Type u) [Preorder α] :
    divergence α ≠ deadlock α := by
  simp [divergence, deadlock]

@[simp]
theorem coe_ne_divergence
    {α : Type u} [Preorder α]
    (values : LowerSet α) :
    (↑values : SeparatedLowerPower α) ≠ divergence α := by
  simp [divergence]

@[simp]
theorem coe_eq_deadlock_iff
    {α : Type u} [Preorder α]
    (values : LowerSet α) :
    (↑values : SeparatedLowerPower α) = deadlock α ↔
      values = ⊥ := by
  simp [deadlock]

noncomputable instance separatedLowerPowerFinite
    (α : Type u) [Preorder α] [Finite α] :
    Finite (SeparatedLowerPower α) := by
  infer_instance

/-! ## Empty and nonempty Hoare layers -/

/-- Convert the existing nonempty Hoare value to mathlib's lower-set bundle. -/
def lowerSetOfHoare
    {α : Type u} [PartialOrder α]
    (values : FMSCpoFiniteHoarePower.HoarePower α) :
    LowerSet α :=
  ⟨FMSCpoFiniteHoarePower.carrier values, by
    intro lower upper lowerLe upperMember
    exact values.property.2 upperMember lowerLe⟩

/-- Embed a nonempty Hoare value above both nullary computations. -/
def embedNonempty
    {α : Type u} [PartialOrder α]
    (values : FMSCpoFiniteHoarePower.HoarePower α) :
    SeparatedLowerPower α :=
  ↑(lowerSetOfHoare values)

theorem embedNonempty_ne_divergence
    {α : Type u} [PartialOrder α]
    (values : FMSCpoFiniteHoarePower.HoarePower α) :
    embedNonempty values ≠ divergence α :=
  coe_ne_divergence _

theorem embedNonempty_ne_deadlock
    {α : Type u} [PartialOrder α]
    (values : FMSCpoFiniteHoarePower.HoarePower α) :
    embedNonempty values ≠ deadlock α := by
  change
    (↑(lowerSetOfHoare values) : SeparatedLowerPower α) ≠
      deadlock α
  intro equality
  have empty : lowerSetOfHoare values = ⊥ :=
    (coe_eq_deadlock_iff (lowerSetOfHoare values)).mp equality
  rcases values.property.1 with ⟨value, valueMember⟩
  have impossible : value ∈ (⊥ : LowerSet α) := by
    rw [← empty]
    exact valueMember
  exact impossible

/--
Every lower-set layer is exactly deadlock or contains an element.  This
separates the empty and nonempty Hoare layers without conflating either with
outer divergence.
-/
theorem lowerSet_empty_or_nonempty
    {α : Type u} [PartialOrder α]
    (values : LowerSet α) :
    values = ⊥ ∨ (values : Set α).Nonempty := by
  by_cases empty : values = ⊥
  · exact Or.inl empty
  · exact Or.inr (Set.nonempty_iff_ne_empty.mpr (by
      intro coeEmpty
      apply empty
      apply LowerSet.ext
      simpa using coeEmpty))

/-! ## Principal return -/

/-- Principal lower-set return, before continuity is considered. -/
def principalRaw
    {α : Type u} [Preorder α]
    (value : α) :
    SeparatedLowerPower α :=
  ↑(LowerSet.Iic value)

theorem principalRaw_monotone
    {α : Type u} [Preorder α] :
    Monotone (principalRaw : α → SeparatedLowerPower α) := by
  intro left right ordered
  change
    (↑(LowerSet.Iic left) : SeparatedLowerPower α) ≤
      ↑(LowerSet.Iic right)
  rw [WithBot.coe_le_coe]
  intro value valueLe
  exact le_trans valueLe ordered

/--
On a finite omega-CPO, principal return is a genuine continuous map into the
separated carrier.
-/
def principal
    {α : Type u}
    [OmegaCompletePartialOrder α] [Finite α] :
    ωCPO.of α ⟶ separatedLowerCpo α :=
  continuousOfFiniteMonotone principalRaw principalRaw_monotone

@[simp]
theorem principal_apply
    {α : Type u}
    [OmegaCompletePartialOrder α] [Finite α]
    (value : α) :
    principal value = principalRaw value :=
  rfl

/-! ## Strict continuous choice on finite carriers -/

/--
Strict union: divergence is absorbing, while nondivergent lower sets are
combined by union.
-/
def choiceRaw
    {α : Type u} [Preorder α] :
    SeparatedLowerPower α × SeparatedLowerPower α →
      SeparatedLowerPower α :=
  fun pair => WithBot.map₂ (· ⊔ ·) pair.1 pair.2

theorem choiceRaw_monotone
    {α : Type u} [Preorder α] :
    Monotone (choiceRaw (α := α)) := by
  rintro ⟨left₁, right₁⟩ ⟨left₂, right₂⟩ ordered
  rcases ordered with ⟨leftOrder, rightOrder⟩
  induction left₁ using WithBot.recBotCoe with
  | bot =>
      simp [choiceRaw]
  | coe left₁ =>
      induction right₁ using WithBot.recBotCoe with
      | bot =>
          simp [choiceRaw]
      | coe right₁ =>
          have left₂_ne : left₂ ≠ ⊥ := by
            intro equality
            subst left₂
            exact WithBot.not_coe_le_bot left₁ leftOrder
          have right₂_ne : right₂ ≠ ⊥ := by
            intro equality
            subst right₂
            exact WithBot.not_coe_le_bot right₁ rightOrder
          obtain ⟨left₂, rfl⟩ :=
            WithBot.ne_bot_iff_exists.mp left₂_ne
          obtain ⟨right₂, rfl⟩ :=
            WithBot.ne_bot_iff_exists.mp right₂_ne
          rw [WithBot.coe_le_coe] at leftOrder rightOrder
          change
            (↑(left₁ ⊔ right₁) : SeparatedLowerPower α) ≤
              ↑(left₂ ⊔ right₂)
          rw [WithBot.coe_le_coe]
          exact sup_le_sup leftOrder rightOrder

/-- Strict union is continuous on every finite base. -/
def choice
    {α : Type u} [Preorder α] [Finite α] :
    ωCPO.of
        (SeparatedLowerPower α × SeparatedLowerPower α) ⟶
      separatedLowerCpo α :=
  continuousOfFiniteMonotone choiceRaw choiceRaw_monotone

@[simp]
theorem choice_divergence_left
    {α : Type u} [Preorder α] [Finite α]
    (value : SeparatedLowerPower α) :
    choice (divergence α, value) = divergence α := by
  change choiceRaw (⊥, value) = ⊥
  rfl

@[simp]
theorem choice_divergence_right
    {α : Type u} [Preorder α] [Finite α]
    (value : SeparatedLowerPower α) :
    choice (value, divergence α) = divergence α := by
  change choiceRaw (value, ⊥) = ⊥
  unfold choiceRaw
  exact WithBot.map₂_bot_right (· ⊔ ·) value

@[simp]
theorem choice_coe
    {α : Type u} [Preorder α] [Finite α]
    (left right : LowerSet α) :
    choice
        ((↑left : SeparatedLowerPower α),
          (↑right : SeparatedLowerPower α)) =
      (↑(left ⊔ right) : SeparatedLowerPower α) :=
  rfl

theorem choice_assoc
    {α : Type u} [Preorder α] [Finite α]
    (left middle right : SeparatedLowerPower α) :
    choice (choice (left, middle), right) =
      choice (left, choice (middle, right)) := by
  change
    choiceRaw (choiceRaw (left, middle), right) =
      choiceRaw (left, choiceRaw (middle, right))
  induction left using WithBot.recBotCoe <;>
    induction middle using WithBot.recBotCoe <;>
      induction right using WithBot.recBotCoe <;>
        simp only [choiceRaw, WithBot.map₂_bot_left,
          WithBot.map₂_bot_right, WithBot.map₂_coe_coe]
  rw [sup_assoc]

theorem choice_comm
    {α : Type u} [Preorder α] [Finite α]
    (left right : SeparatedLowerPower α) :
    choice (left, right) = choice (right, left) := by
  change choiceRaw (left, right) = choiceRaw (right, left)
  induction left using WithBot.recBotCoe <;>
    induction right using WithBot.recBotCoe <;>
      simp [choiceRaw, sup_comm]

theorem choice_idem
    {α : Type u} [Preorder α] [Finite α]
    (value : SeparatedLowerPower α) :
    choice (value, value) = value := by
  change choiceRaw (value, value) = value
  induction value using WithBot.recBotCoe <;>
    simp [choiceRaw]

theorem deadlock_choice
    {α : Type u} [Preorder α] [Finite α]
    (value : SeparatedLowerPower α) :
    choice (deadlock α, value) = value := by
  change choiceRaw (deadlock α, value) = value
  induction value using WithBot.recBotCoe <;>
    simp [choiceRaw, deadlock]

/-- A concrete separated nondeterministic computation for every finite base. -/
def finiteSeparatedComputation
    (α : Type) [PartialOrder α] [Finite α] :
    NondeterministicComputation where
  carrier := separatedLowerCpo α
  divergence := divergence α
  divergence_le := by
    intro value
    exact bot_le
  deadlock := deadlock α
  choice := choice
  choice_assoc := choice_assoc
  choice_comm := choice_comm
  choice_idem := choice_idem
  deadlock_choice := deadlock_choice

theorem finiteSeparatedComputation_separates_nullaries
    (α : Type) [PartialOrder α] [Finite α] :
    (finiteSeparatedComputation α).divergence ≠
      (finiteSeparatedComputation α).deadlock :=
  divergence_ne_deadlock α

/-! ## Lower direct image -/

/-- Downward closure of direct image along a monotone function. -/
def lowerImage
    {α β : Type u}
    [Preorder α] [Preorder β]
    (function : α → β) (_monotone : Monotone function)
    (values : LowerSet α) :
    LowerSet β :=
  ⟨{ target |
      ∃ source ∈ values, target ≤ function source }, by
    intro lower upper lowerLe
    rintro ⟨source, sourceMember, upperLe⟩
    exact ⟨source, sourceMember, le_trans lowerLe upperLe⟩⟩

theorem lowerImage_monotone
    {α β : Type u}
    [Preorder α] [Preorder β]
    (function : α → β) (monotone : Monotone function) :
    Monotone (lowerImage function monotone) := by
  intro left right subset target
  rintro ⟨source, sourceMember, targetLe⟩
  exact ⟨source, subset sourceMember, targetLe⟩

/-- Strict lower direct image preserves outer divergence. -/
def mapRaw
    {α β : Type u}
    [Preorder α] [Preorder β]
    (function : α → β) (monotone : Monotone function) :
    SeparatedLowerPower α → SeparatedLowerPower β :=
  WithBot.map (lowerImage function monotone)

theorem mapRaw_monotone
    {α β : Type u}
    [Preorder α] [Preorder β]
    (function : α → β) (monotone : Monotone function) :
    Monotone (mapRaw function monotone) :=
  Monotone.withBot_map (lowerImage_monotone function monotone)

/-- Strict lower direct image is continuous for finite source bases. -/
def map
    {α β : Type u}
    [Preorder α] [Preorder β] [Finite α]
    (function : α → β) (monotone : Monotone function) :
    separatedLowerCpo α ⟶ separatedLowerCpo β :=
  continuousOfFiniteMonotone
    (mapRaw function monotone)
    (mapRaw_monotone function monotone)

@[simp]
theorem map_divergence
    {α β : Type u}
    [Preorder α] [Preorder β] [Finite α]
    (function : α → β) (monotone : Monotone function) :
    map function monotone (divergence α) = divergence β :=
  rfl

@[simp]
theorem lowerImage_empty
    {α β : Type u}
    [Preorder α] [Preorder β]
    (function : α → β) (monotone : Monotone function) :
    lowerImage function monotone (⊥ : LowerSet α) = ⊥ := by
  apply LowerSet.ext
  simp [lowerImage]

@[simp]
theorem map_deadlock
    {α β : Type u}
    [Preorder α] [Preorder β] [Finite α]
    (function : α → β) (monotone : Monotone function) :
    map function monotone (deadlock α) = deadlock β := by
  change
    mapRaw function monotone
        (↑(⊥ : LowerSet α) : SeparatedLowerPower α) =
      (↑(⊥ : LowerSet β) : SeparatedLowerPower β)
  rw [show
    mapRaw function monotone
        (↑(⊥ : LowerSet α) : SeparatedLowerPower α) =
      ↑(lowerImage function monotone (⊥ : LowerSet α)) by rfl]
  rw [lowerImage_empty]

theorem lowerImage_principal
    {α β : Type u}
    [Preorder α] [Preorder β]
    (function : α → β) (monotone : Monotone function)
    (value : α) :
    lowerImage function monotone (LowerSet.Iic value) =
      LowerSet.Iic (function value) := by
  apply LowerSet.ext
  ext target
  constructor
  · rintro ⟨source, sourceLe, targetLe⟩
    exact le_trans targetLe (monotone sourceLe)
  · intro targetLe
    exact ⟨value, le_rfl, targetLe⟩

theorem map_principalRaw
    {α β : Type u}
    [Preorder α] [Preorder β] [Finite α]
    (function : α → β) (monotone : Monotone function)
    (value : α) :
    map function monotone (principalRaw value) =
      principalRaw (function value) := by
  change
    (↑(lowerImage function monotone (LowerSet.Iic value)) :
      SeparatedLowerPower β) =
      ↑(LowerSet.Iic (function value))
  rw [lowerImage_principal]

theorem map_id
    {α : Type u} [Preorder α] [Finite α] :
    map (id : α → α) monotone_id =
      𝟙 (separatedLowerCpo α) := by
  apply ContinuousHom.ext
  intro values
  induction values using WithBot.recBotCoe with
  | bot =>
      rfl
  | coe values =>
      change
        (↑(lowerImage id monotone_id values) :
          SeparatedLowerPower α) =
        ↑values
      congr 1
      apply LowerSet.ext
      ext target
      constructor
      · rintro ⟨source, sourceMember, targetLe⟩
        exact values.lower targetLe sourceMember
      · intro targetMember
        exact ⟨target, targetMember, le_rfl⟩

theorem map_comp
    {α β γ : Type u}
    [Preorder α] [Preorder β] [Preorder γ]
    [Finite α] [Finite β]
    (first : α → β) (second : β → γ)
    (firstMonotone : Monotone first)
    (secondMonotone : Monotone second) :
    map first firstMonotone ≫ map second secondMonotone =
      map (second ∘ first)
        (secondMonotone.comp firstMonotone) := by
  apply ContinuousHom.ext
  intro values
  induction values using WithBot.recBotCoe with
  | bot =>
      rfl
  | coe values =>
      change
        (↑(lowerImage second secondMonotone
          (lowerImage first firstMonotone values)) :
          SeparatedLowerPower γ) =
        ↑(lowerImage (second ∘ first)
          (secondMonotone.comp firstMonotone) values)
      congr 1
      apply LowerSet.ext
      ext target
      constructor
      · rintro
          ⟨middle, ⟨source, sourceMember, middleLe⟩, targetLe⟩
        exact
          ⟨source, sourceMember,
            le_trans targetLe (secondMonotone middleLe)⟩
      · rintro ⟨source, sourceMember, targetLe⟩
        exact
          ⟨first source,
            ⟨source, sourceMember, le_rfl⟩,
            targetLe⟩

/-! ## A finite continuous endofunctor with natural principal unit -/

/--
The separated lower-set carrier stays inside the full subcategory of finite
omega-CPOs.
-/
def separatedObject (object : FiniteCPO.{u}) : FiniteCPO.{u} :=
  ⟨separatedLowerCpo object.obj,
    show Finite (SeparatedLowerPower object.obj) from inferInstance⟩

/-- Strict lower direct image as a morphism of finite omega-CPOs. -/
def separatedMap
    {source target : FiniteCPO.{u}}
    (morphism : source ⟶ target) :
    separatedObject source ⟶ separatedObject target :=
  ObjectProperty.homMk
    (map morphism.hom morphism.hom.monotone)

/--
The separated lower-set lifting is a genuine continuous endofunctor on
finite omega-CPOs.
-/
def finiteSeparatedFunctor : FiniteCPO.{u} ⥤ FiniteCPO.{u} where
  obj := separatedObject
  map := separatedMap
  map_id object := by
    apply ObjectProperty.hom_ext
    exact map_id
  map_comp first second := by
    apply ObjectProperty.hom_ext
    exact
      (map_comp
        first.hom second.hom
        first.hom.monotone second.hom.monotone).symm

/--
Principal lower sets give a natural transformation from the identity to the
finite separated lifting.

This is only a unit candidate.  The obstruction below rules out the tempting
strict-union multiplication; consequently this declaration is intentionally
not promoted to a monad.
-/
def finiteSeparatedUnit :
    𝟭 FiniteCPO.{u} ⟶ finiteSeparatedFunctor where
  app object :=
    ObjectProperty.homMk principal
  naturality := by
    intro source target morphism
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro value
    exact
      (map_principalRaw
        morphism.hom morphism.hom.monotone value).symm

@[simp]
theorem finiteSeparatedFunctor_map_divergence
    {source target : FiniteCPO.{u}}
    (morphism : source ⟶ target) :
    finiteSeparatedFunctor.map morphism (divergence source.obj) =
      divergence target.obj :=
  map_divergence morphism.hom morphism.hom.monotone

@[simp]
theorem finiteSeparatedFunctor_map_deadlock
    {source target : FiniteCPO.{u}}
    (morphism : source ⟶ target) :
    finiteSeparatedFunctor.map morphism (deadlock source.obj) =
      deadlock target.obj :=
  map_deadlock morphism.hom morphism.hom.monotone

@[simp]
theorem finiteSeparatedUnit_apply
    (object : FiniteCPO.{u}) (value : object.obj) :
    finiteSeparatedUnit.app object value = principalRaw value :=
  rfl

/-! ## The strict-flattening obstruction -/

/--
Every nonempty lower set of a pointed carrier contains the carrier bottom.
This elementary fact is exactly what makes a second bottom delicate.
-/
theorem nonempty_lowerSet_contains_bottom
    {α : Type u} [Preorder α] [OrderBot α]
    (values : LowerSet α)
    (nonempty : (values : Set α).Nonempty) :
    (⊥ : α) ∈ values := by
  obtain ⟨value, valueMember⟩ := nonempty
  exact values.lower bot_le valueMember

/--
The principal lower set of any separated computation contains outer
divergence, because divergence is the least element of the separated carrier.
-/
theorem principal_contains_divergence
    {α : Type u} [Preorder α]
    (value : SeparatedLowerPower α) :
    divergence α ∈ LowerSet.Iic value :=
  by
    change divergence α ≤ value
    exact bot_le

/--
There is no flattening operation which is both

* strict whenever an embedded family contains divergence, and
* a left inverse to principal return.

The contradiction already occurs at returned deadlock.  Therefore adding an
outer bottom to all lower sets does separate divergence and deadlock, but
strict union cannot supply the desired monad multiplication.
-/
theorem no_strict_flatten_with_principal_unit
    (α : Type u) [PartialOrder α] :
    ¬ ∃ flatten :
        SeparatedLowerPower (SeparatedLowerPower α) →
          SeparatedLowerPower α,
      (∀ family : LowerSet (SeparatedLowerPower α),
          divergence α ∈ family →
          flatten
              (↑family :
                SeparatedLowerPower (SeparatedLowerPower α)) =
            divergence α) ∧
      (∀ value : SeparatedLowerPower α,
          flatten (principalRaw value) = value) := by
  rintro ⟨flatten, strictOnContainedDivergence, principalUnit⟩
  have contains :
      divergence α ∈ LowerSet.Iic (deadlock α) :=
    principal_contains_divergence (deadlock α)
  have strictAtDeadlock :=
    strictOnContainedDivergence
      (LowerSet.Iic (deadlock α)) contains
  change
    flatten (principalRaw (deadlock α)) = divergence α
      at strictAtDeadlock
  have unitAtDeadlock :=
    principalUnit (deadlock α)
  have impossible : divergence α = deadlock α :=
    strictAtDeadlock.symm.trans unitAtDeadlock
  exact divergence_ne_deadlock α impossible

/-! ## Principal return is not continuous on all omega-CPOs -/

/-- The increasing sequence `0, 1, 2, ...` in extended naturals. -/
def natLimitChain :
    Chain ℕ∞ where
  toFun index := index
  monotone' := by
    intro left right ordered
    change (left : ℕ∞) ≤ (right : ℕ∞)
    exact_mod_cast ordered

/-- The omega-supremum of the finite extended naturals is the new top. -/
theorem omegaSup_natLimitChain :
    ωSup natLimitChain = (⊤ : ℕ∞) := by
  change (⨆ index : ℕ, (index : ℕ∞)) = ⊤
  exact ENat.iSup_natCast

/-- The lower set of precisely the finite extended naturals. -/
def finiteExtendedNaturals :
    LowerSet ℕ∞ :=
  ⟨{value | value ≠ ⊤}, by
    intro upper lower lowerLe upperFinite lowerTop
    subst lower
    exact upperFinite (top_unique lowerLe)⟩

@[simp]
theorem finiteExtendedNaturals_mem_iff
    (value : ℕ∞) :
    value ∈ finiteExtendedNaturals ↔ value ≠ ⊤ :=
  Iff.rfl

/--
There is no continuous map on extended naturals whose pointwise action is
principal lower-set return into the separated carrier.

The proof is internal: continuity would put the principal lower set of `⊤`
below the lower set of finite elements, although the former contains `⊤` and
the latter does not.
-/
theorem no_continuous_principal_on_natLimit :
    ¬ ∃ unit :
        ℕ∞ →𝒄 SeparatedLowerPower ℕ∞,
      ∀ value : ℕ∞, unit value = principalRaw value := by
  rintro ⟨unit, unitApply⟩
  have mappedUpper :
      ωSup (natLimitChain.map unit.toOrderHom) ≤
        (↑finiteExtendedNaturals :
          SeparatedLowerPower ℕ∞) := by
    apply ωSup_le
    intro index
    change
      unit (index : ℕ∞) ≤
        (↑finiteExtendedNaturals :
          SeparatedLowerPower ℕ∞)
    rw [unitApply]
    change
      (↑(LowerSet.Iic (index : ℕ∞)) :
          SeparatedLowerPower ℕ∞) ≤
        (↑finiteExtendedNaturals :
          SeparatedLowerPower ℕ∞)
    rw [WithBot.coe_le_coe]
    intro value valueLe
    change value ≠ (⊤ : ℕ∞)
    intro valueTop
    subst value
    simp at valueLe
  have preservesSup := unit.map_ωSup' natLimitChain
  rw [omegaSup_natLimitChain] at preservesSup
  change
    unit (⊤ : ℕ∞) =
      ωSup (natLimitChain.map unit.toOrderHom)
      at preservesSup
  rw [unitApply] at preservesSup
  have principalUpper :
      principalRaw (⊤ : ℕ∞) ≤
        (↑finiteExtendedNaturals :
          SeparatedLowerPower ℕ∞) := by
    rw [preservesSup]
    exact mappedUpper
  change
    (↑(LowerSet.Iic (⊤ : ℕ∞)) :
        SeparatedLowerPower ℕ∞) ≤
      (↑finiteExtendedNaturals :
        SeparatedLowerPower ℕ∞)
      at principalUpper
  rw [WithBot.coe_le_coe] at principalUpper
  have topInPrincipal :
      (⊤ : ℕ∞) ∈ LowerSet.Iic (⊤ : ℕ∞) := by
    change (⊤ : ℕ∞) ≤ ⊤
    exact le_rfl
  have topMember :
      (⊤ : ℕ∞) ∈ finiteExtendedNaturals :=
    principalUpper topInPrincipal
  exact topMember rfl

end Cantilune.Pi.FMSCpoSeparatedLowerPower
