import Cantilune.Core.PositionalPushoutClosure
import Cantilune.Core.DPOConcurrency

/-!
# Positional closure for parallel-independent DPO concurrency

The generic adhesive concurrency theorem forms the intersection of two
retained complements as a pullback.  This file proves that, for arbitrary
monic legal matches between finite positional open hypergraphs, that
intersection is again represented by a finite positional hypergraph.

Together with `PositionalPushoutClosure`, this supplies the object-closure
facts needed for both residual contexts and both sequential results.
-/

noncomputable section

namespace Cantilune.Core.PositionalConcurrencyClosure

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PositionalComplementClosure
open Cantilune.Core.PositionalComplementClosure.GraphOps

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

abbrev Graph (σ : FinSignature)
    (inputTypes outputTypes : List σ.Obj) :=
  PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes

namespace TypeIntersection

universe u

variable {X : Type u} (First Second : X → Prop)

/-- Elements satisfying both retained-subobject predicates. -/
abbrev Both := {x : X // First x ∧ Second x}

def toFirst (value : Both First Second) : {x : X // First x} :=
  ⟨value.1, value.2.1⟩

def toSecond (value : Both First Second) : {x : X // Second x} :=
  ⟨value.1, value.2.2⟩

@[simp]
theorem toFirst_val (value : Both First Second) :
    (toFirst First Second value).1 = value.1 := by
  rcases value with ⟨value, first, second⟩
  rfl

@[simp]
theorem toSecond_val (value : Both First Second) :
    (toSecond First Second value).1 = value.1 := by
  rcases value with ⟨value, first, second⟩
  rfl

/-- Intersection of two subtypes is their pullback over the common carrier. -/
theorem isPullback :
    IsPullback
      (TypeCat.ofHom (toFirst First Second))
      (TypeCat.ofHom (toSecond First Second))
      (TypeCat.ofHom (Subtype.val : {x : X // First x} → X))
      (TypeCat.ofHom (Subtype.val : {x : X // Second x} → X)) := by
  apply IsPullback.mk'
  · apply ConcreteCategory.hom_ext
    intro value
    change
      (toFirst First Second value).1 =
        (toSecond First Second value).1
    simp
  · intro T first second firstAgreement _
    apply ConcreteCategory.hom_ext
    intro value
    have point :=
      ConcreteCategory.congr_hom firstAgreement value
    change
      toFirst First Second (first value) =
        toFirst First Second (second value)
      at point
    have underlying :
        (first value : Both First Second).1 =
          (second value : Both First Second).1 := by
      have equality :=
        congrArg
          (fun retained : {x : X // First x} => retained.1)
          point
      simpa only [toFirst_val] using equality
    exact Subtype.ext underlying
  · intro T first second compatibility
    let lift : T ⟶ Both First Second :=
      TypeCat.ofHom fun value =>
        ⟨(first value).1, (first value).2, by
          have point :=
            ConcreteCategory.congr_hom compatibility value
          have underlying : (first value).1 = (second value).1 :=
            point
          exact underlying ▸ (second value).2⟩
    refine ⟨lift, ?_, ?_⟩
    · apply ConcreteCategory.hom_ext
      intro value
      apply Subtype.ext
      rfl
    · apply ConcreteCategory.hom_ext
      intro value
      apply Subtype.ext
      exact ConcreteCategory.congr_hom compatibility value

end TypeIntersection

namespace Joint

variable
  {K₁ L₁ K₂ L₂ G : Graph σ inputTypes outputTypes}
  (left₁ : K₁ ⟶ L₁) (occurrence₁ : L₁ ⟶ G)
  (left₂ : K₂ ⟶ L₂) (occurrence₂ : L₂ ⟶ G)

/-- A host element retained by both canonical deletions. -/
def Retained
    (shape : IncidenceShapeᵒᵖ)
    (value : G.encoded.left.obj shape) : Prop :=
  (¬ Deleted left₁ occurrence₁ shape value) ∧
    ¬ Deleted left₂ occurrence₂ shape value

/-- The finite positional graph retained simultaneously by both steps. -/
noncomputable def graph
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂) :
    Graph σ inputTypes outputTypes where
  Node object :=
    {node : G.Node object //
      Retained left₁ occurrence₁ left₂ occurrence₂ nodeObject
        (⟨object, node⟩ : G.NodeCarrier)}
  Edge generator :=
    {edge : G.Edge generator //
      Retained left₁ occurrence₁ left₂ occurrence₂ edgeObject
        (⟨generator, edge⟩ : G.EdgeCarrier)}
  nodeFintype _ := by
    classical
    infer_instance
  edgeFintype _ := by
    classical
    infer_instance
  source := by
    intro generator edge position
    refine ⟨G.source edge.1 position, ?_⟩
    let incidence : G.SourceCarrier :=
      ⟨generator, edge.1, position⟩
    constructor
    · have sourceRetained :
          ¬ Deleted left₁ occurrence₁ sourceObject incidence :=
        (source_retained_iff_edge_retained
          left₁ occurrence₁ legal₁ incidence).2 (by
            simpa [incidence, GraphOps.sourceEdge,
              PositionalDPOI.FiniteHypergraph.map] using edge.2.1)
      have nodeRetained :=
        legal₁
          (Quiver.Hom.op IncidenceShape.Hom.nodeSource)
          incidence sourceRetained
      exact nodeRetained
    · have sourceRetained :
          ¬ Deleted left₂ occurrence₂ sourceObject incidence :=
        (source_retained_iff_edge_retained
          left₂ occurrence₂ legal₂ incidence).2 (by
            simpa [incidence, GraphOps.sourceEdge,
              PositionalDPOI.FiniteHypergraph.map] using edge.2.2)
      have nodeRetained :=
        legal₂
          (Quiver.Hom.op IncidenceShape.Hom.nodeSource)
          incidence sourceRetained
      exact nodeRetained
  target := by
    intro generator edge position
    refine ⟨G.target edge.1 position, ?_⟩
    let incidence : G.TargetCarrier :=
      ⟨generator, edge.1, position⟩
    constructor
    · have targetRetained :
          ¬ Deleted left₁ occurrence₁ targetObject incidence :=
        (target_retained_iff_edge_retained
          left₁ occurrence₁ legal₁ incidence).2 (by
            simpa [incidence, GraphOps.targetEdge,
              PositionalDPOI.FiniteHypergraph.map] using edge.2.1)
      have nodeRetained :=
        legal₁
          (Quiver.Hom.op IncidenceShape.Hom.nodeTarget)
          incidence targetRetained
      exact nodeRetained
    · have targetRetained :
          ¬ Deleted left₂ occurrence₂ targetObject incidence :=
        (target_retained_iff_edge_retained
          left₂ occurrence₂ legal₂ incidence).2 (by
            simpa [incidence, GraphOps.targetEdge,
              PositionalDPOI.FiniteHypergraph.map] using edge.2.2)
      have nodeRetained :=
        legal₂
          (Quiver.Hom.op IncidenceShape.Hom.nodeTarget)
          incidence targetRetained
      exact nodeRetained
  inputBoundary := by
    intro position
    refine ⟨G.inputBoundary position, ?_, ?_⟩
    · exact
        legal₁
          (Quiver.Hom.op IncidenceShape.Hom.nodeInput)
          position (boundary₁.1 position)
    · exact
        legal₂
          (Quiver.Hom.op IncidenceShape.Hom.nodeInput)
          position (boundary₂.1 position)
  outputBoundary := by
    intro position
    refine ⟨G.outputBoundary position, ?_, ?_⟩
    · exact
        legal₁
          (Quiver.Hom.op IncidenceShape.Hom.nodeOutput)
          position (boundary₁.2 position)
    · exact
        legal₂
          (Quiver.Hom.op IncidenceShape.Hom.nodeOutput)
          position (boundary₂.2 position)
  inputBoundary_injective := by
    intro first second equality
    apply G.inputBoundary_injective
    exact congrArg
      (fun value => (⟨value.1, value.2.1⟩ : G.NodeCarrier))
      equality
  outputBoundary_injective := by
    intro first second equality
    apply G.outputBoundary_injective
    exact congrArg
      (fun value => (⟨value.1, value.2.1⟩ : G.NodeCarrier))
      equality

/-- Presheaf of host elements retained by both matches. -/
def presheaf
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    IncidenceShapeᵒᵖ ⥤ Type where
  obj shape :=
    TypeIntersection.Both
      (fun value : G.encoded.left.obj shape =>
        ¬ Deleted left₁ occurrence₁ shape value)
      (fun value : G.encoded.left.obj shape =>
        ¬ Deleted left₂ occurrence₂ shape value)
  map {source target} morphism :=
    TypeCat.ofHom fun value =>
      ⟨G.encoded.left.map morphism value.1,
        legal₁ morphism value.1 value.2.1,
        legal₂ morphism value.1 value.2.2⟩
  map_id shape := by
    ext value
    simp
  map_comp first second := by
    ext value
    simp

def typing
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    presheaf left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂ ⟶
      typeGraph σ inputTypes outputTypes where
  app shape :=
    TypeCat.ofHom fun value => G.encoded.hom.app shape value.1
  naturality := by
    intro source target morphism
    ext value
    exact ConcreteCategory.congr_hom
      (G.encoded.hom.naturality morphism) value.1

/-- Typed common-retained object. -/
def object
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    AdhesiveDPOI.TypedHypergraph
      (typeGraph σ inputTypes outputTypes) :=
  Over.mk
    (typing left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂)

private def comparisonComponent
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (shape : IncidenceShapeᵒᵖ) :
    (graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂).encoded.left.obj shape →
      (object left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂).left.obj shape := by
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      exact fun value =>
        ⟨⟨value.1, value.2.1⟩, value.2.2.1, value.2.2.2⟩
  | edge =>
      exact fun value =>
        ⟨⟨value.1, value.2.1⟩, value.2.2.1, value.2.2.2⟩
  | source =>
      exact fun value =>
        ⟨⟨value.1, value.2.1.1, value.2.2⟩,
          (source_retained_iff_edge_retained
            left₁ occurrence₁ legal₁
            (⟨value.1, value.2.1.1, value.2.2⟩ :
              G.SourceCarrier)).2 value.2.1.2.1,
          (source_retained_iff_edge_retained
            left₂ occurrence₂ legal₂
            (⟨value.1, value.2.1.1, value.2.2⟩ :
              G.SourceCarrier)).2 value.2.1.2.2⟩
  | target =>
      exact fun value =>
        ⟨⟨value.1, value.2.1.1, value.2.2⟩,
          (target_retained_iff_edge_retained
            left₁ occurrence₁ legal₁
            (⟨value.1, value.2.1.1, value.2.2⟩ :
              G.TargetCarrier)).2 value.2.1.2.1,
          (target_retained_iff_edge_retained
            left₂ occurrence₂ legal₂
            (⟨value.1, value.2.1.1, value.2.2⟩ :
              G.TargetCarrier)).2 value.2.1.2.2⟩
  | input =>
      exact fun position =>
        ⟨position, boundary₁.1 position, boundary₂.1 position⟩
  | output =>
      exact fun position =>
        ⟨position, boundary₁.2 position, boundary₂.2 position⟩

private def comparisonInverseComponent
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (shape : IncidenceShapeᵒᵖ) :
    (object left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂).left.obj shape →
      (graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂).encoded.left.obj shape := by
  rcases shape with ⟨shape⟩
  cases shape with
  | node =>
      exact fun value =>
        ⟨value.1.1, ⟨value.1.2, value.2.1, value.2.2⟩⟩
  | edge =>
      exact fun value =>
        ⟨value.1.1, ⟨value.1.2, value.2.1, value.2.2⟩⟩
  | source =>
      exact fun value =>
        ⟨value.1.1,
          ⟨⟨value.1.2.1,
              (source_retained_iff_edge_retained
                left₁ occurrence₁ legal₁ value.1).1 value.2.1,
              (source_retained_iff_edge_retained
                left₂ occurrence₂ legal₂ value.1).1 value.2.2⟩,
            value.1.2.2⟩⟩
  | target =>
      exact fun value =>
        ⟨value.1.1,
          ⟨⟨value.1.2.1,
              (target_retained_iff_edge_retained
                left₁ occurrence₁ legal₁ value.1).1 value.2.1,
              (target_retained_iff_edge_retained
                left₂ occurrence₂ legal₂ value.1).1 value.2.2⟩,
            value.1.2.2⟩⟩
  | input =>
      exact fun value => value.1
  | output =>
      exact fun value => value.1

private theorem comparison_leftInverse
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (shape : IncidenceShapeᵒᵖ) :
    Function.LeftInverse
      (comparisonInverseComponent
        left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ shape)
      (comparisonComponent
        left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ shape) := by
  rcases shape with ⟨shape⟩
  cases shape <;> intro value
  · rcases value with ⟨object, node⟩
    rfl
  · rcases value with ⟨generator, edge⟩
    rfl
  · rcases value with ⟨generator, edge, position⟩
    rfl
  · rcases value with ⟨generator, edge, position⟩
    rfl
  · rfl
  · rfl

private theorem comparison_rightInverse
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (shape : IncidenceShapeᵒᵖ) :
    Function.RightInverse
      (comparisonInverseComponent
        left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ shape)
      (comparisonComponent
        left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ shape) := by
  rcases shape with ⟨shape⟩
  cases shape <;> intro value
  · rcases value with ⟨⟨object, node⟩, retained⟩
    rfl
  · rcases value with ⟨⟨generator, edge⟩, retained⟩
    rfl
  · rcases value with ⟨⟨generator, edge, position⟩, retained⟩
    apply Subtype.ext
    rfl
  · rcases value with ⟨⟨generator, edge, position⟩, retained⟩
    apply Subtype.ext
    rfl
  · rcases value with ⟨position, retained⟩
    apply Subtype.ext
    rfl
  · rcases value with ⟨position, retained⟩
    apply Subtype.ext
    rfl

private def comparisonEquiv
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (shape : IncidenceShapeᵒᵖ) :
    (graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂).encoded.left.obj shape ≃
      (object left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂).left.obj shape where
  toFun :=
    comparisonComponent left₁ occurrence₁ left₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ shape
  invFun :=
    comparisonInverseComponent left₁ occurrence₁ left₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ shape
  left_inv :=
    comparison_leftInverse left₁ occurrence₁ left₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ shape
  right_inv :=
    comparison_rightInverse left₁ occurrence₁ left₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ shape

private theorem comparison_naturality_base
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    {sourceShape targetShape : IncidenceShape}
    (morphism : IncidenceShape.Hom sourceShape targetShape) :
    (graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂).encoded.left.map
          (Quiver.Hom.op morphism) ≫
        TypeCat.ofHom
          (comparisonComponent left₁ occurrence₁ left₂ occurrence₂
            legal₁ boundary₁ legal₂ boundary₂
              (Opposite.op sourceShape)) =
      TypeCat.ofHom
          (comparisonComponent left₁ occurrence₁ left₂ occurrence₂
            legal₁ boundary₁ legal₂ boundary₂
              (Opposite.op targetShape)) ≫
        (object left₁ occurrence₁ left₂ occurrence₂
          legal₁ legal₂).left.map (Quiver.Hom.op morphism) := by
  cases morphism <;> ext value <;> apply Subtype.ext <;> rfl

private def comparisonNatural
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂) :
    (graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂).encoded.left ⟶
      (object left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂).left where
  app shape :=
    TypeCat.ofHom
      (comparisonComponent left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ shape)
  naturality := by
    intro source target morphism
    simpa only [Quiver.Hom.op_unop] using
      comparison_naturality_base
        left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂
        (Quiver.Hom.unop morphism)

/-- The encoded joint graph is the common-retained typed presheaf. -/
noncomputable def typedIso
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂) :
    (graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂).encoded ≅
      object left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂ :=
  Over.isoMk
    (NatIso.ofComponents
      (fun shape =>
        (comparisonEquiv left₁ occurrence₁ left₂ occurrence₂
          legal₁ boundary₁ legal₂ boundary₂ shape).toIso)
      (fun morphism =>
        (comparisonNatural left₁ occurrence₁ left₂ occurrence₂
          legal₁ boundary₁ legal₂ boundary₂).naturality morphism))
    (by
      ext shape value
      rcases shape with ⟨shape⟩
      cases shape <;> rcases value with ⟨first, second⟩ <;> rfl)

def firstProjectionNatural
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    presheaf left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂ ⟶
      retainedPresheaf left₁ occurrence₁ legal₁ where
  app shape :=
    TypeCat.ofHom
      (TypeIntersection.toFirst
        (fun value : G.encoded.left.obj shape =>
          ¬ Deleted left₁ occurrence₁ shape value)
        (fun value : G.encoded.left.obj shape =>
          ¬ Deleted left₂ occurrence₂ shape value))
  naturality := by
    intro source target morphism
    ext value
    rcases value with ⟨value, first, second⟩
    apply Subtype.ext
    simp only
    dsimp [object, typing, presheaf,
      retainedObject, retainedTyping, retainedPresheaf,
      TypeIntersection.toFirst]

def secondProjectionNatural
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    presheaf left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂ ⟶
      retainedPresheaf left₂ occurrence₂ legal₂ where
  app shape :=
    TypeCat.ofHom
      (TypeIntersection.toSecond
        (fun value : G.encoded.left.obj shape =>
          ¬ Deleted left₁ occurrence₁ shape value)
        (fun value : G.encoded.left.obj shape =>
          ¬ Deleted left₂ occurrence₂ shape value))
  naturality := by
    intro source target morphism
    ext value
    rcases value with ⟨value, first, second⟩
    apply Subtype.ext
    simp only
    dsimp [object, typing, presheaf,
      retainedObject, retainedTyping, retainedPresheaf,
      TypeIntersection.toSecond]

/-- First projection of the common retained object. -/
def firstProjection
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    object left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂ ⟶
      retainedObject left₁ occurrence₁ legal₁ :=
  Over.homMk
    (firstProjectionNatural left₁ occurrence₁ left₂ occurrence₂
      legal₁ legal₂)
    (by
      ext shape value
      rcases value with ⟨value, first, second⟩
      rfl)

/-- Second projection of the common retained object. -/
def secondProjection
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    object left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂ ⟶
      retainedObject left₂ occurrence₂ legal₂ :=
  Over.homMk
    (secondProjectionNatural left₁ occurrence₁ left₂ occurrence₂
      legal₁ legal₂)
    (by
      ext shape value
      rcases value with ⟨value, first, second⟩
      rfl)

def firstInclusionNatural
    (legal₁ : Legal left₁ occurrence₁) :
    retainedPresheaf left₁ occurrence₁ legal₁ ⟶
      G.presheaf where
  app shape := TypeCat.ofHom Subtype.val
  naturality := by
    intro source target morphism
    ext value
    rfl

def secondInclusionNatural
    (legal₂ : Legal left₂ occurrence₂) :
    retainedPresheaf left₂ occurrence₂ legal₂ ⟶
      G.presheaf where
  app shape := TypeCat.ofHom Subtype.val
  naturality := by
    intro source target morphism
    ext value
    rfl

/-- Inclusion of the first retained complement in the common host. -/
def firstInclusion
    (legal₁ : Legal left₁ occurrence₁) :
    retainedObject left₁ occurrence₁ legal₁ ⟶ G.encoded :=
  Over.homMk
    (firstInclusionNatural left₁ occurrence₁ legal₁)
    (by rfl)

/-- Inclusion of the second retained complement in the common host. -/
def secondInclusion
    (legal₂ : Legal left₂ occurrence₂) :
    retainedObject left₂ occurrence₂ legal₂ ⟶ G.encoded :=
  Over.homMk
    (secondInclusionNatural left₂ occurrence₂ legal₂)
    (by rfl)

/-- The common retained presheaf is the pointwise intersection pullback. -/
theorem presheaf_isPullback
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    IsPullback
      (firstProjection left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂).left
      (secondProjection left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂).left
      (firstInclusion left₁ occurrence₁ legal₁).left
      (secondInclusion left₂ occurrence₂ legal₂).left := by
  apply IsPullback.of_forall_isPullback_app
  intro shape
  change
    IsPullback
      (TypeCat.ofHom
        (TypeIntersection.toFirst
          (fun value : G.encoded.left.obj shape =>
            ¬ Deleted left₁ occurrence₁ shape value)
          (fun value : G.encoded.left.obj shape =>
            ¬ Deleted left₂ occurrence₂ shape value)))
      (TypeCat.ofHom
        (TypeIntersection.toSecond
          (fun value : G.encoded.left.obj shape =>
            ¬ Deleted left₁ occurrence₁ shape value)
          (fun value : G.encoded.left.obj shape =>
            ¬ Deleted left₂ occurrence₂ shape value)))
      (TypeCat.ofHom
        (Subtype.val :
          {value : G.encoded.left.obj shape //
            ¬ Deleted left₁ occurrence₁ shape value} →
            G.encoded.left.obj shape))
      (TypeCat.ofHom
        (Subtype.val :
          {value : G.encoded.left.obj shape //
            ¬ Deleted left₂ occurrence₂ shape value} →
            G.encoded.left.obj shape))
  exact TypeIntersection.isPullback
      (fun value : G.encoded.left.obj shape =>
        ¬ Deleted left₁ occurrence₁ shape value)
      (fun value : G.encoded.left.obj shape =>
        ¬ Deleted left₂ occurrence₂ shape value)

/-- The common retained object is a pullback in the typed presheaf slice. -/
theorem typed_isPullback
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂) :
    IsPullback
      (firstProjection left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂)
      (secondProjection left₁ occurrence₁ left₂ occurrence₂
        legal₁ legal₂)
      (firstInclusion left₁ occurrence₁ legal₁)
      (secondInclusion left₂ occurrence₂ legal₂) := by
  apply IsPullback.of_map_of_faithful
    (F := Over.forget (typeGraph σ inputTypes outputTypes))
  exact
    presheaf_isPullback
      left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂

/--
The intrinsic joint graph itself is a pullback of the two retained
complements in the entire typed-presheaf slice.
-/
theorem graph_isPullback
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂) :
    IsPullback
      ((typedIso left₁ occurrence₁ left₂ occurrence₂
          legal₁ boundary₁ legal₂ boundary₂).hom ≫
        firstProjection left₁ occurrence₁ left₂ occurrence₂
          legal₁ legal₂)
      ((typedIso left₁ occurrence₁ left₂ occurrence₂
          legal₁ boundary₁ legal₂ boundary₂).hom ≫
        secondProjection left₁ occurrence₁ left₂ occurrence₂
          legal₁ legal₂)
      (firstInclusion left₁ occurrence₁ legal₁)
      (secondInclusion left₂ occurrence₂ legal₂) := by
  apply
    (typed_isPullback
      left₁ occurrence₁ left₂ occurrence₂ legal₁ legal₂).of_iso'
      (typedIso left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂)
      (Iso.refl _)
      (Iso.refl _)
      (Iso.refl _)
  · simp
  · simp
  · exact
      (Category.id_comp _).trans
        (Category.comp_id _).symm
  · exact
      (Category.id_comp _).trans
        (Category.comp_id _).symm

/--
The ambient chosen pullback of the two canonical retained complements is
isomorphic to the encoded finite joint graph.
-/
theorem ambient_pullback_mem_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      (pullback
        (firstInclusion left₁ occurrence₁ legal₁)
        (secondInclusion left₂ occurrence₂ legal₂)) := by
  let square :=
    graph_isPullback left₁ occurrence₁ left₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂
  refine
    ⟨graph left₁ occurrence₁ left₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂, ?_⟩
  exact
    ⟨square.isoIsPullback
      (retainedObject left₁ occurrence₁ legal₁)
      (retainedObject left₂ occurrence₂ legal₂)
      (IsPullback.of_hasPullback
        (firstInclusion left₁ occurrence₁ legal₁)
        (secondInclusion left₂ occurrence₂ legal₂))⟩

end Joint

/-! ## Closure of the standard adhesive concurrency construction -/

namespace CanonicalConcurrency

open Cantilune.Core.PositionalPushoutClosure
open Cantilune.Core.PositionalPushoutClosure.CanonicalPositionalDPO

variable
  {K₁ L₁ R₁ K₂ L₂ R₂ G : Graph σ inputTypes outputTypes}
  (left₁ : K₁ ⟶ L₁) (right₁ : K₁ ⟶ R₁)
  (occurrence₁ : L₁ ⟶ G)
  (left₂ : K₂ ⟶ L₂) (right₂ : K₂ ⟶ R₂)
  (occurrence₂ : L₂ ⟶ G)

variable
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left₁)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right₁)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
      occurrence₁)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left₂)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right₂)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
      occurrence₂)]

theorem first_complementToHost_eq
    (legal₁ : Legal left₁ occurrence₁) :
    (canonicalDerivation left₁ right₁ occurrence₁ legal₁).complementToHost =
      Joint.firstInclusion left₁ occurrence₁ legal₁ :=
  rfl

theorem second_complementToHost_eq
    (legal₂ : Legal left₂ occurrence₂) :
    (canonicalDerivation left₂ right₂ occurrence₂ legal₂).complementToHost =
      Joint.secondInclusion left₂ occurrence₂ legal₂ :=
  rfl

/-- The chosen joint context in the standard concurrency construction is positional. -/
theorem jointContext_mem_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      independent.JointContext := by
  change
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      (pullback
        (canonicalDerivation
          left₁ right₁ occurrence₁ legal₁).complementToHost
        (canonicalDerivation
          left₂ right₂ occurrence₂ legal₂).complementToHost)
  rw [first_complementToHost_eq, second_complementToHost_eq]
  exact
    Joint.ambient_pullback_mem_positionalImage
      left₁ occurrence₁ left₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂

/--
The residual context for applying rule one after rule two is positional.
-/
theorem firstResidualContext_mem_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      independent.FirstResidualContext := by
  rcases
      jointContext_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent with
    ⟨jointGraph, ⟨jointIso⟩⟩
  exact
    PushoutObject.ambient_result_mem_of_complement_iso
      (right := right₂)
      (D := jointGraph)
      jointIso
      independent.secondInterfaceToJoint
      independent.secondRightToFirstResidualContext
      independent.jointToFirstResidualContext
      independent.first_residual_context_square

/--
The residual context for applying rule two after rule one is positional.
-/
theorem secondResidualContext_mem_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      independent.SecondResidualContext := by
  rcases
      jointContext_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent with
    ⟨jointGraph, ⟨jointIso⟩⟩
  exact
    PushoutObject.ambient_result_mem_of_complement_iso
      (right := right₁)
      (D := jointGraph)
      jointIso
      independent.firstInterfaceToJoint
      independent.firstRightToSecondResidualContext
      independent.jointToSecondResidualContext
      independent.second_residual_context_square

/-- The final object in the order “second, then first” is positional. -/
theorem firstAfterSecondResult_mem_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      independent.firstAfterSecond.result := by
  rcases
      firstResidualContext_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent with
    ⟨residualGraph, ⟨residualIso⟩⟩
  exact
    PushoutObject.ambient_result_mem_of_complement_iso
      (right := right₁)
      (D := residualGraph)
      residualIso
      independent.firstAfterSecond.interfaceToComplement
      independent.firstAfterSecond.rightToResult
      independent.firstAfterSecond.complementToResult
      independent.firstAfterSecond.resultSquare

/-- The final object in the order “first, then second” is positional. -/
theorem secondAfterFirstResult_mem_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      independent.secondAfterFirst.result := by
  rcases
      secondResidualContext_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent with
    ⟨residualGraph, ⟨residualIso⟩⟩
  exact
    PushoutObject.ambient_result_mem_of_complement_iso
      (right := right₂)
      (D := residualGraph)
      residualIso
      independent.secondAfterFirst.interfaceToComplement
      independent.secondAfterFirst.rightToResult
      independent.secondAfterFirst.complementToResult
      independent.secondAfterFirst.resultSquare

private theorem encoded_mem_positionalImage
    (X : Graph σ inputTypes outputTypes) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      X.encoded :=
  ⟨X, ⟨Iso.refl X.encoded⟩⟩

/-- The complete “second, then first” residual witness lifts intrinsically. -/
theorem firstAfterSecondWitness_in_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    PositionalDPOIBridge.WitnessInPositionalImage
      (toWitness independent.firstAfterSecond) := by
  refine
    { interface_mem := encoded_mem_positionalImage K₁
      left_mem := encoded_mem_positionalImage L₁
      right_mem := encoded_mem_positionalImage R₁
      host_mem := ?_
      complement_mem := ?_
      result_mem := ?_ }
  · exact
      canonicalResult_mem_positionalImage
        left₂ right₂ occurrence₂ legal₂ boundary₂
  · exact
      firstResidualContext_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent
  · exact
      firstAfterSecondResult_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent

/-- The complete “first, then second” residual witness lifts intrinsically. -/
theorem secondAfterFirstWitness_in_positionalImage
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    PositionalDPOIBridge.WitnessInPositionalImage
      (toWitness independent.secondAfterFirst) := by
  refine
    { interface_mem := encoded_mem_positionalImage K₂
      left_mem := encoded_mem_positionalImage L₂
      right_mem := encoded_mem_positionalImage R₂
      host_mem := ?_
      complement_mem := ?_
      result_mem := ?_ }
  · exact
      canonicalResult_mem_positionalImage
        left₁ right₁ occurrence₁ legal₁ boundary₁
  · exact
      secondResidualContext_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent
  · exact
      secondAfterFirstResult_mem_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent

/--
Both residual derivations supplied by the standard adhesive concurrency
theorem exist as genuine DPO witnesses in the intrinsic finite positional
category.
-/
theorem residual_finite_bridges_exist
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    Nonempty
        (PositionalDPOIBridge.FiniteWitnessType
          (toWitness independent.firstAfterSecond)
          (firstAfterSecondWitness_in_positionalImage
            left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
            legal₁ boundary₁ legal₂ boundary₂ independent)) ∧
      Nonempty
        (PositionalDPOIBridge.FiniteWitnessType
          (toWitness independent.secondAfterFirst)
          (secondAfterFirstWitness_in_positionalImage
            left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
            legal₁ boundary₁ legal₂ boundary₂ independent)) := by
  constructor
  · exact
      PositionalDPOIBridge.finite_bridge_exists
        (toWitness independent.firstAfterSecond)
        (firstAfterSecondWitness_in_positionalImage
          left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
          legal₁ boundary₁ legal₂ boundary₂ independent)
  · exact
      PositionalDPOIBridge.finite_bridge_exists
        (toWitness independent.secondAfterFirst)
        (secondAfterFirstWitness_in_positionalImage
          left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
          legal₁ boundary₁ legal₂ boundary₂ independent)

end CanonicalConcurrency

end Cantilune.Core.PositionalConcurrencyClosure
