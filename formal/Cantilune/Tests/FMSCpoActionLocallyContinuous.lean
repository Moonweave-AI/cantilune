import Cantilune.Pi.FMSCpoActionLocallyContinuous

/-!
Kernel regression checks for local continuity of the exact action functor.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoActionLocallyContinuous

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoActionLocallyContinuous

example :
    EndofunctorLocallyContinuous actionFunctor :=
  actionFunctorLocallyContinuous

example
    {source target : World ⥤ ωCPO}
    {first second : source ⟶ target}
    (ordered : TransformationPointwiseLE first second) :
    TransformationPointwiseLE
      (actionFunctor.map first)
      (actionFunctor.map second) :=
  actionFunctor_map_monotone ordered

example
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (action : (actionFunctor.obj source).obj world) :
    (actionFunctor.map chain.supremum).app world action =
      OmegaCompletePartialOrder.ωSup
        (mappedActionChain chain world action) :=
  actionFunctor_map_omegaSup chain world action

end Cantilune.Tests.FMSCpoActionLocallyContinuous
