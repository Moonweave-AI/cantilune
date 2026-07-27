import Cantilune.Core.DPOI
import Cantilune.Core.AdhesiveDPOI
import Mathlib.CategoryTheory.Adjunction.Evaluation
import Mathlib.CategoryTheory.ConcreteCategory.EpiMono
import Mathlib.CategoryTheory.Limits.Over

/-!
# The executable finite DPOI fragment inside a typed presheaf slice

This file supplies the concrete bridge which is intentionally absent from
`AdhesiveDPOI`.  It uses a six-sorted incidence shape and encodes the finite
active-support views of one fixed typed open hypergraph, with inclusion
morphisms, as presheaves in the slice over a fixed signature/type graph.

The source/target type carrier records `(generator, Fin-position)`, so ports
with the same object type remain distinct.  The bridge in this file is still
deliberately restricted to the thin category of active-support views of one
fixed host.  `Core.PositionalDPOI` separately supplies the category of all
finite positional typed open hypergraphs, all typed natural transformations,
a full and faithful encoding, and an equivalence with its essential image in
the typed presheaf slice.

There are two deliberately separate results.

* Every executable `DPOI.AdmissibleRewrite` has a host-indexed categorical DPO
  witness.  Its rule is the canonical contextual span
  `G ← complement → result`; both squares are genuine pushouts (identity-leg
  pushouts), but the rule is not claimed to be independent of the host.
* A context-independent finite rule needs the additional locality condition
  `InterfaceLocal`: an inserted edge may only attach to a retained node of the
  matched interface.  The executable record is more permissive and therefore
  cannot, in general, be reinterpreted as such a rule without this condition.

Adhesivity is used only after the pushout squares have been constructed.  It
is never used as an existence theorem for pushout complements.
-/

namespace Cantilune.Core.FinitePresheafDPOI

open CategoryTheory
open CategoryTheory.Limits
open Opposite

-- Inclusion and union-square witnesses live in `Prop` but are deliberately
-- reducible: later pointwise pushout proofs compute through their fields.
set_option linter.defProp false

/-! ## A concrete incidence shape -/

/--
The six sorts needed by the finite open-hypergraph encoding.

The nonidentity arrows of the base category point from the carrier sort to an
incidence/boundary sort.  Passing to the opposite category makes a presheaf
carry the expected functions from incidences and boundary ports to nodes and
edges.
-/
inductive IncidenceShape
  | node
  | edge
  | source
  | target
  | input
  | output
  deriving DecidableEq

namespace IncidenceShape

/-- The only nonidentity arrows are the six structure projections. -/
inductive Hom : IncidenceShape → IncidenceShape → Type
  | id (X) : Hom X X
  | nodeSource : Hom .node .source
  | edgeSource : Hom .edge .source
  | nodeTarget : Hom .node .target
  | edgeTarget : Hom .edge .target
  | nodeInput : Hom .node .input
  | nodeOutput : Hom .node .output
  deriving DecidableEq

def id : (X : IncidenceShape) → Hom X X :=
  Hom.id

def comp :
    {X Y Z : IncidenceShape} → Hom X Y → Hom Y Z → Hom X Z
  | _, _, _, .id _, g => g
  | _, _, _, f, .id _ => f

@[simp]
theorem id_comp {X Y : IncidenceShape} (f : Hom X Y) :
    comp (id X) f = f := by
  cases f <;> rfl

@[simp]
theorem comp_id {X Y : IncidenceShape} (f : Hom X Y) :
    comp f (id Y) = f := by
  cases f <;> rfl

theorem assoc {W X Y Z : IncidenceShape}
    (f : Hom W X) (g : Hom X Y) (h : Hom Y Z) :
    comp (comp f g) h = comp f (comp g h) := by
  cases f <;> cases g <;> cases h <;> rfl

instance : SmallCategory IncidenceShape where
  Hom := Hom
  id := id
  comp := comp
  id_comp := id_comp
  comp_id := comp_id
  assoc := assoc

@[simp]
theorem categorical_id (X : IncidenceShape) :
    Hom.id X = 𝟙 X :=
  rfl

end IncidenceShape

/-! ## The fixed type graph -/

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

/-- Values of the signature/type graph at the six incidence sorts. -/
def TypeCarrier (σ : FinSignature) (inputTypes outputTypes : List σ.Obj) :
    IncidenceShape → Type
  | .node => σ.Obj
  | .edge => σ.Gen
  | .source => Σ g : σ.Gen, Fin (σ.input g).length
  | .target => Σ g : σ.Gen, Fin (σ.output g).length
  | .input => Fin inputTypes.length
  | .output => Fin outputTypes.length

/-- Contravariant action of the fixed type graph on the incidence shape. -/
def typeMap (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)
    {X Y : IncidenceShape} :
    IncidenceShape.Hom X Y →
      TypeCarrier σ inputTypes outputTypes Y →
      TypeCarrier σ inputTypes outputTypes X
  | .id _, x => x
  | .nodeSource, p => (σ.input p.1).get p.2
  | .edgeSource, p => p.1
  | .nodeTarget, p => (σ.output p.1).get p.2
  | .edgeTarget, p => p.1
  | .nodeInput, i => inputTypes.get i
  | .nodeOutput, i => outputTypes.get i

@[simp]
theorem typeMap_id (σ : FinSignature)
    (inputTypes outputTypes : List σ.Obj) (X : IncidenceShape) :
    TypeCat.ofHom
        (typeMap σ inputTypes outputTypes (IncidenceShape.Hom.id X)) =
      𝟙 (TypeCarrier σ inputTypes outputTypes X) :=
  rfl

theorem typeMap_comp (σ : FinSignature)
    (inputTypes outputTypes : List σ.Obj)
    {X Y Z : IncidenceShape}
    (f : IncidenceShape.Hom X Y) (g : IncidenceShape.Hom Y Z) :
    TypeCat.ofHom
        (typeMap σ inputTypes outputTypes (IncidenceShape.comp f g)) =
      TypeCat.ofHom (typeMap σ inputTypes outputTypes g) ≫
        TypeCat.ofHom (typeMap σ inputTypes outputTypes f) := by
  cases f <;> cases g <;> rfl

/-- The concrete signature/type graph. -/
def typeGraph (σ : FinSignature) (inputTypes outputTypes : List σ.Obj) :
    IncidenceShapeᵒᵖ ⥤ Type where
  obj X := TypeCarrier σ inputTypes outputTypes (unop X)
  map f := TypeCat.ofHom (typeMap σ inputTypes outputTypes f.unop)
  map_id X := typeMap_id σ inputTypes outputTypes (unop X)
  map_comp f g := by
    simpa only [CategoryTheory.unop_comp] using
      typeMap_comp σ inputTypes outputTypes g.unop f.unop

/-! ## Pointwise union pushouts in `Type` -/

private def subtypeInclusion {α : Type} {P Q : α → Prop}
    (h : ∀ x, P x → Q x) :
    {x // P x} ⟶ {x // Q x} :=
  TypeCat.ofHom fun x => ⟨x.1, h x.1 x.2⟩

private theorem subtypeInclusion_injective
    {α : Type} {P Q : α → Prop}
    (h : ∀ x, P x → Q x) :
    Function.Injective (subtypeInclusion h) := by
  intro x y hxy
  apply Subtype.ext
  exact congrArg (fun z : {x // Q x} => z.1) hxy

private theorem subtype_union_isPushout
    {α : Type} {K L D H : α → Prop}
    [∀ x, Decidable (L x)]
    (kL : ∀ x, K x → L x)
    (kD : ∀ x, K x → D x)
    (lH : ∀ x, L x → H x)
    (dH : ∀ x, D x → H x)
    (inter : ∀ x, K x ↔ L x ∧ D x)
    (union : ∀ x, H x ↔ L x ∨ D x) :
    IsPushout
      (subtypeInclusion kL) (subtypeInclusion kD)
      (subtypeInclusion lH) (subtypeInclusion dH) := by
  let desc :
      (s : PushoutCocone (subtypeInclusion kL) (subtypeInclusion kD)) →
        {x // H x} ⟶ s.pt :=
    fun s => TypeCat.ofHom fun x =>
        if hx : L x.1 then
          s.inl ⟨x.1, hx⟩
        else
          s.inr
            ⟨x.1, (union x.1).mp x.2 |>.resolve_left hx⟩
  refine IsPushout.of_isColimit
    (PushoutCocone.IsColimit.mk
      (by ext x; rfl)
      desc ?_ ?_ ?_)
  · intro s
    ext x
    change
      (if hx : L x.1 then s.inl ⟨x.1, hx⟩ else
        s.inr ⟨x.1, (union x.1).mp (lH x.1 x.2) |>.resolve_left hx⟩) =
          s.inl x
    rw [dif_pos x.2]
  · intro s
    ext x
    by_cases hx : L x.1
    ·
      have hxK : K x.1 := (inter x.1).mpr ⟨hx, x.2⟩
      have hcondition :=
        ConcreteCategory.congr_hom s.condition
          (⟨x.1, hxK⟩ : {x // K x})
      simpa [desc, subtypeInclusion, hx] using hcondition
    ·
      simp [desc, subtypeInclusion, hx]
  · intro s m hmL hmD
    ext x
    by_cases hx : L x.1
    ·
      have hpoint :=
        ConcreteCategory.congr_hom hmL
          (⟨x.1, hx⟩ : {x // L x})
      simpa [desc, subtypeInclusion, hx] using hpoint
    ·
      have hxD : D x.1 :=
        (union x.1).mp x.2 |>.resolve_left hx
      have hpoint :=
        ConcreteCategory.congr_hom hmD
          (⟨x.1, hxD⟩ : {x // D x})
      simpa [desc, subtypeInclusion, hx] using hpoint

/-! ## Finite views and their presheaves -/

variable {Node Edge : Type} [DecidableEq Node] [DecidableEq Edge]

/--
A finite view of the total declarations carried by `G`.

Views are used for hosts, complements, results, and finite rule fragments.
Only incidence/boundary closure is needed here: signature typing remains in
the fixed total declarations of the already certified host graph.
-/
structure View
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) where
  nodes : Finset Node
  edges : Finset Edge
  inputs : Finset (Fin inputTypes.length)
  outputs : Finset (Fin outputTypes.length)
  source_active :
    ∀ e, e ∈ edges → ∀ n, n ∈ G.sources e → n ∈ nodes
  target_active :
    ∀ e, e ∈ edges → ∀ n, n ∈ G.targets e → n ∈ nodes
  source_typed :
    ∀ e, e ∈ edges →
      (G.sources e).map G.nodeType = σ.input (G.edgeLabel e)
  target_typed :
    ∀ e, e ∈ edges →
      (G.targets e).map G.nodeType = σ.output (G.edgeLabel e)
  input_active :
    ∀ i, i ∈ inputs → G.inputBoundary i ∈ nodes
  output_active :
    ∀ i, i ∈ outputs → G.outputBoundary i ∈ nodes

namespace View

variable {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}

/-- Global ordered source-port identifiers. -/
abbrev SourcePort (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) :=
  Σ e : Edge, Fin (G.sources e).length

/-- Global ordered target-port identifiers. -/
abbrev TargetPort (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) :=
  Σ e : Edge, Fin (G.targets e).length

/-- Presheaf carriers for one finite view. -/
def Carrier (V : View G) : IncidenceShape → Type
  | .node => ↥V.nodes
  | .edge => ↥V.edges
  | .source => { p : SourcePort G // p.1 ∈ V.edges }
  | .target => { p : TargetPort G // p.1 ∈ V.edges }
  | .input => ↥V.inputs
  | .output => ↥V.outputs

private theorem source_get_mem (e : Edge) (i : Fin (G.sources e).length) :
    (G.sources e).get i ∈ G.sources e :=
  List.get_mem _ _

private theorem target_get_mem (e : Edge) (i : Fin (G.targets e).length) :
    (G.targets e).get i ∈ G.targets e :=
  List.get_mem _ _

private theorem get_cast_of_eq {α : Type} {l r : List α}
    (h : l = r) (i : Fin l.length) :
    l.get i = r.get (Fin.cast (congrArg List.length h) i) := by
  cases h
  rfl

/-- Contravariant incidence maps of a finite view. -/
def map (V : View G) {X Y : IncidenceShape} :
    IncidenceShape.Hom X Y → Carrier V Y → Carrier V X
  | .id _, x => x
  | .nodeSource, p =>
      ⟨(G.sources p.1.1).get p.1.2,
        V.source_active p.1.1 p.2 _
          (source_get_mem p.1.1 p.1.2)⟩
  | .edgeSource, p => ⟨p.1.1, p.2⟩
  | .nodeTarget, p =>
      ⟨(G.targets p.1.1).get p.1.2,
        V.target_active p.1.1 p.2 _
          (target_get_mem p.1.1 p.1.2)⟩
  | .edgeTarget, p => ⟨p.1.1, p.2⟩
  | .nodeInput, i =>
      ⟨G.inputBoundary i.1, V.input_active i.1 i.2⟩
  | .nodeOutput, i =>
      ⟨G.outputBoundary i.1, V.output_active i.1 i.2⟩

@[simp]
theorem map_id (V : View G) (X : IncidenceShape) :
    TypeCat.ofHom (V.map (IncidenceShape.Hom.id X)) =
      𝟙 (Carrier V X) :=
  rfl

theorem map_comp (V : View G) {X Y Z : IncidenceShape}
    (f : IncidenceShape.Hom X Y) (g : IncidenceShape.Hom Y Z) :
    TypeCat.ofHom (V.map (IncidenceShape.comp f g)) =
      TypeCat.ofHom (V.map g) ≫ TypeCat.ofHom (V.map f) := by
  cases f <;> cases g <;> rfl

/-- The incidence presheaf of a finite view. -/
def presheaf (V : View G) : IncidenceShapeᵒᵖ ⥤ Type where
  obj X := Carrier V (unop X)
  map f := TypeCat.ofHom (V.map f.unop)
  map_id X := map_id V (unop X)
  map_comp f g := by
    simpa only [CategoryTheory.unop_comp] using
      map_comp V g.unop f.unop

/-- Component of the typing map at one incidence sort. -/
def typingComponent (V : View G) :
    (X : IncidenceShape) →
      Carrier V X ⟶ TypeCarrier σ inputTypes outputTypes X
  | .node =>
      TypeCat.ofHom fun n => G.nodeType n.1
  | .edge =>
      TypeCat.ofHom fun e => G.edgeLabel e.1
  | .source =>
      TypeCat.ofHom fun p =>
        ⟨G.edgeLabel p.1.1,
          Fin.cast
            (congrArg List.length
              (V.source_typed p.1.1 p.2))
            (Fin.cast (by simp) p.1.2)⟩
  | .target =>
      TypeCat.ofHom fun p =>
        ⟨G.edgeLabel p.1.1,
          Fin.cast
            (congrArg List.length
              (V.target_typed p.1.1 p.2))
            (Fin.cast (by simp) p.1.2)⟩
  | .input => TypeCat.ofHom fun i => i.1
  | .output => TypeCat.ofHom fun i => i.1

theorem typing_naturality_base (V : View G)
    {X Y : IncidenceShape} (f : IncidenceShape.Hom X Y) :
    TypeCat.ofHom (V.map f) ≫ V.typingComponent X =
      V.typingComponent Y ≫
        TypeCat.ofHom (typeMap σ inputTypes outputTypes f) := by
  cases f with
  | id X => cases X <;> rfl
  | nodeSource =>
      ext p
      have h :=
        V.source_typed p.1.1 p.2
      have hget :=
        get_cast_of_eq h
          (Fin.cast (by simp) p.1.2)
      change
        G.nodeType ((G.sources p.1.1).get p.1.2) =
          (σ.input (G.edgeLabel p.1.1)).get
            (Fin.cast (congrArg List.length h)
              (Fin.cast (by simp) p.1.2))
      simpa using hget
  | edgeSource => rfl
  | nodeTarget =>
      ext p
      have h :=
        V.target_typed p.1.1 p.2
      have hget :=
        get_cast_of_eq h
          (Fin.cast (by simp) p.1.2)
      change
        G.nodeType ((G.targets p.1.1).get p.1.2) =
          (σ.output (G.edgeLabel p.1.1)).get
            (Fin.cast (congrArg List.length h)
              (Fin.cast (by simp) p.1.2))
      simpa using hget
  | edgeTarget => rfl
  | nodeInput =>
      ext x
      exact G.wellFormed.inputBoundary_typed x.1
  | nodeOutput =>
      ext x
      exact G.wellFormed.outputBoundary_typed x.1

/-- Typing natural transformation into the fixed signature/type graph. -/
def typing (V : View G) :
    V.presheaf ⟶ typeGraph σ inputTypes outputTypes where
  app X := V.typingComponent (unop X)
  naturality := by
    intro X Y f
    change
      TypeCat.ofHom (V.map (Quiver.Hom.unop f)) ≫
          V.typingComponent (unop Y) =
        V.typingComponent (unop X) ≫
          TypeCat.ofHom
            (typeMap σ inputTypes outputTypes (Quiver.Hom.unop f))
    exact V.typing_naturality_base (Quiver.Hom.unop f)

/-- A finite view as an object of the typed presheaf slice. -/
def typed (V : View G) :
    AdhesiveDPOI.TypedHypergraph (typeGraph σ inputTypes outputTypes) :=
  Over.mk V.typing

/-! ## Inclusions of finite views -/

/-- Componentwise inclusion of finite views over the same total declarations. -/
structure Inclusion (A B : View G) : Prop where
  nodes : A.nodes ⊆ B.nodes
  edges : A.edges ⊆ B.edges
  inputs : A.inputs ⊆ B.inputs
  outputs : A.outputs ⊆ B.outputs

namespace Inclusion

variable {A B C : View G}

def refl (A : View G) : Inclusion A A where
  nodes := fun _ h => h
  edges := fun _ h => h
  inputs := fun _ h => h
  outputs := fun _ h => h

def trans (f : Inclusion A B) (g : Inclusion B C) :
    Inclusion A C where
  nodes := fun _ h => g.nodes (f.nodes h)
  edges := fun _ h => g.edges (f.edges h)
  inputs := fun _ h => g.inputs (f.inputs h)
  outputs := fun _ h => g.outputs (f.outputs h)

def app (h : Inclusion A B) :
    (X : IncidenceShape) → Carrier A X ⟶ Carrier B X
  | .node => subtypeInclusion h.nodes
  | .edge => subtypeInclusion h.edges
  | .source =>
      subtypeInclusion (fun _ hp => h.edges hp)
  | .target =>
      subtypeInclusion (fun _ hp => h.edges hp)
  | .input => subtypeInclusion h.inputs
  | .output => subtypeInclusion h.outputs

theorem app_naturality (h : Inclusion A B)
    {X Y : IncidenceShape} (f : IncidenceShape.Hom X Y) :
    TypeCat.ofHom (A.map f) ≫ h.app X =
      h.app Y ≫ TypeCat.ofHom (B.map f) := by
  cases f with
  | id X => cases X <;> rfl
  | nodeSource => rfl
  | edgeSource => rfl
  | nodeTarget => rfl
  | edgeTarget => rfl
  | nodeInput => rfl
  | nodeOutput => rfl

/-- Underlying natural transformation of a finite-view inclusion. -/
def naturalTransformation (h : Inclusion A B) :
    A.presheaf ⟶ B.presheaf where
  app X := h.app (unop X)
  naturality := by
    intro X Y f
    change
      TypeCat.ofHom (A.map (Quiver.Hom.unop f)) ≫ h.app (unop Y) =
        h.app (unop X) ≫
          TypeCat.ofHom (B.map (Quiver.Hom.unop f))
    exact h.app_naturality (Quiver.Hom.unop f)

theorem typing_comm (h : Inclusion A B) :
    h.naturalTransformation ≫ B.typing = A.typing := by
  ext X x
  cases X with
  | op X =>
      cases X <;> cases x <;> rfl

/-- Inclusion as a morphism in the typed presheaf slice. -/
def hom (h : Inclusion A B) : A.typed ⟶ B.typed :=
  Over.homMk h.naturalTransformation h.typing_comm

theorem app_injective (h : Inclusion A B) (X : IncidenceShape) :
    Function.Injective (h.app X) := by
  cases X with
  | node => exact subtypeInclusion_injective h.nodes
  | edge => exact subtypeInclusion_injective h.edges
  | source =>
      exact subtypeInclusion_injective (fun p hp => h.edges hp)
  | target =>
      exact subtypeInclusion_injective (fun p hp => h.edges hp)
  | input => exact subtypeInclusion_injective h.inputs
  | output => exact subtypeInclusion_injective h.outputs

/-- Every finite-view inclusion is monic in the typed slice. -/
theorem hom_mono (h : Inclusion A B) : Mono h.hom := by
  letI appMono (X : IncidenceShapeᵒᵖ) :
      Mono (h.naturalTransformation.app X) :=
    (mono_iff_injective _).2 (h.app_injective (unop X))
  letI : Mono h.naturalTransformation :=
    NatTrans.mono_of_mono_app h.naturalTransformation
  letI : Mono h.hom.left := by
    change Mono h.naturalTransformation
    infer_instance
  exact Over.mono_of_mono_left h.hom

@[simp]
theorem hom_id (A : View G) :
    (refl A).hom =
      𝟙 A.typed := by
  ext X x
  cases X with
  | op X =>
      cases X <;> cases x <;> rfl

@[simp]
theorem hom_comp (f : Inclusion A B) (g : Inclusion B C) :
    (trans f g).hom = f.hom ≫ g.hom := by
  ext X x
  cases X with
  | op X =>
      cases X <;> cases x <;> rfl

theorem proof_irrel (f g : Inclusion A B) : f = g :=
  Subsingleton.elim f g

end Inclusion

/-!
The fixed-declaration finite-view category has inclusions as morphisms.  This
is the exact morphism class needed by the executable inclusion-match DPO
fragment; it is intentionally narrower than arbitrary open-hypergraph
morphisms.
-/
instance viewCategory : Category (View G) where
  Hom A B := PLift (Inclusion A B)
  id A := ⟨Inclusion.refl A⟩
  comp f g := ⟨Inclusion.trans f.down g.down⟩
  id_comp := by
    intros
    exact Subsingleton.elim _ _
  comp_id := by
    intros
    exact Subsingleton.elim _ _
  assoc := by
    intros
    exact Subsingleton.elim _ _

/-- Faithful encoding of finite support views and their inclusions. -/
def encodingFunctor
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) :
    View G ⥤ AdhesiveDPOI.TypedHypergraph
      (typeGraph σ inputTypes outputTypes) where
  obj V := V.typed
  map := by
    intro X Y f
    exact f.down.hom
  map_id V := Inclusion.hom_id V
  map_comp := by
    intro X Y Z f g
    exact Inclusion.hom_comp f.down g.down

/--
The view encoding is faithful on the proved inclusion morphism class.

This theorem does not say that every morphism in the typed slice is induced
by a finite-view inclusion.
-/
instance encodingFunctor_faithful
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) :
    (encodingFunctor G).Faithful where
  map_injective := by
    intro X Y f g _
    change PLift (Inclusion X Y) at f g
    cases f
    cases g
    rfl

/-! ## Pointwise pushout criterion for four finite views -/

/--
A square of view inclusions whose supports are pointwise intersections and
unions.  These are concrete, non-circular gluing equations.
-/
structure UnionSquare (K L D H : View G) where
  kL : Inclusion K L
  kD : Inclusion K D
  lH : Inclusion L H
  dH : Inclusion D H
  nodes_inter :
    ∀ x, x ∈ K.nodes ↔ x ∈ L.nodes ∧ x ∈ D.nodes
  nodes_union :
    ∀ x, x ∈ H.nodes ↔ x ∈ L.nodes ∨ x ∈ D.nodes
  edges_inter :
    ∀ x, x ∈ K.edges ↔ x ∈ L.edges ∧ x ∈ D.edges
  edges_union :
    ∀ x, x ∈ H.edges ↔ x ∈ L.edges ∨ x ∈ D.edges
  inputs_inter :
    ∀ x, x ∈ K.inputs ↔ x ∈ L.inputs ∧ x ∈ D.inputs
  inputs_union :
    ∀ x, x ∈ H.inputs ↔ x ∈ L.inputs ∨ x ∈ D.inputs
  outputs_inter :
    ∀ x, x ∈ K.outputs ↔ x ∈ L.outputs ∧ x ∈ D.outputs
  outputs_union :
    ∀ x, x ∈ H.outputs ↔ x ∈ L.outputs ∨ x ∈ D.outputs

namespace UnionSquare

variable {K L D H : View G}

/-- Each sort of a union square is a pushout in `Type`. -/
theorem app_isPushout (sq : UnionSquare K L D H)
    (X : IncidenceShape) :
    IsPushout
      (sq.kL.naturalTransformation.app (op X))
      (sq.kD.naturalTransformation.app (op X))
      (sq.lH.naturalTransformation.app (op X))
      (sq.dH.naturalTransformation.app (op X)) := by
  cases X with
  | node =>
      change
        IsPushout
          (subtypeInclusion sq.kL.nodes)
          (subtypeInclusion sq.kD.nodes)
          (subtypeInclusion sq.lH.nodes)
          (subtypeInclusion sq.dH.nodes)
      exact
        subtype_union_isPushout
          sq.kL.nodes sq.kD.nodes sq.lH.nodes sq.dH.nodes
          sq.nodes_inter sq.nodes_union
  | edge =>
      change
        IsPushout
          (subtypeInclusion sq.kL.edges)
          (subtypeInclusion sq.kD.edges)
          (subtypeInclusion sq.lH.edges)
          (subtypeInclusion sq.dH.edges)
      exact
        subtype_union_isPushout
          sq.kL.edges sq.kD.edges sq.lH.edges sq.dH.edges
          sq.edges_inter sq.edges_union
  | source =>
      change
        IsPushout
          (subtypeInclusion
            (fun (p : SourcePort G) hp => sq.kL.edges hp))
          (subtypeInclusion
            (fun (p : SourcePort G) hp => sq.kD.edges hp))
          (subtypeInclusion
            (fun (p : SourcePort G) hp => sq.lH.edges hp))
          (subtypeInclusion
            (fun (p : SourcePort G) hp => sq.dH.edges hp))
      exact
        subtype_union_isPushout
          (α := SourcePort G)
          (K := fun p => p.1 ∈ K.edges)
          (L := fun p => p.1 ∈ L.edges)
          (D := fun p => p.1 ∈ D.edges)
          (H := fun p => p.1 ∈ H.edges)
          (fun p hp => sq.kL.edges hp)
          (fun p hp => sq.kD.edges hp)
          (fun p hp => sq.lH.edges hp)
          (fun p hp => sq.dH.edges hp)
          (fun p => sq.edges_inter p.1)
          (fun p => sq.edges_union p.1)
  | target =>
      change
        IsPushout
          (subtypeInclusion
            (fun (p : TargetPort G) hp => sq.kL.edges hp))
          (subtypeInclusion
            (fun (p : TargetPort G) hp => sq.kD.edges hp))
          (subtypeInclusion
            (fun (p : TargetPort G) hp => sq.lH.edges hp))
          (subtypeInclusion
            (fun (p : TargetPort G) hp => sq.dH.edges hp))
      exact
        subtype_union_isPushout
          (α := TargetPort G)
          (K := fun p => p.1 ∈ K.edges)
          (L := fun p => p.1 ∈ L.edges)
          (D := fun p => p.1 ∈ D.edges)
          (H := fun p => p.1 ∈ H.edges)
          (fun p hp => sq.kL.edges hp)
          (fun p hp => sq.kD.edges hp)
          (fun p hp => sq.lH.edges hp)
          (fun p hp => sq.dH.edges hp)
          (fun p => sq.edges_inter p.1)
          (fun p => sq.edges_union p.1)
  | input =>
      change
        IsPushout
          (subtypeInclusion sq.kL.inputs)
          (subtypeInclusion sq.kD.inputs)
          (subtypeInclusion sq.lH.inputs)
          (subtypeInclusion sq.dH.inputs)
      exact
        subtype_union_isPushout
          sq.kL.inputs sq.kD.inputs sq.lH.inputs sq.dH.inputs
          sq.inputs_inter sq.inputs_union
  | output =>
      change
        IsPushout
          (subtypeInclusion sq.kL.outputs)
          (subtypeInclusion sq.kD.outputs)
          (subtypeInclusion sq.lH.outputs)
          (subtypeInclusion sq.dH.outputs)
      exact
        subtype_union_isPushout
          sq.kL.outputs sq.kD.outputs sq.lH.outputs sq.dH.outputs
          sq.outputs_inter sq.outputs_union

/-- The incidence-presheaf square is a pointwise pushout. -/
theorem presheaf_isPushout (sq : UnionSquare K L D H) :
    IsPushout
      sq.kL.naturalTransformation sq.kD.naturalTransformation
      sq.lH.naturalTransformation sq.dH.naturalTransformation := by
  apply IsPushout.of_forall_isPushout_app
  intro X
  exact sq.app_isPushout (unop X)

/-- The pointwise presheaf pushout is reflected into the typed slice. -/
theorem typed_isPushout (sq : UnionSquare K L D H) :
    IsPushout sq.kL.hom sq.kD.hom sq.lH.hom sq.dH.hom := by
  apply IsPushout.of_map_of_faithful (F := Over.forget _)
  change
    IsPushout
      sq.kL.naturalTransformation sq.kD.naturalTransformation
      sq.lH.naturalTransformation sq.dH.naturalTransformation
  exact sq.presheaf_isPushout

end UnionSquare

/-! ## Executable hosts, complements, and results -/

/-- The full open host as a finite view. -/
def wholeView
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) :
    View G where
  nodes := G.nodes
  edges := G.edges
  inputs := Finset.univ
  outputs := Finset.univ
  source_active := G.wellFormed.source_active
  target_active := G.wellFormed.target_active
  source_typed := G.wellFormed.source_typed
  target_typed := G.wellFormed.target_typed
  input_active := by
    intro i _
    exact G.wellFormed.inputBoundary_active i
  output_active := by
    intro i _
    exact G.wellFormed.outputBoundary_active i

/--
The executable deletion complement, represented over the unchanged total
declarations of the host.
-/
def complementView
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (r : DPOI.AdmissibleRewrite G) :
    View G where
  nodes := r.complement.nodes
  edges := r.complement.edges
  inputs := Finset.univ
  outputs := Finset.univ
  source_active := r.complement.wellFormed.source_active
  target_active := r.complement.wellFormed.target_active
  source_typed := r.complement.wellFormed.source_typed
  target_typed := r.complement.wellFormed.target_typed
  input_active := by
    intro i _
    exact r.complement.wellFormed.inputBoundary_active i
  output_active := by
    intro i _
    exact r.complement.wellFormed.outputBoundary_active i

/-- The executable insertion result as a finite view over the host declarations. -/
def resultView
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (r : DPOI.AdmissibleRewrite G) :
    View G where
  nodes := r.result.nodes
  edges := r.result.edges
  inputs := Finset.univ
  outputs := Finset.univ
  source_active := r.result.wellFormed.source_active
  target_active := r.result.wellFormed.target_active
  source_typed := r.result.wellFormed.source_typed
  target_typed := r.result.wellFormed.target_typed
  input_active := by
    intro i _
    exact r.result.wellFormed.inputBoundary_active i
  output_active := by
    intro i _
    exact r.result.wellFormed.outputBoundary_active i

/--
Any two certified realizations of the explicit finite deletion complement
have isomorphic encoded whole views.

The equality used here is the executable complement-uniqueness theorem in
`DPOI`; neither the equality nor this induced isomorphism follows merely from
adhesivity.
-/
noncomputable def encodedComplementUniqueIso
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (r : DPOI.AdmissibleRewrite G)
    {D E : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (hD : r.IsComplement D) (hE : r.IsComplement E) :
    (wholeView D).typed ≅ (wholeView E).typed := by
  have h : D = E := r.fixed_match_complement_unique hD hE
  subst E
  exact Iso.refl _

namespace Contextual

variable {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
variable (r : DPOI.AdmissibleRewrite G)

def complementToHost :
    View.Inclusion (complementView r) (wholeView G) where
  nodes := by
    intro n hn
    exact (Finset.mem_sdiff.mp hn).1
  edges := by
    intro e he
    exact (Finset.mem_sdiff.mp he).1
  inputs := fun _ hi => hi
  outputs := fun _ hi => hi

def complementToResult :
    View.Inclusion (complementView r) (resultView r) where
  nodes := by
    intro n hn
    exact Finset.mem_union_left _ hn
  edges := by
    intro e he
    exact Finset.mem_union_left _ he
  inputs := fun _ hi => hi
  outputs := fun _ hi => hi

/--
The canonical host-indexed rule `G ← complement → result`.

This is a genuine linear rule in the adhesive slice, but it is contextual:
its left and right objects depend on this particular host and event.
-/
def rule :
    AdhesiveDPOI.Rule (typeGraph σ inputTypes outputTypes) where
  interface := (complementView r).typed
  left := (wholeView G).typed
  right := (resultView r).typed
  leftLeg := (complementToHost r).hom
  rightLeg := (complementToResult r).hom
  left_mono := (complementToHost r).hom_mono
  right_mono := (complementToResult r).hom_mono

/-- The contextual rule is matched by the identity of its host. -/
def matching :
    AdhesiveDPOI.Match (rule r) (wholeView G).typed where
  arrow := 𝟙 _
  mono := by
    dsimp [rule]
    infer_instance

/--
Every executable finite inclusion rewrite yields two actual pushout squares in
the typed presheaf slice.

Both are identity-leg pushouts.  Consequently this theorem is a sound bridge
to the categorical DPO interface, but not a proof that the executable event
came from a host-independent local rule.
-/
def derivation :
    AdhesiveDPOI.Derivation (rule r) (matching r) where
  complement := (complementView r).typed
  result := (resultView r).typed
  interfaceToComplement := 𝟙 _
  complementToHost := (complementToHost r).hom
  rightToResult := 𝟙 _
  complementToResult := (complementToResult r).hom
  complementSquare := IsPushout.of_id_snd
  resultSquare := IsPushout.of_id_snd

theorem complement_exists :
    Nonempty (AdhesiveDPOI.Derivation (rule r) (matching r)) :=
  ⟨derivation r⟩

end Contextual

/-! ## Exact boundary for a host-independent local rule -/

/--
Inserted hyperedges are local to the preserved matched interface.

Without this condition an inserted edge may attach to a retained host node
outside the match.  Such an attachment is executable in `AdmissibleRewrite`
but cannot be represented by the same inclusion-style, host-independent
linear rule: that context node would be in neither side of the rule interface.
-/
def InterfaceLocal
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (r : DPOI.AdmissibleRewrite G) : Prop :=
  (∀ e, e ∈ r.support.insertEdges →
      ∀ n, n ∈ G.sources e →
        n ∈
          (r.matching.nodes \ r.support.deleteNodes) ∪
            r.support.insertNodes) ∧
  (∀ e, e ∈ r.support.insertEdges →
      ∀ n, n ∈ G.targets e →
        n ∈
          (r.matching.nodes \ r.support.deleteNodes) ∪
            r.support.insertNodes)

namespace Local

variable {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
variable (r : DPOI.AdmissibleRewrite G)

/-- The selected left-hand side `L`; open boundary ports belong to context. -/
def leftView : View G where
  nodes := r.matching.nodes
  edges := r.matching.edges
  inputs := ∅
  outputs := ∅
  source_active := r.matching.source_closed
  target_active := r.matching.target_closed
  source_typed := by
    intro e he
    exact G.wellFormed.source_typed e (r.matching.edges_active he)
  target_typed := by
    intro e he
    exact G.wellFormed.target_typed e (r.matching.edges_active he)
  input_active := by simp
  output_active := by simp

/-- The preserved rule interface `K = L \ delete`. -/
def interfaceView : View G where
  nodes := r.matching.nodes \ r.support.deleteNodes
  edges := r.matching.edges \ r.support.deleteEdges
  inputs := ∅
  outputs := ∅
  source_active := by
    intro e he n hn
    have heMatch : e ∈ r.matching.edges := (Finset.mem_sdiff.mp he).1
    have heRetained : e ∉ r.support.deleteEdges :=
      (Finset.mem_sdiff.mp he).2
    have hnMatch : n ∈ r.matching.nodes :=
      r.matching.source_closed e heMatch n hn
    have hnRetained : n ∉ r.support.deleteNodes :=
      (r.dangling e (r.matching.edges_active heMatch) heRetained).1 n hn
    exact Finset.mem_sdiff.mpr ⟨hnMatch, hnRetained⟩
  target_active := by
    intro e he n hn
    have heMatch : e ∈ r.matching.edges := (Finset.mem_sdiff.mp he).1
    have heRetained : e ∉ r.support.deleteEdges :=
      (Finset.mem_sdiff.mp he).2
    have hnMatch : n ∈ r.matching.nodes :=
      r.matching.target_closed e heMatch n hn
    have hnRetained : n ∉ r.support.deleteNodes :=
      (r.dangling e (r.matching.edges_active heMatch) heRetained).2 n hn
    exact Finset.mem_sdiff.mpr ⟨hnMatch, hnRetained⟩
  source_typed := by
    intro e he
    exact
      G.wellFormed.source_typed e
        (r.matching.edges_active (Finset.mem_sdiff.mp he).1)
  target_typed := by
    intro e he
    exact
      G.wellFormed.target_typed e
        (r.matching.edges_active (Finset.mem_sdiff.mp he).1)
  input_active := by simp
  output_active := by simp

/--
The local right-hand side `R = K ∪ insert`.

Construction is possible precisely with the explicit `InterfaceLocal`
attachment condition; general executable events need not satisfy it.
-/
def rightView (hlocal : InterfaceLocal r) : View G where
  nodes :=
    (r.matching.nodes \ r.support.deleteNodes) ∪
      r.support.insertNodes
  edges :=
    (r.matching.edges \ r.support.deleteEdges) ∪
      r.support.insertEdges
  inputs := ∅
  outputs := ∅
  source_active := by
    intro e he n hn
    rcases Finset.mem_union.mp he with heRetained | heInserted
    ·
      exact Finset.mem_union_left _
        ((interfaceView r).source_active e heRetained n hn)
    · exact hlocal.1 e heInserted n hn
  target_active := by
    intro e he n hn
    rcases Finset.mem_union.mp he with heRetained | heInserted
    ·
      exact Finset.mem_union_left _
        ((interfaceView r).target_active e heRetained n hn)
    · exact hlocal.2 e heInserted n hn
  source_typed := by
    intro e he
    apply r.result.wellFormed.source_typed e
    change
      e ∈ (G.edges \ r.support.deleteEdges) ∪
        r.support.insertEdges
    rcases Finset.mem_union.mp he with heRetained | heInserted
    · exact
        Finset.mem_union_left _
          (Finset.mem_sdiff.mpr
            ⟨r.matching.edges_active (Finset.mem_sdiff.mp heRetained).1,
              (Finset.mem_sdiff.mp heRetained).2⟩)
    · exact Finset.mem_union_right _ heInserted
  target_typed := by
    intro e he
    apply r.result.wellFormed.target_typed e
    change
      e ∈ (G.edges \ r.support.deleteEdges) ∪
        r.support.insertEdges
    rcases Finset.mem_union.mp he with heRetained | heInserted
    · exact
        Finset.mem_union_left _
          (Finset.mem_sdiff.mpr
            ⟨r.matching.edges_active (Finset.mem_sdiff.mp heRetained).1,
              (Finset.mem_sdiff.mp heRetained).2⟩)
    · exact Finset.mem_union_right _ heInserted
  input_active := by simp
  output_active := by simp

def interfaceToLeft :
    View.Inclusion (interfaceView r) (leftView r) where
  nodes := fun _ hn => (Finset.mem_sdiff.mp hn).1
  edges := fun _ he => (Finset.mem_sdiff.mp he).1
  inputs := fun _ hi => hi
  outputs := fun _ hi => hi

def leftToHost :
    View.Inclusion (leftView r) (wholeView G) where
  nodes := r.matching.nodes_active
  edges := r.matching.edges_active
  inputs := by
    intro i _
    simp [wholeView]
  outputs := by
    intro i _
    simp [wholeView]

def interfaceToComplement :
    View.Inclusion (interfaceView r) (complementView r) where
  nodes := by
    intro n hn
    exact
      Finset.mem_sdiff.mpr
        ⟨r.matching.nodes_active (Finset.mem_sdiff.mp hn).1,
          (Finset.mem_sdiff.mp hn).2⟩
  edges := by
    intro e he
    exact
      Finset.mem_sdiff.mpr
        ⟨r.matching.edges_active (Finset.mem_sdiff.mp he).1,
          (Finset.mem_sdiff.mp he).2⟩
  inputs := by
    intro i _
    simp [complementView]
  outputs := by
    intro i _
    simp [complementView]

def interfaceToRight (hlocal : InterfaceLocal r) :
    View.Inclusion (interfaceView r) (rightView r hlocal) where
  nodes := fun _ hn => Finset.mem_union_left _ hn
  edges := fun _ he => Finset.mem_union_left _ he
  inputs := fun _ hi => hi
  outputs := fun _ hi => hi

def rightToResult (hlocal : InterfaceLocal r) :
    View.Inclusion (rightView r hlocal) (resultView r) where
  nodes := by
    intro n hn
    rcases Finset.mem_union.mp hn with hnRetained | hnInserted
    ·
      exact Finset.mem_union_left _
        (Finset.mem_sdiff.mpr
          ⟨r.matching.nodes_active (Finset.mem_sdiff.mp hnRetained).1,
            (Finset.mem_sdiff.mp hnRetained).2⟩)
    · exact Finset.mem_union_right _ hnInserted
  edges := by
    intro e he
    rcases Finset.mem_union.mp he with heRetained | heInserted
    ·
      exact Finset.mem_union_left _
        (Finset.mem_sdiff.mpr
          ⟨r.matching.edges_active (Finset.mem_sdiff.mp heRetained).1,
            (Finset.mem_sdiff.mp heRetained).2⟩)
    · exact Finset.mem_union_right _ heInserted
  inputs := by
    intro i _
    simp [resultView]
  outputs := by
    intro i _
    simp [resultView]

/-- A genuine host-independent finite linear rule for local events. -/
def rule (hlocal : InterfaceLocal r) :
    AdhesiveDPOI.Rule (typeGraph σ inputTypes outputTypes) where
  interface := (interfaceView r).typed
  left := (leftView r).typed
  right := (rightView r hlocal).typed
  leftLeg := (interfaceToLeft r).hom
  rightLeg := (interfaceToRight r hlocal).hom
  left_mono := (interfaceToLeft r).hom_mono
  right_mono := (interfaceToRight r hlocal).hom_mono

/-- The selected inclusion occurrence `L ↪ G`. -/
def matching (hlocal : InterfaceLocal r) :
    AdhesiveDPOI.Match (rule r hlocal) (wholeView G).typed where
  arrow := (leftToHost r).hom
  mono := (leftToHost r).hom_mono

/-- Pointwise intersection/union equations for the deletion square. -/
def complementUnionSquare :
    View.UnionSquare
      (interfaceView r) (leftView r) (complementView r) (wholeView G) where
  kL := interfaceToLeft r
  kD := interfaceToComplement r
  lH := leftToHost r
  dH := Contextual.complementToHost r
  nodes_inter := by
    intro n
    constructor
    · intro hn
      exact
        ⟨(Finset.mem_sdiff.mp hn).1,
          Finset.mem_sdiff.mpr
            ⟨r.matching.nodes_active (Finset.mem_sdiff.mp hn).1,
              (Finset.mem_sdiff.mp hn).2⟩⟩
    · rintro ⟨hnMatch, hnComplement⟩
      exact
        Finset.mem_sdiff.mpr
          ⟨hnMatch, (Finset.mem_sdiff.mp hnComplement).2⟩
  nodes_union := by
    intro n
    constructor
    · intro hnHost
      by_cases hnMatch : n ∈ r.matching.nodes
      · exact Or.inl hnMatch
      ·
        exact Or.inr
          (Finset.mem_sdiff.mpr
            ⟨hnHost, fun hnDelete =>
              hnMatch (r.deleteNodes_matched hnDelete)⟩)
    · rintro (hnMatch | hnComplement)
      · exact r.matching.nodes_active hnMatch
      · exact (Finset.mem_sdiff.mp hnComplement).1
  edges_inter := by
    intro e
    constructor
    · intro he
      exact
        ⟨(Finset.mem_sdiff.mp he).1,
          Finset.mem_sdiff.mpr
            ⟨r.matching.edges_active (Finset.mem_sdiff.mp he).1,
              (Finset.mem_sdiff.mp he).2⟩⟩
    · rintro ⟨heMatch, heComplement⟩
      exact
        Finset.mem_sdiff.mpr
          ⟨heMatch, (Finset.mem_sdiff.mp heComplement).2⟩
  edges_union := by
    intro e
    constructor
    · intro heHost
      by_cases heMatch : e ∈ r.matching.edges
      · exact Or.inl heMatch
      ·
        exact Or.inr
          (Finset.mem_sdiff.mpr
            ⟨heHost, fun heDelete =>
              heMatch (r.deleteEdges_matched heDelete)⟩)
    · rintro (heMatch | heComplement)
      · exact r.matching.edges_active heMatch
      · exact (Finset.mem_sdiff.mp heComplement).1
  inputs_inter := by
    intro i
    simp [interfaceView, leftView]
  inputs_union := by
    intro i
    simp [leftView, complementView, wholeView]
  outputs_inter := by
    intro i
    simp [interfaceView, leftView]
  outputs_union := by
    intro i
    simp [leftView, complementView, wholeView]

/-- Pointwise intersection/union equations for the insertion square. -/
def resultUnionSquare (hlocal : InterfaceLocal r) :
    View.UnionSquare
      (interfaceView r) (rightView r hlocal)
      (complementView r) (resultView r) where
  kL := interfaceToRight r hlocal
  kD := interfaceToComplement r
  lH := rightToResult r hlocal
  dH := Contextual.complementToResult r
  nodes_inter := by
    intro n
    constructor
    · intro hn
      exact
        ⟨Finset.mem_union_left _ hn,
          Finset.mem_sdiff.mpr
            ⟨r.matching.nodes_active (Finset.mem_sdiff.mp hn).1,
              (Finset.mem_sdiff.mp hn).2⟩⟩
    · rintro ⟨hnRight, hnComplement⟩
      rcases Finset.mem_union.mp hnRight with hnRetained | hnInserted
      · exact hnRetained
      ·
        exact
          (Finset.disjoint_left.mp r.insertNodes_fresh
            hnInserted (Finset.mem_sdiff.mp hnComplement).1).elim
  nodes_union := by
    intro n
    constructor
    · intro hnResult
      rcases Finset.mem_union.mp hnResult with hnComplement | hnInserted
      · exact Or.inr hnComplement
      · exact Or.inl (Finset.mem_union_right _ hnInserted)
    · rintro (hnRight | hnComplement)
      ·
        rcases Finset.mem_union.mp hnRight with hnRetained | hnInserted
        ·
          exact Finset.mem_union_left _
            (Finset.mem_sdiff.mpr
              ⟨r.matching.nodes_active (Finset.mem_sdiff.mp hnRetained).1,
                (Finset.mem_sdiff.mp hnRetained).2⟩)
        · exact Finset.mem_union_right _ hnInserted
      · exact Finset.mem_union_left _ hnComplement
  edges_inter := by
    intro e
    constructor
    · intro he
      exact
        ⟨Finset.mem_union_left _ he,
          Finset.mem_sdiff.mpr
            ⟨r.matching.edges_active (Finset.mem_sdiff.mp he).1,
              (Finset.mem_sdiff.mp he).2⟩⟩
    · rintro ⟨heRight, heComplement⟩
      rcases Finset.mem_union.mp heRight with heRetained | heInserted
      · exact heRetained
      ·
        exact
          (Finset.disjoint_left.mp r.insertEdges_fresh
            heInserted (Finset.mem_sdiff.mp heComplement).1).elim
  edges_union := by
    intro e
    constructor
    · intro heResult
      rcases Finset.mem_union.mp heResult with heComplement | heInserted
      · exact Or.inr heComplement
      · exact Or.inl (Finset.mem_union_right _ heInserted)
    · rintro (heRight | heComplement)
      ·
        rcases Finset.mem_union.mp heRight with heRetained | heInserted
        ·
          exact Finset.mem_union_left _
            (Finset.mem_sdiff.mpr
              ⟨r.matching.edges_active (Finset.mem_sdiff.mp heRetained).1,
                (Finset.mem_sdiff.mp heRetained).2⟩)
        · exact Finset.mem_union_right _ heInserted
      · exact Finset.mem_union_left _ heComplement
  inputs_inter := by
    intro i
    simp [interfaceView, rightView]
  inputs_union := by
    intro i
    simp [rightView, complementView, resultView]
  outputs_inter := by
    intro i
    simp [interfaceView, rightView]
  outputs_union := by
    intro i
    simp [rightView, complementView, resultView]

/--
The nondegenerate local DPO derivation.

Its first and second squares are obtained by the proved pointwise
intersection/union universal property and reflection through the typed-slice
forgetful functor.
-/
def derivation (hlocal : InterfaceLocal r) :
    AdhesiveDPOI.Derivation (rule r hlocal) (matching r hlocal) where
  complement := (complementView r).typed
  result := (resultView r).typed
  interfaceToComplement := (interfaceToComplement r).hom
  complementToHost := (Contextual.complementToHost r).hom
  rightToResult := (rightToResult r hlocal).hom
  complementToResult := (Contextual.complementToResult r).hom
  complementSquare := (complementUnionSquare r).typed_isPushout
  resultSquare := (resultUnionSquare r hlocal).typed_isPushout

theorem local_complement_exists (hlocal : InterfaceLocal r) :
    Nonempty
      (AdhesiveDPOI.Derivation (rule r hlocal) (matching r hlocal)) :=
  ⟨derivation r hlocal⟩

end Local

end View

end Cantilune.Core.FinitePresheafDPOI
