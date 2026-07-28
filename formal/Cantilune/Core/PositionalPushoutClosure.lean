import Cantilune.Core.PositionalComplementClosure
import Mathlib.CategoryTheory.Limits.Types.Pushouts
import Mathlib.Data.Fintype.EquivFin

/-!
# Pushout closure of finite positional typed hypergraphs

This module constructs the objectwise set pushout of a span of intrinsic
finite positional hypergraphs.  The construction is carried out in the
dependent node and edge fibres, so ordered source/target positions are
preserved by construction rather than recovered from an arbitrary
presheaf.

The ultimate purpose is to remove the remaining `result_mem` premise from
`PositionalDPOIBridge.WitnessInPositionalImage`: the second DPO pushout of a
finite positional interface, right-hand side, and complement is again in the
finite positional essential image.
-/

noncomputable section

namespace Cantilune.Core.PositionalPushoutClosure

open CategoryTheory
open CategoryTheory.Limits
open CategoryTheory.Limits.Types
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

abbrev Graph (σ : FinSignature)
    (inputTypes outputTypes : List σ.Obj) :=
  PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes

namespace Graph

/-- The node-fibre map underlying an arbitrary typed positional morphism. -/
def nodeMap {G H : Graph σ inputTypes outputTypes}
    (f : G ⟶ H) (o : σ.Obj) :
    G.Node o → H.Node o := by
  intro node
  let image :=
    f.left.app (Opposite.op IncidenceShape.node) ⟨o, node⟩
  have typeEq : image.1 = o := by
    have typed := Over.w f
    have typedApp :=
      congrArg (fun transformation =>
        transformation.app (Opposite.op IncidenceShape.node)) typed
    have valueEq :=
      ConcreteCategory.congr_hom typedApp (⟨o, node⟩ : G.NodeCarrier)
    exact valueEq
  exact typeEq ▸ image.2

/-- The generator-fibre map underlying an arbitrary typed positional morphism. -/
def edgeMap {G H : Graph σ inputTypes outputTypes}
    (f : G ⟶ H) (g : σ.Gen) :
    G.Edge g → H.Edge g := by
  intro edge
  let image :=
    f.left.app (Opposite.op IncidenceShape.edge) ⟨g, edge⟩
  have typeEq : image.1 = g := by
    have typed := Over.w f
    have typedApp :=
      congrArg (fun transformation =>
        transformation.app (Opposite.op IncidenceShape.edge)) typed
    have valueEq :=
      ConcreteCategory.congr_hom typedApp (⟨g, edge⟩ : G.EdgeCarrier)
    exact valueEq
  exact typeEq ▸ image.2

theorem nodeMap_sigma
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    (o : σ.Obj) (node : G.Node o) :
    f.left.app (Opposite.op IncidenceShape.node) ⟨o, node⟩ =
      ⟨o, nodeMap f o node⟩ := by
  unfold nodeMap
  let image :=
    f.left.app (Opposite.op IncidenceShape.node) ⟨o, node⟩
  have typeEq : image.1 = o := by
    have typed := Over.w f
    have typedApp :=
      congrArg (fun transformation =>
        transformation.app (Opposite.op IncidenceShape.node)) typed
    exact
      ConcreteCategory.congr_hom typedApp
        (⟨o, node⟩ : G.NodeCarrier)
  change image = ⟨o, typeEq ▸ image.2⟩
  rcases image with ⟨imageType, imageNode⟩
  dsimp at typeEq ⊢
  subst imageType
  rfl

theorem edgeMap_sigma
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    (g : σ.Gen) (edge : G.Edge g) :
    f.left.app (Opposite.op IncidenceShape.edge) ⟨g, edge⟩ =
      ⟨g, edgeMap f g edge⟩ := by
  unfold edgeMap
  let image :=
    f.left.app (Opposite.op IncidenceShape.edge) ⟨g, edge⟩
  have typeEq : image.1 = g := by
    have typed := Over.w f
    have typedApp :=
      congrArg (fun transformation =>
        transformation.app (Opposite.op IncidenceShape.edge)) typed
    exact
      ConcreteCategory.congr_hom typedApp
        (⟨g, edge⟩ : G.EdgeCarrier)
  change image = ⟨g, typeEq ▸ image.2⟩
  rcases image with ⟨imageType, imageEdge⟩
  dsimp at typeEq ⊢
  subst imageType
  rfl

theorem nodeMap_comp
    {G H J : Graph σ inputTypes outputTypes}
    (first : G ⟶ H) (second : H ⟶ J)
    (object : σ.Obj) (node : G.Node object) :
    nodeMap (first ≫ second) object node =
      nodeMap second object (nodeMap first object node) := by
  have sigmaEquality :
      (⟨object, nodeMap (first ≫ second) object node⟩ :
          J.NodeCarrier) =
        ⟨object,
          nodeMap second object (nodeMap first object node)⟩ := by
    rw [← nodeMap_sigma (first ≫ second)]
    change
      second.left.app (Opposite.op IncidenceShape.node)
          (first.left.app (Opposite.op IncidenceShape.node)
            ⟨object, node⟩) =
        ⟨object,
          nodeMap second object (nodeMap first object node)⟩
    rw [nodeMap_sigma first, nodeMap_sigma second]
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigmaEquality |>.2)

theorem edgeMap_comp
    {G H J : Graph σ inputTypes outputTypes}
    (first : G ⟶ H) (second : H ⟶ J)
    (generator : σ.Gen) (edge : G.Edge generator) :
    edgeMap (first ≫ second) generator edge =
      edgeMap second generator (edgeMap first generator edge) := by
  have sigmaEquality :
      (⟨generator, edgeMap (first ≫ second) generator edge⟩ :
          J.EdgeCarrier) =
        ⟨generator,
          edgeMap second generator (edgeMap first generator edge)⟩ := by
    rw [← edgeMap_sigma (first ≫ second)]
    change
      second.left.app (Opposite.op IncidenceShape.edge)
          (first.left.app (Opposite.op IncidenceShape.edge)
            ⟨generator, edge⟩) =
        ⟨generator,
          edgeMap second generator (edgeMap first generator edge)⟩
    rw [edgeMap_sigma first, edgeMap_sigma second]
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigmaEquality |>.2)

theorem nodeMap_injective
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    [Mono ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map f)]
    (o : σ.Obj) :
    Function.Injective (nodeMap f o) := by
  intro first second equality
  let ambient :=
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map f
  haveI : Mono ambient.left := Over.mono_left_of_mono ambient
  have ambientAppMono :
      Mono (ambient.left.app (Opposite.op IncidenceShape.node)) :=
    (NatTrans.mono_iff_mono_app'
      (C := IncidenceShapeᵒᵖ) (D := Type) ambient.left).mp
      (by infer_instance) _
  have appInjective :
      Function.Injective
        (f.left.app (Opposite.op IncidenceShape.node)) := by
    change Function.Injective
      (ambient.left.app (Opposite.op IncidenceShape.node))
    exact
      (CategoryTheory.mono_iff_injective
        (ambient.left.app (Opposite.op IncidenceShape.node))).mp
        ambientAppMono
  have sigmaEquality :
      f.left.app (Opposite.op IncidenceShape.node) ⟨o, first⟩ =
        f.left.app (Opposite.op IncidenceShape.node) ⟨o, second⟩ := by
    rw [nodeMap_sigma, nodeMap_sigma, equality]
  exact eq_of_heq (Sigma.mk.inj_iff.mp (appInjective sigmaEquality) |>.2)

theorem edgeMap_injective
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    [Mono ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map f)]
    (g : σ.Gen) :
    Function.Injective (edgeMap f g) := by
  intro first second equality
  let ambient :=
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map f
  haveI : Mono ambient.left := Over.mono_left_of_mono ambient
  have ambientAppMono :
      Mono (ambient.left.app (Opposite.op IncidenceShape.edge)) :=
    (NatTrans.mono_iff_mono_app'
      (C := IncidenceShapeᵒᵖ) (D := Type) ambient.left).mp
      (by infer_instance) _
  have appInjective :
      Function.Injective
        (f.left.app (Opposite.op IncidenceShape.edge)) := by
    change Function.Injective
      (ambient.left.app (Opposite.op IncidenceShape.edge))
    exact
      (CategoryTheory.mono_iff_injective
        (ambient.left.app (Opposite.op IncidenceShape.edge))).mp
        ambientAppMono
  have sigmaEquality :
      f.left.app (Opposite.op IncidenceShape.edge) ⟨g, first⟩ =
        f.left.app (Opposite.op IncidenceShape.edge) ⟨g, second⟩ := by
    rw [edgeMap_sigma, edgeMap_sigma, equality]
  exact eq_of_heq (Sigma.mk.inj_iff.mp (appInjective sigmaEquality) |>.2)

theorem sourceMap_sigma
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    {g : σ.Gen} (edge : G.Edge g)
    (position : Fin (σ.input g).length) :
    f.left.app (Opposite.op IncidenceShape.source)
        (⟨g, edge, position⟩ : G.SourceCarrier) =
      (⟨g, edgeMap f g edge, position⟩ : H.SourceCarrier) := by
  let sourcePoint : G.SourceCarrier := ⟨g, edge, position⟩
  set image :=
    f.left.app (Opposite.op IncidenceShape.source) sourcePoint with imageDef
  have typingEq :=
    PositionalDPOI.FiniteHypergraph.hom_source_typing f sourcePoint
  have edgeNaturality :=
    ConcreteCategory.congr_hom
      (f.left.naturality
        (Quiver.Hom.op IncidenceShape.Hom.edgeSource))
      sourcePoint
  rw [← imageDef] at typingEq
  rcases image with ⟨imageGen, imageEdge, imagePosition⟩
  dsimp [FiniteHypergraph.typingComponent, sourcePoint] at typingEq
  change (⟨imageGen, imagePosition⟩ :
      Σ generator, Fin (σ.input generator).length) =
    ⟨g, position⟩ at typingEq
  cases typingEq
  have edgeSigma :
      (⟨g, edgeMap f g edge⟩ : H.EdgeCarrier) =
        ⟨g, imageEdge⟩ := by
    change
      f.left.app (Opposite.op IncidenceShape.edge) ⟨g, edge⟩ =
        H.presheaf.map (Quiver.Hom.op IncidenceShape.Hom.edgeSource)
          (f.left.app (Opposite.op IncidenceShape.source) sourcePoint)
        at edgeNaturality
    rw [← imageDef] at edgeNaturality
    rw [edgeMap_sigma] at edgeNaturality
    change (⟨g, edgeMap f g edge⟩ : H.EdgeCarrier) =
      ⟨g, imageEdge⟩ at edgeNaturality
    exact edgeNaturality
  have edgeEq : edgeMap f g edge = imageEdge :=
    eq_of_heq (Sigma.mk.inj_iff.mp edgeSigma |>.2)
  subst imageEdge
  rfl

theorem targetMap_sigma
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    {g : σ.Gen} (edge : G.Edge g)
    (position : Fin (σ.output g).length) :
    f.left.app (Opposite.op IncidenceShape.target)
        (⟨g, edge, position⟩ : G.TargetCarrier) =
      (⟨g, edgeMap f g edge, position⟩ : H.TargetCarrier) := by
  let targetPoint : G.TargetCarrier := ⟨g, edge, position⟩
  set image :=
    f.left.app (Opposite.op IncidenceShape.target) targetPoint with imageDef
  have typingEq :=
    PositionalDPOI.FiniteHypergraph.hom_target_typing f targetPoint
  have edgeNaturality :=
    ConcreteCategory.congr_hom
      (f.left.naturality
        (Quiver.Hom.op IncidenceShape.Hom.edgeTarget))
      targetPoint
  rw [← imageDef] at typingEq
  rcases image with ⟨imageGen, imageEdge, imagePosition⟩
  dsimp [FiniteHypergraph.typingComponent, targetPoint] at typingEq
  change (⟨imageGen, imagePosition⟩ :
      Σ generator, Fin (σ.output generator).length) =
    ⟨g, position⟩ at typingEq
  cases typingEq
  have edgeSigma :
      (⟨g, edgeMap f g edge⟩ : H.EdgeCarrier) =
        ⟨g, imageEdge⟩ := by
    change
      f.left.app (Opposite.op IncidenceShape.edge) ⟨g, edge⟩ =
        H.presheaf.map (Quiver.Hom.op IncidenceShape.Hom.edgeTarget)
          (f.left.app (Opposite.op IncidenceShape.target) targetPoint)
        at edgeNaturality
    rw [← imageDef] at edgeNaturality
    rw [edgeMap_sigma] at edgeNaturality
    change (⟨g, edgeMap f g edge⟩ : H.EdgeCarrier) =
      ⟨g, imageEdge⟩ at edgeNaturality
    exact edgeNaturality
  have edgeEq : edgeMap f g edge = imageEdge :=
    eq_of_heq (Sigma.mk.inj_iff.mp edgeSigma |>.2)
  subst imageEdge
  rfl

theorem source_natural
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    {g : σ.Gen} (edge : G.Edge g)
    (position : Fin (σ.input g).length) :
    H.source (edgeMap f g edge) position =
      nodeMap f ((σ.input g).get position) (G.source edge position) := by
  have naturality :
      f.left.app (Opposite.op IncidenceShape.node)
          ⟨(σ.input g).get position, G.source edge position⟩ =
        ⟨(σ.input g).get position,
          H.source (edgeMap f g edge) position⟩ := by
    have raw :=
      ConcreteCategory.congr_hom
        (f.left.naturality
          (Quiver.Hom.op IncidenceShape.Hom.nodeSource))
        (⟨g, edge, position⟩ : G.SourceCarrier)
    change
      f.left.app (Opposite.op IncidenceShape.node)
          ⟨(σ.input g).get position, G.source edge position⟩ =
        H.presheaf.map (Quiver.Hom.op IncidenceShape.Hom.nodeSource)
          (f.left.app (Opposite.op IncidenceShape.source)
            (⟨g, edge, position⟩ : G.SourceCarrier)) at raw
    rw [sourceMap_sigma] at raw
    change
      f.left.app (Opposite.op IncidenceShape.node)
          ⟨(σ.input g).get position, G.source edge position⟩ =
        ⟨(σ.input g).get position,
          H.source (edgeMap f g edge) position⟩ at raw
    exact raw
  rw [nodeMap_sigma] at naturality
  exact eq_of_heq (Sigma.mk.inj_iff.mp naturality |>.2).symm

theorem target_natural
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    {g : σ.Gen} (edge : G.Edge g)
    (position : Fin (σ.output g).length) :
    H.target (edgeMap f g edge) position =
      nodeMap f ((σ.output g).get position) (G.target edge position) := by
  have naturality :
      f.left.app (Opposite.op IncidenceShape.node)
          ⟨(σ.output g).get position, G.target edge position⟩ =
        ⟨(σ.output g).get position,
          H.target (edgeMap f g edge) position⟩ := by
    have raw :=
      ConcreteCategory.congr_hom
        (f.left.naturality
          (Quiver.Hom.op IncidenceShape.Hom.nodeTarget))
        (⟨g, edge, position⟩ : G.TargetCarrier)
    change
      f.left.app (Opposite.op IncidenceShape.node)
          ⟨(σ.output g).get position, G.target edge position⟩ =
        H.presheaf.map (Quiver.Hom.op IncidenceShape.Hom.nodeTarget)
          (f.left.app (Opposite.op IncidenceShape.target)
            (⟨g, edge, position⟩ : G.TargetCarrier)) at raw
    rw [targetMap_sigma] at raw
    change
      f.left.app (Opposite.op IncidenceShape.node)
          ⟨(σ.output g).get position, G.target edge position⟩ =
        ⟨(σ.output g).get position,
          H.target (edgeMap f g edge) position⟩ at raw
    exact raw
  rw [nodeMap_sigma] at naturality
  exact eq_of_heq (Sigma.mk.inj_iff.mp naturality |>.2).symm

theorem input_natural
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    (position : Fin inputTypes.length) :
    H.inputBoundary position =
      nodeMap f (inputTypes.get position) (G.inputBoundary position) := by
  have inputIdentity :
      f.left.app (Opposite.op IncidenceShape.input) position =
        position := by
    have typed := Over.w f
    have typedApp :=
      congrArg (fun transformation =>
        transformation.app (Opposite.op IncidenceShape.input)) typed
    exact ConcreteCategory.congr_hom typedApp position
  have naturality :=
    ConcreteCategory.congr_hom
      (f.left.naturality
        (Quiver.Hom.op IncidenceShape.Hom.nodeInput))
      position
  change
    f.left.app (Opposite.op IncidenceShape.node)
        ⟨inputTypes.get position, G.inputBoundary position⟩ =
      H.presheaf.map (Quiver.Hom.op IncidenceShape.Hom.nodeInput)
        (f.left.app (Opposite.op IncidenceShape.input) position)
      at naturality
  rw [inputIdentity] at naturality
  change
    f.left.app (Opposite.op IncidenceShape.node)
        ⟨inputTypes.get position, G.inputBoundary position⟩ =
      ⟨inputTypes.get position, H.inputBoundary position⟩
      at naturality
  rw [nodeMap_sigma] at naturality
  exact eq_of_heq (Sigma.mk.inj_iff.mp naturality |>.2).symm

theorem inputMap_identity
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    (position : Fin inputTypes.length) :
    f.left.app (Opposite.op IncidenceShape.input) position =
      position := by
  have typed := Over.w f
  have typedApp :=
    congrArg (fun transformation =>
      transformation.app (Opposite.op IncidenceShape.input)) typed
  exact ConcreteCategory.congr_hom typedApp position

theorem output_natural
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    (position : Fin outputTypes.length) :
    H.outputBoundary position =
      nodeMap f (outputTypes.get position) (G.outputBoundary position) := by
  have outputIdentity :
      f.left.app (Opposite.op IncidenceShape.output) position =
        position := by
    have typed := Over.w f
    have typedApp :=
      congrArg (fun transformation =>
        transformation.app (Opposite.op IncidenceShape.output)) typed
    exact ConcreteCategory.congr_hom typedApp position
  have naturality :=
    ConcreteCategory.congr_hom
      (f.left.naturality
        (Quiver.Hom.op IncidenceShape.Hom.nodeOutput))
      position
  change
    f.left.app (Opposite.op IncidenceShape.node)
        ⟨outputTypes.get position, G.outputBoundary position⟩ =
      H.presheaf.map (Quiver.Hom.op IncidenceShape.Hom.nodeOutput)
        (f.left.app (Opposite.op IncidenceShape.output) position)
      at naturality
  rw [outputIdentity] at naturality
  change
    f.left.app (Opposite.op IncidenceShape.node)
        ⟨outputTypes.get position, G.outputBoundary position⟩ =
      ⟨outputTypes.get position, H.outputBoundary position⟩
      at naturality
  rw [nodeMap_sigma] at naturality
  exact eq_of_heq (Sigma.mk.inj_iff.mp naturality |>.2).symm

theorem outputMap_identity
    {G H : Graph σ inputTypes outputTypes} (f : G ⟶ H)
    (position : Fin outputTypes.length) :
    f.left.app (Opposite.op IncidenceShape.output) position =
      position := by
  have typed := Over.w f
  have typedApp :=
    congrArg (fun transformation =>
      transformation.app (Opposite.op IncidenceShape.output)) typed
  exact ConcreteCategory.congr_hom typedApp position

theorem hom_ext_of_node_edge
    {G H : Graph σ inputTypes outputTypes}
    {first second : G ⟶ H}
    (nodeEquality :
      ∀ object node,
        nodeMap first object node = nodeMap second object node)
    (edgeEquality :
      ∀ generator edge,
        edgeMap first generator edge = edgeMap second generator edge) :
    first = second := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext shape
  apply ConcreteCategory.hom_ext
  intro value
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      rcases value with ⟨object, node⟩
      rw [nodeMap_sigma first, nodeMap_sigma second,
        nodeEquality object node]
  | edge =>
      rcases value with ⟨generator, edge⟩
      rw [edgeMap_sigma first, edgeMap_sigma second,
        edgeEquality generator edge]
  | source =>
      rcases value with ⟨generator, edge, position⟩
      rw [sourceMap_sigma first, sourceMap_sigma second,
        edgeEquality generator edge]
  | target =>
      rcases value with ⟨generator, edge, position⟩
      rw [targetMap_sigma first, targetMap_sigma second,
        edgeEquality generator edge]
  | input =>
      rw [inputMap_identity first, inputMap_identity second]
  | output =>
      rw [outputMap_identity first, outputMap_identity second]

end Graph

namespace PushoutObject

variable
  {K R D : Graph σ inputTypes outputTypes}
  (right : K ⟶ R) (interface : K ⟶ D)

namespace Indexed

universe w

variable
  {Index : Type*}
  {InterfaceFiber RightFiber ComplementFiber : Index → Type w}
  (rightFiber : ∀ index, InterfaceFiber index → RightFiber index)
  (complementFiber :
    ∀ index, InterfaceFiber index → ComplementFiber index)

def leftInclusion :
    (Σ index, RightFiber index) →
      Σ index,
        Types.Pushout
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index)
  | ⟨index, value⟩ =>
      ⟨index,
        Types.Pushout.inl
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index)
          value⟩

def rightInclusion :
    (Σ index, ComplementFiber index) →
      Σ index,
        Types.Pushout
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index)
  | ⟨index, value⟩ =>
      ⟨index,
        Types.Pushout.inr
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index)
          value⟩

theorem isPushout
    (leftMap :
      (Σ index, InterfaceFiber index) →
        Σ index, RightFiber index)
    (rightMap :
      (Σ index, InterfaceFiber index) →
        Σ index, ComplementFiber index)
    (leftMap_fiber :
      ∀ index value,
        leftMap ⟨index, value⟩ =
          ⟨index, rightFiber index value⟩)
    (rightMap_fiber :
      ∀ index value,
        rightMap ⟨index, value⟩ =
          ⟨index, complementFiber index value⟩) :
    IsPushout
      (TypeCat.ofHom leftMap)
      (TypeCat.ofHom rightMap)
      (TypeCat.ofHom
        (leftInclusion rightFiber complementFiber))
      (TypeCat.ofHom
        (rightInclusion rightFiber complementFiber)) := by
  let desc :
      (cocone :
        PushoutCocone
          (TypeCat.ofHom leftMap)
          (TypeCat.ofHom rightMap)) →
        (Σ index,
          Types.Pushout
            (TypeCat.ofHom (rightFiber index) :
              InterfaceFiber index ⟶ RightFiber index)
            (TypeCat.ofHom (complementFiber index) :
              InterfaceFiber index ⟶ ComplementFiber index)) ⟶
          cocone.pt :=
    fun cocone =>
      TypeCat.ofHom fun value =>
        Quot.lift
          (fun side =>
            match side with
            | Sum.inl rightValue =>
                cocone.inl ⟨value.1, rightValue⟩
            | Sum.inr complementValue =>
                cocone.inr ⟨value.1, complementValue⟩)
          (by
            intro leftValue rightValue relation
            cases relation with
            | inl_inr interfaceValue =>
                have compatibility :=
                  ConcreteCategory.congr_hom cocone.condition
                    ⟨value.1, interfaceValue⟩
                change
                  cocone.inl (leftMap ⟨value.1, interfaceValue⟩) =
                    cocone.inr (rightMap ⟨value.1, interfaceValue⟩)
                  at compatibility
                rw [leftMap_fiber, rightMap_fiber] at compatibility
                exact compatibility)
          value.2
  refine IsPushout.of_isColimit
    (PushoutCocone.IsColimit.mk
      ?_ desc ?_ ?_ ?_)
  · apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value⟩
    change
      leftInclusion rightFiber complementFiber
          (leftMap ⟨index, value⟩) =
        rightInclusion rightFiber complementFiber
          (rightMap ⟨index, value⟩)
    rw [leftMap_fiber, rightMap_fiber]
    apply Sigma.ext
    · rfl
    · exact
        heq_of_eq
          (Quot.sound (Types.Pushout.Rel.inl_inr value))
  · intro cocone
    apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value⟩
    change
      desc cocone
          (leftInclusion rightFiber complementFiber
            ⟨index, value⟩) =
        cocone.inl ⟨index, value⟩
    rfl
  · intro cocone
    apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value⟩
    change
      desc cocone
          (rightInclusion rightFiber complementFiber
            ⟨index, value⟩) =
        cocone.inr ⟨index, value⟩
    rfl
  · intro cocone candidate leftAgreement rightAgreement
    apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value⟩
    refine Quot.inductionOn value ?_
    intro side
    cases side with
    | inl rightValue =>
        have point :=
          ConcreteCategory.congr_hom leftAgreement
            ⟨index, rightValue⟩
        exact point
    | inr complementValue =>
        have point :=
          ConcreteCategory.congr_hom rightAgreement
            ⟨index, complementValue⟩
        exact point

end Indexed

namespace Positioned

universe w

variable
  {Index : Type*}
  {Position : Index → Type w}
  {InterfaceFiber RightFiber ComplementFiber : Index → Type w}
  (rightFiber : ∀ index, InterfaceFiber index → RightFiber index)
  (complementFiber :
    ∀ index, InterfaceFiber index → ComplementFiber index)

def leftInclusion :
    (Σ index, RightFiber index × Position index) →
      Σ index,
        Types.Pushout
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index) ×
          Position index
  | ⟨index, value, position⟩ =>
      ⟨index,
        Types.Pushout.inl
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index)
          value,
        position⟩

def rightInclusion :
    (Σ index, ComplementFiber index × Position index) →
      Σ index,
        Types.Pushout
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index) ×
          Position index
  | ⟨index, value, position⟩ =>
      ⟨index,
        Types.Pushout.inr
          (TypeCat.ofHom (rightFiber index) :
            InterfaceFiber index ⟶ RightFiber index)
          (TypeCat.ofHom (complementFiber index) :
            InterfaceFiber index ⟶ ComplementFiber index)
          value,
        position⟩

theorem isPushout
    (leftMap :
      (Σ index, InterfaceFiber index × Position index) →
        Σ index, RightFiber index × Position index)
    (rightMap :
      (Σ index, InterfaceFiber index × Position index) →
        Σ index, ComplementFiber index × Position index)
    (leftMap_fiber :
      ∀ index value position,
        leftMap ⟨index, value, position⟩ =
          ⟨index, rightFiber index value, position⟩)
    (rightMap_fiber :
      ∀ index value position,
        rightMap ⟨index, value, position⟩ =
          ⟨index, complementFiber index value, position⟩) :
    IsPushout
      (TypeCat.ofHom leftMap)
      (TypeCat.ofHom rightMap)
      (TypeCat.ofHom
        (leftInclusion
          (Position := Position) rightFiber complementFiber))
      (TypeCat.ofHom
        (rightInclusion
          (Position := Position) rightFiber complementFiber)) := by
  let desc :
      (cocone :
        PushoutCocone
          (TypeCat.ofHom leftMap)
          (TypeCat.ofHom rightMap)) →
        (Σ index,
          Types.Pushout
            (TypeCat.ofHom (rightFiber index) :
              InterfaceFiber index ⟶ RightFiber index)
            (TypeCat.ofHom (complementFiber index) :
              InterfaceFiber index ⟶ ComplementFiber index) ×
            Position index) ⟶
          cocone.pt :=
    fun cocone =>
      TypeCat.ofHom fun value =>
        Quot.lift
          (fun side =>
            match side with
            | Sum.inl rightValue =>
                cocone.inl ⟨value.1, rightValue, value.2.2⟩
            | Sum.inr complementValue =>
                cocone.inr ⟨value.1, complementValue, value.2.2⟩)
          (by
            intro leftValue rightValue relation
            cases relation with
            | inl_inr interfaceValue =>
                have compatibility :=
                  ConcreteCategory.congr_hom cocone.condition
                    ⟨value.1, interfaceValue, value.2.2⟩
                change
                  cocone.inl
                      (leftMap
                        ⟨value.1, interfaceValue, value.2.2⟩) =
                    cocone.inr
                      (rightMap
                        ⟨value.1, interfaceValue, value.2.2⟩)
                  at compatibility
                rw [leftMap_fiber, rightMap_fiber] at compatibility
                exact compatibility)
          value.2.1
  refine IsPushout.of_isColimit
    (PushoutCocone.IsColimit.mk
      ?_ desc ?_ ?_ ?_)
  · apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value, position⟩
    change
      leftInclusion (Position := Position) rightFiber complementFiber
          (leftMap ⟨index, value, position⟩) =
        rightInclusion (Position := Position) rightFiber complementFiber
          (rightMap ⟨index, value, position⟩)
    rw [leftMap_fiber, rightMap_fiber]
    apply Sigma.ext
    · rfl
    · exact
        heq_of_eq
          (Prod.ext
            (Quot.sound (Types.Pushout.Rel.inl_inr value))
            rfl)
  · intro cocone
    apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value, position⟩
    change
      desc cocone
          (leftInclusion (Position := Position)
            rightFiber complementFiber
            ⟨index, value, position⟩) =
        cocone.inl ⟨index, value, position⟩
    rfl
  · intro cocone
    apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value, position⟩
    change
      desc cocone
          (rightInclusion (Position := Position)
            rightFiber complementFiber
            ⟨index, value, position⟩) =
        cocone.inr ⟨index, value, position⟩
    rfl
  · intro cocone candidate leftAgreement rightAgreement
    apply ConcreteCategory.hom_ext
    intro value
    rcases value with ⟨index, value, position⟩
    refine Quot.inductionOn value ?_
    intro side
    cases side with
    | inl rightValue =>
        exact
          ConcreteCategory.congr_hom leftAgreement
            ⟨index, rightValue, position⟩
    | inr complementValue =>
        exact
          ConcreteCategory.congr_hom rightAgreement
            ⟨index, complementValue, position⟩

end Positioned

/-- Inclusion of complement nodes into the fibrewise pushout node carrier. -/
def complementNodeInclusion :
    D.NodeCarrier →
      Σ object,
        Types.Pushout
          (TypeCat.ofHom (Graph.nodeMap right object))
          (TypeCat.ofHom (Graph.nodeMap interface object))
  | ⟨object, node⟩ =>
      ⟨object,
        Types.Pushout.inr
          (TypeCat.ofHom (Graph.nodeMap right object))
          (TypeCat.ofHom (Graph.nodeMap interface object))
          node⟩

theorem complementNodeInclusion_injective
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    Function.Injective
      (complementNodeInclusion right interface) := by
  rintro ⟨leftObject, leftNode⟩ ⟨rightObject, rightNode⟩ equality
  have objectEquality : leftObject = rightObject :=
    congrArg Sigma.fst equality
  subst rightObject
  have nodeEquality :
      Types.Pushout.inr
          (TypeCat.ofHom (Graph.nodeMap right leftObject))
          (TypeCat.ofHom (Graph.nodeMap interface leftObject))
          leftNode =
        Types.Pushout.inr
          (TypeCat.ofHom (Graph.nodeMap right leftObject))
          (TypeCat.ofHom (Graph.nodeMap interface leftObject))
          rightNode :=
    eq_of_heq (Sigma.mk.inj_iff.mp equality |>.2)
  haveI :
      Mono (TypeCat.ofHom (Graph.nodeMap right leftObject)) :=
    (CategoryTheory.mono_iff_injective _).mpr
      (Graph.nodeMap_injective right leftObject)
  have rightInjection :
      Function.Injective
        (Types.Pushout.inr
          (TypeCat.ofHom (Graph.nodeMap right leftObject))
          (TypeCat.ofHom (Graph.nodeMap interface leftObject))) :=
    (CategoryTheory.mono_iff_injective _).mp (by infer_instance)
  have sameNode := rightInjection nodeEquality
  subst rightNode
  rfl

/-- Source incidence in the fibrewise pushout. -/
def pushoutSource
    {generator : σ.Gen}
    (edge :
      Types.Pushout
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator)))
    (position : Fin (σ.input generator).length) :
    Types.Pushout
      (TypeCat.ofHom
        (Graph.nodeMap right ((σ.input generator).get position)))
      (TypeCat.ofHom
        (Graph.nodeMap interface ((σ.input generator).get position))) :=
  Quot.lift
    (fun side =>
      match side with
      | Sum.inl rightEdge =>
          Types.Pushout.inl
            (TypeCat.ofHom
              (Graph.nodeMap right ((σ.input generator).get position)))
            (TypeCat.ofHom
              (Graph.nodeMap interface ((σ.input generator).get position)))
            (R.source rightEdge position)
      | Sum.inr complementEdge =>
          Types.Pushout.inr
            (TypeCat.ofHom
              (Graph.nodeMap right ((σ.input generator).get position)))
            (TypeCat.ofHom
              (Graph.nodeMap interface ((σ.input generator).get position)))
            (D.source complementEdge position))
    (by
      intro leftEdge rightEdge relation
      cases relation with
      | inl_inr interfaceEdge =>
          change
            Types.Pushout.inl
                (TypeCat.ofHom
                  (Graph.nodeMap right
                    ((σ.input generator).get position)))
                (TypeCat.ofHom
                  (Graph.nodeMap interface
                    ((σ.input generator).get position)))
                (R.source
                  (Graph.edgeMap right generator interfaceEdge)
                  position) =
              Types.Pushout.inr
                (TypeCat.ofHom
                  (Graph.nodeMap right
                    ((σ.input generator).get position)))
                (TypeCat.ofHom
                  (Graph.nodeMap interface
                    ((σ.input generator).get position)))
                (D.source
                  (Graph.edgeMap interface generator interfaceEdge)
                  position)
          rw [Graph.source_natural right interfaceEdge position]
          rw [Graph.source_natural interface interfaceEdge position]
          exact
            Quot.sound
              (Types.Pushout.Rel.inl_inr
                (K.source interfaceEdge position)))
    edge

/-- Target incidence in the fibrewise pushout. -/
def pushoutTarget
    {generator : σ.Gen}
    (edge :
      Types.Pushout
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator)))
    (position : Fin (σ.output generator).length) :
    Types.Pushout
      (TypeCat.ofHom
        (Graph.nodeMap right ((σ.output generator).get position)))
      (TypeCat.ofHom
        (Graph.nodeMap interface ((σ.output generator).get position))) :=
  Quot.lift
    (fun side =>
      match side with
      | Sum.inl rightEdge =>
          Types.Pushout.inl
            (TypeCat.ofHom
              (Graph.nodeMap right ((σ.output generator).get position)))
            (TypeCat.ofHom
              (Graph.nodeMap interface ((σ.output generator).get position)))
            (R.target rightEdge position)
      | Sum.inr complementEdge =>
          Types.Pushout.inr
            (TypeCat.ofHom
              (Graph.nodeMap right ((σ.output generator).get position)))
            (TypeCat.ofHom
              (Graph.nodeMap interface ((σ.output generator).get position)))
            (D.target complementEdge position))
    (by
      intro leftEdge rightEdge relation
      cases relation with
      | inl_inr interfaceEdge =>
          change
            Types.Pushout.inl
                (TypeCat.ofHom
                  (Graph.nodeMap right
                    ((σ.output generator).get position)))
                (TypeCat.ofHom
                  (Graph.nodeMap interface
                    ((σ.output generator).get position)))
                (R.target
                  (Graph.edgeMap right generator interfaceEdge)
                  position) =
              Types.Pushout.inr
                (TypeCat.ofHom
                  (Graph.nodeMap right
                    ((σ.output generator).get position)))
                (TypeCat.ofHom
                  (Graph.nodeMap interface
                    ((σ.output generator).get position)))
                (D.target
                  (Graph.edgeMap interface generator interfaceEdge)
                  position)
          rw [Graph.target_natural right interfaceEdge position]
          rw [Graph.target_natural interface interfaceEdge position]
          exact
            Quot.sound
              (Types.Pushout.Rel.inl_inr
                (K.target interfaceEdge position)))
    edge

/--
The finite positional pushout object of `K ⟶ R` and `K ⟶ D`.

The right rule leg is assumed monic in the ambient typed-presheaf slice.
This makes the complement injection monic and hence preserves the fixed
input/output boundary embeddings.
-/
def pushoutGraph
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    Graph σ inputTypes outputTypes where
  Node object :=
    Types.Pushout
      (TypeCat.ofHom (Graph.nodeMap right object))
      (TypeCat.ofHom (Graph.nodeMap interface object))
  Edge generator :=
    Types.Pushout
      (TypeCat.ofHom (Graph.edgeMap right generator))
      (TypeCat.ofHom (Graph.edgeMap interface generator))
  nodeFintype object := by
    letI : Finite (R.Node object ⊕ D.Node object) := inferInstance
    change
      Fintype
        (Quot
          (Types.Pushout.Rel
            (TypeCat.ofHom (Graph.nodeMap right object))
            (TypeCat.ofHom (Graph.nodeMap interface object))))
    exact Fintype.ofFinite _
  edgeFintype generator := by
    letI : Finite (R.Edge generator ⊕ D.Edge generator) := inferInstance
    change
      Fintype
        (Quot
          (Types.Pushout.Rel
            (TypeCat.ofHom (Graph.edgeMap right generator))
            (TypeCat.ofHom (Graph.edgeMap interface generator))))
    exact Fintype.ofFinite _
  source := pushoutSource right interface
  target := pushoutTarget right interface
  inputBoundary position :=
    Types.Pushout.inr
      (TypeCat.ofHom (Graph.nodeMap right (inputTypes.get position)))
      (TypeCat.ofHom (Graph.nodeMap interface (inputTypes.get position)))
      (D.inputBoundary position)
  outputBoundary position :=
    Types.Pushout.inr
      (TypeCat.ofHom (Graph.nodeMap right (outputTypes.get position)))
      (TypeCat.ofHom (Graph.nodeMap interface (outputTypes.get position)))
      (D.outputBoundary position)
  inputBoundary_injective :=
    (complementNodeInclusion_injective right interface).comp
      D.inputBoundary_injective
  outputBoundary_injective :=
    (complementNodeInclusion_injective right interface).comp
      D.outputBoundary_injective

/-- Component maps from the right-hand graph into the fibrewise pushout. -/
def rightComponent
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (shape : IncidenceShape) :
    R.Carrier shape → (pushoutGraph right interface).Carrier shape :=
  match shape with
  | .node =>
      fun node =>
        ⟨node.1,
          Types.Pushout.inl
            (TypeCat.ofHom (Graph.nodeMap right node.1))
            (TypeCat.ofHom (Graph.nodeMap interface node.1))
            node.2⟩
  | .edge =>
      fun edge =>
        ⟨edge.1,
          Types.Pushout.inl
            (TypeCat.ofHom (Graph.edgeMap right edge.1))
            (TypeCat.ofHom (Graph.edgeMap interface edge.1))
            edge.2⟩
  | .source =>
      fun source =>
        ⟨source.1,
          Types.Pushout.inl
            (TypeCat.ofHom (Graph.edgeMap right source.1))
            (TypeCat.ofHom (Graph.edgeMap interface source.1))
            source.2.1,
          source.2.2⟩
  | .target =>
      fun target =>
        ⟨target.1,
          Types.Pushout.inl
            (TypeCat.ofHom (Graph.edgeMap right target.1))
            (TypeCat.ofHom (Graph.edgeMap interface target.1))
            target.2.1,
          target.2.2⟩
  | .input => id
  | .output => id

/-- Component maps from the retained complement into the fibrewise pushout. -/
def complementComponent
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (shape : IncidenceShape) :
    D.Carrier shape → (pushoutGraph right interface).Carrier shape :=
  match shape with
  | .node =>
      fun node =>
        ⟨node.1,
          Types.Pushout.inr
            (TypeCat.ofHom (Graph.nodeMap right node.1))
            (TypeCat.ofHom (Graph.nodeMap interface node.1))
            node.2⟩
  | .edge =>
      fun edge =>
        ⟨edge.1,
          Types.Pushout.inr
            (TypeCat.ofHom (Graph.edgeMap right edge.1))
            (TypeCat.ofHom (Graph.edgeMap interface edge.1))
            edge.2⟩
  | .source =>
      fun source =>
        ⟨source.1,
          Types.Pushout.inr
            (TypeCat.ofHom (Graph.edgeMap right source.1))
            (TypeCat.ofHom (Graph.edgeMap interface source.1))
            source.2.1,
          source.2.2⟩
  | .target =>
      fun target =>
        ⟨target.1,
          Types.Pushout.inr
            (TypeCat.ofHom (Graph.edgeMap right target.1))
            (TypeCat.ofHom (Graph.edgeMap interface target.1))
            target.2.1,
          target.2.2⟩
  | .input => id
  | .output => id

private theorem right_input_boundary
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (position : Fin inputTypes.length) :
    Types.Pushout.inl
        (TypeCat.ofHom (Graph.nodeMap right (inputTypes.get position)))
        (TypeCat.ofHom (Graph.nodeMap interface (inputTypes.get position)))
        (R.inputBoundary position) =
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.nodeMap right (inputTypes.get position)))
        (TypeCat.ofHom (Graph.nodeMap interface (inputTypes.get position)))
        (D.inputBoundary position) := by
  rw [Graph.input_natural right position]
  rw [Graph.input_natural interface position]
  exact
    Quot.sound
      (Types.Pushout.Rel.inl_inr (K.inputBoundary position))

private theorem right_output_boundary
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (position : Fin outputTypes.length) :
    Types.Pushout.inl
        (TypeCat.ofHom (Graph.nodeMap right (outputTypes.get position)))
        (TypeCat.ofHom (Graph.nodeMap interface (outputTypes.get position)))
        (R.outputBoundary position) =
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.nodeMap right (outputTypes.get position)))
        (TypeCat.ofHom (Graph.nodeMap interface (outputTypes.get position)))
        (D.outputBoundary position) := by
  rw [Graph.output_natural right position]
  rw [Graph.output_natural interface position]
  exact
    Quot.sound
      (Types.Pushout.Rel.inl_inr (K.outputBoundary position))

private theorem rightComponent_naturality
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    {sourceShape targetShape : IncidenceShape}
    (morphism : IncidenceShape.Hom sourceShape targetShape) :
    TypeCat.ofHom (R.map morphism) ≫
        TypeCat.ofHom (rightComponent right interface sourceShape) =
      TypeCat.ofHom (rightComponent right interface targetShape) ≫
        TypeCat.ofHom ((pushoutGraph right interface).map morphism) := by
  cases morphism with
  | id => cases sourceShape <;> rfl
  | nodeSource => rfl
  | edgeSource => rfl
  | nodeTarget => rfl
  | edgeTarget => rfl
  | nodeInput =>
      ext position
      change
        (⟨inputTypes.get position,
            Types.Pushout.inl
              (TypeCat.ofHom
                (Graph.nodeMap right (inputTypes.get position)))
              (TypeCat.ofHom
                (Graph.nodeMap interface (inputTypes.get position)))
              (R.inputBoundary position)⟩ :
          (pushoutGraph right interface).NodeCarrier) =
          ⟨inputTypes.get position,
            Types.Pushout.inr
              (TypeCat.ofHom
                (Graph.nodeMap right (inputTypes.get position)))
              (TypeCat.ofHom
                (Graph.nodeMap interface (inputTypes.get position)))
              (D.inputBoundary position)⟩
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq (right_input_boundary right interface position)
  | nodeOutput =>
      ext position
      change
        (⟨outputTypes.get position,
            Types.Pushout.inl
              (TypeCat.ofHom
                (Graph.nodeMap right (outputTypes.get position)))
              (TypeCat.ofHom
                (Graph.nodeMap interface (outputTypes.get position)))
              (R.outputBoundary position)⟩ :
          (pushoutGraph right interface).NodeCarrier) =
          ⟨outputTypes.get position,
            Types.Pushout.inr
              (TypeCat.ofHom
                (Graph.nodeMap right (outputTypes.get position)))
              (TypeCat.ofHom
                (Graph.nodeMap interface (outputTypes.get position)))
              (D.outputBoundary position)⟩
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq (right_output_boundary right interface position)

private theorem complementComponent_naturality
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    {sourceShape targetShape : IncidenceShape}
    (morphism : IncidenceShape.Hom sourceShape targetShape) :
    TypeCat.ofHom (D.map morphism) ≫
        TypeCat.ofHom
          (complementComponent right interface sourceShape) =
      TypeCat.ofHom
          (complementComponent right interface targetShape) ≫
        TypeCat.ofHom ((pushoutGraph right interface).map morphism) := by
  cases morphism <;> rfl

/-- Presheaf morphism from the right-hand graph to the pushout graph. -/
def rightNatural
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    R.presheaf ⟶ (pushoutGraph right interface).presheaf where
  app shape :=
    TypeCat.ofHom (rightComponent right interface (Opposite.unop shape))
  naturality := by
    intro source target morphism
    simpa [FiniteHypergraph.presheaf] using
      rightComponent_naturality right interface
        (Quiver.Hom.unop morphism)

/-- Presheaf morphism from the complement graph to the pushout graph. -/
def complementNatural
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    D.presheaf ⟶ (pushoutGraph right interface).presheaf where
  app shape :=
    TypeCat.ofHom
      (complementComponent right interface (Opposite.unop shape))
  naturality := by
    intro source target morphism
    simpa [FiniteHypergraph.presheaf] using
      complementComponent_naturality right interface
        (Quiver.Hom.unop morphism)

/-- Typed inclusion of the right-hand graph into the fibrewise pushout. -/
def rightInclusion
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    R ⟶ pushoutGraph right interface :=
  Over.homMk (rightNatural right interface) (by
    ext shape value
    rcases shape with ⟨shape⟩
    cases shape <;> rfl)

/-- Typed inclusion of the complement graph into the fibrewise pushout. -/
def complementInclusion
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    D ⟶ pushoutGraph right interface :=
  Over.homMk (complementNatural right interface) (by
    ext shape value
    rcases shape with ⟨shape⟩
    cases shape <;> rfl)

@[simp]
theorem rightInclusion_nodeMap
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (object : σ.Obj) (node : R.Node object) :
    Graph.nodeMap (rightInclusion right interface) object node =
      Types.Pushout.inl
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object))
        node := by
  have sigma :=
    Graph.nodeMap_sigma (rightInclusion right interface) object node
  change
    (⟨object,
      Types.Pushout.inl
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object))
        node⟩ :
      (pushoutGraph right interface).NodeCarrier) =
      ⟨object,
        Graph.nodeMap (rightInclusion right interface) object node⟩
      at sigma
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigma |>.2).symm

@[simp]
theorem complementInclusion_nodeMap
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (object : σ.Obj) (node : D.Node object) :
    Graph.nodeMap (complementInclusion right interface) object node =
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object))
        node := by
  have sigma :=
    Graph.nodeMap_sigma (complementInclusion right interface) object node
  change
    (⟨object,
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object))
        node⟩ :
      (pushoutGraph right interface).NodeCarrier) =
      ⟨object,
        Graph.nodeMap (complementInclusion right interface) object node⟩
      at sigma
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigma |>.2).symm

@[simp]
theorem rightInclusion_edgeMap
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (generator : σ.Gen) (edge : R.Edge generator) :
    Graph.edgeMap (rightInclusion right interface) generator edge =
      Types.Pushout.inl
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator))
        edge := by
  have sigma :=
    Graph.edgeMap_sigma (rightInclusion right interface) generator edge
  change
    (⟨generator,
      Types.Pushout.inl
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator))
        edge⟩ :
      (pushoutGraph right interface).EdgeCarrier) =
      ⟨generator,
        Graph.edgeMap (rightInclusion right interface) generator edge⟩
      at sigma
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigma |>.2).symm

@[simp]
theorem complementInclusion_edgeMap
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (generator : σ.Gen) (edge : D.Edge generator) :
    Graph.edgeMap (complementInclusion right interface) generator edge =
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator))
        edge := by
  have sigma :=
    Graph.edgeMap_sigma (complementInclusion right interface) generator edge
  change
    (⟨generator,
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator))
        edge⟩ :
      (pushoutGraph right interface).EdgeCarrier) =
      ⟨generator,
        Graph.edgeMap (complementInclusion right interface) generator edge⟩
      at sigma
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigma |>.2).symm

private theorem node_condition
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (object : σ.Obj) (node : K.Node object) :
    Types.Pushout.inl
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object))
        (Graph.nodeMap right object node) =
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object))
        (Graph.nodeMap interface object node) :=
  Quot.sound (Types.Pushout.Rel.inl_inr node)

private theorem edge_condition
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    (generator : σ.Gen) (edge : K.Edge generator) :
    Types.Pushout.inl
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator))
        (Graph.edgeMap right generator edge) =
      Types.Pushout.inr
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator))
        (Graph.edgeMap interface generator edge) :=
  Quot.sound (Types.Pushout.Rel.inl_inr edge)

/-- The two fibrewise inclusions form a commuting square. -/
theorem pushout_square
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    right ≫ rightInclusion right interface =
      interface ≫ complementInclusion right interface := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext shape
  apply ConcreteCategory.hom_ext
  intro value
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      rcases value with ⟨object, node⟩
      change
        rightComponent right interface .node
            (right.left.app (Opposite.op .node) ⟨object, node⟩) =
          complementComponent right interface .node
            (interface.left.app (Opposite.op .node) ⟨object, node⟩)
      rw [Graph.nodeMap_sigma right, Graph.nodeMap_sigma interface]
      apply Sigma.ext
      · rfl
      · exact heq_of_eq (node_condition right interface object node)
  | edge =>
      rcases value with ⟨generator, edge⟩
      change
        rightComponent right interface .edge
            (right.left.app (Opposite.op .edge) ⟨generator, edge⟩) =
          complementComponent right interface .edge
            (interface.left.app (Opposite.op .edge) ⟨generator, edge⟩)
      rw [Graph.edgeMap_sigma right, Graph.edgeMap_sigma interface]
      apply Sigma.ext
      · rfl
      · exact heq_of_eq (edge_condition right interface generator edge)
  | source =>
      rcases value with ⟨generator, edge, position⟩
      change
        rightComponent right interface .source
            (right.left.app (Opposite.op .source)
              ⟨generator, edge, position⟩) =
          complementComponent right interface .source
            (interface.left.app (Opposite.op .source)
              ⟨generator, edge, position⟩)
      rw [Graph.sourceMap_sigma right, Graph.sourceMap_sigma interface]
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq
            (Prod.ext
              (edge_condition right interface generator edge)
              rfl)
  | target =>
      rcases value with ⟨generator, edge, position⟩
      change
        rightComponent right interface .target
            (right.left.app (Opposite.op .target)
              ⟨generator, edge, position⟩) =
          complementComponent right interface .target
            (interface.left.app (Opposite.op .target)
              ⟨generator, edge, position⟩)
      rw [Graph.targetMap_sigma right, Graph.targetMap_sigma interface]
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq
            (Prod.ext
              (edge_condition right interface generator edge)
              rfl)
  | input =>
      change
        right.left.app (Opposite.op .input) value =
          interface.left.app (Opposite.op .input) value
      rw [Graph.inputMap_identity right, Graph.inputMap_identity interface]
  | output =>
      change
        right.left.app (Opposite.op .output) value =
          interface.left.app (Opposite.op .output) value
      rw [Graph.outputMap_identity right, Graph.outputMap_identity interface]

section Universal

variable
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
  {X : Graph σ inputTypes outputTypes}
  (rightMap : R ⟶ X) (complementMap : D ⟶ X)
  (condition :
    right ≫ rightMap = interface ≫ complementMap)

include condition

private theorem cocone_node_condition
    (object : σ.Obj) (node : K.Node object) :
    Graph.nodeMap rightMap object
        (Graph.nodeMap right object node) =
      Graph.nodeMap complementMap object
        (Graph.nodeMap interface object node) := by
  have mapped :=
    congrArg (fun morphism =>
      Graph.nodeMap morphism object node) condition
  rw [Graph.nodeMap_comp, Graph.nodeMap_comp] at mapped
  exact mapped

private theorem cocone_edge_condition
    (generator : σ.Gen) (edge : K.Edge generator) :
    Graph.edgeMap rightMap generator
        (Graph.edgeMap right generator edge) =
      Graph.edgeMap complementMap generator
        (Graph.edgeMap interface generator edge) := by
  have mapped :=
    congrArg (fun morphism =>
      Graph.edgeMap morphism generator edge) condition
  rw [Graph.edgeMap_comp, Graph.edgeMap_comp] at mapped
  exact mapped

/-- Fibrewise map on nodes induced by an arbitrary cocone. -/
def nodeLift (object : σ.Obj) :
    Types.Pushout
        (TypeCat.ofHom (Graph.nodeMap right object))
        (TypeCat.ofHom (Graph.nodeMap interface object)) →
      X.Node object :=
  Quot.lift
    (fun side =>
      match side with
      | Sum.inl node => Graph.nodeMap rightMap object node
      | Sum.inr node => Graph.nodeMap complementMap object node)
    (by
      intro leftNode rightNode relation
      cases relation with
      | inl_inr node =>
          exact
            cocone_node_condition right interface rightMap complementMap
              condition object node)

/-- Fibrewise map on edges induced by an arbitrary cocone. -/
def edgeLift (generator : σ.Gen) :
    Types.Pushout
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator)) →
      X.Edge generator :=
  Quot.lift
    (fun side =>
      match side with
      | Sum.inl edge => Graph.edgeMap rightMap generator edge
      | Sum.inr edge => Graph.edgeMap complementMap generator edge)
    (by
      intro leftEdge rightEdge relation
      cases relation with
      | inl_inr edge =>
          exact
            cocone_edge_condition right interface rightMap complementMap
              condition generator edge)

/-- Components of the mediating typed-presheaf map. -/
def liftComponent (shape : IncidenceShape) :
    (pushoutGraph right interface).Carrier shape → X.Carrier shape :=
  match shape with
  | .node =>
      fun node =>
        ⟨node.1,
          nodeLift right interface rightMap complementMap condition
            node.1 node.2⟩
  | .edge =>
      fun edge =>
        ⟨edge.1,
          edgeLift right interface rightMap complementMap condition
            edge.1 edge.2⟩
  | .source =>
      fun source =>
        ⟨source.1,
          edgeLift right interface rightMap complementMap condition
            source.1 source.2.1,
          source.2.2⟩
  | .target =>
      fun target =>
        ⟨target.1,
          edgeLift right interface rightMap complementMap condition
            target.1 target.2.1,
          target.2.2⟩
  | .input => id
  | .output => id

private theorem source_lift_natural
    {generator : σ.Gen}
    (edge :
      Types.Pushout
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator)))
    (position : Fin (σ.input generator).length) :
    X.source
        (edgeLift right interface rightMap complementMap condition
          generator edge)
        position =
      nodeLift right interface rightMap complementMap condition
        ((σ.input generator).get position)
        (pushoutSource right interface edge position) := by
  refine Quot.inductionOn edge ?_
  intro side
  cases side with
  | inl rightEdge =>
      exact Graph.source_natural rightMap rightEdge position
  | inr complementEdge =>
      exact Graph.source_natural complementMap complementEdge position

private theorem target_lift_natural
    {generator : σ.Gen}
    (edge :
      Types.Pushout
        (TypeCat.ofHom (Graph.edgeMap right generator))
        (TypeCat.ofHom (Graph.edgeMap interface generator)))
    (position : Fin (σ.output generator).length) :
    X.target
        (edgeLift right interface rightMap complementMap condition
          generator edge)
        position =
      nodeLift right interface rightMap complementMap condition
        ((σ.output generator).get position)
        (pushoutTarget right interface edge position) := by
  refine Quot.inductionOn edge ?_
  intro side
  cases side with
  | inl rightEdge =>
      exact Graph.target_natural rightMap rightEdge position
  | inr complementEdge =>
      exact Graph.target_natural complementMap complementEdge position

private theorem liftComponent_naturality
    {sourceShape targetShape : IncidenceShape}
    (morphism : IncidenceShape.Hom sourceShape targetShape) :
    TypeCat.ofHom ((pushoutGraph right interface).map morphism) ≫
        TypeCat.ofHom
          (liftComponent right interface rightMap complementMap condition
            sourceShape) =
      TypeCat.ofHom
          (liftComponent right interface rightMap complementMap condition
            targetShape) ≫
        TypeCat.ofHom (X.map morphism) := by
  cases morphism with
  | id => cases sourceShape <;> rfl
  | nodeSource =>
      ext source
      rcases source with ⟨generator, edge, position⟩
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq
            (source_lift_natural right interface rightMap complementMap
              condition edge position).symm
  | edgeSource => rfl
  | nodeTarget =>
      ext target
      rcases target with ⟨generator, edge, position⟩
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq
            (target_lift_natural right interface rightMap complementMap
              condition edge position).symm
  | edgeTarget => rfl
  | nodeInput =>
      ext position
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq
            (Graph.input_natural complementMap position).symm
  | nodeOutput =>
      ext position
      apply Sigma.ext
      · rfl
      · exact
          heq_of_eq
            (Graph.output_natural complementMap position).symm

/-- Natural transformation underlying the mediating morphism. -/
def liftNatural :
    (pushoutGraph right interface).presheaf ⟶ X.presheaf where
  app shape :=
    TypeCat.ofHom
      (liftComponent right interface rightMap complementMap condition
        (Opposite.unop shape))
  naturality := by
    intro source target morphism
    simpa [FiniteHypergraph.presheaf] using
      liftComponent_naturality right interface rightMap complementMap
        condition (Quiver.Hom.unop morphism)

/-- Mediating morphism selected by an arbitrary cocone. -/
def lift :
    pushoutGraph right interface ⟶ X :=
  Over.homMk
    (liftNatural right interface rightMap complementMap condition)
    (by
      ext shape value
      rcases shape with ⟨shape⟩
      cases shape <;> rfl)

@[simp]
theorem lift_nodeMap
    (object : σ.Obj)
    (node : (pushoutGraph right interface).Node object) :
    Graph.nodeMap
        (lift right interface rightMap complementMap condition)
        object node =
      nodeLift right interface rightMap complementMap condition
        object node := by
  have sigma :=
    Graph.nodeMap_sigma
      (lift right interface rightMap complementMap condition)
      object node
  change
    (⟨object,
      nodeLift right interface rightMap complementMap condition
        object node⟩ : X.NodeCarrier) =
      ⟨object,
        Graph.nodeMap
          (lift right interface rightMap complementMap condition)
          object node⟩ at sigma
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigma |>.2).symm

@[simp]
theorem lift_edgeMap
    (generator : σ.Gen)
    (edge : (pushoutGraph right interface).Edge generator) :
    Graph.edgeMap
        (lift right interface rightMap complementMap condition)
        generator edge =
      edgeLift right interface rightMap complementMap condition
        generator edge := by
  have sigma :=
    Graph.edgeMap_sigma
      (lift right interface rightMap complementMap condition)
      generator edge
  change
    (⟨generator,
      edgeLift right interface rightMap complementMap condition
        generator edge⟩ : X.EdgeCarrier) =
      ⟨generator,
        Graph.edgeMap
          (lift right interface rightMap complementMap condition)
          generator edge⟩ at sigma
  exact eq_of_heq (Sigma.mk.inj_iff.mp sigma |>.2).symm

/-- The mediator agrees with the right cocone leg. -/
theorem rightInclusion_lift :
    rightInclusion right interface ≫
        lift right interface rightMap complementMap condition =
      rightMap := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext shape
  apply ConcreteCategory.hom_ext
  intro value
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      rcases value with ⟨object, node⟩
      change
        (⟨object, Graph.nodeMap rightMap object node⟩ :
          X.NodeCarrier) =
          rightMap.left.app (Opposite.op .node) ⟨object, node⟩
      exact (Graph.nodeMap_sigma rightMap object node).symm
  | edge =>
      rcases value with ⟨generator, edge⟩
      change
        (⟨generator, Graph.edgeMap rightMap generator edge⟩ :
          X.EdgeCarrier) =
          rightMap.left.app (Opposite.op .edge) ⟨generator, edge⟩
      exact (Graph.edgeMap_sigma rightMap generator edge).symm
  | source =>
      rcases value with ⟨generator, edge, position⟩
      change
        (⟨generator, Graph.edgeMap rightMap generator edge, position⟩ :
          X.SourceCarrier) =
          rightMap.left.app (Opposite.op .source)
            ⟨generator, edge, position⟩
      exact (Graph.sourceMap_sigma rightMap edge position).symm
  | target =>
      rcases value with ⟨generator, edge, position⟩
      change
        (⟨generator, Graph.edgeMap rightMap generator edge, position⟩ :
          X.TargetCarrier) =
          rightMap.left.app (Opposite.op .target)
            ⟨generator, edge, position⟩
      exact (Graph.targetMap_sigma rightMap edge position).symm
  | input =>
      change value =
        rightMap.left.app (Opposite.op .input) value
      exact (Graph.inputMap_identity rightMap value).symm
  | output =>
      change value =
        rightMap.left.app (Opposite.op .output) value
      exact (Graph.outputMap_identity rightMap value).symm

/-- The mediator agrees with the complement cocone leg. -/
theorem complementInclusion_lift :
    complementInclusion right interface ≫
        lift right interface rightMap complementMap condition =
      complementMap := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext shape
  apply ConcreteCategory.hom_ext
  intro value
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      rcases value with ⟨object, node⟩
      change
        (⟨object, Graph.nodeMap complementMap object node⟩ :
          X.NodeCarrier) =
          complementMap.left.app (Opposite.op .node) ⟨object, node⟩
      exact (Graph.nodeMap_sigma complementMap object node).symm
  | edge =>
      rcases value with ⟨generator, edge⟩
      change
        (⟨generator, Graph.edgeMap complementMap generator edge⟩ :
          X.EdgeCarrier) =
          complementMap.left.app (Opposite.op .edge) ⟨generator, edge⟩
      exact (Graph.edgeMap_sigma complementMap generator edge).symm
  | source =>
      rcases value with ⟨generator, edge, position⟩
      change
        (⟨generator,
            Graph.edgeMap complementMap generator edge, position⟩ :
          X.SourceCarrier) =
          complementMap.left.app (Opposite.op .source)
            ⟨generator, edge, position⟩
      exact (Graph.sourceMap_sigma complementMap edge position).symm
  | target =>
      rcases value with ⟨generator, edge, position⟩
      change
        (⟨generator,
            Graph.edgeMap complementMap generator edge, position⟩ :
          X.TargetCarrier) =
          complementMap.left.app (Opposite.op .target)
            ⟨generator, edge, position⟩
      exact (Graph.targetMap_sigma complementMap edge position).symm
  | input =>
      change value =
        complementMap.left.app (Opposite.op .input) value
      exact (Graph.inputMap_identity complementMap value).symm
  | output =>
      change value =
        complementMap.left.app (Opposite.op .output) value
      exact (Graph.outputMap_identity complementMap value).symm

/-- Any other mediator agreeing with both cocone legs is the selected lift. -/
theorem lift_unique
    (candidate : pushoutGraph right interface ⟶ X)
    (rightAgreement :
      rightInclusion right interface ≫ candidate = rightMap)
    (complementAgreement :
      complementInclusion right interface ≫ candidate = complementMap) :
    candidate =
      lift right interface rightMap complementMap condition := by
  apply Graph.hom_ext_of_node_edge
  · intro object node
    rw [lift_nodeMap]
    refine Quot.inductionOn node ?_
    intro side
    cases side with
    | inl rightNode =>
        have mapped :=
          congrArg (fun morphism =>
            Graph.nodeMap morphism object rightNode) rightAgreement
        rw [Graph.nodeMap_comp, rightInclusion_nodeMap] at mapped
        exact mapped
    | inr complementNode =>
        have mapped :=
          congrArg (fun morphism =>
            Graph.nodeMap morphism object complementNode)
            complementAgreement
        rw [Graph.nodeMap_comp, complementInclusion_nodeMap] at mapped
        exact mapped
  · intro generator edge
    rw [lift_edgeMap]
    refine Quot.inductionOn edge ?_
    intro side
    cases side with
    | inl rightEdge =>
        have mapped :=
          congrArg (fun morphism =>
            Graph.edgeMap morphism generator rightEdge) rightAgreement
        rw [Graph.edgeMap_comp, rightInclusion_edgeMap] at mapped
        exact mapped
    | inr complementEdge =>
        have mapped :=
          congrArg (fun morphism =>
            Graph.edgeMap morphism generator complementEdge)
            complementAgreement
        rw [Graph.edgeMap_comp, complementInclusion_edgeMap] at mapped
        exact mapped

end Universal

/-- The fibrewise square is a pushout in the intrinsic finite category. -/
theorem finite_isPushout
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    IsPushout right interface
      (rightInclusion right interface)
      (complementInclusion right interface) := by
  refine IsPushout.of_isColimit
    (PushoutCocone.IsColimit.mk
      (pushout_square right interface)
      (fun cocone =>
        lift right interface cocone.inl cocone.inr cocone.condition)
      ?_ ?_ ?_)
  · intro cocone
    exact
      rightInclusion_lift right interface cocone.inl cocone.inr
        cocone.condition
  · intro cocone
    exact
      complementInclusion_lift right interface cocone.inl cocone.inr
        cocone.condition
  · intro cocone candidate rightAgreement complementAgreement
    exact
      lift_unique right interface cocone.inl cocone.inr
        cocone.condition candidate rightAgreement complementAgreement

/-- The identity square is a pushout in `Type`. -/
private theorem identity_isPushout (carrier : Type*) :
    IsPushout
      (𝟙 carrier)
      (𝟙 carrier)
      (𝟙 carrier)
      (𝟙 carrier) := by
  exact
    IsPushout.of_isColimit
      (DPO.identityComplement carrier).isPushout

/--
The same square is a pushout after encoding into the entire typed-presheaf
slice, not merely relative to finite positional target objects.
-/
theorem presheaf_isPushout
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    IsPushout
      right.left
      interface.left
      (rightInclusion right interface).left
      (complementInclusion right interface).left := by
  apply IsPushout.of_forall_isPushout_app
  intro shape
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      change
        IsPushout
          (right.left.app (Opposite.op IncidenceShape.node))
          (interface.left.app (Opposite.op IncidenceShape.node))
          (TypeCat.ofHom
            (Indexed.leftInclusion
              (fun object => Graph.nodeMap right object)
              (fun object => Graph.nodeMap interface object)))
          (TypeCat.ofHom
            (Indexed.rightInclusion
              (fun object => Graph.nodeMap right object)
              (fun object => Graph.nodeMap interface object)))
      exact Indexed.isPushout
          (rightFiber := fun object => Graph.nodeMap right object)
          (complementFiber := fun object =>
            Graph.nodeMap interface object)
          (fun node =>
            right.left.app (Opposite.op IncidenceShape.node) node)
          (fun node =>
            interface.left.app (Opposite.op IncidenceShape.node) node)
          (Graph.nodeMap_sigma right)
          (Graph.nodeMap_sigma interface)
  | edge =>
      change
        IsPushout
          (right.left.app (Opposite.op IncidenceShape.edge))
          (interface.left.app (Opposite.op IncidenceShape.edge))
          (TypeCat.ofHom
            (Indexed.leftInclusion
              (fun generator => Graph.edgeMap right generator)
              (fun generator => Graph.edgeMap interface generator)))
          (TypeCat.ofHom
            (Indexed.rightInclusion
              (fun generator => Graph.edgeMap right generator)
              (fun generator => Graph.edgeMap interface generator)))
      exact Indexed.isPushout
          (rightFiber := fun generator => Graph.edgeMap right generator)
          (complementFiber := fun generator =>
            Graph.edgeMap interface generator)
          (fun edge =>
            right.left.app (Opposite.op IncidenceShape.edge) edge)
          (fun edge =>
            interface.left.app (Opposite.op IncidenceShape.edge) edge)
          (Graph.edgeMap_sigma right)
          (Graph.edgeMap_sigma interface)
  | source =>
      change
        IsPushout
          (right.left.app (Opposite.op IncidenceShape.source))
          (interface.left.app (Opposite.op IncidenceShape.source))
          (TypeCat.ofHom
            (Positioned.leftInclusion
              (Position := fun generator =>
                Fin (σ.input generator).length)
              (fun generator => Graph.edgeMap right generator)
              (fun generator => Graph.edgeMap interface generator)))
          (TypeCat.ofHom
            (Positioned.rightInclusion
              (Position := fun generator =>
                Fin (σ.input generator).length)
              (fun generator => Graph.edgeMap right generator)
              (fun generator => Graph.edgeMap interface generator)))
      exact Positioned.isPushout
          (Position := fun generator =>
            Fin (σ.input generator).length)
          (rightFiber := fun generator =>
            Graph.edgeMap right generator)
          (complementFiber := fun generator =>
            Graph.edgeMap interface generator)
          (fun source =>
            right.left.app (Opposite.op IncidenceShape.source) source)
          (fun source =>
            interface.left.app (Opposite.op IncidenceShape.source) source)
          (fun generator edge position =>
            Graph.sourceMap_sigma right edge position)
          (fun generator edge position =>
            Graph.sourceMap_sigma interface edge position)
  | target =>
      change
        IsPushout
          (right.left.app (Opposite.op IncidenceShape.target))
          (interface.left.app (Opposite.op IncidenceShape.target))
          (TypeCat.ofHom
            (Positioned.leftInclusion
              (Position := fun generator =>
                Fin (σ.output generator).length)
              (fun generator => Graph.edgeMap right generator)
              (fun generator => Graph.edgeMap interface generator)))
          (TypeCat.ofHom
            (Positioned.rightInclusion
              (Position := fun generator =>
                Fin (σ.output generator).length)
              (fun generator => Graph.edgeMap right generator)
              (fun generator => Graph.edgeMap interface generator)))
      exact Positioned.isPushout
          (Position := fun generator =>
            Fin (σ.output generator).length)
          (rightFiber := fun generator =>
            Graph.edgeMap right generator)
          (complementFiber := fun generator =>
            Graph.edgeMap interface generator)
          (fun target =>
            right.left.app (Opposite.op IncidenceShape.target) target)
          (fun target =>
            interface.left.app (Opposite.op IncidenceShape.target) target)
          (fun generator edge position =>
            Graph.targetMap_sigma right edge position)
          (fun generator edge position =>
            Graph.targetMap_sigma interface edge position)
  | input =>
      have rightIdentity :
          right.left.app (Opposite.op IncidenceShape.input) =
            𝟙 (Fin inputTypes.length) := by
        apply ConcreteCategory.hom_ext
        intro position
        exact Graph.inputMap_identity right position
      have interfaceIdentity :
          interface.left.app (Opposite.op IncidenceShape.input) =
            𝟙 (Fin inputTypes.length) := by
        apply ConcreteCategory.hom_ext
        intro position
        exact Graph.inputMap_identity interface position
      rw [rightIdentity, interfaceIdentity]
      change
        IsPushout
          (𝟙 (Fin inputTypes.length))
          (𝟙 (Fin inputTypes.length))
          (𝟙 (Fin inputTypes.length))
          (𝟙 (Fin inputTypes.length))
      exact identity_isPushout (Fin inputTypes.length)
  | output =>
      have rightIdentity :
          right.left.app (Opposite.op IncidenceShape.output) =
            𝟙 (Fin outputTypes.length) := by
        apply ConcreteCategory.hom_ext
        intro position
        exact Graph.outputMap_identity right position
      have interfaceIdentity :
          interface.left.app (Opposite.op IncidenceShape.output) =
            𝟙 (Fin outputTypes.length) := by
        apply ConcreteCategory.hom_ext
        intro position
        exact Graph.outputMap_identity interface position
      rw [rightIdentity, interfaceIdentity]
      change
        IsPushout
          (𝟙 (Fin outputTypes.length))
          (𝟙 (Fin outputTypes.length))
          (𝟙 (Fin outputTypes.length))
          (𝟙 (Fin outputTypes.length))
      exact identity_isPushout (Fin outputTypes.length)

/-- The encoded square is a pushout in the typed presheaf slice. -/
theorem typed_isPushout
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    IsPushout
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map interface)
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        (rightInclusion right interface))
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        (complementInclusion right interface)) := by
  apply IsPushout.of_map_of_faithful
    (F := Over.forget
      (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes))
  exact presheaf_isPushout right interface

/--
Every ambient typed-presheaf pushout of an intrinsic finite positional span
is isomorphic to the encoded fibrewise pushout, hence remains in the precise
positional essential image.
-/
theorem ambient_result_mem_positionalImage
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    {result :
      AdhesiveDPOI.TypedHypergraph
        (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)}
    {rightToResult :
      R.encoded ⟶ result}
    {complementToResult :
      D.encoded ⟶ result}
    (square :
      IsPushout
        ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)
        ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map interface)
        rightToResult complementToResult) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      result := by
  refine ⟨pushoutGraph right interface, ?_⟩
  exact
    ⟨(typed_isPushout right interface).isoIsPushout
      R.encoded D.encoded square⟩

/--
Closure of the second DPO pushout is invariant under replacing its ambient
complement by an isomorphic intrinsic finite positional representative.

This is the transport lemma needed after
`PositionalComplementClosure.complementTypedIso`: the original DPO square
has the canonical retained presheaf as its complement, whereas
`ambient_result_mem_positionalImage` expects an intrinsic positional
complement.  The transported complement leg is
`interfaceToComplement ≫ complementIso.inv`.
-/
theorem ambient_result_mem_of_complement_iso
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    {ambientComplement result :
      AdhesiveDPOI.TypedHypergraph
        (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)}
    (complementIso : D.encoded ≅ ambientComplement)
    (interfaceToComplement : K.encoded ⟶ ambientComplement)
    (rightToResult : R.encoded ⟶ result)
    (complementToResult : ambientComplement ⟶ result)
    (square :
      IsPushout
        ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)
        interfaceToComplement
        rightToResult complementToResult) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      result := by
  let positionalInterface : K.encoded ⟶ D.encoded :=
    interfaceToComplement ≫ complementIso.inv
  have transported :
      IsPushout
        ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)
        ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
          positionalInterface)
        rightToResult
        (complementIso.hom ≫ complementToResult) := by
    apply square.of_iso
      (Iso.refl K.encoded)
      (Iso.refl R.encoded)
      complementIso.symm
      (Iso.refl result)
    · exact
        (Category.comp_id _).trans
          (Category.id_comp _).symm
    · rfl
    · exact (Category.id_comp _).symm
    · simp
  exact
    ambient_result_mem_positionalImage
      (right := right)
      (interface := positionalInterface)
      transported

end PushoutObject

/-! ## Canonical finite positional DPO derivations -/

namespace CanonicalPositionalDPO

open Cantilune.Core.PositionalComplementClosure

variable {K L R G : Graph σ inputTypes outputTypes}
variable (left : K ⟶ L) (right : K ⟶ R) (occurrence : L ⟶ G)

/-- Package an intrinsic positional span as an ambient linear DPO rule. -/
def rule
    [leftMono : Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [rightMono : Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)] :
    AdhesiveDPOI.Rule
      (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes) where
  interface := K.encoded
  left := L.encoded
  right := R.encoded
  leftLeg :=
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left
  rightLeg :=
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right
  left_mono := leftMono
  right_mono := rightMono

/-- Package an arbitrary ambient-monic positional occurrence as a DPO match. -/
def matching
    [leftMono : Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [rightMono : Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [occurrenceMono : Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)] :
    AdhesiveDPOI.Match (rule left right) G.encoded where
  arrow :=
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
      occurrence
  mono := occurrenceMono

/-- The raw positional gluing predicate is exactly the ambient one. -/
theorem legalMatch
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    PresheafComplementDPO.Presheaf.LegalMatch
      (rule left right) (matching left right occurrence) :=
  legal

/--
The generic canonical retained presheaf specializes definitionally to the
raw retained object used by positional complement closure.
-/
theorem canonicalComplement_eq_retained
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    PresheafComplementDPO.Presheaf.complement
        (legalMatch left right occurrence legal) =
      retainedObject left occurrence legal :=
  rfl

/--
The canonical arbitrary-monic ambient derivation associated with an
intrinsic finite positional rule and occurrence.
-/
noncomputable def canonicalDerivation
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    AdhesiveDPOI.Derivation
      (rule left right) (matching left right occurrence) :=
  OpenCospanDPOI.Presheaf.canonicalDerivation
    (legalMatch left right occurrence legal)

/--
The result of every canonical legal finite positional DPO step stays in the
finite positional essential image.  No `InterfaceLocal` or thin-inclusion
hypothesis is used: all three legs are arbitrary ambient monomorphisms.
-/
theorem canonicalResult_mem_positionalImage
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      (canonicalDerivation left right occurrence legal).result := by
  let derivation := canonicalDerivation left right occurrence legal
  let complementIso :
      (complementGraph left occurrence legal boundary).encoded ≅
        derivation.complement := by
    exact complementTypedIso left occurrence legal boundary
  exact
    PushoutObject.ambient_result_mem_of_complement_iso
      (right := right)
      (D := complementGraph left occurrence legal boundary)
      complementIso
      derivation.interfaceToComplement
      derivation.rightToResult
      derivation.complementToResult
      derivation.resultSquare

/-- Forget an adhesive derivation bundle to the generic two-pushout witness. -/
noncomputable def toWitness
    {T : AdhesiveDPOI.HypergraphPresheaf
      FinitePresheafDPOI.IncidenceShape}
    {ambientRule : AdhesiveDPOI.Rule T}
    {host : AdhesiveDPOI.TypedHypergraph T}
    {ambientMatch : AdhesiveDPOI.Match ambientRule host}
    (derivation : AdhesiveDPOI.Derivation ambientRule ambientMatch) :
    DPO.Witness
      ambientRule.leftLeg ambientRule.rightLeg ambientMatch.arrow where
  complement :=
    { context := derivation.complement
      interface := derivation.interfaceToComplement
      inclusion := derivation.complementToHost
      square := derivation.complementSquare.w
      isPushout := derivation.complementSquare.isColimit }
  result :=
    { cocone :=
        PushoutCocone.mk
          derivation.complementToResult
          derivation.rightToResult
          derivation.resultSquare.w.symm
      isPushout := derivation.resultSquare.flip.isColimit }

/-- The generic DPO witness underlying the canonical positional derivation. -/
noncomputable def canonicalWitness
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    DPO.Witness
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence) :=
  toWitness (canonicalDerivation left right occurrence legal)

private theorem encoded_mem_positionalImage
    (X : Graph σ inputTypes outputTypes) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      X.encoded :=
  ⟨X, ⟨Iso.refl X.encoded⟩⟩

/--
All six objects of the canonical arbitrary-monic DPO witness are in the
finite positional essential image.  This discharges both membership premises
that were formerly left to callers of `PositionalDPOIBridge`.
-/
theorem canonicalWitness_in_positionalImage
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    PositionalDPOIBridge.WitnessInPositionalImage
      (canonicalWitness left right occurrence legal) := by
  refine
    { interface_mem := encoded_mem_positionalImage K
      left_mem := encoded_mem_positionalImage L
      right_mem := encoded_mem_positionalImage R
      host_mem := encoded_mem_positionalImage G
      complement_mem := ?_
      result_mem := ?_ }
  · refine
      ⟨complementGraph left occurrence legal boundary, ?_⟩
    exact
      ⟨complementTypedIso left occurrence legal boundary⟩
  · exact
      canonicalResult_mem_positionalImage
        left right occurrence legal boundary

/--
Every legal boundary-retaining arbitrary-monic finite positional DPO step
therefore transports to a genuine two-pushout witness in the intrinsic
finite positional category.
-/
theorem canonical_finite_bridge_exists
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    Nonempty
      (PositionalDPOIBridge.FiniteWitnessType
        (canonicalWitness left right occurrence legal)
        (canonicalWitness_in_positionalImage
          left right occurrence legal boundary)) :=
  PositionalDPOIBridge.finite_bridge_exists
    (canonicalWitness left right occurrence legal)
    (canonicalWitness_in_positionalImage
      left right occurrence legal boundary)

end CanonicalPositionalDPO

end Cantilune.Core.PositionalPushoutClosure
