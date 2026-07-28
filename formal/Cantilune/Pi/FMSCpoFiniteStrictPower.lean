import Cantilune.Pi.FMSExternalPackage
import Mathlib.Order.ConditionallyCompleteLattice.Basic
import Mathlib.Order.Preorder.Finite

/-!
# A non-discrete finite strict powerdomain fragment

The finite-powerset monad in `FMSCpoFinitePower` lives in the
equality-ordered full subcategory.  This module constructs a different,
genuinely order-sensitive object inside `ωCPO`:

`Pₛ α = (Set α)⊥`

for finite `α`.  The added least element is divergence, while the embedded
empty set is deadlock.  Nondeterministic choice is strict union: divergence
is absorbing and deadlock is the identity.  The subset order above the added
least element is non-discrete, and all operations below are actual continuous
maps.

This is a kernel-checked finite strict powerdomain *fragment*.  It is not
promoted to `CpoPowerdomainPackage`: extending the singleton unit from
equality-ordered finite bases to arbitrary `ωCPO`s is exactly the obstruction
proved in `FMSCpoFinitePowerObstruction`, and the all-`ωCPO` Abramsky
completion/domain equation remains external.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteStrictPower

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFinitePower

universe u v

/-! ## Monotone maps out of finite CPOs are continuous -/

/--
Every omega chain in a finite partial order reaches its supremum at a finite
index.  This is the precise fact used below; no equality-order shortcut is
involved.
-/
theorem finite_chain_reaches_ωSup
    {α : Type u} [OmegaCompletePartialOrder α] [Finite α]
    (chain : Chain α) :
    ∃ index, ωSup chain = chain index := by
  obtain ⟨maximum, ⟨index, rfl⟩, maximal⟩ :=
    (Set.toFinite (Set.range chain)).exists_maximal
      (Set.range_nonempty chain)
  have upper : ∀ other, chain other ≤ chain index := by
    intro other
    rcases le_total other index with before | after
    · exact chain.monotone before
    · exact maximal ⟨other, rfl⟩ (chain.monotone after)
  exact
    ⟨index,
      le_antisymm
        (ωSup_le_iff.mpr upper)
        (le_ωSup_of_le index le_rfl)⟩

/--
A monotone map whose source CPO is finite preserves omega-chain suprema and
therefore bundles as a genuine `ContinuousHom`.
-/
def continuousOfFiniteMonotone
    {α : Type u} {β : Type v}
    [OmegaCompletePartialOrder α] [Finite α]
    [OmegaCompletePartialOrder β]
    (function : α → β) (monotone : Monotone function) :
    α →𝒄 β := by
  refine ContinuousHom.ofFun function ?_
  apply ωScottContinuous.of_monotone_map_ωSup
  refine ⟨monotone, ?_⟩
  intro chain
  obtain ⟨index, sourceSup⟩ := finite_chain_reaches_ωSup chain
  rw [sourceSup]
  apply le_antisymm
  · apply le_ωSup_of_le index
    exact le_rfl
  · rw [ωSup_le_iff]
    intro other
    apply monotone
    rw [← sourceSup]
    exact le_ωSup_of_le other le_rfl

@[simp]
theorem continuousOfFiniteMonotone_apply
    {α : Type u} {β : Type v}
    [OmegaCompletePartialOrder α] [Finite α]
    [OmegaCompletePartialOrder β]
    (function : α → β) (monotone : Monotone function)
    (value : α) :
    continuousOfFiniteMonotone function monotone value =
      function value :=
  rfl

/-! ## Strict finite powers -/

/--
Finite nondeterministic values ordered by inclusion, with a fresh least
element below the embedded empty set.
-/
abbrev StrictFinitePower (α : Type u) := WithBot (Set α)

noncomputable instance strictFinitePower_finite
    (α : Type u) [Finite α] :
    Finite (StrictFinitePower α) := by
  infer_instance

/-- The strict finite power as an actual omega-CPO. -/
abbrev strictPowerCpo (α : Type u) : ωCPO :=
  ωCPO.of (StrictFinitePower α)

/-- Divergence is the added order-theoretic least element. -/
def divergence (α : Type u) : StrictFinitePower α :=
  ⊥

/-- Deadlock is the embedded empty set and is distinct from divergence. -/
def deadlock (α : Type u) : StrictFinitePower α :=
  (↑(∅ : Set α) : WithBot (Set α))

theorem divergence_ne_deadlock (α : Type u) :
    divergence α ≠ deadlock α := by
  simp [divergence, deadlock]

/--
Strict nondeterministic union.  Any divergent branch makes the whole choice
divergent; otherwise the represented finite result sets are unioned.
-/
def choiceRaw {α : Type u} :
    StrictFinitePower α × StrictFinitePower α →
      StrictFinitePower α :=
  fun pair => WithBot.map₂ (· ∪ ·) pair.1 pair.2

theorem choiceRaw_monotone {α : Type u} :
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
            (↑(left₁ ∪ right₁) : WithBot (Set α)) ≤
              (↑(left₂ ∪ right₂) : WithBot (Set α))
          rw [WithBot.coe_le_coe]
          intro value member
          rcases member with leftMember | rightMember
          · exact Or.inl (leftOrder leftMember)
          · exact Or.inr (rightOrder rightMember)

/-- Strict choice as a continuous map in `ωCPO`. -/
def choice {α : Type u} [Finite α] :
    ωCPO.of (StrictFinitePower α × StrictFinitePower α) ⟶
      strictPowerCpo α :=
  continuousOfFiniteMonotone choiceRaw choiceRaw_monotone

@[simp]
theorem choice_bot_left {α : Type u} [Finite α]
    (value : StrictFinitePower α) :
    choice (α := α) (⊥, value) = ⊥ := by
  change choiceRaw (⊥, value) = ⊥
  rfl

@[simp]
theorem choice_bot_right {α : Type u} [Finite α]
    (value : StrictFinitePower α) :
    choice (α := α) (value, ⊥) = ⊥ := by
  change choiceRaw (value, ⊥) = ⊥
  unfold choiceRaw
  exact WithBot.map₂_bot_right (· ∪ ·) value

@[simp]
theorem choice_coe {α : Type u} [Finite α] (left right : Set α) :
    choice (α := α) (left, right) =
      (↑(left ∪ right) : StrictFinitePower α) :=
  rfl

theorem choice_assoc {α : Type u} [Finite α]
    (left middle right : StrictFinitePower α) :
    choice (α := α) (choice (α := α) (left, middle), right) =
      choice (α := α) (left, choice (α := α) (middle, right)) := by
  change
    choiceRaw (choiceRaw (left, middle), right) =
      choiceRaw (left, choiceRaw (middle, right))
  induction left using WithBot.recBotCoe <;>
    induction middle using WithBot.recBotCoe <;>
      induction right using WithBot.recBotCoe <;>
        simp [choiceRaw, Set.union_assoc]

theorem choice_comm {α : Type u} [Finite α]
    (left right : StrictFinitePower α) :
    choice (α := α) (left, right) =
      choice (α := α) (right, left) := by
  change choiceRaw (left, right) = choiceRaw (right, left)
  induction left using WithBot.recBotCoe <;>
    induction right using WithBot.recBotCoe <;>
      simp [choiceRaw, Set.union_comm]

theorem choice_idem {α : Type u} [Finite α]
    (value : StrictFinitePower α) :
    choice (α := α) (value, value) = value := by
  change choiceRaw (value, value) = value
  induction value using WithBot.recBotCoe <;>
    simp [choiceRaw]

theorem deadlock_choice {α : Type u} [Finite α]
    (value : StrictFinitePower α) :
    choice (α := α) (deadlock α, value) = value := by
  change choiceRaw (deadlock α, value) = value
  induction value using WithBot.recBotCoe <;>
    simp [choiceRaw, deadlock]

/--
The finite strict object is a concrete inhabitant of the abstract
`NondeterministicComputation` interface used by the FMS acceptance boundary.
-/
def strictFiniteComputation (α : Type) [Finite α] :
    NondeterministicComputation where
  carrier := strictPowerCpo α
  divergence := divergence α
  divergence_le := by
    intro value
    change (⊥ : StrictFinitePower α) ≤ value
    exact bot_le
  deadlock := deadlock α
  choice := choice
  choice_assoc := choice_assoc
  choice_comm := choice_comm
  choice_idem := choice_idem
  deadlock_choice := deadlock_choice

theorem strictFiniteComputation_separates_nullaries
    (α : Type) [Finite α] :
    (strictFiniteComputation α).divergence ≠
      (strictFiniteComputation α).deadlock :=
  by
    change divergence α ≠ deadlock α
    exact divergence_ne_deadlock α

/-! ## Functorial action on finite equality-ordered bases -/

/-- Strict direct image, preserving the added divergence. -/
def mapRaw {α β : Type u} (function : α → β) :
    StrictFinitePower α → StrictFinitePower β :=
  WithBot.map (Set.image function)

theorem mapRaw_monotone {α β : Type u}
    (function : α → β) :
    Monotone (mapRaw function) := by
  apply Monotone.withBot_map
  intro left right subset
  exact Set.image_mono subset

/-- Direct image as an actual continuous map for finite source types. -/
def map {α β : Type u} (function : α → β) [Finite α] :
    strictPowerCpo α ⟶ strictPowerCpo β :=
  continuousOfFiniteMonotone (mapRaw function) (mapRaw_monotone function)

@[simp]
theorem map_bot {α β : Type u}
    (function : α → β) [Finite α] :
    map function ⊥ = ⊥ :=
  by
    change mapRaw function ⊥ = ⊥
    rfl

@[simp]
theorem map_coe {α β : Type u}
    (function : α → β) [Finite α] (values : Set α) :
    map function values =
      (↑(function '' values) : StrictFinitePower β) :=
  by
    change mapRaw function (↑values) = ↑(function '' values)
    rfl

theorem map_id {α : Type u} [Finite α] :
    map (id : α → α) = 𝟙 (strictPowerCpo α) := by
  apply ContinuousHom.ext
  intro value
  induction value using WithBot.recBotCoe with
  | bot =>
      change mapRaw id ⊥ = ⊥
      rfl
  | coe values =>
      change
        mapRaw (α := α) (β := α) id
            (↑values : StrictFinitePower α) =
          (↑values : StrictFinitePower α)
      change (↑(id '' values) : StrictFinitePower α) = ↑values
      rw [Set.image_id]

theorem map_comp
    {α β γ : Type u}
    (first : α → β) (second : β → γ)
    [Finite α] [Finite β] :
    map first ≫ map second = map (second ∘ first) := by
  apply ContinuousHom.ext
  intro value
  induction value using WithBot.recBotCoe with
  | bot =>
      change mapRaw second (mapRaw first ⊥) =
        mapRaw (second ∘ first) ⊥
      rfl
  | coe values =>
      change
        mapRaw second (mapRaw first ↑values) =
          mapRaw (second ∘ first) ↑values
      change
        (↑(second '' (first '' values)) : StrictFinitePower γ) =
          ↑((second ∘ first) '' values)
      rw [Set.image_image]
      rfl

/-- Singleton into the strict power, continuous from the equality CPO. -/
def singleton (α : Type u) :
    ωCPO.of (EqualityOrder α) ⟶ strictPowerCpo α :=
  EqualityOrder.continuousTo fun value =>
    (↑({value} : Set α) : StrictFinitePower α)

@[simp]
theorem singleton_apply {α : Type u} (value : α) :
    singleton α value =
      (↑({value} : Set α) : StrictFinitePower α) :=
  rfl

/--
Unlike the false all-`ωCPO` singleton, the finite equality-base singleton is
natural for every function and lands in a genuinely ordered CPO.
-/
theorem map_singleton
    {α β : Type u}
    (function : α → β) [Finite α] (value : α) :
    map function (singleton α value) =
      singleton β (function value) := by
  change
    mapRaw function
        (↑({value} : Set α) : StrictFinitePower α) =
      (↑({function value} : Set β) : StrictFinitePower β)
  change
    (↑(function '' ({value} : Set α)) : StrictFinitePower β) =
      ↑({function value} : Set β)
  rw [Set.image_singleton]

/--
The same carrier cannot be promoted to a singleton monad on all `ωCPO`s.
For the ordinary ordered Boolean CPO, monotonicity would require
`{false} ⊆ {true}`.  An Abramsky completion must therefore change more than
the order placed on raw finite subsets.
-/
theorem no_continuous_ordered_bool_singleton :
    ¬ ∃ unit : Bool →𝒄 StrictFinitePower Bool,
      ∀ value, unit value =
        (↑({value} : Set Bool) : StrictFinitePower Bool) := by
  rintro ⟨unit, unit_apply⟩
  have ordered : false ≤ true := by decide
  have mapped := unit.monotone ordered
  rw [unit_apply false, unit_apply true] at mapped
  rw [WithBot.coe_le_coe] at mapped
  have falseMember : false ∈ ({true} : Set Bool) :=
    mapped (by simp)
  simp at falseMember

/-- There is a strict order step from divergence to deadlock. -/
theorem divergence_lt_deadlock (α : Type u) :
    divergence α < deadlock α := by
  exact WithBot.bot_lt_coe _

/-- For every value, deadlock is strictly below its singleton result. -/
theorem deadlock_lt_singleton {α : Type u} (value : α) :
    deadlock α <
      (↑({value} : Set α) : StrictFinitePower α) := by
  change
    (↑(∅ : Set α) : WithBot (Set α)) <
      (↑({value} : Set α) : WithBot (Set α))
  rw [WithBot.coe_lt_coe]
  simp

/--
Concrete non-discreteness: the finite strict power over `PUnit` contains a
three-element strict chain `divergence < deadlock < return unit`.
-/
theorem punit_three_stage_chain :
    divergence PUnit < deadlock PUnit ∧
      deadlock PUnit <
        (↑({PUnit.unit} : Set PUnit) :
          StrictFinitePower PUnit) :=
  ⟨divergence_lt_deadlock PUnit,
    deadlock_lt_singleton PUnit.unit⟩

end Cantilune.Pi.FMSCpoFiniteStrictPower
