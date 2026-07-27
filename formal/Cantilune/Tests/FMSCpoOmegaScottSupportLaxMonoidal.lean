import Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonoidal

/-!
Kernel-facing checks for the support-lax cartesian symmetric monoidal
category and commutative monoidal lower omega-Scott monad.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottSupportLaxMonoidal

open CategoryTheory
open CategoryTheory.Functor
open Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad
open Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonoidal

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

example :
    MonoidalCategory
      (SupportLaxOmegaCpo.{u, v} Resource) :=
  inferInstance

example :
    SymmetricCategory
      (SupportLaxOmegaCpo.{u, v} Resource) :=
  inferInstance

example :
    (supportLaxPowerFunctor
      (Resource := Resource)).LaxBraided :=
  inferInstance

example :
    NatTrans.IsMonoidal
      (supportLaxPowerUnit
        (Resource := Resource)) :=
  inferInstance

example :
    NatTrans.IsMonoidal
      (supportLaxPowerMultiplication
        (Resource := Resource)) :=
  inferInstance

example :
    Nonempty
        ((supportLaxPowerFunctor
          (Resource := Resource)).LaxBraided) ∧
      NatTrans.IsMonoidal
        (supportLaxPowerUnit (Resource := Resource)) ∧
      NatTrans.IsMonoidal
        (supportLaxPowerMultiplication
          (Resource := Resource)) :=
  supportLaxPower_commutativeMonoidalMonad Resource

#print axioms supportLaxMonoidalCategory
#print axioms supportLaxSymmetricCategory
#print axioms supportLaxPowerFunctorLaxMonoidal
#print axioms supportLaxPowerFunctorLaxBraided
#print axioms supportLaxPowerUnitIsMonoidal
#print axioms supportLaxPowerMultiplicationIsMonoidal
#print axioms supportLaxPower_commutativeMonoidalMonad

end Cantilune.Tests.FMSCpoOmegaScottSupportLaxMonoidal
