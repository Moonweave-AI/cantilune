import Cantilune.Pi.FMSCpoOmegaScottPower

/-!
# Cartesian strength for the omega-Scott lower monad

This file studies the cartesian product operation on the unseparated
omega-Scott closed-set monad.  The construction remains lower/Hoare-style:
the empty closed set is both the least computation and the empty result.
Consequently none of the results below supplies the divergence/deadlock
separation or free pointed-semilattice fields of `CpoPowerdomainPackage`.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottStrength

open CategoryTheory
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSCpoOmegaScottPower

universe u

/-! ## Continuous pairing maps -/

def pairLeft
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : α) :
    β →𝒄 α × β :=
  ContinuousHom.ofFun fun right => (left, right)

def pairRight
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (right : β) :
    α →𝒄 α × β :=
  ContinuousHom.ofFun fun left => (left, right)

def productMap
    {α β γ δ : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    [OmegaCompletePartialOrder δ]
    (leftMap : α →𝒄 γ)
    (rightMap : β →𝒄 δ) :
    α × β →𝒄 γ × δ :=
  ContinuousHom.ofFun fun pair =>
    (leftMap pair.1, rightMap pair.2)

def swapMap
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    α × β →𝒄 β × α :=
  ContinuousHom.ofFun fun pair => (pair.2, pair.1)

def associatorMap
    {α β γ : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ] :
    (α × β) × γ →𝒄 α × (β × γ) :=
  ContinuousHom.ofFun fun value =>
    (value.1.1, (value.1.2, value.2))

/-! ## Closed cartesian product -/

/--
Independent lower computations pair by cartesian product of their closed
carriers.  This carrier is again lower and closed under omega-chain suprema.
-/
def fubiniRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : OmegaScottPower α)
    (right : OmegaScottPower β) :
    OmegaScottPower (α × β) :=
  ⟨carrier left ×ˢ carrier right, by
    apply
      isClosed_iff_isLowerSet_and_chainSupClosed.mpr
    constructor
    · intro upper lower ordered member
      exact
        ⟨isLowerSet left ordered.1 member.1,
          isLowerSet right ordered.2 member.2⟩
    · rintro _ ⟨chain, rfl⟩ members _ _ limit isLimit
      have limitEq : limit = ωSup chain :=
        OmegaCompletePartialOrder.ωSup_eq_of_isLUB isLimit
      subst limit
      constructor
      · change
          WithOmegaScott.toOmegaScott
              (ωSup (chain.map OrderHom.fst)) ∈
            carrier left
        apply omegaSup_mem left
        intro index
        exact (members ⟨index, rfl⟩).1
      · change
          WithOmegaScott.toOmegaScott
              (ωSup (chain.map OrderHom.snd)) ∈
            carrier right
        apply omegaSup_mem right
        intro index
        exact (members ⟨index, rfl⟩).2⟩

@[simp]
theorem mem_fubiniRaw_iff
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : OmegaScottPower α)
    (right : OmegaScottPower β)
    (value : α × β) :
    WithOmegaScott.toOmegaScott value ∈
        carrier (fubiniRaw left right) ↔
      WithOmegaScott.toOmegaScott value.1 ∈ carrier left ∧
        WithOmegaScott.toOmegaScott value.2 ∈ carrier right :=
  Iff.rfl

theorem fubiniRaw_monotone
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    Monotone
      (fun pair :
          OmegaScottPower α × OmegaScottPower β =>
        fubiniRaw pair.1 pair.2) := by
  intro left right ordered value member
  exact
    ⟨ordered.1 member.1, ordered.2 member.2⟩

def fubiniOrderHom
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    OmegaScottPower α × OmegaScottPower β →o
      OmegaScottPower (α × β) where
  toFun pair := fubiniRaw pair.1 pair.2
  monotone' := fubiniRaw_monotone

theorem fubiniRaw_map_omegaSup
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain :
      Chain
        (OmegaScottPower α × OmegaScottPower β)) :
    fubiniRaw (ωSup chain).1 (ωSup chain).2 =
      ωSup (chain.map fubiniOrderHom) := by
  let leftChain : Chain (OmegaScottPower α) :=
    chain.map OrderHom.fst
  let rightChain : Chain (OmegaScottPower β) :=
    chain.map OrderHom.snd
  let target : OmegaScottPower (α × β) :=
    ωSup (chain.map fubiniOrderHom)
  apply le_antisymm
  · intro value valueMember
    have leftMember :
        value.1 ∈ carrier (ωSup leftChain) := by
      exact valueMember.1
    have rightMember :
        value.2 ∈ carrier (ωSup rightChain) := by
      exact valueMember.2
    have stageWithRightSup :
        ∀ (index : ℕ)
          (leftValue : WithOmegaScott α),
          leftValue ∈ carrier ((chain index).1) →
          (leftValue, value.2) ∈ carrier target := by
      intro index leftValue leftAtIndex
      have unionSubset :
          (⋃ rightIndex,
              carrier ((chain rightIndex).2)) ⊆
            omegaScottLift
                (pairLeft
                  (WithOmegaScott.ofOmegaScott leftValue)) ⁻¹'
              carrier target := by
        rintro rightValue rightInUnion
        obtain ⟨rightIndex, rightAtIndex⟩ :=
          mem_iUnion.mp rightInUnion
        have inclusion :
            fubiniRaw
                (chain (max index rightIndex)).1
                (chain (max index rightIndex)).2 ≤
              target :=
          le_ωSup
            (chain.map fubiniOrderHom)
            (max index rightIndex)
        apply inclusion
        exact
          ⟨(chain.monotone
              (le_max_left index rightIndex)).1
              leftAtIndex,
            (chain.monotone
              (le_max_right index rightIndex)).2
              rightAtIndex⟩
      have sectionClosed :
          IsClosed
            (omegaScottLift
                (pairLeft
                  (WithOmegaScott.ofOmegaScott leftValue)) ⁻¹'
              carrier target) :=
        target.isClosed.preimage
          (continuousHom_omegaScott_continuous
            (pairLeft
              (WithOmegaScott.ofOmegaScott leftValue)))
      have closureSubset :=
        closure_minimal unionSubset sectionClosed
      rw [omegaSup_eq_closure_iUnion] at rightMember
      exact closureSubset rightMember
    have unionSubset :
        (⋃ index, carrier ((chain index).1)) ⊆
          omegaScottLift
              (pairRight
                (WithOmegaScott.ofOmegaScott value.2)) ⁻¹'
            carrier target := by
      rintro leftValue leftInUnion
      obtain ⟨index, leftAtIndex⟩ :=
        mem_iUnion.mp leftInUnion
      exact stageWithRightSup index leftValue leftAtIndex
    have sectionClosed :
        IsClosed
          (omegaScottLift
              (pairRight
                (WithOmegaScott.ofOmegaScott value.2)) ⁻¹'
            carrier target) :=
      target.isClosed.preimage
        (continuousHom_omegaScott_continuous
          (pairRight
            (WithOmegaScott.ofOmegaScott value.2)))
    have closureSubset :=
      closure_minimal unionSubset sectionClosed
    rw [omegaSup_eq_closure_iUnion] at leftMember
    exact closureSubset leftMember
  · apply ωSup_le
    intro index
    apply fubiniRaw_monotone
    exact le_ωSup chain index

/-- Continuous independent pairing of two omega-Scott computations. -/
def fubini
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    ωCPO.of
        (OmegaScottPower α × OmegaScottPower β) ⟶
      omegaScottPowerCpo (α × β) where
  toFun pair := fubiniRaw pair.1 pair.2
  monotone' := fubiniRaw_monotone
  map_ωSup' := fubiniRaw_map_omegaSup

theorem fubiniRaw_natural
    {α β γ δ : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    [OmegaCompletePartialOrder δ]
    (leftMap : α →𝒄 γ)
    (rightMap : β →𝒄 δ)
    (left : OmegaScottPower α)
    (right : OmegaScottPower β) :
    mapRaw (productMap leftMap rightMap)
        (fubiniRaw left right) =
      fubiniRaw
        (mapRaw leftMap left)
        (mapRaw rightMap right) := by
  apply le_antisymm
  · apply
      (mapRaw_le_iff
        (productMap leftMap rightMap)
        (fubiniRaw left right)
        (fubiniRaw
          (mapRaw leftMap left)
          (mapRaw rightMap right))).2
    intro value member
    exact
      ⟨subset_closure
          ⟨value.1, member.1, rfl⟩,
        subset_closure
          ⟨value.2, member.2, rfl⟩⟩
  · intro value member
    let target : OmegaScottPower (γ × δ) :=
      mapRaw (productMap leftMap rightMap)
        (fubiniRaw left right)
    have sourcePairsWithRight :
        ∀ (source : WithOmegaScott α),
          source ∈ carrier left →
          (omegaScottLift leftMap source, value.2) ∈
            carrier target := by
      intro source sourceMember
      have imageSubset :
          omegaScottLift rightMap '' carrier right ⊆
            omegaScottLift
                (pairLeft
                  (WithOmegaScott.ofOmegaScott
                    (omegaScottLift leftMap source))) ⁻¹'
              carrier target := by
        rintro mappedRight
          ⟨sourceRight, sourceRightMember, rfl⟩
        exact
          subset_closure
            ⟨(source, sourceRight),
              ⟨sourceMember, sourceRightMember⟩,
              rfl⟩
      have sectionClosed :
          IsClosed
            (omegaScottLift
                (pairLeft
                  (WithOmegaScott.ofOmegaScott
                    (omegaScottLift leftMap source))) ⁻¹'
              carrier target) :=
        target.isClosed.preimage
          (continuousHom_omegaScott_continuous
            (pairLeft
              (WithOmegaScott.ofOmegaScott
                (omegaScottLift leftMap source))))
      exact
        (closure_minimal imageSubset sectionClosed)
          member.2
    have imageSubset :
        omegaScottLift leftMap '' carrier left ⊆
          omegaScottLift
              (pairRight
                (WithOmegaScott.ofOmegaScott value.2)) ⁻¹'
            carrier target := by
      rintro mappedLeft
        ⟨source, sourceMember, rfl⟩
      exact sourcePairsWithRight source sourceMember
    have sectionClosed :
        IsClosed
          (omegaScottLift
              (pairRight
                (WithOmegaScott.ofOmegaScott value.2)) ⁻¹'
            carrier target) :=
      target.isClosed.preimage
        (continuousHom_omegaScott_continuous
          (pairRight
            (WithOmegaScott.ofOmegaScott value.2)))
    exact
      (closure_minimal imageSubset sectionClosed)
        member.1

@[simp]
theorem fubiniRaw_principal
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : α) (right : β) :
    fubiniRaw (principalRaw left) (principalRaw right) =
      principalRaw (left, right) := by
  apply TopologicalSpace.Closeds.ext
  ext value
  rfl

theorem mapRaw_eq_of_image_eq
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β)
    (values : OmegaScottPower α)
    (result : OmegaScottPower β)
    (imageEq :
      omegaScottLift function '' carrier values =
        carrier result) :
    mapRaw function values = result := by
  apply TopologicalSpace.Closeds.ext
  change
    closure
        (omegaScottLift function '' carrier values) =
      carrier result
  rw [imageEq]
  exact result.isClosed.closure_eq

theorem fubiniRaw_swap
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : OmegaScottPower α)
    (right : OmegaScottPower β) :
    mapRaw swapMap (fubiniRaw left right) =
      fubiniRaw right left := by
  apply
    mapRaw_eq_of_image_eq
      swapMap (fubiniRaw left right)
      (fubiniRaw right left)
  ext value
  constructor
  · rintro ⟨source, sourceMember, rfl⟩
    exact ⟨sourceMember.2, sourceMember.1⟩
  · intro member
    exact
      ⟨(value.2, value.1),
        ⟨member.2, member.1⟩, rfl⟩

theorem fubiniRaw_associative
    {α β γ : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    (first : OmegaScottPower α)
    (second : OmegaScottPower β)
    (third : OmegaScottPower γ) :
    mapRaw associatorMap
        (fubiniRaw (fubiniRaw first second) third) =
      fubiniRaw first (fubiniRaw second third) := by
  apply
    mapRaw_eq_of_image_eq
      associatorMap
      (fubiniRaw (fubiniRaw first second) third)
      (fubiniRaw first (fubiniRaw second third))
  ext value
  constructor
  · rintro ⟨source, sourceMember, rfl⟩
    exact
      ⟨sourceMember.1.1,
        sourceMember.1.2, sourceMember.2⟩
  · intro member
    exact
      ⟨((value.1, value.2.1), value.2.2),
        ⟨⟨member.1, member.2.1⟩,
          member.2.2⟩,
        rfl⟩

/-!
The right-oriented Fubini map is defined independently by swapping the two
computations, applying cartesian product, and swapping the result back.
-/
def rightFubiniRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : OmegaScottPower α)
    (right : OmegaScottPower β) :
    OmegaScottPower (α × β) :=
  mapRaw swapMap (fubiniRaw right left)

def rightFubini
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    ωCPO.of
        (OmegaScottPower α × OmegaScottPower β) ⟶
      omegaScottPowerCpo (α × β) :=
  (map swapMap).comp
    (fubini.comp
      (ContinuousHom.ofFun fun value =>
        (value.2, value.1)))

theorem rightFubiniRaw_eq_fubiniRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : OmegaScottPower α)
    (right : OmegaScottPower β) :
    rightFubiniRaw left right =
      fubiniRaw left right := by
  exact fubiniRaw_swap right left

theorem rightFubini_eq_fubini
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    (rightFubini :
      OmegaScottPower α × OmegaScottPower β →𝒄
        OmegaScottPower (α × β)) =
      fubini := by
  apply ContinuousHom.ext
  intro values
  exact
    rightFubiniRaw_eq_fubiniRaw
      values.1 values.2

/-! ## Tensorial strengths -/

def leftStrengthRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (value : α × OmegaScottPower β) :
    OmegaScottPower (α × β) :=
  fubiniRaw (principalRaw value.1) value.2

def leftStrengthInput
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    α × OmegaScottPower β →𝒄
      OmegaScottPower α × OmegaScottPower β where
  toFun value := (principalRaw value.1, value.2)
  monotone' := by
    intro left right ordered
    exact
      ⟨principalRaw_monotone ordered.1, ordered.2⟩
  map_ωSup' := by
    intro chain
    apply Prod.ext
    · change
        principalRaw
            (ωSup (chain.map OrderHom.fst)) =
          ωSup
            ((chain.map OrderHom.fst).map
              principalOrderHom)
      exact
        principalRaw_map_omegaSup
          (chain.map OrderHom.fst)
    · rfl

def leftStrength
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    ωCPO.of (α × OmegaScottPower β) ⟶
      omegaScottPowerCpo (α × β) :=
  fubini.comp leftStrengthInput

def rightStrengthRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (value : OmegaScottPower α × β) :
    OmegaScottPower (α × β) :=
  fubiniRaw value.1 (principalRaw value.2)

def rightStrengthInput
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    OmegaScottPower α × β →𝒄
      OmegaScottPower α × OmegaScottPower β where
  toFun value := (value.1, principalRaw value.2)
  monotone' := by
    intro left right ordered
    exact
      ⟨ordered.1, principalRaw_monotone ordered.2⟩
  map_ωSup' := by
    intro chain
    apply Prod.ext
    · rfl
    · change
        principalRaw
            (ωSup (chain.map OrderHom.snd)) =
          ωSup
            ((chain.map OrderHom.snd).map
              principalOrderHom)
      exact
        principalRaw_map_omegaSup
          (chain.map OrderHom.snd)

def rightStrength
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    ωCPO.of (OmegaScottPower α × β) ⟶
      omegaScottPowerCpo (α × β) :=
  fubini.comp rightStrengthInput

@[simp]
theorem leftStrengthRaw_principal
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : α) (right : β) :
    leftStrengthRaw (left, principalRaw right) =
      principalRaw (left, right) :=
  fubiniRaw_principal left right

@[simp]
theorem rightStrengthRaw_principal
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : α) (right : β) :
    rightStrengthRaw (principalRaw left, right) =
      principalRaw (left, right) :=
  fubiniRaw_principal left right

end Cantilune.Pi.FMSCpoOmegaScottStrength
