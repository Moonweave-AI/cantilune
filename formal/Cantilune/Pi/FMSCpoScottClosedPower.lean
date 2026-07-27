import Cantilune.Pi.FMSCpoSeparatedLowerPower
import Mathlib.Topology.OmegaCompletePartialOrder
import Mathlib.Topology.Sets.Closeds

/-!
# Scott-closed lower-set power candidate

For a preorder `α`, `ScottPower α` is the complete lattice of closed sets of
the Scott topology on `α`.  Such sets are proof-carrying lower sets closed
under every existing nonempty directed supremum, hence in particular under
the designated omega-suprema of an `OmegaCompletePartialOrder`.

Unlike the ordinary lower-set candidate, principal return into this carrier
preserves omega-suprema on every omega-CPO.  Chain suprema in the carrier are
topological closures of unions, rather than raw unions.

This file investigates only the lower/Hoare side of a possible powerdomain.
It does not identify this carrier with the Abramsky powerdomain and does not
claim the FMS domain equation or full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoScottClosedPower

open OmegaCompletePartialOrder
open Set
open Topology

universe u

/-! ## Proof-carrying Scott-closed lower sets -/

/--
Closed sets of the Scott topology, ordered by inclusion.

The bundled `IsClosed` proof entails both lower closure and closure under
every existing nonempty directed supremum.
-/
abbrev ScottPower
    (α : Type u) [Preorder α] :=
  TopologicalSpace.Closeds (WithScott α)

/-- The carrier set in the Scott-topologized type synonym. -/
def carrier
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    Set (WithScott α) :=
  values

@[simp]
theorem mem_carrier_iff
    {α : Type u} [Preorder α]
    (values : ScottPower α) (value : α) :
    WithScott.toScott value ∈ carrier values ↔
      WithScott.toScott value ∈ values :=
  Iff.rfl

/-- Order in `ScottPower` is precisely carrier inclusion. -/
theorem le_iff_subset
    {α : Type u} [Preorder α]
    (left right : ScottPower α) :
    left ≤ right ↔ carrier left ⊆ carrier right :=
  Iff.rfl

/-- Every bundled Scott-closed set is lower. -/
theorem isLowerSet
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    IsLowerSet (carrier values) :=
  Topology.IsScott.isLowerSet_of_isClosed values.isClosed

/-- Every bundled Scott-closed set is closed under directed suprema. -/
theorem dirSupClosed
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    DirSupClosed (carrier values) :=
  Topology.IsScott.dirSupClosed_of_isClosed values.isClosed

/--
The complete-lattice instance on topological closed sets supplies a genuine
omega-CPO structure on `ScottPower α`.
-/
abbrev scottPowerCpo
    (α : Type u) [Preorder α] :
    ωCPO :=
  ωCPO.of (ScottPower α)

/--
A Scott-closed set contains the designated supremum of every omega-chain
whose members it contains.
-/
theorem omegaSup_mem
    {α : Type u} [OmegaCompletePartialOrder α]
    (values : ScottPower α)
    (chain : Chain α)
    (members :
      ∀ index, WithScott.toScott (chain index) ∈ carrier values) :
    WithScott.toScott (ωSup chain) ∈ carrier values := by
  let scottChain : Chain (WithScott α) :=
    { toFun := fun index => WithScott.toScott (chain index)
      monotone' := chain.monotone }
  refine
    (dirSupClosed values)
      (d := Set.range scottChain) ?_ ?_ ?_ ?_
  · rintro value ⟨index, rfl⟩
    exact members index
  · exact ⟨scottChain 0, ⟨0, rfl⟩⟩
  · exact scottChain.isChain_range.directedOn
  · apply Scott.isωSup_iff_isLUB.mp
    constructor
    · intro index
      exact le_ωSup chain index
    · intro upper isUpper
      exact ωSup_le chain (WithScott.ofScott upper) isUpper

/-! ## Explicit omega-chain supremum -/

/--
The closure of the union of an omega-chain of Scott-closed sets.
-/
def omegaSupCandidate
    {α : Type u} [Preorder α]
    (chain : Chain (ScottPower α)) :
    ScottPower α :=
  TopologicalSpace.Closeds.closure
    (⋃ index, carrier (chain index))

theorem le_omegaSupCandidate
    {α : Type u} [Preorder α]
    (chain : Chain (ScottPower α)) (index : ℕ) :
    chain index ≤ omegaSupCandidate chain := by
  intro value valueMember
  exact
    subset_closure
      (mem_iUnion.2
        ⟨index, show value ∈ carrier (chain index) from valueMember⟩)

theorem omegaSupCandidate_le
    {α : Type u} [Preorder α]
    (chain : Chain (ScottPower α))
    (upper : ScottPower α)
    (isUpper : ∀ index, chain index ≤ upper) :
    omegaSupCandidate chain ≤ upper := by
  change
    TopologicalSpace.Closeds.closure
        (⋃ index, carrier (chain index)) ≤
      upper
  rw [TopologicalSpace.Closeds.closure_le]
  intro value valueMember
  obtain ⟨index, memberAtIndex⟩ := mem_iUnion.mp valueMember
  exact isUpper index memberAtIndex

/--
The inherited omega-supremum is exactly Scott closure of the chain union.
This is the construction missing from the raw lower-set candidate.
-/
theorem omegaSup_eq_closure_iUnion
    {α : Type u} [Preorder α]
    (chain : Chain (ScottPower α)) :
    ωSup chain = omegaSupCandidate chain := by
  apply le_antisymm
  · apply ωSup_le
    exact le_omegaSupCandidate chain
  · apply omegaSupCandidate_le
    exact le_ωSup chain

/-! ## Principal return and its omega-continuity -/

/-- Principal Scott-closed lower set. -/
def principalRaw
    {α : Type u} [Preorder α]
    (value : α) :
    ScottPower α :=
  ⟨Iic (WithScott.toScott value), isClosed_Iic⟩

@[simp]
theorem mem_principalRaw_iff
    {α : Type u} [Preorder α]
    (left right : α) :
    WithScott.toScott left ∈ carrier (principalRaw right) ↔
      left ≤ right :=
  Iff.rfl

theorem principalRaw_monotone
    {α : Type u} [Preorder α] :
    Monotone (principalRaw : α → ScottPower α) := by
  intro left right ordered value valueLe
  exact le_trans valueLe ordered

/-- Principal return as an order homomorphism. -/
def principalOrderHom
    {α : Type u} [Preorder α] :
    α →o ScottPower α where
  toFun := principalRaw
  monotone' := principalRaw_monotone

/--
Principal return preserves the designated omega-supremum.

The nontrivial direction uses Scott closure of the target supremum: it
contains every chain point, hence contains their supremum, and lower closure
then contains the whole principal ideal.
-/
theorem principalRaw_map_omegaSup
    {α : Type u} [OmegaCompletePartialOrder α]
    (chain : Chain α) :
    principalRaw (ωSup chain) =
      ωSup (chain.map principalOrderHom) := by
  apply le_antisymm
  · intro value valueLe
    have chainPointMember :
        ∀ index,
          WithScott.toScott (chain index) ∈
            carrier (ωSup (chain.map principalOrderHom)) := by
      intro index
      have inclusion :
          principalRaw (chain index) ≤
            ωSup (chain.map principalOrderHom) :=
        le_ωSup (chain.map principalOrderHom) index
      exact inclusion le_rfl
    have limitMember :
        WithScott.toScott (ωSup chain) ∈
          carrier (ωSup (chain.map principalOrderHom)) :=
      omegaSup_mem
        (ωSup (chain.map principalOrderHom))
        chain chainPointMember
    change
      value ∈ carrier (ωSup (chain.map principalOrderHom))
    exact
      isLowerSet (ωSup (chain.map principalOrderHom))
        valueLe limitMember
  · apply ωSup_le
    intro index
    exact principalRaw_monotone (le_ωSup chain index)

/--
Principal Scott-closed return is a genuine continuous map on every
omega-CPO; no finiteness hypothesis is used.
-/
def principal
    {α : Type u} [OmegaCompletePartialOrder α] :
    ωCPO.of α ⟶ scottPowerCpo α where
  toFun := principalRaw
  monotone' := principalRaw_monotone
  map_ωSup' := principalRaw_map_omegaSup

@[simp]
theorem principal_apply
    {α : Type u} [OmegaCompletePartialOrder α]
    (value : α) :
    principal value = principalRaw value :=
  rfl

/-! ## Finite choice on the unseparated carrier -/

/--
Finite nondeterministic choice is union of Scott-closed sets.  In the
complete lattice of closed sets this is binary supremum, and is continuous
on every source omega-CPO.
-/
def choice
    {α : Type u} [Preorder α] :
    ωCPO.of (ScottPower α × ScottPower α) ⟶
      scottPowerCpo α :=
  ContinuousHom.ofFun
    (fun pair : ScottPower α × ScottPower α =>
      pair.1 ⊔ pair.2)
    (CompleteLattice.ωScottContinuous.sup
      Prod.ωScottContinuous_fst
      Prod.ωScottContinuous_snd)

@[simp]
theorem choice_apply
    {α : Type u} [Preorder α]
    (left right : ScottPower α) :
    choice (left, right) = left ⊔ right :=
  rfl

theorem choice_assoc
    {α : Type u} [Preorder α]
    (left middle right : ScottPower α) :
    choice (choice (left, middle), right) =
      choice (left, choice (middle, right)) :=
  sup_assoc _ _ _

theorem choice_comm
    {α : Type u} [Preorder α]
    (left right : ScottPower α) :
    choice (left, right) = choice (right, left) :=
  sup_comm _ _

theorem choice_idem
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    choice (values, values) = values :=
  sup_idem _

theorem deadlock_choice
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    choice (⊥, values) = values := by
  change (⊥ : ScottPower α) ⊔ values = values
  simp

/-! ## Continuous unseparated flattening -/

/--
The actual set of inner closed computations represented by an outer
Scott-closed family.
-/
def memberSet
    {α : Type u} [Preorder α]
    (family : ScottPower (ScottPower α)) :
    Set (ScottPower α) :=
  WithScott.ofScott '' carrier family

@[simp]
theorem mem_memberSet_iff
    {α : Type u} [Preorder α]
    (family : ScottPower (ScottPower α))
    (values : ScottPower α) :
    values ∈ memberSet family ↔
      WithScott.toScott values ∈ carrier family := by
  constructor
  · rintro ⟨scottValues, member, equality⟩
    simpa [← equality] using member
  · intro member
    exact
      ⟨WithScott.toScott values, member,
        WithScott.ofScott_toScott values⟩

/--
Flattening takes the complete-lattice supremum of all inner computations in
the family.
-/
def flattenRaw
    {α : Type u} [Preorder α]
    (family : ScottPower (ScottPower α)) :
    ScottPower α :=
  sSup (memberSet family)

/--
Flattening is left adjoint to principal ideal formation.
-/
theorem flattenRaw_le_iff
    {α : Type u} [Preorder α]
    (family : ScottPower (ScottPower α))
    (bound : ScottPower α) :
    flattenRaw family ≤ bound ↔
      family ≤ principalRaw bound := by
  constructor
  · intro flattenedLe value valueMember
    change WithScott.ofScott value ≤ bound
    exact
      le_trans
        (le_sSup
          ((mem_memberSet_iff family
            (WithScott.ofScott value)).2 valueMember))
        flattenedLe
  · intro familyLe
    apply sSup_le
    intro values valuesMember
    have member :
        WithScott.toScott values ∈ carrier family :=
      (mem_memberSet_iff family values).1 valuesMember
    exact familyLe member

theorem flattenRaw_monotone
    {α : Type u} [Preorder α] :
    Monotone
      (flattenRaw :
        ScottPower (ScottPower α) → ScottPower α) := by
  intro left right ordered
  apply (flattenRaw_le_iff left (flattenRaw right)).2
  exact le_trans ordered
    ((flattenRaw_le_iff right (flattenRaw right)).1 le_rfl)

/-- Flattening as an order homomorphism. -/
def flattenOrderHom
    {α : Type u} [Preorder α] :
    ScottPower (ScottPower α) →o ScottPower α where
  toFun := flattenRaw
  monotone' := flattenRaw_monotone

/--
The adjunction makes unseparated flattening preserve every omega-chain
supremum.
-/
theorem flattenRaw_map_omegaSup
    {α : Type u} [Preorder α]
    (chain : Chain (ScottPower (ScottPower α))) :
    flattenRaw (ωSup chain) =
      ωSup (chain.map flattenOrderHom) := by
  change
    flattenRaw (⨆ index, chain index) =
      ⨆ index, flattenRaw (chain index)
  exact
    (show
      GaloisConnection
        (flattenRaw :
          ScottPower (ScottPower α) → ScottPower α)
        (principalRaw :
          ScottPower α → ScottPower (ScottPower α))
      from fun family bound =>
        flattenRaw_le_iff family bound).l_iSup

/-- Unseparated flattening is a genuine continuous map. -/
def flatten
    {α : Type u} [Preorder α] :
    scottPowerCpo (ScottPower α) ⟶ scottPowerCpo α where
  toFun := flattenRaw
  monotone' := flattenRaw_monotone
  map_ωSup' := flattenRaw_map_omegaSup

/-- Principal-family flattening is the left unit equation. -/
theorem flattenRaw_principal
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    flattenRaw (principalRaw values) = values := by
  apply le_antisymm
  · exact
      (flattenRaw_le_iff
        (principalRaw values) values).2 le_rfl
  · apply le_sSup
    apply (mem_memberSet_iff
      (α := α)
      (principalRaw (α := ScottPower α) values) values).2
    change values ≤ values
    exact le_rfl

@[simp]
theorem flatten_principal
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    flatten (principalRaw values) = values :=
  flattenRaw_principal values

/-! ## Scott-continuous direct image -/

/--
Scott closure of direct image.  The continuity proof below requires the
underlying map to be continuous for the full Scott topologies.
-/
def mapRaw
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β) :
    ScottPower α → ScottPower β :=
  fun values =>
    TopologicalSpace.Closeds.closure
      (function '' carrier values)

/-- Closed preimage along a full Scott-continuous function. -/
def preimage
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β)
    (continuous : Continuous function)
    (values : ScottPower β) :
    ScottPower α :=
  values.preimage continuous

/-- Scott-closed direct image is left adjoint to closed preimage. -/
theorem mapRaw_le_iff
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β)
    (continuous : Continuous function)
    (values : ScottPower α)
    (bound : ScottPower β) :
    mapRaw function values ≤ bound ↔
      values ≤ preimage function continuous bound := by
  change
    TopologicalSpace.Closeds.closure
        (function '' carrier values) ≤ bound ↔
      values ≤ bound.preimage continuous
  rw [TopologicalSpace.Closeds.closure_le]
  constructor
  · intro imageSubset source sourceMember
    exact imageSubset ⟨source, sourceMember, rfl⟩
  · rintro preimageSubset target ⟨source, sourceMember, rfl⟩
    exact preimageSubset sourceMember

theorem mapRaw_monotone
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β)
    (continuous : Continuous function) :
    Monotone (mapRaw function) := by
  intro left right ordered
  apply (mapRaw_le_iff function continuous
    left (mapRaw function right)).2
  exact le_trans ordered
    ((mapRaw_le_iff function continuous
      right (mapRaw function right)).1 le_rfl)

/-- Full Scott-continuous direct image as an order homomorphism. -/
def mapOrderHom
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β)
    (continuous : Continuous function) :
    ScottPower α →o ScottPower β where
  toFun := mapRaw function
  monotone' := mapRaw_monotone function continuous

/--
Scott-closed direct image preserves omega-chain suprema because it is a left
adjoint.
-/
theorem mapRaw_map_omegaSup
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β)
    (continuous : Continuous function)
    (chain : Chain (ScottPower α)) :
    mapRaw function (ωSup chain) =
      ωSup (chain.map (mapOrderHom function continuous)) := by
  change
    mapRaw function (⨆ index, chain index) =
      ⨆ index, mapRaw function (chain index)
  exact
    (show
      GaloisConnection
        (mapRaw function : ScottPower α → ScottPower β)
        (preimage function continuous)
      from fun values bound =>
        mapRaw_le_iff function continuous values bound).l_iSup

/-- Direct image along a full Scott-continuous map is omega-continuous. -/
def map
    {α β : Type u} [Preorder α] [Preorder β]
    (function : WithScott α → WithScott β)
    (continuous : Continuous function) :
    scottPowerCpo α ⟶ scottPowerCpo β where
  toFun := mapRaw function
  monotone' := mapRaw_monotone function continuous
  map_ωSup' := mapRaw_map_omegaSup function continuous

theorem mapRaw_id
    {α : Type u} [Preorder α]
    (values : ScottPower α) :
    mapRaw id values = values := by
  apply TopologicalSpace.Closeds.ext
  change closure (id '' carrier values) = carrier values
  rw [image_id]
  change closure (↑values : Set (WithScott α)) = ↑values
  exact values.isClosed.closure_eq

theorem mapRaw_comp
    {α β γ : Type u}
    [Preorder α] [Preorder β] [Preorder γ]
    (first : WithScott α → WithScott β)
    (second : WithScott β → WithScott γ)
    (_firstContinuous : Continuous first)
    (secondContinuous : Continuous second)
    (values : ScottPower α) :
    mapRaw second (mapRaw first values) =
      mapRaw (second ∘ first) values := by
  apply TopologicalSpace.Closeds.ext
  apply Subset.antisymm
  · apply closure_minimal
    · rintro target ⟨middle, middleMember, rfl⟩
      have closedPreimage :
          IsClosed
            (second ⁻¹'
              closure ((second ∘ first) '' carrier values)) :=
        isClosed_closure.preimage secondContinuous
      apply
        (closure_minimal
          (s := first '' carrier values)
          (t :=
            second ⁻¹'
              closure ((second ∘ first) '' carrier values))
          ?_ closedPreimage)
        middleMember
      rintro image ⟨source, sourceMember, rfl⟩
      exact
        subset_closure
          ⟨source, sourceMember, rfl⟩
    · exact isClosed_closure
  · apply closure_minimal
    · rintro target ⟨source, sourceMember, rfl⟩
      apply subset_closure
      exact
        ⟨first source,
          subset_closure
            ⟨source, sourceMember, rfl⟩,
          rfl⟩
    · exact isClosed_closure

/-!
The declarations above deliberately accept a topological `Continuous`
hypothesis for the full Scott topology.  A mathlib `ContinuousHom` between
arbitrary omega-CPOs supplies only omega-Scott continuity, which is not the
same theorem in general.  Consequently these laws do not yet define an
endofunctor on all of `ωCPO`.
-/

/-! ## Separated nullaries and the strict multiplication no-go -/

/-- Add one fresh divergence below all Scott-closed computations. -/
abbrev SeparatedScottPower
    (α : Type u) [Preorder α] :=
  WithBot (ScottPower α)

def divergence
    (α : Type u) [Preorder α] :
    SeparatedScottPower α :=
  ⊥

def deadlock
    (α : Type u) [Preorder α] :
    SeparatedScottPower α :=
  (↑(⊥ : ScottPower α) : SeparatedScottPower α)

theorem divergence_ne_deadlock
    (α : Type u) [Preorder α] :
    divergence α ≠ deadlock α := by
  simp [divergence, deadlock]

/-- The separated carrier is itself an omega-CPO. -/
abbrev separatedScottPowerCpo
    (α : Type u) [Preorder α] :
    ωCPO :=
  ωCPO.of (SeparatedScottPower α)

/-- Separated principal return at the value level. -/
def separatedPrincipalRaw
    {α : Type u} [Preorder α]
    (value : α) :
    SeparatedScottPower α :=
  ↑(principalRaw value)

/-- Embedding nondivergent Scott computations above the fresh bottom. -/
def embedOrderHom
    {α : Type u} [Preorder α] :
    ScottPower α →o SeparatedScottPower α where
  toFun values := ↑values
  monotone' := by
    intro left right ordered
    exact WithBot.coe_le_coe.mpr ordered

/-- The nondivergent embedding preserves omega-chain suprema. -/
theorem embedOrderHom_map_omegaSup
    {α : Type u} [Preorder α]
    (chain : Chain (ScottPower α)) :
    (↑(ωSup chain) : SeparatedScottPower α) =
      ωSup (chain.map embedOrderHom) := by
  change
    (↑(⨆ index, chain index) :
      WithBot (ScottPower α)) =
      ⨆ index, (↑(chain index) : WithBot (ScottPower α))
  exact WithBot.coe_iSup (OrderTop.bddAbove _)

/-- The nondivergent embedding as a continuous map. -/
def embed
    {α : Type u} [Preorder α] :
    scottPowerCpo α ⟶ separatedScottPowerCpo α where
  toFun values := ↑values
  monotone' := embedOrderHom.monotone
  map_ωSup' := embedOrderHom_map_omegaSup

/--
Scott-closed principal return remains continuous after adding the fresh
outer divergence.
-/
def separatedPrincipal
    {α : Type u} [OmegaCompletePartialOrder α] :
    ωCPO.of α ⟶ separatedScottPowerCpo α :=
  embed.comp principal

@[simp]
theorem separatedPrincipal_apply
    {α : Type u} [OmegaCompletePartialOrder α]
    (value : α) :
    separatedPrincipal value = separatedPrincipalRaw value :=
  rfl

/--
Every separated principal family contains outer divergence, since it is a
lower set and outer divergence is least.
-/
theorem divergence_mem_principal
    {α : Type u} [Preorder α]
    (value : SeparatedScottPower α) :
    WithScott.toScott (divergence α) ∈
      carrier (principalRaw value) := by
  change divergence α ≤ value
  exact bot_le

/--
No separated flattening can simultaneously be strict on every embedded
family containing divergence and satisfy the principal unit equation.

This is the exact obstruction for the tempting `WithBot` multiplication; it
does not rule out other powerdomain constructions with different treatment
of divergence.
-/
theorem no_strict_separated_flatten_with_principal_unit
    (α : Type u) [PartialOrder α] :
    ¬ ∃ flatten :
        SeparatedScottPower (SeparatedScottPower α) →
          SeparatedScottPower α,
      (∀ family : ScottPower (SeparatedScottPower α),
          WithScott.toScott (divergence α) ∈ carrier family →
          flatten
              (↑family :
                SeparatedScottPower (SeparatedScottPower α)) =
            divergence α) ∧
      (∀ value : SeparatedScottPower α,
          flatten (separatedPrincipalRaw value) = value) := by
  rintro ⟨flatten, strictOnContainedDivergence, principalUnit⟩
  have contains :=
    divergence_mem_principal (deadlock α)
  have strictAtDeadlock :=
    strictOnContainedDivergence
      (principalRaw (deadlock α)) contains
  change
    flatten (separatedPrincipalRaw (deadlock α)) =
      divergence α
      at strictAtDeadlock
  have unitAtDeadlock :=
    principalUnit (deadlock α)
  have impossible : divergence α = deadlock α :=
    strictAtDeadlock.symm.trans unitAtDeadlock
  exact divergence_ne_deadlock α impossible

end Cantilune.Pi.FMSCpoScottClosedPower
