import Cantilune.Pi.FMSCpoActionFunctor

/-!
Kernel regression checks for the exact action endofunctor.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoActionFunctor

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor

example :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  actionFunctor

example
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (action :
      (actionFunctor.obj model).obj source) :
    actionEquiv model target
        ((actionFunctor.obj model).map injection action) =
      mapAction model injection
        (actionEquiv model source action) :=
  actionEquiv_world_natural
    model injection action

example
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (action : (actionFunctor.obj source).obj world) :
    actionEquiv target world
        ((actionFunctor.map transformation).app world action) =
      ActionCarrier.mapModel transformation
        (actionEquiv source world action) :=
  actionEquiv_model_natural
    transformation world action

end Cantilune.Tests.FMSCpoActionFunctor
