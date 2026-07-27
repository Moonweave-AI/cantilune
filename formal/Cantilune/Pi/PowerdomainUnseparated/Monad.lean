import Cantilune.Pi.PowerdomainUnseparated.Base

/-!
# Monad structure of the verified unseparated powerdomain

This file re-exports the kernel-built omega-Scott endofunctor, unit,
multiplication, and monad laws through the Gate-7 namespace.  All maps are
continuous maps on arbitrary omega-CPOs.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower

universe u

abbrev powerObject (object : ωCPO.{u}) : ωCPO.{u} :=
  FMSCpoOmegaScottPower.powerObject object

abbrev powerMap
    {source target : ωCPO.{u}}
    (morphism : source ⟶ target) :
    powerObject source ⟶ powerObject target :=
  FMSCpoOmegaScottPower.powerMap morphism

/-- Actual all-object endofunctor. -/
abbrev unseparatedPowerFunctor :
    ωCPO.{u} ⥤ ωCPO.{u} :=
  omegaScottPowerFunctor

/-- Actual continuous unit. -/
abbrev unseparatedPowerUnit :
    𝟭 ωCPO.{u} ⟶ unseparatedPowerFunctor :=
  omegaScottPowerUnit

/-- Actual continuous multiplication. -/
abbrev unseparatedPowerMultiplication :
    unseparatedPowerFunctor ⋙ unseparatedPowerFunctor ⟶
      unseparatedPowerFunctor :=
  omegaScottPowerMultiplication

/-- Kernel-built monad on every omega-CPO. -/
abbrev unseparatedPowerMonad :
    CategoryTheory.Monad ωCPO.{u} :=
  omegaScottPowerMonad

/-- Kleisli extension defined from the actual map and multiplication. -/
def bindRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 UnseparatedPower β)
    (values : UnseparatedPower α) :
    UnseparatedPower β :=
  FMSCpoOmegaScottPower.flattenRaw
    (FMSCpoOmegaScottPower.mapRaw function values)

theorem bindRaw_principal_left
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 UnseparatedPower β)
    (value : α) :
    bindRaw function (singleton value) = function value := by
  unfold bindRaw
  rw [FMSCpoOmegaScottPower.mapRaw_principal]
  exact FMSCpoOmegaScottPower.flattenRaw_principal (function value)

theorem bindRaw_principal_right
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    bindRaw FMSCpoOmegaScottPower.principal values = values :=
  FMSCpoOmegaScottPower.flattenRaw_mapRaw_principal values

theorem multiplication_principal
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    FMSCpoOmegaScottPower.flattenRaw
        (FMSCpoOmegaScottPower.principalRaw values) =
      values :=
  FMSCpoOmegaScottPower.flattenRaw_principal values

theorem multiplication_unit_map
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (values : UnseparatedPower α) :
    FMSCpoOmegaScottPower.flattenRaw
        (FMSCpoOmegaScottPower.mapRaw
          FMSCpoOmegaScottPower.principal values) =
      values :=
  FMSCpoOmegaScottPower.flattenRaw_mapRaw_principal values

theorem multiplication_associative
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (family :
      UnseparatedPower
        (UnseparatedPower (UnseparatedPower α))) :
    FMSCpoOmegaScottPower.flattenRaw
        (FMSCpoOmegaScottPower.mapRaw
          FMSCpoOmegaScottPower.flatten family) =
      FMSCpoOmegaScottPower.flattenRaw
        (FMSCpoOmegaScottPower.flattenRaw family) :=
  FMSCpoOmegaScottPower.flattenRaw_assoc family

theorem multiplication_natural
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β)
    (family : UnseparatedPower (UnseparatedPower α)) :
    FMSCpoOmegaScottPower.flattenRaw
        (FMSCpoOmegaScottPower.mapRaw
          (FMSCpoOmegaScottPower.map function) family) =
      FMSCpoOmegaScottPower.mapRaw function
        (FMSCpoOmegaScottPower.flattenRaw family) :=
  FMSCpoOmegaScottPower.flattenRaw_mapRaw_natural function family

/-- Stable certificate that the categorical monad is inhabited. -/
theorem unseparated_monad_exists :
    Nonempty (CategoryTheory.Monad ωCPO.{u}) :=
  ⟨unseparatedPowerMonad⟩

end Cantilune.Pi.PowerdomainUnseparated
