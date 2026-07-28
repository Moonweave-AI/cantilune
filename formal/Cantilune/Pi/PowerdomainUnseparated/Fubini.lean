import Cantilune.Pi.PowerdomainUnseparated.Monad
import Cantilune.Pi.FMSCpoOmegaScottChosenCoherence

/-!
# Verified Fubini structure for the unseparated powerdomain

The raw Fubini carrier is Cartesian product of omega-Scott closed
computations.  The existing construction proves continuity, naturality,
symmetry, associativity, unit, multiplication, and both tensorial strengths.
This file exposes those results without adding the false claim that pairing
with bottom is strict when the other argument is non-bottom.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottChosenCoherence

universe u

abbrev fubiniRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : UnseparatedPower α)
    (right : UnseparatedPower β) :
    UnseparatedPower (α × β) :=
  FMSCpoOmegaScottStrength.fubiniRaw left right

abbrev fubini
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    ωCPO.of
        (UnseparatedPower α × UnseparatedPower β) ⟶
      unseparatedPowerCpo (α × β) :=
  FMSCpoOmegaScottStrength.fubini

@[simp]
theorem mem_fubiniRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : UnseparatedPower α)
    (right : UnseparatedPower β)
    (value : α × β) :
    WithOmegaScott.toOmegaScott value ∈
        carrier (fubiniRaw left right) ↔
      WithOmegaScott.toOmegaScott value.1 ∈ carrier left ∧
      WithOmegaScott.toOmegaScott value.2 ∈ carrier right :=
  FMSCpoOmegaScottStrength.mem_fubiniRaw_iff left right value

theorem fubiniRaw_natural
    {α β γ δ : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    [OmegaCompletePartialOrder δ]
    (leftMap : α →𝒄 γ)
    (rightMap : β →𝒄 δ)
    (left : UnseparatedPower α)
    (right : UnseparatedPower β) :
    FMSCpoOmegaScottPower.mapRaw
        (FMSCpoOmegaScottStrength.productMap leftMap rightMap)
        (fubiniRaw left right) =
      fubiniRaw
        (FMSCpoOmegaScottPower.mapRaw leftMap left)
        (FMSCpoOmegaScottPower.mapRaw rightMap right) :=
  FMSCpoOmegaScottStrength.fubiniRaw_natural
    leftMap rightMap left right

theorem fubiniRaw_principal
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : α) (right : β) :
    fubiniRaw (singleton left) (singleton right) =
      singleton (left, right) :=
  FMSCpoOmegaScottStrength.fubiniRaw_principal left right

theorem fubiniRaw_swap
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left : UnseparatedPower α)
    (right : UnseparatedPower β) :
    FMSCpoOmegaScottPower.mapRaw
        FMSCpoOmegaScottStrength.swapMap
        (fubiniRaw left right) =
      fubiniRaw right left :=
  FMSCpoOmegaScottStrength.fubiniRaw_swap left right

theorem fubiniRaw_associative
    {α β γ : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    (first : UnseparatedPower α)
    (second : UnseparatedPower β)
    (third : UnseparatedPower γ) :
    FMSCpoOmegaScottPower.mapRaw
        FMSCpoOmegaScottStrength.associatorMap
        (fubiniRaw (fubiniRaw first second) third) =
      fubiniRaw first (fubiniRaw second third) :=
  FMSCpoOmegaScottStrength.fubiniRaw_associative
    first second third

/--
Complete chosen-product certificate: naturality, unit, multiplication,
braiding, associativity, unitors, and both strengths are proof fields.
-/
abbrev strongCommutativeMonad :
    UnseparatedStrongCommutativeMonad :=
  omegaScottUnseparatedStrongCommutativeMonad

/--
The implemented *chosen-product* coherence record is inhabited. This is not
the source-level separated Abramsky/FMS powerdomain package.
-/
theorem chosenProductStrongCommutativeCertificate_exists :
    Nonempty UnseparatedStrongCommutativeMonad :=
  ⟨strongCommutativeMonad⟩

end Cantilune.Pi.PowerdomainUnseparated
