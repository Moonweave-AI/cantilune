import Cantilune.Pi.FMSCpoInputTransport

/-!
Kernel regression checks for the canonical FMS input transport.
-/

namespace Cantilune.Tests.FMSCpoInputTransport

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoInputTransport

example
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin source → model.obj source)
    (fresh : model.obj (source + 1))
    (old : Fin source) :
    inputKnownTransport model injection known fresh
        (homToFun injection old) =
      model.map injection (known old) :=
  inputKnownTransport_old
    model injection known fresh old

example
    {source target : World}
    (injection : source ⟶ target)
    (newName : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName) :
    ∃! extension : source + 1 ⟶ target,
      (∀ old : Fin source,
        homToFun extension (Fin.castSucc old) =
          homToFun injection old) ∧
      homToFun extension (Fin.last source) = newName :=
  exists_unique_fresh_extension
    injection newName outside

example
    {sourceModel targetModel : World ⥤ ωCPO}
    (transformation : sourceModel ⟶ targetModel)
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin source → sourceModel.obj source)
    (fresh : sourceModel.obj (source + 1))
    (name : Fin target) :
    inputKnownTransport targetModel injection
        (fun old => transformation.app source (known old))
        (transformation.app (source + 1) fresh)
        name =
      transformation.app target
        (inputKnownTransport sourceModel injection
          known fresh name) :=
  inputKnownTransport_model_natural
    transformation injection known fresh name

example
    (model : World ⥤ ωCPO)
    (world : World)
    (known : Fin world → model.obj world)
    (fresh : model.obj (world + 1)) :
    inputKnownTransport model (𝟙 world)
        known fresh =
      known :=
  inputKnownTransport_identity
    model world known fresh

example
    (model : World ⥤ ωCPO)
    {first second third : World}
    (left : first ⟶ second)
    (right : second ⟶ third)
    (known : Fin first → model.obj first)
    (fresh : model.obj (first + 1)) :
    inputKnownTransport model (left ≫ right)
        known fresh =
      inputKnownTransport model right
        (inputKnownTransport model left known fresh)
        (model.map
          (Cantilune.Pi.FMSCpoWorld.successorWorld.map left)
          fresh) :=
  inputKnownTransport_comp
    model left right known fresh

end Cantilune.Tests.FMSCpoInputTransport
