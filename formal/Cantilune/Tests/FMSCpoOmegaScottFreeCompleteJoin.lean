import Cantilune.Pi.FMSCpoOmegaScottFreeCompleteJoin

/-!
Kernel regression checks for the complete-join universal property of the
unseparated omega-Scott lower/Hoare power construction.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottFreeCompleteJoin

open CategoryTheory
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottFreeCompleteJoin

universe u

variable
    {α T : Type u}
    [OmegaCompletePartialOrder α]
    [CompleteLattice T]

example
    (generator : α →𝒄 T)
    (values : Set (WithOmegaScott α)) :
    liftSubset generator
        (carrier
          (TopologicalSpace.Closeds.closure values :
            OmegaScottPower α)) =
      liftSubset generator values :=
  liftSubset_closure generator values

example
    (generator : α →𝒄 T)
    (value : α) :
    liftRaw generator (principalRaw value) =
      generator value :=
  liftRaw_principal generator value

example
    (generator : α →𝒄 T)
    (left right : OmegaScottPower α) :
    liftRaw generator (left ⊔ right) =
      liftRaw generator left ⊔
        liftRaw generator right :=
  liftRaw_sup generator left right

example
    (generator : α →𝒄 T) :
    omegaScottPowerCpo α ⟶ ωCPO.of T :=
  liftContinuous generator

example
    (generator : α →𝒄 T)
    (extension : sSupHom (OmegaScottPower α) T)
    (extendsGenerator :
      ∀ value : α,
        extension (principalRaw value) =
          generator value) :
    extension = liftSSupHom generator :=
  liftSSupHom_unique
    generator extension extendsGenerator

end Cantilune.Tests.FMSCpoOmegaScottFreeCompleteJoin
