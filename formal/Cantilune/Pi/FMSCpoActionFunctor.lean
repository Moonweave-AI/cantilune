import Cantilune.Pi.FMSExternalPackage
import Cantilune.Pi.FMSCpoNameAbstractionFunctor
import Cantilune.Pi.FMSCpoSeparatedSum

/-!
# The exact finite-world FMS action endofunctor

This module assembles the four separated action summands

`N × (N ⇒ X) + N × N × X + N × δX + X`

on the actual category `World ⥤ ωCPO`.  The name-abstraction summand is the
genuine endofunctor from `FMSCpoNameAbstractionFunctor`; channel and value
tags carry equality order; the four outer constructors use separated
omega-CPO coproducts.

The resulting endofunctor is continuously and naturally equivalent, at
every carrier, to `FMSExternalPackage.ActionCarrier`.  This closes the exact
action-shape construction.  It does not construct the Abramsky powerdomain
or solve the recursive agent-domain equation.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoActionFunctor

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoInputTransport
open Cantilune.Pi.FMSCpoNameAbstractionFunctor

/-- Pointwise product of continuous maps. -/
def productMap
    {α β γ δ : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    [OmegaCompletePartialOrder δ]
    (left : α →𝒄 γ)
    (right : β →𝒄 δ) :
    (α × β) →𝒄 (γ × δ) :=
  ContinuousHom.ofFun fun value =>
    (left value.1, right value.2)

@[simp]
theorem productMap_apply
    {α β γ δ : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    [OmegaCompletePartialOrder δ]
    (left : α →𝒄 γ)
    (right : β →𝒄 δ)
    (value : α × β) :
    productMap left right value =
      (left value.1, right value.2) :=
  rfl

/-- Equality-ordered finite name tags. -/
abbrev NameTag (world : World) :=
  EqualityOrder (Fin world)

/-- Insert an ordinary finite name into the equality-ordered tag carrier. -/
def nameTag {world : World}
    (name : Fin world) :
    NameTag world :=
  name

/-- Forget the equality-order wrapper on a finite name tag. -/
def tagName {world : World}
    (tag : NameTag world) :
    Fin world :=
  tag

@[simp]
theorem tagName_nameTag
    {world : World}
    (name : Fin world) :
    tagName (nameTag name) = name :=
  rfl

@[simp]
theorem nameTag_tagName
    {world : World}
    (tag : NameTag world) :
    nameTag (tagName tag) = tag :=
  rfl

/-- Covariant action of a world injection on equality-ordered name tags. -/
def mapNameTag
    {source target : World}
    (injection : source ⟶ target)
    (tag : NameTag source) :
    NameTag target :=
  nameTag
    (homToFun injection (tagName tag))

@[simp]
theorem mapNameTag_id
    (world : World)
    (tag : NameTag world) :
    mapNameTag (𝟙 world) tag = tag := by
  exact nameTag_tagName tag

@[simp]
theorem mapNameTag_comp
    {first second third : World}
    (left : first ⟶ second)
    (right : second ⟶ third)
    (tag : NameTag first) :
    mapNameTag (left ≫ right) tag =
      mapNameTag right (mapNameTag left tag) :=
  rfl

/-- Explicit successor action on a finite-world injection. -/
def successorMap
    {source target : World}
    (injection : source ⟶ target) :
    source + 1 ⟶ target + 1 :=
  Cantilune.Pi.FMSCpoWorld.Injection.succ
    (asInjection injection)

@[simp]
theorem successorMap_id
    (world : World) :
    successorMap (𝟙 world) =
      𝟙 (world + 1) :=
  Cantilune.Pi.FMSCpoWorld.Injection.succ_identity
    world

@[simp]
theorem successorMap_comp
    {first second third : World}
    (left : first ⟶ second)
    (right : second ⟶ third) :
    successorMap (left ≫ right) =
      successorMap left ≫ successorMap right :=
  Cantilune.Pi.FMSCpoWorld.Injection.succ_comp
    left right

theorem successorMap_eq_functor_map
    {source target : World}
    (injection : source ⟶ target) :
    successorMap injection =
      Cantilune.Pi.FMSCpoWorld.successorWorld.map
        injection :=
  rfl

/--
Separated omega-CPO presentation of the four exact FMS action constructors.
-/
abbrev ActionRepresentation
    (model : World ⥤ ωCPO)
    (world : World) :=
  (NameTag world × NameAbstractionCarrier model world) ⊕
    (((NameTag world × NameTag world) × model.obj world) ⊕
      ((NameTag world × model.obj (world + 1)) ⊕
        model.obj world))

/-- The separated representation as an actual omega-CPO object. -/
abbrev actionCpo
    (model : World ⥤ ωCPO)
    (world : World) :
    ωCPO :=
  ωCPO.of (ActionRepresentation model world)

/-- Carrier conversion into the exact external action shape. -/
def toAction
    {model : World ⥤ ωCPO}
    {world : World} :
    ActionRepresentation model world →
      ActionCarrier model world
  | Sum.inl (channel, (known, fresh)) =>
      .input (tagName channel) known fresh
  | Sum.inr (Sum.inl ((channel, value), continuation)) =>
      .freeOutput
        (tagName channel) (tagName value) continuation
  | Sum.inr (Sum.inr (Sum.inl (channel, continuation))) =>
      .boundOutput (tagName channel) continuation
  | Sum.inr (Sum.inr (Sum.inr continuation)) =>
      .tau continuation

/-- Exact action shape converted to the separated representation. -/
def ofAction
    {model : World ⥤ ωCPO}
    {world : World} :
    ActionCarrier model world →
      ActionRepresentation model world
  | .input channel known fresh =>
      Sum.inl (nameTag channel, (known, fresh))
  | .freeOutput channel value continuation =>
      Sum.inr
        (Sum.inl
          ((nameTag channel, nameTag value), continuation))
  | .boundOutput channel continuation =>
      Sum.inr
        (Sum.inr
          (Sum.inl (nameTag channel, continuation)))
  | .tau continuation =>
      Sum.inr (Sum.inr (Sum.inr continuation))

/-- Exact carrier equivalence with `ActionCarrier`. -/
def actionEquiv
    (model : World ⥤ ωCPO)
    (world : World) :
    ActionRepresentation model world ≃
      ActionCarrier model world where
  toFun := toAction
  invFun := ofAction
  left_inv := by
    intro action
    rcases action with input | rest
    · rcases input with ⟨channel, known, fresh⟩
      rfl
    · rcases rest with free | rest
      · rcases free with ⟨tags, continuation⟩
        rcases tags with ⟨channel, value⟩
        rfl
      · rcases rest with bound | continuation
        · rcases bound with ⟨channel, next⟩
          rfl
        · rfl
  right_inv := by
    intro action
    cases action <;> rfl

/-- Equality-tag action along a finite injection. -/
def nameTagMap
    {source target : World}
    (injection : source ⟶ target) :
    NameTag source →𝒄 NameTag target :=
  EqualityOrder.continuous
    (mapNameTag injection)

/-- World action on the input summand. -/
def inputWorldMap
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    (NameTag source ×
        NameAbstractionCarrier model source) →𝒄
      (NameTag target ×
        NameAbstractionCarrier model target) :=
  productMap
    (nameTagMap injection)
    (FMSCpoNameAbstractionFunctor.worldMap
      model injection)

/-- World action on the free-output summand. -/
def freeOutputWorldMap
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    ((NameTag source × NameTag source) ×
        model.obj source) →𝒄
      ((NameTag target × NameTag target) ×
        model.obj target) :=
  productMap
    (productMap
      (nameTagMap injection)
      (nameTagMap injection))
    (model.map injection)

/-- World action on the bound-output summand. -/
def boundOutputWorldMap
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    (NameTag source × model.obj (source + 1)) →𝒄
      (NameTag target × model.obj (target + 1)) :=
  productMap
    (nameTagMap injection)
    (model.map
      (successorMap injection))

/-- World action on all four separated action summands. -/
def actionWorldMap
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    ActionRepresentation model source →𝒄
      ActionRepresentation model target :=
  FMSCpoSeparatedSum.map
    (inputWorldMap model injection)
    (FMSCpoSeparatedSum.map
      (freeOutputWorldMap model injection)
      (FMSCpoSeparatedSum.map
        (boundOutputWorldMap model injection)
        (model.map injection)))

@[simp]
theorem actionWorldMap_input
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (channel : NameTag source)
    (known : Fin source → model.obj source)
    (fresh : model.obj (source + 1)) :
    actionWorldMap model injection
        (Sum.inl (channel, (known, fresh))) =
      Sum.inl
        (mapNameTag injection channel,
          (inputKnownTransport model injection
            known fresh,
           model.map
            (successorMap injection)
            fresh)) := by
  unfold actionWorldMap
  rw [FMSCpoSeparatedSum.map_inl]
  apply congrArg Sum.inl
  unfold inputWorldMap
  rw [productMap_apply]
  apply Prod.ext
  · rfl
  · change
      (ConcreteCategory.hom
          (FMSCpoNameAbstractionFunctor.worldMap
            model injection))
          (known, fresh) =
        _
    apply Prod.ext
    · funext name
      exact
        FMSCpoNameAbstractionFunctor.inputKnownContinuous_apply
          model injection name (known, fresh)
    · rfl

@[simp]
theorem actionWorldMap_freeOutput
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (channel value : NameTag source)
    (continuation : model.obj source) :
    actionWorldMap model injection
        (Sum.inr
          (Sum.inl
            ((channel, value), continuation))) =
      Sum.inr
        (Sum.inl
          ((mapNameTag injection channel,
            mapNameTag injection value),
           model.map injection continuation)) := by
  unfold actionWorldMap
  rw [FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inl]
  apply congrArg Sum.inr
  apply congrArg Sum.inl
  unfold freeOutputWorldMap
  rw [productMap_apply]
  apply Prod.ext
  · rw [productMap_apply]
    apply Prod.ext <;> rfl
  · rfl

@[simp]
theorem actionWorldMap_boundOutput
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (channel : NameTag source)
    (continuation : model.obj (source + 1)) :
    actionWorldMap model injection
        (Sum.inr
          (Sum.inr
            (Sum.inl (channel, continuation)))) =
      Sum.inr
        (Sum.inr
          (Sum.inl
            (mapNameTag injection channel,
             model.map
              (successorMap injection)
              continuation))) := by
  unfold actionWorldMap
  rw [FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inl]
  apply congrArg Sum.inr
  apply congrArg Sum.inr
  apply congrArg Sum.inl
  unfold boundOutputWorldMap
  rw [productMap_apply]
  apply Prod.ext <;> rfl

@[simp]
theorem actionWorldMap_tau
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (continuation : model.obj source) :
    actionWorldMap model injection
        (Sum.inr (Sum.inr (Sum.inr continuation))) =
      Sum.inr
        (Sum.inr
          (Sum.inr
            (model.map injection continuation))) := by
  unfold actionWorldMap
  rw [FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inr]
  rfl

/-- The exact action object for one model. -/
def actionObject
    (model : World ⥤ ωCPO) :
    World ⥤ ωCPO where
  obj world := actionCpo model world
  map injection := actionWorldMap model injection
  map_id world := by
    apply ContinuousHom.ext
    intro action
    change
      actionWorldMap model (𝟙 world) action =
        action
    rcases action with input | rest
    · rcases input with ⟨channel, known, fresh⟩
      rw [actionWorldMap_input]
      apply congrArg Sum.inl
      apply Prod.ext
      · simp
      · apply Prod.ext
        · exact inputKnownTransport_identity
            model world known fresh
        · simpa using
            ContinuousHom.congr_fun
              (model.map_id (world + 1)) fresh
    · rcases rest with free | rest
      · rcases free with ⟨tags, continuation⟩
        rcases tags with ⟨channel, value⟩
        simp only [actionWorldMap_freeOutput]
        simp
      · rcases rest with bound | continuation
        · rcases bound with ⟨channel, next⟩
          simp only [actionWorldMap_boundOutput]
          simp
        · simp only [actionWorldMap_tau]
          simp
  map_comp left right := by
    apply ContinuousHom.ext
    intro action
    change
      actionWorldMap model (left ≫ right) action =
        actionWorldMap model right
          (actionWorldMap model left action)
    rcases action with input | rest
    · rcases input with ⟨channel, known, fresh⟩
      simp only [actionWorldMap_input]
      apply congrArg Sum.inl
      apply Prod.ext
      · rfl
      · apply Prod.ext
        · exact inputKnownTransport_comp
            model left right known fresh
        · rw [successorMap_comp]
          simpa using
            ContinuousHom.congr_fun
              (model.map_comp
                (successorMap left)
                (successorMap right))
              fresh
    · rcases rest with free | rest
      · rcases free with ⟨tags, continuation⟩
        rcases tags with ⟨channel, value⟩
        simp only [actionWorldMap_freeOutput]
        rw [model.map_comp]
        rfl
      · rcases rest with bound | continuation
        · rcases bound with ⟨channel, next⟩
          simp only [actionWorldMap_boundOutput]
          rw [successorMap_comp]
          apply congrArg Sum.inr
          apply congrArg Sum.inr
          apply congrArg Sum.inl
          apply Prod.ext
          · rfl
          · exact
              ContinuousHom.congr_fun
                (model.map_comp
                  (successorMap left)
                  (successorMap right))
                next
        · simp only [actionWorldMap_tau]
          rw [model.map_comp]
          rfl

/-- Identity continuous map on an equality-ordered tag. -/
def nameTagIdentity
    (world : World) :
    NameTag world →𝒄 NameTag world :=
  EqualityOrder.continuous id

/-- Model transformation on the input summand. -/
def inputModelMap
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World) :
    (NameTag world ×
        NameAbstractionCarrier source world) →𝒄
      (NameTag world ×
        NameAbstractionCarrier target world) :=
  productMap
    (nameTagIdentity world)
    (FMSCpoNameAbstractionFunctor.modelMapComponent
      transformation world)

/-- Model transformation on the free-output summand. -/
def freeOutputModelMap
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World) :
    ((NameTag world × NameTag world) ×
        source.obj world) →𝒄
      ((NameTag world × NameTag world) ×
        target.obj world) :=
  productMap
    (productMap
      (nameTagIdentity world)
      (nameTagIdentity world))
    (transformation.app world)

/-- Model transformation on the bound-output summand. -/
def boundOutputModelMap
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World) :
    (NameTag world × source.obj (world + 1)) →𝒄
      (NameTag world × target.obj (world + 1)) :=
  productMap
    (nameTagIdentity world)
    (transformation.app (world + 1))

/-- Model transformation on all four separated action summands. -/
def actionModelMapComponent
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World) :
    ActionRepresentation source world →𝒄
      ActionRepresentation target world :=
  FMSCpoSeparatedSum.map
    (inputModelMap transformation world)
    (FMSCpoSeparatedSum.map
      (freeOutputModelMap transformation world)
      (FMSCpoSeparatedSum.map
        (boundOutputModelMap transformation world)
        (transformation.app world)))

@[simp]
theorem actionModelMap_input
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (channel : NameTag world)
    (known : Fin world → source.obj world)
    (fresh : source.obj (world + 1)) :
    actionModelMapComponent transformation world
        (Sum.inl (channel, (known, fresh))) =
      Sum.inl
        (channel,
          (fun name =>
            transformation.app world (known name),
           transformation.app (world + 1) fresh)) := by
  unfold actionModelMapComponent
  rw [FMSCpoSeparatedSum.map_inl]
  apply congrArg Sum.inl
  unfold inputModelMap
  rw [productMap_apply]
  apply Prod.ext
  · rfl
  · exact
      FMSCpoNameAbstractionFunctor.modelMapComponent_apply
        transformation world (known, fresh)

@[simp]
theorem actionModelMap_freeOutput
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (channel value : NameTag world)
    (continuation : source.obj world) :
    actionModelMapComponent transformation world
        (Sum.inr
          (Sum.inl
            ((channel, value), continuation))) =
      Sum.inr
        (Sum.inl
          ((channel, value),
            transformation.app world continuation)) := by
  unfold actionModelMapComponent
  rw [FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inl]
  apply congrArg Sum.inr
  apply congrArg Sum.inl
  unfold freeOutputModelMap
  rw [productMap_apply]
  apply Prod.ext
  · rw [productMap_apply]
    apply Prod.ext <;> rfl
  · rfl

@[simp]
theorem actionModelMap_boundOutput
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (channel : NameTag world)
    (continuation : source.obj (world + 1)) :
    actionModelMapComponent transformation world
        (Sum.inr
          (Sum.inr
            (Sum.inl (channel, continuation)))) =
      Sum.inr
        (Sum.inr
          (Sum.inl
            (channel,
              transformation.app (world + 1)
                continuation))) := by
  unfold actionModelMapComponent
  rw [FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inl]
  apply congrArg Sum.inr
  apply congrArg Sum.inr
  apply congrArg Sum.inl
  unfold boundOutputModelMap
  rw [productMap_apply]
  apply Prod.ext <;> rfl

@[simp]
theorem actionModelMap_tau
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (continuation : source.obj world) :
    actionModelMapComponent transformation world
        (Sum.inr (Sum.inr (Sum.inr continuation))) =
      Sum.inr
        (Sum.inr
          (Sum.inr
            (transformation.app world continuation))) := by
  unfold actionModelMapComponent
  rw [FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inr,
    FMSCpoSeparatedSum.map_inr]
  rfl

/-- Model transformation on exact action objects. -/
def actionMap
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target) :
    actionObject source ⟶ actionObject target where
  app world :=
    actionModelMapComponent transformation world
  naturality := by
    intro first second injection
    apply ContinuousHom.ext
    intro action
    change
      actionModelMapComponent transformation second
          (actionWorldMap source injection action) =
        actionWorldMap target injection
          (actionModelMapComponent transformation first
            action)
    rcases action with input | rest
    · rcases input with ⟨channel, known, fresh⟩
      simp only [
        actionWorldMap_input,
        actionModelMap_input]
      apply congrArg Sum.inl
      apply Prod.ext
      · rfl
      · apply Prod.ext
        · funext name
          exact
            (inputKnownTransport_model_natural
              transformation injection
              known fresh name).symm
        · exact
            ContinuousHom.congr_fun
              (transformation.naturality
                (Cantilune.Pi.FMSCpoWorld.successorWorld.map
                  injection))
              fresh
    · rcases rest with free | rest
      · rcases free with ⟨tags, continuation⟩
        rcases tags with ⟨channel, value⟩
        simp only [
          actionWorldMap_freeOutput,
          actionModelMap_freeOutput]
        apply congrArg Sum.inr
        apply congrArg Sum.inl
        apply Prod.ext
        · rfl
        · exact
            ContinuousHom.congr_fun
              (transformation.naturality injection)
              continuation
      · rcases rest with bound | continuation
        · rcases bound with ⟨channel, next⟩
          simp only [
            actionWorldMap_boundOutput,
            actionModelMap_boundOutput]
          apply congrArg Sum.inr
          apply congrArg Sum.inr
          apply congrArg Sum.inl
          apply Prod.ext
          · rfl
          · exact
              ContinuousHom.congr_fun
                (transformation.naturality
                  (successorMap injection))
                next
        · simp only [
            actionWorldMap_tau,
            actionModelMap_tau]
          apply congrArg Sum.inr
          apply congrArg Sum.inr
          apply congrArg Sum.inr
          exact
            ContinuousHom.congr_fun
              (transformation.naturality injection)
              continuation

/--
The genuine exact FMS action endofunctor on `World ⥤ ωCPO`.
-/
def actionFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) where
  obj := actionObject
  map := actionMap
  map_id model := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro action
    change
      actionModelMapComponent (𝟙 model) world action =
        action
    rcases action with input | rest
    · rcases input with ⟨channel, known, fresh⟩
      simp only [actionModelMap_input]
      rfl
    · rcases rest with free | rest
      · rcases free with ⟨tags, continuation⟩
        rcases tags with ⟨channel, value⟩
        simp only [actionModelMap_freeOutput]
        rfl
      · rcases rest with bound | continuation
        · rcases bound with ⟨channel, next⟩
          simp only [actionModelMap_boundOutput]
          rfl
        · simp only [actionModelMap_tau]
          rfl
  map_comp first second := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro action
    change
      actionModelMapComponent (first ≫ second)
          world action =
        actionModelMapComponent second world
          (actionModelMapComponent first world action)
    rcases action with input | rest
    · rcases input with ⟨channel, known, fresh⟩
      simp only [actionModelMap_input]
      rfl
    · rcases rest with free | rest
      · rcases free with ⟨tags, continuation⟩
        rcases tags with ⟨channel, value⟩
        simp only [actionModelMap_freeOutput]
        rfl
      · rcases rest with bound | continuation
        · rcases bound with ⟨channel, next⟩
          simp only [actionModelMap_boundOutput]
          rfl
        · simp only [actionModelMap_tau]
          rfl

/-- The carrier equivalence is natural in the model argument. -/
theorem actionEquiv_model_natural
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    (world : World)
    (action : (actionFunctor.obj source).obj world) :
    actionEquiv target world
        ((actionFunctor.map transformation).app world
          action) =
      ActionCarrier.mapModel transformation
        (actionEquiv source world action) := by
  change
    actionEquiv target world
        (actionModelMapComponent transformation world
          action) =
      ActionCarrier.mapModel transformation
        (actionEquiv source world action)
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    rfl
  · rcases rest with free | rest
    · rcases free with ⟨tags, continuation⟩
      rcases tags with ⟨channel, value⟩
      rfl
    · rcases rest with bound | continuation
      · rcases bound with ⟨channel, next⟩
        rfl
      · rfl

/-- Native finite-injection action on the exact carrier shape. -/
def mapAction
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    ActionCarrier model source →
      ActionCarrier model target :=
  fun action =>
    actionEquiv model target
      (actionWorldMap model injection
        ((actionEquiv model source).symm action))

@[simp]
theorem mapAction_input
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (channel : Fin source)
    (known : Fin source → model.obj source)
    (fresh : model.obj (source + 1)) :
    mapAction model injection
        (.input channel known fresh) =
      .input
        (homToFun injection channel)
        (inputKnownTransport model injection known fresh)
        (model.map
          (Cantilune.Pi.FMSCpoWorld.successorWorld.map
            injection)
          fresh) := by
  unfold mapAction
  change
    actionEquiv model target
        (actionWorldMap model injection
          (Sum.inl
            (nameTag channel, (known, fresh)))) =
      _
  rw [actionWorldMap_input]
  rfl

@[simp]
theorem mapAction_freeOutput
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (channel value : Fin source)
    (continuation : model.obj source) :
    mapAction model injection
        (.freeOutput channel value continuation) =
      .freeOutput
        (homToFun injection channel)
        (homToFun injection value)
        (model.map injection continuation) := by
  unfold mapAction
  change
    actionEquiv model target
        (actionWorldMap model injection
          (Sum.inr
            (Sum.inl
              ((nameTag channel, nameTag value),
                continuation)))) =
      _
  rw [actionWorldMap_freeOutput]
  rfl

@[simp]
theorem mapAction_boundOutput
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (channel : Fin source)
    (continuation : model.obj (source + 1)) :
    mapAction model injection
        (.boundOutput channel continuation) =
      .boundOutput
        (homToFun injection channel)
        (model.map
          (Cantilune.Pi.FMSCpoWorld.successorWorld.map
            injection)
          continuation) := by
  unfold mapAction
  change
    actionEquiv model target
        (actionWorldMap model injection
          (Sum.inr
            (Sum.inr
              (Sum.inl
                (nameTag channel, continuation))))) =
      _
  rw [actionWorldMap_boundOutput]
  rfl

@[simp]
theorem mapAction_tau
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (continuation : model.obj source) :
    mapAction model injection (.tau continuation) =
      .tau (model.map injection continuation) := by
  unfold mapAction
  change
    actionEquiv model target
        (actionWorldMap model injection
          (Sum.inr
            (Sum.inr
              (Sum.inr continuation)))) =
      _
  rw [actionWorldMap_tau]
  rfl

/-- The carrier equivalence is natural for every finite-world injection. -/
theorem actionEquiv_world_natural
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (action : (actionFunctor.obj model).obj source) :
    actionEquiv model target
        ((actionFunctor.obj model).map injection action) =
      mapAction model injection
        (actionEquiv model source action) := by
  change
    actionEquiv model target
        (actionWorldMap model injection action) =
      mapAction model injection
        (actionEquiv model source action)
  simp [mapAction]

end Cantilune.Pi.FMSCpoActionFunctor
