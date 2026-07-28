import Cantilune.Pi.FMSCpoOmegaScottPower

/-!
# The naive separated omega-Scott multiplication obstruction

The unseparated `OmegaScottPower` is a lower/Hoare monad on all omega-CPOs.
A tempting attempt to distinguish divergence from empty deadlock is to apply
`WithBot` outside that monad:

`T α = WithBot (OmegaScottPower α)`.

This file isolates the exact order obstruction to giving that naive
transformer a monotone multiplication with the two unit equations needed at
outer divergence and embedded empty deadlock.  It does not rule out other
powerdomains or other treatments of divergence.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottSeparatedNoGo

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower

universe u

/-- Add a fresh outer divergence to the unseparated omega-Scott power. -/
abbrev NaiveSeparatedPower
    (α : Type u) [OmegaCompletePartialOrder α] :=
  WithBot (OmegaScottPower α)

/-- The separated carrier is again an omega-CPO. -/
abbrev naiveSeparatedPowerCpo
    (α : Type u) [OmegaCompletePartialOrder α] :
    ωCPO :=
  ωCPO.of (NaiveSeparatedPower α)

/-- Fresh outer divergence. -/
def divergence
    (α : Type u) [OmegaCompletePartialOrder α] :
    NaiveSeparatedPower α :=
  ⊥

/-- Empty omega-Scott computation embedded above outer divergence. -/
def deadlock
    (α : Type u) [OmegaCompletePartialOrder α] :
    NaiveSeparatedPower α :=
  (↑(⊥ : OmegaScottPower α) : NaiveSeparatedPower α)

theorem divergence_lt_deadlock
    (α : Type u) [OmegaCompletePartialOrder α] :
    divergence α < deadlock α := by
  simp [divergence, deadlock]

theorem not_deadlock_le_divergence
    (α : Type u) [OmegaCompletePartialOrder α] :
    ¬ deadlock α ≤ divergence α := by
  simp [divergence, deadlock]

/-- Embed an unseparated computation above the fresh bottom. -/
def embedOrderHom
    {α : Type u} [OmegaCompletePartialOrder α] :
    OmegaScottPower α →o NaiveSeparatedPower α where
  toFun values := ↑values
  monotone' := by
    intro left right ordered
    exact WithBot.coe_le_coe.mpr ordered

theorem embedOrderHom_map_omegaSup
    {α : Type u} [OmegaCompletePartialOrder α]
    (chain : Chain (OmegaScottPower α)) :
    (↑(ωSup chain) : NaiveSeparatedPower α) =
      ωSup (chain.map embedOrderHom) := by
  change
    (↑(⨆ index, chain index) :
      WithBot (OmegaScottPower α)) =
      ⨆ index, (↑(chain index) :
        WithBot (OmegaScottPower α))
  exact WithBot.coe_iSup (OrderTop.bddAbove _)

/-- The nondivergent embedding is omega-continuous. -/
def embed
    {α : Type u} [OmegaCompletePartialOrder α] :
    omegaScottPowerCpo α ⟶ naiveSeparatedPowerCpo α where
  toFun values := ↑values
  monotone' := embedOrderHom.monotone
  map_ωSup' := embedOrderHom_map_omegaSup

/-- The naive separated unit. -/
def separatedPrincipal
    {α : Type u} [OmegaCompletePartialOrder α] :
    ωCPO.of α ⟶ naiveSeparatedPowerCpo α :=
  embed.comp principal

/-- Value-level form of the naive separated unit. -/
def separatedPrincipalRaw
    {α : Type u} [OmegaCompletePartialOrder α]
    (value : α) :
    NaiveSeparatedPower α :=
  ↑(principalRaw value)

@[simp]
theorem separatedPrincipal_apply
    {α : Type u} [OmegaCompletePartialOrder α]
    (value : α) :
    separatedPrincipal value = separatedPrincipalRaw value :=
  rfl

/-- The unseparated direct image sends empty deadlock to empty deadlock. -/
theorem omegaMapRaw_bot
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β) :
    mapRaw function (⊥ : OmegaScottPower α) =
      (⊥ : OmegaScottPower β) := by
  apply le_antisymm
  · exact
      (mapRaw_le_iff function
        (⊥ : OmegaScottPower α)
        (⊥ : OmegaScottPower β)).2 bot_le
  · exact bot_le

/--
The raw map of the naive transformer: preserve outer divergence and apply the
unseparated omega-Scott direct image to every embedded computation.
-/
def naiveMapRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β) :
    NaiveSeparatedPower α → NaiveSeparatedPower β :=
  WithBot.map (mapRaw function)

theorem naiveMapRaw_monotone
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β) :
    Monotone (naiveMapRaw function) :=
  Monotone.withBot_map (mapRaw_monotone function)

@[simp]
theorem naiveMapRaw_divergence
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β) :
    naiveMapRaw function (divergence α) =
      divergence β :=
  rfl

@[simp]
theorem naiveMapRaw_deadlock
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β) :
    naiveMapRaw function (deadlock α) =
      deadlock β := by
  change
    (↑(mapRaw function (⊥ : OmegaScottPower α)) :
      NaiveSeparatedPower β) =
      (↑(⊥ : OmegaScottPower β) :
        NaiveSeparatedPower β)
  rw [omegaMapRaw_bot]

/-- `T η` at embedded empty deadlock is the embedded empty outer family. -/
def embeddedEmptyFamily
    (α : Type u) [OmegaCompletePartialOrder α] :
    NaiveSeparatedPower (NaiveSeparatedPower α) :=
  (↑(⊥ : OmegaScottPower (NaiveSeparatedPower α)) :
    NaiveSeparatedPower (NaiveSeparatedPower α))

/-- `η_T` at outer divergence is the embedded principal divergence family. -/
def embeddedPrincipalDivergence
    (α : Type u) [OmegaCompletePartialOrder α] :
    NaiveSeparatedPower (NaiveSeparatedPower α) :=
  separatedPrincipalRaw (divergence α)

theorem naiveMapUnit_deadlock
    (α : Type u) [OmegaCompletePartialOrder α] :
    naiveMapRaw
        (separatedPrincipal :
          α →𝒄 NaiveSeparatedPower α)
        (deadlock α) =
      embeddedEmptyFamily α := by
  exact
    naiveMapRaw_deadlock
      (separatedPrincipal :
        α →𝒄 NaiveSeparatedPower α)

theorem unitAtDivergence_eq_embeddedPrincipalDivergence
    (α : Type u) [OmegaCompletePartialOrder α] :
    separatedPrincipalRaw (divergence α) =
      embeddedPrincipalDivergence α :=
  rfl

/--
The embedded empty family lies below the embedded principal family generated
by outer divergence.  This is the order fact that drives the obstruction.
-/
theorem embeddedEmptyFamily_le_embeddedPrincipalDivergence
    (α : Type u) [OmegaCompletePartialOrder α] :
    embeddedEmptyFamily α ≤
      embeddedPrincipalDivergence α := by
  apply WithBot.coe_le_coe.mpr
  exact bot_le

/-- Left-unit equation required at the fresh outer divergence. -/
def LeftUnitAtDivergence
    {α : Type u} [OmegaCompletePartialOrder α]
    (multiplication :
      NaiveSeparatedPower (NaiveSeparatedPower α) →
        NaiveSeparatedPower α) :
    Prop :=
  multiplication (embeddedPrincipalDivergence α) =
    divergence α

/-- Right-unit equation required at embedded empty deadlock. -/
def RightUnitAtDeadlock
    {α : Type u} [OmegaCompletePartialOrder α]
    (multiplication :
      NaiveSeparatedPower (NaiveSeparatedPower α) →
        NaiveSeparatedPower α) :
    Prop :=
  multiplication (embeddedEmptyFamily α) =
    deadlock α

/--
There is no monotone multiplication for the naive `WithBot` transformer that
satisfies both necessary unit equations.

Monotonicity maps
`embeddedEmptyFamily ≤ embeddedPrincipalDivergence` to
`deadlock ≤ divergence`, contradicting the strict outer separation.
-/
theorem no_monotone_multiplication_with_unit_equations
    (α : Type u) [OmegaCompletePartialOrder α] :
    ¬ ∃ multiplication :
        NaiveSeparatedPower (NaiveSeparatedPower α) →
          NaiveSeparatedPower α,
      Monotone multiplication ∧
      LeftUnitAtDivergence multiplication ∧
      RightUnitAtDeadlock multiplication := by
  rintro
    ⟨multiplication, monotone,
      leftUnitAtDivergence, rightUnitAtDeadlock⟩
  have impossibleOrder :
      deadlock α ≤ divergence α := by
    have mappedOrder :=
      monotone
        (embeddedEmptyFamily_le_embeddedPrincipalDivergence α)
    rw [RightUnitAtDeadlock] at rightUnitAtDeadlock
    rw [LeftUnitAtDivergence] at leftUnitAtDivergence
    exact
      rightUnitAtDeadlock ▸
        leftUnitAtDivergence ▸ mappedOrder
  exact not_deadlock_le_divergence α impossibleOrder

end Cantilune.Pi.FMSCpoOmegaScottSeparatedNoGo
