import Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

/-!
Kernel regression checks for local continuity of the unseparated omega-Scott
lower/Hoare power functor.  These checks do not assert separation, a recursive
domain solution, adequacy, or full abstraction.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottLocallyContinuous

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

universe u

example
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (functions : Chain (α →𝒄 β))
    (values : OmegaScottPower α) :
    mapRaw (ωSup functions) values =
      ωSup (mapRawFunctionChain functions values) :=
  mapRaw_function_omegaSup functions values

example
    (source target : ωCPO.{u}) :
    ContinuousHom source target →𝒄
      ContinuousHom
        (omegaScottPowerFunctor.obj source)
        (omegaScottPowerFunctor.obj target) :=
  omegaScottPowerMapHomContinuous source target

example :
    EndofunctorLocallyContinuous
      pointwiseOmegaScottPowerFunctor :=
  pointwiseOmegaScottPowerLocallyContinuous

example :
    EndofunctorLocallyContinuous
      (actionFunctor ⋙
        pointwiseOmegaScottPowerFunctor) :=
  actionThenOmegaScottPowerLocallyContinuous

end Cantilune.Tests.FMSCpoOmegaScottLocallyContinuous
