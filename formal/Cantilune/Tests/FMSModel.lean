import Cantilune.Pi.FMSModel

/-!
# Regression checks for the concrete functor-category models
-/

namespace Cantilune.Tests.FMSModel

open CategoryTheory
open Cantilune.Pi.FMSModel

example : Fintype.card (name.obj 3) = 3 := by
  simp

example (support : Set (Fin 2)) (value : Fin 2)
    (member : value ∈ support) :
    Fin.castSucc value ∈ allocate 2 support :=
  allocate_preserves_membership 2 support value member

example
    {source target : World} (injection : source ⟶ target)
    (left right : Set (Fin source)) :
    setAgent.map injection (left ∪ right) =
      setAgent.map injection left ∪ setAgent.map injection right :=
  parallel_natural injection left right

example
    {source target : World} (injection : source ⟶ target)
    (support : Set (Fin source)) :
    cpoAgent.map injection support =
      homToFun injection '' support :=
  cpo_map_apply injection support

example
    {source target : World} (injection : source ⟶ target)
    (chain :
      OmegaCompletePartialOrder.Chain (Set (Fin source))) :
    imageOrderHom injection
        (OmegaCompletePartialOrder.ωSup chain) =
      OmegaCompletePartialOrder.ωSup
        (chain.map (imageOrderHom injection)) :=
  image_map_ωSup injection chain

end Cantilune.Tests.FMSModel
