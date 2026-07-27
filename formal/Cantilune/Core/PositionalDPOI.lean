import Cantilune.Core.FinitePresheafDPOI
import Mathlib.CategoryTheory.Equivalence

/-!
# Intrinsic finite positional typed hypergraphs

This module removes the fixed ambient `Node`/`Edge` identifier types used by
the executable inclusion fragment.  An object carries finite dependent node
and edge fibres over the signature.  Ordered source and target positions occur
in the types of the incidence maps themselves.

Morphisms are all morphisms between the associated objects of the typed
incidence-presheaf slice.  Consequently they are general typed, positional
natural transformations, rather than inclusions in one fixed host.  The
encoding functor is full and faithful by construction and hence is an
equivalence onto its categorical essential image.  No claim is made that its
essential image is the whole slice: arbitrary slice objects can omit or
duplicate the incidence belonging to an edge/position pair.
-/

namespace Cantilune.Core.PositionalDPOI

open CategoryTheory
open Cantilune.Core.FinitePresheafDPOI
open Opposite

variable (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)

/--
An intrinsic finite typed open hypergraph.

Nodes and edges are dependent fibres over their types and labels.  Thus a
source at position `i` of a `g`-edge has type exactly
`Node ((σ.input g).get i)`.
-/
structure FiniteHypergraph where
  Node : σ.Obj → Type
  Edge : σ.Gen → Type
  nodeFintype : ∀ o, Fintype (Node o)
  edgeFintype : ∀ g, Fintype (Edge g)
  source :
    ∀ {g : σ.Gen}, Edge g →
      (i : Fin (σ.input g).length) → Node ((σ.input g).get i)
  target :
    ∀ {g : σ.Gen}, Edge g →
      (i : Fin (σ.output g).length) → Node ((σ.output g).get i)
  inputBoundary :
    (i : Fin inputTypes.length) → Node (inputTypes.get i)
  outputBoundary :
    (i : Fin outputTypes.length) → Node (outputTypes.get i)
  inputBoundary_injective :
    Function.Injective
      (fun i => (⟨inputTypes.get i, inputBoundary i⟩ : Σ o, Node o))
  outputBoundary_injective :
    Function.Injective
      (fun i => (⟨outputTypes.get i, outputBoundary i⟩ : Σ o, Node o))

attribute [instance] FiniteHypergraph.nodeFintype
  FiniteHypergraph.edgeFintype

namespace FiniteHypergraph

variable {σ inputTypes outputTypes}

abbrev NodeCarrier (G : FiniteHypergraph σ inputTypes outputTypes) :=
  Σ o : σ.Obj, G.Node o

abbrev EdgeCarrier (G : FiniteHypergraph σ inputTypes outputTypes) :=
  Σ g : σ.Gen, G.Edge g

abbrev SourceCarrier (G : FiniteHypergraph σ inputTypes outputTypes) :=
  Σ g : σ.Gen, G.Edge g × Fin (σ.input g).length

abbrev TargetCarrier (G : FiniteHypergraph σ inputTypes outputTypes) :=
  Σ g : σ.Gen, G.Edge g × Fin (σ.output g).length

/-- The six carriers of the positional incidence presheaf. -/
def Carrier (G : FiniteHypergraph σ inputTypes outputTypes) :
    IncidenceShape → Type
  | .node => NodeCarrier G
  | .edge => EdgeCarrier G
  | .source => SourceCarrier G
  | .target => TargetCarrier G
  | .input => Fin inputTypes.length
  | .output => Fin outputTypes.length

instance carrierFintype
    (G : FiniteHypergraph σ inputTypes outputTypes)
    (X : IncidenceShape) : Fintype (G.Carrier X) := by
  cases X <;> simp only [Carrier] <;> infer_instance

/-- Contravariant action of the incidence presheaf. -/
def map (G : FiniteHypergraph σ inputTypes outputTypes)
    {X Y : IncidenceShape} :
    IncidenceShape.Hom X Y → G.Carrier Y → G.Carrier X
  | .id _, x => x
  | .nodeSource, p =>
      ⟨(σ.input p.1).get p.2.2, G.source p.2.1 p.2.2⟩
  | .edgeSource, p => ⟨p.1, p.2.1⟩
  | .nodeTarget, p =>
      ⟨(σ.output p.1).get p.2.2, G.target p.2.1 p.2.2⟩
  | .edgeTarget, p => ⟨p.1, p.2.1⟩
  | .nodeInput, i => ⟨inputTypes.get i, G.inputBoundary i⟩
  | .nodeOutput, i => ⟨outputTypes.get i, G.outputBoundary i⟩

@[simp]
theorem map_id (G : FiniteHypergraph σ inputTypes outputTypes)
    (X : IncidenceShape) :
    TypeCat.ofHom (G.map (IncidenceShape.Hom.id X)) =
      𝟙 (G.Carrier X) :=
  rfl

theorem map_comp (G : FiniteHypergraph σ inputTypes outputTypes)
    {X Y Z : IncidenceShape}
    (f : IncidenceShape.Hom X Y) (g : IncidenceShape.Hom Y Z) :
    TypeCat.ofHom (G.map (IncidenceShape.comp f g)) =
      TypeCat.ofHom (G.map g) ≫ TypeCat.ofHom (G.map f) := by
  cases f <;> cases g <;> rfl

/-- The intrinsic graph as a finite incidence presheaf. -/
def presheaf (G : FiniteHypergraph σ inputTypes outputTypes) :
    IncidenceShapeᵒᵖ ⥤ Type where
  obj X := G.Carrier (unop X)
  map f := TypeCat.ofHom (G.map f.unop)
  map_id X := G.map_id (unop X)
  map_comp f g := by
    simpa only [CategoryTheory.unop_comp] using
      G.map_comp g.unop f.unop

/-- Positional typing into the fixed signature graph. -/
def typingComponent (G : FiniteHypergraph σ inputTypes outputTypes) :
    (X : IncidenceShape) →
      G.Carrier X ⟶ TypeCarrier σ inputTypes outputTypes X
  | .node => TypeCat.ofHom Sigma.fst
  | .edge => TypeCat.ofHom Sigma.fst
  | .source => TypeCat.ofHom fun p => ⟨p.1, p.2.2⟩
  | .target => TypeCat.ofHom fun p => ⟨p.1, p.2.2⟩
  | .input => 𝟙 _
  | .output => 𝟙 _

theorem typing_naturality_base
    (G : FiniteHypergraph σ inputTypes outputTypes)
    {X Y : IncidenceShape} (f : IncidenceShape.Hom X Y) :
    TypeCat.ofHom (G.map f) ≫ G.typingComponent X =
      G.typingComponent Y ≫
        TypeCat.ofHom (typeMap σ inputTypes outputTypes f) := by
  cases f with
  | id X => cases X <;> rfl
  | nodeSource => rfl
  | edgeSource => rfl
  | nodeTarget => rfl
  | edgeTarget => rfl
  | nodeInput => rfl
  | nodeOutput => rfl

def typing (G : FiniteHypergraph σ inputTypes outputTypes) :
    G.presheaf ⟶ typeGraph σ inputTypes outputTypes where
  app X := G.typingComponent (unop X)
  naturality := by
    intro X Y f
    change
      TypeCat.ofHom (G.map (Quiver.Hom.unop f)) ≫
          G.typingComponent (unop Y) =
        G.typingComponent (unop X) ≫
          TypeCat.ofHom
            (typeMap σ inputTypes outputTypes (Quiver.Hom.unop f))
    exact G.typing_naturality_base (Quiver.Hom.unop f)

/-- Encoded object of the typed presheaf slice. -/
def encoded (G : FiniteHypergraph σ inputTypes outputTypes) :
    AdhesiveDPOI.TypedHypergraph (typeGraph σ inputTypes outputTypes) :=
  Over.mk G.typing

end FiniteHypergraph

/-!
The category below has every intrinsic finite graph as an object and all
typed-presheaf morphisms between their encodings as arrows.  Naturality
preserves node/edge incidence; the equation in the slice preserves the
dependent generator/position typing.
-/

instance finiteHypergraphCategory :
    Category (FiniteHypergraph σ inputTypes outputTypes) where
  Hom G H := G.encoded ⟶ H.encoded
  id G := 𝟙 G.encoded
  comp f g := f ≫ g
  id_comp := by simp
  comp_id := by simp
  assoc := by simp

/-- Full and faithful inclusion of intrinsic finite positional graphs. -/
def encodingFunctor :
    FiniteHypergraph σ inputTypes outputTypes ⥤
      AdhesiveDPOI.TypedHypergraph (typeGraph σ inputTypes outputTypes) where
  obj G := G.encoded
  map f := f
  map_id _ := rfl
  map_comp _ _ := rfl

instance encodingFunctor_faithful :
    (encodingFunctor σ inputTypes outputTypes).Faithful where
  map_injective := by
    intro X Y f g h
    exact h

instance encodingFunctor_full :
    (encodingFunctor σ inputTypes outputTypes).Full where
  map_surjective f := ⟨f, rfl⟩

/--
The intrinsic finite category is equivalent to its precise categorical
essential image in the slice.
-/
noncomputable def equivalenceEssImage :
    FiniteHypergraph σ inputTypes outputTypes ≌
      (encodingFunctor σ inputTypes outputTypes).EssImageSubcategory :=
  (encodingFunctor σ inputTypes outputTypes).toEssImage.asEquivalence

namespace FiniteHypergraph

variable {σ inputTypes outputTypes}

/--
Every general morphism preserves the complete source typing pair
`(generator, ordered position)`.
-/
theorem hom_source_typing
    {G H : FiniteHypergraph σ inputTypes outputTypes}
    (f : G ⟶ H) (p : G.SourceCarrier) :
    H.typingComponent .source
        (f.left.app (op .source) p) =
      G.typingComponent .source p := by
  have h := Over.w f
  have hApp :=
    congrArg (fun k => k.app (op IncidenceShape.source)) h
  exact ConcreteCategory.congr_hom hApp p

/-- Target generator/position pairs are likewise preserved. -/
theorem hom_target_typing
    {G H : FiniteHypergraph σ inputTypes outputTypes}
    (f : G ⟶ H) (p : G.TargetCarrier) :
    H.typingComponent .target
        (f.left.app (op .target) p) =
      G.typingComponent .target p := by
  have h := Over.w f
  have hApp :=
    congrArg (fun k => k.app (op IncidenceShape.target)) h
  exact ConcreteCategory.congr_hom hApp p

end FiniteHypergraph

end Cantilune.Core.PositionalDPOI
