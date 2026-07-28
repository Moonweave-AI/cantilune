import Cantilune.Pi.FMSCpoOmegaScottPowerSupport

/-!
# The exact-support lower omega-Scott monad

For a fixed finite resource universe, the lower omega-Scott power construction
preserves the exact finite support carried by `SupportedOmegaCpo` morphisms.
The object, map, return, and multiplication constructions from
`FMSCpoOmegaScottPowerSupport` therefore assemble into an actual
`CategoryTheory.Monad`.

This closes the ordinary functor and monad laws for the exact-support lift.  It
does not construct a total separated Fubini map: an empty lower/Hoare
computation can erase the support of the other branch, as characterised by
`powerSupport_fubiniRaw_exact_iff`.  Consequently this monad is not claimed to
be the complete separated Abramsky/FMS powerdomain.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottSupportedMonad

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottPowerSupport

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

/-- Exact-support lower omega-Scott power as an endofunctor. -/
def supportedPowerFunctor :
    SupportedOmegaCpo.{u, v} Resource ⥤
      SupportedOmegaCpo.{u, v} Resource where
  obj := powerObject
  map := mapSupported
  map_id object := by
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact mapRaw_id values
  map_comp first second := by
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact
      (mapRaw_comp
        first.toContinuousHom
        second.toContinuousHom
        values).symm

/-- Return is a natural exact-support transformation. -/
def supportedPowerUnit :
    𝟭 (SupportedOmegaCpo.{u, v} Resource) ⟶
      supportedPowerFunctor (Resource := Resource) where
  app := principalSupported
  naturality := by
    intro source target morphism
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    exact
      (mapRaw_principal
        morphism.toContinuousHom value).symm

/-- Flattening is a natural exact-support transformation. -/
def supportedPowerMultiplication :
    supportedPowerFunctor (Resource := Resource) ⋙
        supportedPowerFunctor (Resource := Resource) ⟶
      supportedPowerFunctor (Resource := Resource) where
  app := flattenSupported
  naturality := by
    intro source target morphism
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro family
    exact
      flattenRaw_mapRaw_natural
        morphism.toContinuousHom family

/--
The genuine lower omega-Scott monad on exact finite-support omega-CPOs.

The underlying computations remain lower/Hoare closed sets.  This declaration
proves the monad structure only; commutative strength for the separated tensor
is deliberately not asserted.
-/
def supportedPowerMonad :
    CategoryTheory.Monad
      (SupportedOmegaCpo.{u, v} Resource) where
  toFunctor :=
    supportedPowerFunctor (Resource := Resource)
  η :=
    supportedPowerUnit (Resource := Resource)
  μ :=
    supportedPowerMultiplication (Resource := Resource)
  assoc object := by
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro family
    exact flattenRaw_assoc family
  left_unit object := by
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact flattenRaw_principal values
  right_unit object := by
    apply SupportedOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact flattenRaw_mapRaw_principal values

/-! ## Pointwise laws exposed without category syntax -/

@[simp]
theorem supportedPowerFunctor_map_apply
    {source target : SupportedOmegaCpo.{u, v} Resource}
    (morphism : source ⟶ target)
    (values : OmegaScottPower source.Carrier) :
    (supportedPowerFunctor.map morphism).toContinuousHom values =
      mapRaw morphism.toContinuousHom values :=
  rfl

@[simp]
theorem supportedPowerUnit_app_apply
    (object : SupportedOmegaCpo.{u, v} Resource)
    (value : object.Carrier) :
    (supportedPowerUnit.app object).toContinuousHom value =
      principalRaw value :=
  rfl

@[simp]
theorem supportedPowerMultiplication_app_apply
    (object : SupportedOmegaCpo.{u, v} Resource)
    (family :
      OmegaScottPower (OmegaScottPower object.Carrier)) :
    (supportedPowerMultiplication.app object).toContinuousHom family =
      flattenRaw family :=
  rfl

end Cantilune.Pi.FMSCpoOmegaScottSupportedMonad
