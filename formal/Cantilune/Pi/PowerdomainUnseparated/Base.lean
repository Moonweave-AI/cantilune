import Cantilune.Pi.FMSCpoOmegaScottPower
import Cantilune.Pi.FMSExternalPackage

/-!
# Verified unseparated omega-Scott powerdomain facade

The unseparated route is the already kernel-built omega-Scott closed
lower-set monad.  Its least computation is the empty closed set, used for
both divergence and deadlock.  This file exposes that construction under the
Gate-7 namespace; it does not introduce a second, incompatible nonempty
Hoare carrier.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSExternalPackage

universe u

/-- The actual all-omega-CPO carrier used by the unseparated route. -/
abbrev UnseparatedPower
    (α : Type u) [OmegaCompletePartialOrder α] :=
  OmegaScottPower α

abbrev carrier
    {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    Set (WithOmegaScott α) :=
  FMSCpoOmegaScottPower.carrier values

abbrev unseparatedPowerCpo
    (α : Type u) [OmegaCompletePartialOrder α] :
    ωCPO.{u} :=
  omegaScottPowerCpo α

/-- Divergence and deadlock are both the least (empty) closed computation. -/
def bottom
    {α : Type u} [OmegaCompletePartialOrder α] :
    UnseparatedPower α :=
  ⊥

@[simp]
theorem mem_bottom
    {α : Type u} [OmegaCompletePartialOrder α]
    (value : WithOmegaScott α) :
    value ∈ carrier (bottom : UnseparatedPower α) ↔ False := by
  rfl

theorem bottom_le
    {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    (bottom : UnseparatedPower α) ≤ values :=
  bot_le

/-- Principal lower closure, the monad unit on elements. -/
abbrev singleton
    {α : Type u} [OmegaCompletePartialOrder α]
    (value : α) :
    UnseparatedPower α :=
  principalRaw value

@[simp]
theorem mem_singleton
    {α : Type u} [OmegaCompletePartialOrder α]
    (lower value : α) :
    WithOmegaScott.toOmegaScott lower ∈
        carrier (singleton value) ↔
      lower ≤ value :=
  mem_principalRaw_iff lower value

theorem singleton_monotone
    {α : Type u} [OmegaCompletePartialOrder α] :
    Monotone (singleton : α → UnseparatedPower α) :=
  principalRaw_monotone

/-- Continuous idempotent choice is lattice union/supremum. -/
def choiceRaw
    {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α × UnseparatedPower α) :
    UnseparatedPower α :=
  values.1 ⊔ values.2

@[simp]
theorem mem_choiceRaw
    {α : Type u} [OmegaCompletePartialOrder α]
    (left right : UnseparatedPower α)
    (value : WithOmegaScott α) :
    value ∈ carrier (choiceRaw (left, right)) ↔
      value ∈ carrier left ∨ value ∈ carrier right :=
  Iff.rfl

theorem choiceRaw_assoc
    {α : Type u} [OmegaCompletePartialOrder α]
    (left middle right : UnseparatedPower α) :
    choiceRaw (choiceRaw (left, middle), right) =
      choiceRaw (left, choiceRaw (middle, right)) :=
  sup_assoc left middle right

theorem choiceRaw_comm
    {α : Type u} [OmegaCompletePartialOrder α]
    (left right : UnseparatedPower α) :
    choiceRaw (left, right) = choiceRaw (right, left) :=
  sup_comm left right

theorem choiceRaw_idem
    {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    choiceRaw (values, values) = values :=
  by
    change values ⊔ values = values
    exact sup_idem values

theorem bottom_choiceRaw
    {α : Type u} [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    choiceRaw (bottom, values) = values :=
  by
    change (⊥ : UnseparatedPower α) ⊔ values = values
    exact bot_sup_eq values

/-- The actual continuous choice morphism. -/
def continuousChoice
    {α : Type u} [OmegaCompletePartialOrder α] :
    ωCPO.of (UnseparatedPower α × UnseparatedPower α) ⟶
      unseparatedPowerCpo α :=
  FMSCpoOmegaScottPower.choice

@[simp]
theorem continuousChoice_apply
    {α : Type u} [OmegaCompletePartialOrder α]
    (left right : UnseparatedPower α) :
    continuousChoice (left, right) = choiceRaw (left, right) :=
  rfl

/--
At the universe used by the external FMS boundary, the construction forms a
genuine nondeterministic-computation object with coincident constants.
-/
def toNondeterministicComputation
    (α : Type) [OmegaCompletePartialOrder α] :
    NondeterministicComputation where
  carrier := unseparatedPowerCpo α
  divergence := bottom
  divergence_le := bottom_le
  deadlock := bottom
  choice := continuousChoice
  choice_assoc := choiceRaw_assoc
  choice_comm := choiceRaw_comm
  choice_idem := choiceRaw_idem
  deadlock_choice := bottom_choiceRaw

theorem divergence_eq_deadlock
    (α : Type) [OmegaCompletePartialOrder α] :
    (toNondeterministicComputation α).divergence =
      (toNondeterministicComputation α).deadlock :=
  rfl

end Cantilune.Pi.PowerdomainUnseparated
