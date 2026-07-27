import Cantilune.Pi.PowerdomainUnseparated.Base
import Cantilune.Pi.FMSCpoFiniteHoareMonad

/-!
# Unseparated Powerdomain - Monad Structure

This module proves that the unseparated powerdomain forms a monad with:
- **Unit (η):** singleton/principal embedding `a ↦ ↓a`
- **Multiplication (μ):** flattening operation `⋃⋃S`
- **Kleisli extension (bind):** `S >>= f = ⋃{f(a) | a ∈ S}`

## Monad Laws

1. **Left unit:** `μ(η(S)) = S`
2. **Right unit:** `μ(map η S) = S`
3. **Associativity:** `μ(μ(S)) = μ(map μ S)`

## Strategy

We reuse the infrastructure from `FMSCpoFiniteHoareMonad` which already proves
all these laws for finite omega-CPOs. The unseparated case works identically
because the carrier structure (nonempty lower sets) is the same.

For general (non-finite) omega-CPOs, we either:
1. Prove omega-continuity directly (preferred long-term)
2. Restrict to finite CPOs initially (sufficient for Phase 7.1)

This file targets **zero sorry** by leveraging existing proofs.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteHoarePower
open Cantilune.Pi.FMSCpoFiniteHoareMonad
open Cantilune.Pi.PowerdomainUnseparated

universe u

/-! ## Kleisli extension (bind operation) -/

/--
Kleisli extension for the unseparated powerdomain monad.

Given a continuation `f : α → P(β)` and a powerdomain value `S : P(α)`,
the result is the union of all `f(a)` for `a ∈ S`:

  `S >>= f = ⋃{f(a) | a ∈ S}`

This is the monadic bind operation, also called Kleisli extension.
-/
def bindRaw
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → UnseparatedPower β) (monotone : Monotone function)
    (values : UnseparatedPower α) :
    UnseparatedPower β :=
  FMSCpoFiniteHoareMonad.bindRaw function monotone values

theorem bindRaw_monotone
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → UnseparatedPower β) (monotone : Monotone function) :
    Monotone (bindRaw function monotone) :=
  FMSCpoFiniteHoareMonad.bindRaw_monotone function monotone

@[simp]
theorem mem_bindRaw {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → UnseparatedPower β) (monotone : Monotone function)
    (values : UnseparatedPower α) (target : β) :
    target ∈ carrier (bindRaw function monotone values) ↔
      ∃ source ∈ carrier values, target ∈ carrier (function source) := by
  rfl

/-! ## Monad unit laws -/

/--
**Left unit law:** `η(a) >>= f = f(a)`

Applying a continuation to a singleton value is the same as applying the
continuation directly.
-/
theorem bindRaw_singleton_left
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → UnseparatedPower β) (monotone : Monotone function)
    (value : α) :
    bindRaw function monotone (singleton value) = function value :=
  FMSCpoFiniteHoareMonad.bindRaw_principal function monotone value

/--
**Right unit law:** `S >>= η = S`

Binding with the singleton embedding is the identity.
-/
theorem bindRaw_singleton_right
    {α : Type u} [PartialOrder α]
    (values : UnseparatedPower α) :
    bindRaw singleton singleton_monotone values = values :=
  FMSCpoFiniteHoareMonad.bindRaw_principal_right values

/-! ## Monad associativity -/

/--
Helper: The composed continuation `a ↦ (f(a) >>= g)` is monotone.
-/
theorem bindRaw_continuation_monotone
    {α β γ : Type u}
    [PartialOrder α] [PartialOrder β] [PartialOrder γ]
    (first : α → UnseparatedPower β) (second : β → UnseparatedPower γ)
    (firstMonotone : Monotone first) (secondMonotone : Monotone second) :
    Monotone (fun value => bindRaw second secondMonotone (first value)) :=
  FMSCpoFiniteHoareMonad.bindRaw_continuation_monotone
    first second firstMonotone secondMonotone

/--
**Associativity law:** `(S >>= f) >>= g = S >>= (λa. f(a) >>= g)`

The two ways of composing Kleisli extensions give the same result.
-/
theorem bindRaw_assoc
    {α β γ : Type u}
    [PartialOrder α] [PartialOrder β] [PartialOrder γ]
    (first : α → UnseparatedPower β) (second : β → UnseparatedPower γ)
    (firstMonotone : Monotone first) (secondMonotone : Monotone second)
    (values : UnseparatedPower α) :
    bindRaw second secondMonotone
        (bindRaw first firstMonotone values) =
      bindRaw
        (fun value => bindRaw second secondMonotone (first value))
        (bindRaw_continuation_monotone
          first second firstMonotone secondMonotone)
        values :=
  FMSCpoFiniteHoareMonad.bindRaw_assoc
    first second firstMonotone secondMonotone values

/-! ## Multiplication (flatten) operation -/

/--
Multiplication/flattening: `μ : P(P(A)) → P(A)`

Flattens a powerdomain value containing powerdomain values by taking the union:
  `μ(S) = ⋃S`

This is the monad multiplication, dual to the Kleisli extension.
-/
def flattenRaw {α : Type u} [PartialOrder α] :
    UnseparatedPower (UnseparatedPower α) → UnseparatedPower α :=
  FMSCpoFiniteHoarePower.flattenRaw

theorem flattenRaw_monotone {α : Type u} [PartialOrder α] :
    Monotone (flattenRaw : UnseparatedPower (UnseparatedPower α) →
      UnseparatedPower α) :=
  FMSCpoFiniteHoarePower.flattenRaw_monotone

@[simp]
theorem mem_flattenRaw {α : Type u} [PartialOrder α]
    (family : UnseparatedPower (UnseparatedPower α)) (value : α) :
    value ∈ carrier (flattenRaw family) ↔
      ∃ member ∈ carrier family, value ∈ carrier member := by
  rfl

/-! ## Map operation (functor action) -/

/--
Functorial map: lift a function to the powerdomain.

For a monotone function `f : α → β`, we get `map f : P(α) → P(β)` by applying
`f` to all elements of the input lower set and taking the lower closure.
-/
def mapRaw {α β : Type u} [PartialOrder α] [PartialOrder β]
    (function : α → β) (monotone : Monotone function) :
    UnseparatedPower α → UnseparatedPower β :=
  FMSCpoFiniteHoarePower.mapRaw function monotone

theorem mapRaw_monotone {α β : Type u} [PartialOrder α] [PartialOrder β]
    (function : α → β) (monotone : Monotone function) :
    Monotone (mapRaw function monotone) :=
  FMSCpoFiniteHoarePower.mapRaw_monotone function monotone

@[simp]
theorem mem_mapRaw {α β : Type u} [PartialOrder α] [PartialOrder β]
    (function : α → β) (monotone : Monotone function)
    (values : UnseparatedPower α) (target : β) :
    target ∈ carrier (mapRaw function monotone values) ↔
      ∃ source ∈ carrier values, target ≤ function source := by
  rfl

/-! ## Bind-flatten equivalence -/

/--
Kleisli extension is equivalent to mapping followed by flattening:
  `S >>= f = μ(map f S)`
-/
theorem bindRaw_eq_flatten_mapRaw
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → UnseparatedPower β) (monotone : Monotone function)
    (values : UnseparatedPower α) :
    bindRaw function monotone values =
      flattenRaw (mapRaw function monotone values) :=
  FMSCpoFiniteHoareMonad.bindRaw_eq_flatten_mapRaw function monotone values

/-! ## Multiplication laws via flattening -/

/--
**Left unit via flatten:** `μ(η(S)) = S`

Flattening a singleton containing S gives back S.
-/
theorem flattenRaw_singleton
    {α : Type u} [PartialOrder α]
    (values : UnseparatedPower α) :
    flattenRaw (singleton values) = values := by
  apply Subtype.ext
  ext value
  constructor
  · rintro ⟨member, memberLe, valueMember⟩
    exact member.property.2 valueMember memberLe
  · intro valueMember
    exact ⟨values, le_rfl, valueMember⟩

/--
**Right unit via flatten:** `μ(map η S) = S`

Mapping singleton then flattening is the identity.
-/
theorem flattenRaw_mapRaw_singleton
    {α : Type u} [PartialOrder α]
    (values : UnseparatedPower α) :
    flattenRaw (mapRaw singleton singleton_monotone values) = values := by
  rw [← bindRaw_eq_flatten_mapRaw]
  exact bindRaw_singleton_right values

/--
Helper: Mapping preserves flattening structure.
-/
theorem mapRaw_flattenRaw_natural
    {α β : Type u} [PartialOrder α] [PartialOrder β]
    (function : α → β) (monotone : Monotone function)
    (family : UnseparatedPower (UnseparatedPower α)) :
    mapRaw function monotone (flattenRaw family) =
      flattenRaw (mapRaw (mapRaw function monotone)
        (mapRaw_monotone function monotone) family) :=
  FMSCpoFiniteHoareMonad.flattenRaw_mapRaw_natural function monotone family

/--
**Associativity via flatten:** `μ(μ(S)) = μ(map μ S)`

The two ways of flattening a triple-nested powerdomain give the same result.
-/
theorem flattenRaw_assoc
    {α : Type u} [PartialOrder α]
    (family : UnseparatedPower (UnseparatedPower (UnseparatedPower α))) :
    flattenRaw (flattenRaw family) =
      flattenRaw (mapRaw flattenRaw flattenRaw_monotone family) := by
  apply Subtype.ext
  ext value
  constructor
  · rintro ⟨inner, ⟨outer, outerMember, innerMember⟩, valueMember⟩
    exact ⟨flattenRaw outer, ⟨outer, outerMember, le_rfl⟩,
      ⟨inner, innerMember, valueMember⟩⟩
  · rintro ⟨flattened, ⟨outer, outerMember, flattenedLe⟩,
      ⟨inner, innerMember, valueMember⟩⟩
    have innerMember' : inner ∈ carrier outer := by
      exact outer.property.2 innerMember flattenedLe
    exact ⟨inner, ⟨outer, outerMember, innerMember'⟩, valueMember⟩

/-! ## Interaction with choice -/

/--
Choice distributes through bind:
  `(S₁ ⊔ S₂) >>= f = (S₁ >>= f) ⊔ (S₂ >>= f)`
-/
theorem bindRaw_choice
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → UnseparatedPower β) (monotone : Monotone function)
    (left right : UnseparatedPower α) :
    bindRaw function monotone (choiceRaw (left, right)) =
      choiceRaw
        (bindRaw function monotone left,
          bindRaw function monotone right) :=
  FMSCpoFiniteHoareMonad.bindRaw_choice function monotone left right

/--
Pointwise choice of continuations distributes:
  `S >>= (λa. f(a) ⊔ g(a)) = (S >>= f) ⊔ (S >>= g)`
-/
theorem bindRaw_pointwise_choice
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (left right : α → UnseparatedPower β)
    (leftMonotone : Monotone left)
    (rightMonotone : Monotone right)
    (values : UnseparatedPower α) :
    bindRaw
        (fun value => choiceRaw (left value, right value))
        (fun source target ordered member memberProof => by
          rcases memberProof with inLeft | inRight
          · exact Or.inl (leftMonotone ordered inLeft)
          · exact Or.inr (rightMonotone ordered inRight))
        values =
      choiceRaw
        (bindRaw left leftMonotone values,
          bindRaw right rightMonotone values) :=
  FMSCpoFiniteHoareMonad.bindRaw_pointwise_choice
    left right leftMonotone rightMonotone values

/-! ## Summary: Monad structure proven -/

/--
The unseparated powerdomain satisfies all monad laws:
- ✅ Left unit: `bindRaw_singleton_left`
- ✅ Right unit: `bindRaw_singleton_right`
- ✅ Associativity: `bindRaw_assoc`
- ✅ Flatten left unit: `flattenRaw_singleton`
- ✅ Flatten right unit: `flattenRaw_mapRaw_singleton`
- ✅ Flatten associativity: `flattenRaw_assoc`
- ✅ Distributivity over choice: `bindRaw_choice`, `bindRaw_pointwise_choice`

**Status:** Phase 7.1.2 complete with **zero sorry**.

**Next phase:** Symmetric Fubini (Phase 7.1.3) in `Fubini.lean`.
-/

end Cantilune.Pi.PowerdomainUnseparated
