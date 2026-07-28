import Cantilune.Core.PositionalDPOIBridge

/-!
# Positional closure of canonical presheaf complements

This file proves the arity fact needed to remove the complement-membership
premise from `PositionalDPOIBridge`: for monic maps between intrinsic
positional encodings, a source/target incidence survives the canonical
deletion exactly when its owning edge survives.
-/

namespace Cantilune.Core.PositionalComplementClosure

open CategoryTheory
open CategoryTheory.Limits
open Opposite

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

abbrev Graph (σ : FinSignature)
    (inputTypes outputTypes : List σ.Obj) :=
  PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes

abbrev T (σ : FinSignature)
    (inputTypes outputTypes : List σ.Obj) :=
  FinitePresheafDPOI.typeGraph σ inputTypes outputTypes

abbrev sourceObject :=
  op FinitePresheafDPOI.IncidenceShape.source

abbrev targetObject :=
  op FinitePresheafDPOI.IncidenceShape.target

abbrev edgeObject :=
  op FinitePresheafDPOI.IncidenceShape.edge

abbrev nodeObject :=
  op FinitePresheafDPOI.IncidenceShape.node

abbrev inputObject :=
  op FinitePresheafDPOI.IncidenceShape.input

abbrev outputObject :=
  op FinitePresheafDPOI.IncidenceShape.output

namespace GraphOps

/-- The edge owned by a source incidence. -/
def sourceEdge (G : Graph σ inputTypes outputTypes)
    (p : G.SourceCarrier) : G.EdgeCarrier :=
  G.map FinitePresheafDPOI.IncidenceShape.Hom.edgeSource p

/-- The edge owned by a target incidence. -/
def targetEdge (G : Graph σ inputTypes outputTypes)
    (p : G.TargetCarrier) : G.EdgeCarrier :=
  G.map FinitePresheafDPOI.IncidenceShape.Hom.edgeTarget p

/--
An incidence of a positional graph is determined jointly by its edge and its
typed `(generator, position)` value.
-/
theorem source_joint_injective
    (G : Graph σ inputTypes outputTypes) :
    Function.Injective fun p : G.SourceCarrier =>
      (sourceEdge G p, G.typingComponent .source p) := by
  intro p q h
  rcases p with ⟨g, e, i⟩
  rcases q with ⟨g', e', i'⟩
  change
    ((⟨g, e⟩, ⟨g, i⟩) :
      G.EdgeCarrier ×
        FinitePresheafDPOI.TypeCarrier
          σ inputTypes outputTypes .source) =
      (⟨g', e'⟩, ⟨g', i'⟩) at h
  cases h
  rfl

theorem target_joint_injective
    (G : Graph σ inputTypes outputTypes) :
    Function.Injective fun p : G.TargetCarrier =>
      (targetEdge G p, G.typingComponent .target p) := by
  intro p q h
  rcases p with ⟨g, e, i⟩
  rcases q with ⟨g', e', i'⟩
  change
    ((⟨g, e⟩, ⟨g, i⟩) :
      G.EdgeCarrier ×
        FinitePresheafDPOI.TypeCarrier
          σ inputTypes outputTypes .target) =
      (⟨g', e'⟩, ⟨g', i'⟩) at h
  cases h
  rfl

/-- Build the unique source incidence over an edge and a compatible position. -/
def sourceLift (G : Graph σ inputTypes outputTypes)
    (e : G.EdgeCarrier)
    (t : FinitePresheafDPOI.TypeCarrier
      σ inputTypes outputTypes .source)
    (h : e.1 = t.1) : G.SourceCarrier := by
  rcases e with ⟨g, e⟩
  rcases t with ⟨g', i⟩
  dsimp at h
  cases h
  exact ⟨g, e, i⟩

@[simp]
theorem sourceLift_edge (G : Graph σ inputTypes outputTypes)
    (e : G.EdgeCarrier)
    (t : FinitePresheafDPOI.TypeCarrier
      σ inputTypes outputTypes .source)
    (h : e.1 = t.1) :
    sourceEdge G (sourceLift G e t h) = e := by
  rcases e with ⟨g, e⟩
  rcases t with ⟨g', i⟩
  dsimp at h
  cases h
  rfl

@[simp]
theorem sourceLift_typing (G : Graph σ inputTypes outputTypes)
    (e : G.EdgeCarrier)
    (t : FinitePresheafDPOI.TypeCarrier
      σ inputTypes outputTypes .source)
    (h : e.1 = t.1) :
    G.typingComponent .source (sourceLift G e t h) = t := by
  rcases e with ⟨g, e⟩
  rcases t with ⟨g', i⟩
  dsimp at h
  cases h
  rfl

def targetLift (G : Graph σ inputTypes outputTypes)
    (e : G.EdgeCarrier)
    (t : FinitePresheafDPOI.TypeCarrier
      σ inputTypes outputTypes .target)
    (h : e.1 = t.1) : G.TargetCarrier := by
  rcases e with ⟨g, e⟩
  rcases t with ⟨g', i⟩
  dsimp at h
  cases h
  exact ⟨g, e, i⟩

@[simp]
theorem targetLift_edge (G : Graph σ inputTypes outputTypes)
    (e : G.EdgeCarrier)
    (t : FinitePresheafDPOI.TypeCarrier
      σ inputTypes outputTypes .target)
    (h : e.1 = t.1) :
    targetEdge G (targetLift G e t h) = e := by
  rcases e with ⟨g, e⟩
  rcases t with ⟨g', i⟩
  dsimp at h
  cases h
  rfl

@[simp]
theorem targetLift_typing (G : Graph σ inputTypes outputTypes)
    (e : G.EdgeCarrier)
    (t : FinitePresheafDPOI.TypeCarrier
      σ inputTypes outputTypes .target)
    (h : e.1 = t.1) :
    G.typingComponent .target (targetLift G e t h) = t := by
  rcases e with ⟨g, e⟩
  rcases t with ⟨g', i⟩
  dsimp at h
  cases h
  rfl

end GraphOps

section Span

open GraphOps

variable {K L G : Graph σ inputTypes outputTypes}
variable (left : K ⟶ L) (matching : L ⟶ G)

/-- Componentwise deleted image for a positional span. -/
def Deleted
    (X : FinitePresheafDPOI.IncidenceShapeᵒᵖ)
    (x : G.encoded.left.obj X) : Prop :=
  PresheafComplementDPO.TypeComplement.Deleted
    (left.left.app X) (matching.left.app X) x

/--
The exact gluing condition for the raw positional span.  Ambient monicity is
orthogonal to this closure predicate and is only needed when packaging the
span as a DPO rule/match.
-/
def Legal : Prop :=
  ∀ {X Y : FinitePresheafDPOI.IncidenceShapeᵒᵖ}
    (f : X ⟶ Y) (x : G.encoded.left.obj X),
      (¬ Deleted left matching X x) →
        ¬ Deleted left matching Y (G.encoded.left.map f x)

private theorem edge_typing_preserved
    {A B : Graph σ inputTypes outputTypes}
    (f : A ⟶ B) (e : A.EdgeCarrier) :
    B.typingComponent .edge
        (f.left.app edgeObject e) =
      A.typingComponent .edge e := by
  have h := Over.w f
  have hApp := congrArg (fun k => k.app edgeObject) h
  exact ConcreteCategory.congr_hom hApp e

private theorem source_map_preserves_edge
    {A B : Graph σ inputTypes outputTypes}
    (f : A ⟶ B) (p : A.SourceCarrier) :
    sourceEdge B (f.left.app sourceObject p) =
      f.left.app edgeObject (sourceEdge A p) := by
  have h :=
    ConcreteCategory.congr_hom
      (f.left.naturality
        (Quiver.Hom.op
          (FinitePresheafDPOI.IncidenceShape.Hom.edgeSource :
            edgeObject.unop ⟶ sourceObject.unop)))
      p
  change
    f.left.app edgeObject (sourceEdge A p) =
      sourceEdge B (f.left.app sourceObject p)
    at h
  exact h.symm

private theorem target_map_preserves_edge
    {A B : Graph σ inputTypes outputTypes}
    (f : A ⟶ B) (p : A.TargetCarrier) :
    targetEdge B (f.left.app targetObject p) =
      f.left.app edgeObject (targetEdge A p) := by
  have h :=
    ConcreteCategory.congr_hom
      (f.left.naturality
        (Quiver.Hom.op
          (FinitePresheafDPOI.IncidenceShape.Hom.edgeTarget :
            edgeObject.unop ⟶ targetObject.unop)))
      p
  change
    f.left.app edgeObject (targetEdge A p) =
      targetEdge B (f.left.app targetObject p)
    at h
  exact h.symm

private theorem source_preimage_of_edge_preimage
    {p : L.SourceCarrier} {kEdge : K.EdgeCarrier}
    (hedge :
      left.left.app edgeObject kEdge = sourceEdge L p) :
    ∃ kSource : K.SourceCarrier,
      left.left.app sourceObject kSource = p := by
  have htypeEdge := edge_typing_preserved left kEdge
  change (left.left.app edgeObject kEdge).1 = kEdge.1 at htypeEdge
  have hgen :
      kEdge.1 = (L.typingComponent .source p).1 := by
    calc
      kEdge.1 =
          (left.left.app edgeObject kEdge).1 := htypeEdge.symm
      _ = (sourceEdge L p).1 := congrArg Sigma.fst hedge
      _ = (L.typingComponent .source p).1 := by
            rcases p with ⟨g, e, i⟩
            rfl
  let kSource :=
    sourceLift K kEdge (L.typingComponent .source p) hgen
  refine ⟨kSource, ?_⟩
  apply source_joint_injective L
  apply Prod.ext
  · change
      sourceEdge L (left.left.app sourceObject kSource) =
        sourceEdge L p
    rw [source_map_preserves_edge]
    have hk : sourceEdge K kSource = kEdge := by
      dsimp [kSource]
      apply sourceLift_edge
    rw [hk]
    exact hedge
  · change
      L.typingComponent .source
          (left.left.app sourceObject kSource) =
        L.typingComponent .source p
    calc
      L.typingComponent .source
            (left.left.app sourceObject kSource) =
          K.typingComponent .source kSource :=
        PositionalDPOI.FiniteHypergraph.hom_source_typing left kSource
      _ = L.typingComponent .source p := by
        dsimp [kSource]
        rw [sourceLift_typing]

private theorem target_preimage_of_edge_preimage
    {p : L.TargetCarrier} {kEdge : K.EdgeCarrier}
    (hedge :
      left.left.app edgeObject kEdge = targetEdge L p) :
    ∃ kTarget : K.TargetCarrier,
      left.left.app targetObject kTarget = p := by
  have htypeEdge := edge_typing_preserved left kEdge
  change (left.left.app edgeObject kEdge).1 = kEdge.1 at htypeEdge
  have hgen :
      kEdge.1 = (L.typingComponent .target p).1 := by
    calc
      kEdge.1 =
          (left.left.app edgeObject kEdge).1 := htypeEdge.symm
      _ = (targetEdge L p).1 := congrArg Sigma.fst hedge
      _ = (L.typingComponent .target p).1 := by
            rcases p with ⟨g, e, i⟩
            rfl
  let kTarget :=
    targetLift K kEdge (L.typingComponent .target p) hgen
  refine ⟨kTarget, ?_⟩
  apply target_joint_injective L
  apply Prod.ext
  · change
      targetEdge L (left.left.app targetObject kTarget) =
        targetEdge L p
    rw [target_map_preserves_edge]
    have hk : targetEdge K kTarget = kEdge := by
      dsimp [kTarget]
      apply targetLift_edge
    rw [hk]
    exact hedge
  · change
      L.typingComponent .target
          (left.left.app targetObject kTarget) =
        L.typingComponent .target p
    calc
      L.typingComponent .target
            (left.left.app targetObject kTarget) =
          K.typingComponent .target kTarget :=
        PositionalDPOI.FiniteHypergraph.hom_target_typing left kTarget
      _ = L.typingComponent .target p := by
        dsimp [kTarget]
        rw [targetLift_typing]

/--
Source arity is closed by canonical deletion: a source incidence is retained
exactly when its owning edge is retained.
-/
theorem source_retained_iff_edge_retained
    (legal : Legal left matching)
    (p : G.SourceCarrier) :
    (¬ Deleted left matching sourceObject p) ↔
      (¬ Deleted left matching edgeObject (sourceEdge G p)) := by
  constructor
  · exact legal
      (Quiver.Hom.op
        (FinitePresheafDPOI.IncidenceShape.Hom.edgeSource :
          edgeObject.unop ⟶ sourceObject.unop))
      p
  · intro hedge hsource
    change
      ¬ PresheafComplementDPO.TypeComplement.Deleted
          (left.left.app edgeObject)
          (matching.left.app edgeObject)
          (sourceEdge G p)
      at hedge
    change
      PresheafComplementDPO.TypeComplement.Deleted
          (left.left.app sourceObject)
          (matching.left.app sourceObject)
          p
      at hsource
    rcases hsource with ⟨y, hy, hno⟩
    apply hedge
    refine ⟨sourceEdge L y, ?_, ?_⟩
    · calc
        matching.left.app edgeObject (sourceEdge L y) =
            sourceEdge G (matching.left.app sourceObject y) := by
              symm
              exact source_map_preserves_edge matching y
        _ = sourceEdge G p := by rw [hy]
    · intro kEdge hk
      rcases source_preimage_of_edge_preimage left hk with ⟨kSource, hkSource⟩
      exact hno kSource hkSource

theorem target_retained_iff_edge_retained
    (legal : Legal left matching)
    (p : G.TargetCarrier) :
    (¬ Deleted left matching targetObject p) ↔
      (¬ Deleted left matching edgeObject (targetEdge G p)) := by
  constructor
  · exact legal
      (Quiver.Hom.op
        (FinitePresheafDPOI.IncidenceShape.Hom.edgeTarget :
          edgeObject.unop ⟶ targetObject.unop))
      p
  · intro hedge htarget
    change
      ¬ PresheafComplementDPO.TypeComplement.Deleted
          (left.left.app edgeObject)
          (matching.left.app edgeObject)
          (targetEdge G p)
      at hedge
    change
      PresheafComplementDPO.TypeComplement.Deleted
          (left.left.app targetObject)
          (matching.left.app targetObject)
          p
      at htarget
    rcases htarget with ⟨y, hy, hno⟩
    apply hedge
    refine ⟨targetEdge L y, ?_, ?_⟩
    · calc
        matching.left.app edgeObject (targetEdge L y) =
            targetEdge G (matching.left.app targetObject y) := by
              symm
              exact target_map_preserves_edge matching y
        _ = targetEdge G p := by rw [hy]
    · intro kEdge hk
      rcases target_preimage_of_edge_preimage left hk with ⟨kTarget, hkTarget⟩
      exact hno kTarget hkTarget

/--
The extra open-graph condition needed for closure in the fixed-boundary
positional category: all distinguished input and output incidences survive.
-/
def BoundaryRetained : Prop :=
  (∀ i : Fin inputTypes.length,
    ¬ Deleted left matching inputObject i) ∧
  (∀ i : Fin outputTypes.length,
    ¬ Deleted left matching outputObject i)

/--
The intrinsic finite positional graph obtained by deleting the matched image
of `L \ K`.  Its node and edge fibres are retained subtypes of the host.
-/
noncomputable def complementGraph
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching) :
    Graph σ inputTypes outputTypes where
  Node o :=
    { n : G.Node o //
      ¬ Deleted left matching nodeObject (⟨o, n⟩ : G.NodeCarrier) }
  Edge g :=
    { e : G.Edge g //
      ¬ Deleted left matching edgeObject (⟨g, e⟩ : G.EdgeCarrier) }
  nodeFintype _ := by
    classical
    infer_instance
  edgeFintype _ := by
    classical
    infer_instance
  source := by
    intro g e i
    refine ⟨G.source e.1 i, ?_⟩
    let p : G.SourceCarrier := ⟨g, e.1, i⟩
    have hpSource :
        ¬ Deleted left matching sourceObject p :=
      (source_retained_iff_edge_retained left matching legal p).2 (by
        simpa [p, GraphOps.sourceEdge,
          PositionalDPOI.FiniteHypergraph.map] using e.2)
    have hpNode :=
      legal
        (Quiver.Hom.op
          (FinitePresheafDPOI.IncidenceShape.Hom.nodeSource :
            nodeObject.unop ⟶ sourceObject.unop))
        p hpSource
    change
      ¬ Deleted left matching nodeObject
          (⟨(σ.input g).get i, G.source e.1 i⟩ : G.NodeCarrier)
      at hpNode
    exact hpNode
  target := by
    intro g e i
    refine ⟨G.target e.1 i, ?_⟩
    let p : G.TargetCarrier := ⟨g, e.1, i⟩
    have hpTarget :
        ¬ Deleted left matching targetObject p :=
      (target_retained_iff_edge_retained left matching legal p).2 (by
        simpa [p, GraphOps.targetEdge,
          PositionalDPOI.FiniteHypergraph.map] using e.2)
    have hpNode :=
      legal
        (Quiver.Hom.op
          (FinitePresheafDPOI.IncidenceShape.Hom.nodeTarget :
            nodeObject.unop ⟶ targetObject.unop))
        p hpTarget
    change
      ¬ Deleted left matching nodeObject
          (⟨(σ.output g).get i, G.target e.1 i⟩ : G.NodeCarrier)
      at hpNode
    exact hpNode
  inputBoundary := by
    intro i
    refine ⟨G.inputBoundary i, ?_⟩
    have hi :=
      legal
        (Quiver.Hom.op
          (FinitePresheafDPOI.IncidenceShape.Hom.nodeInput :
            nodeObject.unop ⟶ inputObject.unop))
        i (boundary.1 i)
    change
      ¬ Deleted left matching nodeObject
          (⟨inputTypes.get i, G.inputBoundary i⟩ : G.NodeCarrier)
      at hi
    exact hi
  outputBoundary := by
    intro i
    refine ⟨G.outputBoundary i, ?_⟩
    have hi :=
      legal
        (Quiver.Hom.op
          (FinitePresheafDPOI.IncidenceShape.Hom.nodeOutput :
            nodeObject.unop ⟶ outputObject.unop))
        i (boundary.2 i)
    change
      ¬ Deleted left matching nodeObject
          (⟨outputTypes.get i, G.outputBoundary i⟩ : G.NodeCarrier)
      at hi
    exact hi
  inputBoundary_injective := by
    intro i j h
    apply G.inputBoundary_injective
    exact congrArg
      (fun z => (⟨z.1, z.2.1⟩ : G.NodeCarrier)) h
  outputBoundary_injective := by
    intro i j h
    apply G.outputBoundary_injective
    exact congrArg
      (fun z => (⟨z.1, z.2.1⟩ : G.NodeCarrier)) h

/-- The raw retained-subpresheaf object associated with a positional span. -/
def retainedPresheaf (legal : Legal left matching) :
    FinitePresheafDPOI.IncidenceShapeᵒᵖ ⥤ Type where
  obj X :=
    { x : G.encoded.left.obj X //
      ¬ Deleted left matching X x }
  map {X Y} f :=
    TypeCat.ofHom fun x =>
      ⟨G.encoded.left.map f x.1, legal f x.1 x.2⟩
  map_id X := by
    ext x
    simp
  map_comp f g := by
    ext x
    simp

def retainedTyping (legal : Legal left matching) :
    retainedPresheaf left matching legal ⟶
      T σ inputTypes outputTypes where
  app X :=
    TypeCat.ofHom fun x => G.encoded.hom.app X x.1
  naturality := by
    intro X Y f
    ext x
    exact ConcreteCategory.congr_hom
      (G.encoded.hom.naturality f) x.1

/-- The raw canonical complement as an object in the typed presheaf slice. -/
def retainedObject (legal : Legal left matching) :
    AdhesiveDPOI.TypedHypergraph (T σ inputTypes outputTypes) :=
  Over.mk (retainedTyping left matching legal)

private def comparisonComponent
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching)
    (X : FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    (complementGraph left matching legal boundary).encoded.left.obj X →
      (retainedObject left matching legal).left.obj X := by
  rcases X with ⟨X⟩
  cases X with
  | node =>
      exact fun p => ⟨⟨p.1, p.2.1⟩, p.2.2⟩
  | edge =>
      exact fun p => ⟨⟨p.1, p.2.1⟩, p.2.2⟩
  | source =>
      exact fun p =>
        ⟨⟨p.1, p.2.1.1, p.2.2⟩,
          (source_retained_iff_edge_retained
            left matching legal
            (⟨p.1, p.2.1.1, p.2.2⟩ : G.SourceCarrier)).2
              p.2.1.2⟩
  | target =>
      exact fun p =>
        ⟨⟨p.1, p.2.1.1, p.2.2⟩,
          (target_retained_iff_edge_retained
            left matching legal
            (⟨p.1, p.2.1.1, p.2.2⟩ : G.TargetCarrier)).2
              p.2.1.2⟩
  | input =>
      exact fun i => ⟨i, boundary.1 i⟩
  | output =>
      exact fun i => ⟨i, boundary.2 i⟩

private def comparisonInverseComponent
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching)
    (X : FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    (retainedObject left matching legal).left.obj X →
      (complementGraph left matching legal boundary).encoded.left.obj X := by
  rcases X with ⟨X⟩
  cases X with
  | node =>
      exact fun p => ⟨p.1.1, ⟨p.1.2, p.2⟩⟩
  | edge =>
      exact fun p => ⟨p.1.1, ⟨p.1.2, p.2⟩⟩
  | source =>
      exact fun p =>
        ⟨p.1.1,
          ⟨⟨p.1.2.1,
              (source_retained_iff_edge_retained
                left matching legal p.1).1 p.2⟩,
            p.1.2.2⟩⟩
  | target =>
      exact fun p =>
        ⟨p.1.1,
          ⟨⟨p.1.2.1,
              (target_retained_iff_edge_retained
                left matching legal p.1).1 p.2⟩,
            p.1.2.2⟩⟩
  | input =>
      exact fun p => p.1
  | output =>
      exact fun p => p.1

private theorem comparison_leftInverse
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching)
    (X : FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.LeftInverse
      (comparisonInverseComponent left matching legal boundary X)
      (comparisonComponent left matching legal boundary X) := by
  rcases X with ⟨X⟩
  cases X <;> intro x
  · rcases x with ⟨o, n⟩
    rfl
  · rcases x with ⟨g, e⟩
    rfl
  · rcases x with ⟨g, e, i⟩
    rfl
  · rcases x with ⟨g, e, i⟩
    rfl
  · rfl
  · rfl

private theorem comparison_rightInverse
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching)
    (X : FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.RightInverse
      (comparisonInverseComponent left matching legal boundary X)
      (comparisonComponent left matching legal boundary X) := by
  rcases X with ⟨X⟩
  cases X <;> intro x
  · rcases x with ⟨⟨o, n⟩, hn⟩
    rfl
  · rcases x with ⟨⟨g, e⟩, he⟩
    rfl
  · rcases x with ⟨⟨g, e, i⟩, hp⟩
    apply Subtype.ext
    rfl
  · rcases x with ⟨⟨g, e, i⟩, hp⟩
    apply Subtype.ext
    rfl
  · rcases x with ⟨i, hi⟩
    apply Subtype.ext
    rfl
  · rcases x with ⟨i, hi⟩
    apply Subtype.ext
    rfl

private def comparisonEquiv
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching)
    (X : FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    (complementGraph left matching legal boundary).encoded.left.obj X ≃
      (retainedObject left matching legal).left.obj X where
  toFun := comparisonComponent left matching legal boundary X
  invFun := comparisonInverseComponent left matching legal boundary X
  left_inv := comparison_leftInverse left matching legal boundary X
  right_inv := comparison_rightInverse left matching legal boundary X

private theorem comparison_naturality_base
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching)
    {X Y : FinitePresheafDPOI.IncidenceShape}
    (f : FinitePresheafDPOI.IncidenceShape.Hom X Y) :
    (complementGraph left matching legal boundary).encoded.left.map
          (Quiver.Hom.op f) ≫
        TypeCat.ofHom
          (comparisonComponent left matching legal boundary (op X)) =
      TypeCat.ofHom
          (comparisonComponent left matching legal boundary (op Y)) ≫
        (retainedObject left matching legal).left.map
          (Quiver.Hom.op f) := by
  cases f <;> ext x <;> apply Subtype.ext <;> rfl

private def comparisonNatural
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching) :
    (complementGraph left matching legal boundary).encoded.left ⟶
      (retainedObject left matching legal).left where
  app X :=
    TypeCat.ofHom
      (comparisonComponent left matching legal boundary X)
  naturality := by
    intro X Y f
    simpa only [Quiver.Hom.op_unop] using
      comparison_naturality_base left matching legal boundary
        (Quiver.Hom.unop f)

/--
The encoded finite positional complement is naturally isomorphic to the
componentwise retained subpresheaf.
-/
noncomputable def complementPresheafIso
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching) :
    (complementGraph left matching legal boundary).encoded.left ≅
      (retainedObject left matching legal).left :=
  NatIso.ofComponents
    (fun X => (comparisonEquiv left matching legal boundary X).toIso)
    (fun f => (comparisonNatural left matching legal boundary).naturality f)

/--
The comparison also preserves the typing map, hence is an isomorphism in the
typed presheaf slice rather than merely between underlying presheaves.
-/
noncomputable def complementTypedIso
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching) :
    (complementGraph left matching legal boundary).encoded ≅
      retainedObject left matching legal :=
  Over.isoMk
    (complementPresheafIso left matching legal boundary)
    (by
      ext X x
      rcases X with ⟨X⟩
      cases X <;> rcases x with ⟨a, b⟩ <;> rfl)

/--
Canonical deletion of a finite positional span stays in the positional
essential image whenever gluing and fixed-boundary retention hold.
-/
theorem retainedObject_mem_positionalImage
    (legal : Legal left matching)
    (boundary : BoundaryRetained left matching) :
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).essImage
      (retainedObject left matching legal) :=
  ⟨complementGraph left matching legal boundary,
    ⟨complementTypedIso left matching legal boundary⟩⟩

end Span

end Cantilune.Core.PositionalComplementClosure
