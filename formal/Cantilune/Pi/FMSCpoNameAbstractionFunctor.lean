import Cantilune.Pi.FMSCpoInputTransport

/-!
# The genuine FMS name-abstraction endofunctor on `ωCPO^I`

This module constructs the exact functor

`B X (n) = X(n)^Fin n × X(n + 1)`

on the actual finite-injection functor category.  Its world action uses the
canonical old/fresh transport from `FMSCpoInputTransport`; its action on
model transformations is pointwise.  All maps are bundled
`ContinuousHom`s, and both world and model functor laws are proved.

This is the input/name-abstraction summand required by the FMS action
functor.  The finite separated coproduct assembling all action summands and
the recursive equation remain separate obligations.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNameAbstractionFunctor

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoInputTransport

/-- Carrier of the name-abstraction object at a finite world. -/
abbrev NameAbstractionCarrier
    (model : World ⥤ ωCPO)
    (world : World) :=
  (Fin world → model.obj world) ×
    model.obj (world + 1)

/-- The carrier equipped with its pointwise/product omega-CPO structure. -/
abbrev nameAbstractionCpo
    (model : World ⥤ ωCPO)
    (world : World) :
    ωCPO :=
  ωCPO.of (NameAbstractionCarrier model world)

/--
One target-name component of the known continuation, bundled as a
continuous map from the complete abstraction carrier.
-/
def inputKnownContinuous
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target) :
    OmegaCompletePartialOrder.ContinuousHom
      (NameAbstractionCarrier model source)
      (model.obj target) :=
  if oldWitness :
      ∃ old : Fin source,
        homToFun injection old = name
  then
    (model.map injection).comp
      (ContinuousHom.ofFun
        (fun abstraction :
            NameAbstractionCarrier model source =>
          abstraction.1
            (Classical.choose oldWitness)))
  else
    (model.map
      (extendByName injection name oldWitness)).comp
        (ContinuousHom.ofFun
          (fun abstraction :
              NameAbstractionCarrier model source =>
            abstraction.2))

@[simp]
theorem inputKnownContinuous_apply
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target)
    (abstraction :
      NameAbstractionCarrier model source) :
    inputKnownContinuous model injection name
        abstraction =
      inputKnownTransport model injection
        abstraction.1 abstraction.2 name := by
  rw [inputKnownContinuous, inputKnownTransport]
  split_ifs <;> rfl

/-- World-injection action of the name-abstraction object. -/
def worldMap
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    nameAbstractionCpo model source ⟶
      nameAbstractionCpo model target where
  toFun abstraction :=
    (fun name =>
      inputKnownContinuous model injection name
        abstraction,
     model.map
      (Cantilune.Pi.FMSCpoWorld.successorWorld.map
        injection)
      abstraction.2)
  monotone' := by
    intro lower upper ordered
    constructor
    · intro name
      exact
        (inputKnownContinuous model injection name).monotone
          ordered
    · exact
        (model.map
          (Cantilune.Pi.FMSCpoWorld.successorWorld.map
            injection)).monotone ordered.2
  map_ωSup' := by
    intro chain
    apply Prod.ext
    · funext name
      exact
        (inputKnownContinuous model injection name).continuous
          chain
    · exact
        (model.map
          (Cantilune.Pi.FMSCpoWorld.successorWorld.map
            injection)).continuous
          (chain.map
            (ContinuousHom.ofFun
              (fun abstraction :
                  NameAbstractionCarrier model source =>
                (show
                  model.obj
                      (Cantilune.Pi.FMSCpoWorld.successorWorld.obj
                        source)
                    from abstraction.2))))

@[simp]
theorem worldMap_apply
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (abstraction :
      NameAbstractionCarrier model source) :
    worldMap model injection abstraction =
      (inputKnownTransport model injection
          abstraction.1 abstraction.2,
       model.map
        (Cantilune.Pi.FMSCpoWorld.successorWorld.map
          injection)
        abstraction.2) := by
  apply Prod.ext
  · funext name
    exact inputKnownContinuous_apply
      model injection name abstraction
  · rfl

/-- The covariant finite-world name-abstraction object of one model. -/
def nameAbstractionObject
    (model : World ⥤ ωCPO) :
    World ⥤ ωCPO where
  obj world := nameAbstractionCpo model world
  map injection := worldMap model injection
  map_id world := by
    apply ContinuousHom.ext
    intro abstraction
    change
      worldMap model (𝟙 world) abstraction =
        abstraction
    rw [worldMap_apply]
    apply Prod.ext
    · exact inputKnownTransport_identity
        model world abstraction.1 abstraction.2
    · simpa using
        ContinuousHom.congr_fun
          (model.map_id (world + 1))
          abstraction.2
  map_comp left right := by
    apply ContinuousHom.ext
    intro abstraction
    change
      worldMap model (left ≫ right) abstraction =
        worldMap model right
          (worldMap model left abstraction)
    rw [worldMap_apply, worldMap_apply, worldMap_apply]
    apply Prod.ext
    · exact inputKnownTransport_comp
        model left right
        abstraction.1 abstraction.2
    · rw [
        Cantilune.Pi.FMSCpoWorld.successorWorld.map_comp]
      simpa using
        ContinuousHom.congr_fun
          (model.map_comp
            (Cantilune.Pi.FMSCpoWorld.successorWorld.map
              left)
            (Cantilune.Pi.FMSCpoWorld.successorWorld.map
              right))
          abstraction.2

/-- Action of a model natural transformation at one abstraction world. -/
def modelMapComponent
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World) :
    nameAbstractionCpo source world ⟶
      nameAbstractionCpo target world where
  toFun abstraction :=
    (fun name =>
      transformation.app world
        (abstraction.1 name),
     transformation.app (world + 1)
       abstraction.2)
  monotone' := by
    intro lower upper ordered
    constructor
    · intro name
      exact
        (transformation.app world).monotone
          (ordered.1 name)
    · exact
        (transformation.app (world + 1)).monotone
          ordered.2
  map_ωSup' := by
    intro chain
    apply Prod.ext
    · funext name
      exact
        (transformation.app world).continuous
          (chain.map
            (ContinuousHom.ofFun
              (fun abstraction :
                  NameAbstractionCarrier source world =>
                abstraction.1 name)))
    · exact
        (transformation.app (world + 1)).continuous
          (chain.map
            (ContinuousHom.ofFun
              (fun abstraction :
                  NameAbstractionCarrier source world =>
                abstraction.2)))

@[simp]
theorem modelMapComponent_apply
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (abstraction :
      NameAbstractionCarrier source world) :
    modelMapComponent transformation world abstraction =
      (fun name =>
          transformation.app world
            (abstraction.1 name),
       transformation.app (world + 1)
         abstraction.2) :=
  rfl

/-- The model-map components form a genuine natural transformation. -/
def nameAbstractionMap
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target) :
    nameAbstractionObject source ⟶
      nameAbstractionObject target where
  app world :=
    modelMapComponent transformation world
  naturality := by
    intro first second injection
    apply ContinuousHom.ext
    intro abstraction
    change
      modelMapComponent transformation second
          (worldMap source injection abstraction) =
        worldMap target injection
          (modelMapComponent transformation first
            abstraction)
    rw [worldMap_apply, worldMap_apply]
    simp only [modelMapComponent_apply]
    apply Prod.ext
    · funext name
      exact
        (inputKnownTransport_model_natural
          transformation injection
          abstraction.1 abstraction.2 name).symm
    · exact
        ContinuousHom.congr_fun
          (transformation.naturality
            (Cantilune.Pi.FMSCpoWorld.successorWorld.map
              injection))
          abstraction.2

/--
The genuine FMS name-abstraction endofunctor on the actual functor category
`World ⥤ ωCPO`.
-/
def nameAbstractionFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) where
  obj := nameAbstractionObject
  map := nameAbstractionMap
  map_id model := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro abstraction
    apply Prod.ext <;> rfl
  map_comp first second := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro abstraction
    apply Prod.ext <;> rfl

@[simp]
theorem nameAbstractionFunctor_obj
    (model : World ⥤ ωCPO)
    (world : World) :
    (nameAbstractionFunctor.obj model).obj world =
      nameAbstractionCpo model world :=
  rfl

@[simp]
theorem nameAbstractionFunctor_map_apply
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (abstraction :
      NameAbstractionCarrier source world) :
    (nameAbstractionFunctor.map transformation).app world
        abstraction =
      (fun name =>
          transformation.app world
            (abstraction.1 name),
       transformation.app (world + 1)
         abstraction.2) :=
  rfl

end Cantilune.Pi.FMSCpoNameAbstractionFunctor
