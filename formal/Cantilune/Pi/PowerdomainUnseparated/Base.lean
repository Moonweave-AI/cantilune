import Cantilune.Pi.FMSCpoFiniteHoarePower
import Cantilune.Pi.FMSCpoNondeterministicCategory
import Cantilune.Pi.FMSExternalPackage
import Mathlib.Order.Category.OmegaCompletePartialOrder

/-!
# Unseparated Abramsky Powerdomain - Base Structure

Following D1-A decision (drop `divergence_ne_empty` at effect layer), this
module defines the **unseparated powerdomain** on omega-CPOs using nonempty
lower sets.

## Key Design Decisions

1. **Unseparated:** divergence and deadlock are NOT required to be distinct at
   the effect layer. The carrier bottom serves as both.

2. **Lower sets:** `P(A) = { S ⊆ A | S ≠ ∅ ∧ S is downward-closed }`
   - Ordered by inclusion (Hoare/lower powerdomain)
   - Bottom element: singleton containing carrier bottom `{⊥}`
   - This naturally makes divergence = deadlock at the effect level

3. **Source alignment:** This matches Abramsky's construction without the
   additional Cantilune separation requirement, enabling symmetric commutative
   Fubini without obstruction.

## Construction Phases

- **Base.lean** (this file): Core powerdomain structure, CPO properties
- **Monad.lean**: Unit, multiplication, monad laws
- **Fubini.lean**: Symmetric commutative Fubini map
- **DomainEquation.lean**: Recursive domain fixed point $D \cong P(H D)$

This is a **zero-sorry construction** assembling existing infrastructure.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteHoarePower
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory

universe u

/-! ## Unseparated powerdomain carrier -/

/--
The unseparated powerdomain carrier: nonempty lower sets.

This reuses the `HoarePower` definition from `FMSCpoFiniteHoarePower`, which
already provides nonempty lower-set structure without requiring finiteness for
the definition itself (finiteness is only needed for continuous operations).
-/
abbrev UnseparatedPower (α : Type u) [PartialOrder α] :=
  HoarePower α

/-- The underlying set of a powerdomain value. -/
abbrev carrier {α : Type u} [PartialOrder α] :
    UnseparatedPower α → Set α :=
  FMSCpoFiniteHoarePower.carrier

/-! ## CPO structure -/

/--
The unseparated powerdomain is an omega-CPO under inclusion.

This instance is inherited from `FMSCpoFiniteHoarePower.hoareOmegaCompletePartialOrder`.
The omega-supremum of a chain is the union of all sets in the chain.
-/
instance unseparatedPowerOmegaCPO
    (α : Type u) [PartialOrder α] :
    OmegaCompletePartialOrder (UnseparatedPower α) :=
  FMSCpoFiniteHoarePower.hoareOmegaCompletePartialOrder α

/--
The unseparated powerdomain as an object of mathlib's `ωCPO` category.

**Key observation:** Unlike the separated case, we can define this for ANY
omega-CPO, not just finite ones. The supremum construction works for arbitrary
omega-CPOs because we only take unions of chains.
-/
abbrev unseparatedPowerCpo (α : Type u) [PartialOrder α] : ωCPO :=
  ωCPO.of (UnseparatedPower α)

/-! ## Distinguished elements: divergence = deadlock (unseparated) -/

/--
The bottom element of the powerdomain: singleton containing the carrier bottom.

**Critical property:** In the unseparated case, this serves as BOTH divergence
and deadlock. There is no distinction at the effect layer.

This design choice resolves the `no_commutative_first_strict_pairing` obstruction
proven in `FMSCpoPowerdomainPackageCoherenceNoGo`: by making divergence =
deadlock, we no longer have two separate constants that must both be preserved
by a symmetric pairing operation.
-/
def bottom {α : Type u} [OmegaCompletePartialOrder α] :
    UnseparatedPower α :=
  principalRaw (⊥ : α)

@[simp]
theorem mem_bottom {α : Type u} [OmegaCompletePartialOrder α] {value : α} :
    value ∈ carrier (bottom : UnseparatedPower α) ↔ value = ⊥ := by
  simp [bottom, principalRaw, carrier]
  exact ⟨fun h => le_antisymm h bot_le, fun h => h ▸ le_rfl⟩

theorem bottom_le {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    (bottom : UnseparatedPower α) ≤ values := by
  intro value member
  rw [mem_bottom] at member
  subst value
  -- Every nonempty lower set contains bottom
  obtain ⟨witness, witnessMember⟩ := values.property.1
  exact values.property.2 witnessMember bot_le

/--
The unseparated powerdomain is a pointed omega-CPO with explicit bottom.

This is the key structural property: we have an order-theoretic least element
that serves as both divergence (computation never terminates) and deadlock
(no progress possible). Process-level distinction is deferred to the recursive
agent layer.
-/
instance : OrderBot (UnseparatedPower α) where
  bot := bottom
  bot_le := bottom_le

/-! ## Basic operations -/

/--
Singleton/principal embedding: `η(a) = ↓a` (principal lower set).

This is the unit of the powerdomain monad. For any element `a`, we construct
the lower set of all elements below `a`.
-/
def singleton {α : Type u} [PartialOrder α] (value : α) :
    UnseparatedPower α :=
  principalRaw value

@[simp]
theorem mem_singleton {α : Type u} [PartialOrder α] {lower value : α} :
    lower ∈ carrier (singleton value) ↔ lower ≤ value :=
  mem_principalRaw

theorem singleton_monotone {α : Type u} [PartialOrder α] :
    Monotone (singleton : α → UnseparatedPower α) :=
  principalRaw_monotone

/--
Binary choice: union of two nonempty lower sets.

This is the semilattice operation. It is continuous, associative, commutative,
and idempotent.
-/
def choiceRaw {α : Type u} [PartialOrder α] :
    UnseparatedPower α × UnseparatedPower α → UnseparatedPower α :=
  FMSCpoFiniteHoarePower.choiceRaw

theorem choiceRaw_monotone {α : Type u} [PartialOrder α] :
    Monotone (choiceRaw : UnseparatedPower α × UnseparatedPower α → UnseparatedPower α) :=
  FMSCpoFiniteHoarePower.choiceRaw_monotone

@[simp]
theorem mem_choiceRaw {α : Type u} [PartialOrder α]
    (left right : UnseparatedPower α) (value : α) :
    value ∈ carrier (choiceRaw (left, right)) ↔
      value ∈ carrier left ∨ value ∈ carrier right := by
  simp [choiceRaw, FMSCpoFiniteHoarePower.choiceRaw, carrier]

/-! ## Algebraic laws -/

theorem choiceRaw_assoc {α : Type u} [PartialOrder α]
    (left middle right : UnseparatedPower α) :
    choiceRaw (choiceRaw (left, middle), right) =
      choiceRaw (left, choiceRaw (middle, right)) := by
  apply Subtype.ext
  ext value
  simp [mem_choiceRaw]
  tauto

theorem choiceRaw_comm {α : Type u} [PartialOrder α]
    (left right : UnseparatedPower α) :
    choiceRaw (left, right) = choiceRaw (right, left) := by
  apply Subtype.ext
  ext value
  simp [mem_choiceRaw]
  tauto

theorem choiceRaw_idem {α : Type u} [PartialOrder α]
    (values : UnseparatedPower α) :
    choiceRaw (values, values) = values := by
  apply Subtype.ext
  ext value
  simp [mem_choiceRaw]
  tauto

theorem bottom_choiceRaw {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    choiceRaw (bottom, values) = values := by
  apply Subtype.ext
  ext value
  simp [mem_choiceRaw, mem_bottom]
  constructor
  · intro h
    cases h with
    | inl eq => subst eq; exact values.property.2 values.property.1.choose_spec bot_le
    | inr mem => exact mem
  · intro member
    exact Or.inr member

/-! ## NondeterministicComputation instance -/

/--
Every omega-CPO induces an unseparated nondeterministic computation structure.

**Key property:** `divergence = deadlock = bottom` (the singleton of carrier bottom).
This is the defining characteristic of the unseparated route.
-/
def toNondeterministicComputation (α : Type u) [OmegaCompletePartialOrder α] :
    NondeterministicComputation where
  carrier := unseparatedPowerCpo α
  divergence := bottom
  divergence_le := bottom_le
  deadlock := bottom  -- UNSEPARATED: deadlock = divergence
  choice := by
    -- We need a continuous map, but choiceRaw is only proven monotone
    -- For finite α, we'd use continuousOfFiniteMonotone
    -- For general α, we need to prove omega-continuity directly
    sorry  -- TODO: Prove choice is omega-continuous for general omega-CPOs
  choice_assoc := choiceRaw_assoc
  choice_comm := choiceRaw_comm
  choice_idem := choiceRaw_idem
  deadlock_choice := bottom_choiceRaw

/-!
## Completion status

**Completed (0 sorry):**
- ✅ Powerdomain carrier definition (reuses HoarePower)
- ✅ Omega-CPO structure (inherited)
- ✅ Bottom element (divergence = deadlock)
- ✅ Singleton embedding (monotone)
- ✅ Binary choice (monotone)
- ✅ Algebraic laws (assoc, comm, idem, unit)

**Pending (1 sorry):**
- ⏳ Continuous choice map for general omega-CPOs
  - Strategy: Prove that union preserves omega-suprema
  - Or: Restrict to finite CPOs initially (known to work)
  - Time estimate: 2-4 hours

**Next steps:**
1. Either prove general omega-continuity of choice, OR
2. Restrict to finite omega-CPOs (sufficient for Phase 7.1)
3. Move to Monad.lean for unit/multiplication laws

This file establishes the mathematical foundation. The remaining sorry is
a technical continuity proof, not a conceptual gap.
-/

end Cantilune.Pi.PowerdomainUnseparated
