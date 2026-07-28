import Cantilune.Core.OpenCospanDPOI
import Mathlib.CategoryTheory.Limits.Preserves.Shapes.Square

/-!
# Exact finite-positional / adhesive-slice DPO bridge

`PositionalDPOI.encodingFunctor` is not an equivalence with the whole typed
presheaf slice: its objects are finite and satisfy the exact positional
incidence equations.  It is, however, full and faithful and an equivalence
with its replete essential image.

This file records the strongest bridge that follows without a false
whole-slice closure claim.  Whenever all six objects of an ambient DPO witness
(`K`, `L`, `R`, host, complement, and result) lie in that essential image, the
two ambient pushout squares lift to genuine pushout squares in the essential
image.  Hence the entire DPO witness lifts and can be transported across the
existing equivalence to the intrinsic finite positional category.

The remaining M-adhesive obligation is now exact: prove that the particular
complement and result constructions used by admitted finite positional rules
remain in this essential image.  It is not hidden in an assertion that the
finite category is equivalent to the entire (possibly infinite and
non-positional) slice.
-/

namespace Cantilune.Core.PositionalDPOIBridge

open CategoryTheory
open CategoryTheory.Limits

universe u

variable (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)

abbrev Slice :=
  AdhesiveDPOI.TypedHypergraph
    (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)

abbrev Encoding :=
  PositionalDPOI.encodingFunctor σ inputTypes outputTypes

abbrev PositionalImage :=
  (Encoding σ inputTypes outputTypes).EssImageSubcategory

section MapWitness

variable {C : Type*} [Category C]
variable {D : Type*} [Category D]
variable {K L R G : C}
variable {left : K ⟶ L} {right : K ⟶ R} {matching : L ⟶ G}

/-- A colimit-preserving functor transports a complete DPO witness. -/
noncomputable def mapWitness
    (w : DPO.Witness left right matching)
    (F : C ⥤ D)
    [PreservesColimit (span left w.complement.interface) F]
    [PreservesColimit (span w.complement.interface right) F] :
    DPO.Witness (F.map left) (F.map right) (F.map matching) := by
  let complementSquare :
      IsPushout
        (F.map left)
        (F.map w.complement.interface)
        (F.map matching)
        (F.map w.complement.inclusion) :=
    (IsPushout.of_isColimit w.complement.isPushout).map F
  let resultSquare :
      IsPushout
        (F.map w.complement.interface)
        (F.map right)
        (F.map w.result.cocone.inl)
        (F.map w.result.cocone.inr) :=
    (IsPushout.of_isColimit w.result.isPushout).map F
  exact
    { complement :=
        { context := F.obj w.complement.context
          interface := F.map w.complement.interface
          inclusion := F.map w.complement.inclusion
          square := complementSquare.w
          isPushout := complementSquare.isColimit }
      result :=
        { cocone :=
            PushoutCocone.mk
              (F.map w.result.cocone.inl)
              (F.map w.result.cocone.inr)
              resultSquare.w
          isPushout := resultSquare.isColimit } }

end MapWitness

/--
An ambient pushout whose four objects lie in the positional essential image
is already a pushout in that full subcategory.
-/
theorem isPushout_in_positionalImage
    {K L D G : PositionalImage σ inputTypes outputTypes}
    {left : K ⟶ L} {interface : K ⟶ D}
    {matching : L ⟶ G} {inclusion : D ⟶ G}
    (square :
      IsPushout
        ((Encoding σ inputTypes outputTypes).essImage.ι.map left)
        ((Encoding σ inputTypes outputTypes).essImage.ι.map interface)
        ((Encoding σ inputTypes outputTypes).essImage.ι.map matching)
        ((Encoding σ inputTypes outputTypes).essImage.ι.map inclusion)) :
    IsPushout left interface matching inclusion := by
  exact
    IsPushout.of_map_of_faithful
      (F := (Encoding σ inputTypes outputTypes).essImage.ι)
      square

/--
The analogous reflection result for pullback squares.  This is used by
adhesive DPO arguments after a complement square has been shown to remain in
the positional image.
-/
theorem isPullback_in_positionalImage
    {K L D G : PositionalImage σ inputTypes outputTypes}
    {left : K ⟶ L} {interface : K ⟶ D}
    {matching : L ⟶ G} {inclusion : D ⟶ G}
    (square :
      IsPullback
        ((Encoding σ inputTypes outputTypes).essImage.ι.map left)
        ((Encoding σ inputTypes outputTypes).essImage.ι.map interface)
        ((Encoding σ inputTypes outputTypes).essImage.ι.map matching)
        ((Encoding σ inputTypes outputTypes).essImage.ι.map inclusion)) :
    IsPullback left interface matching inclusion := by
  exact
    IsPullback.of_map_of_faithful
      (F := (Encoding σ inputTypes outputTypes).essImage.ι)
      square

section Witness

variable {σ inputTypes outputTypes}
variable {K L R G : Slice σ inputTypes outputTypes}
variable {left : K ⟶ L} {right : K ⟶ R} {matching : L ⟶ G}

/--
Membership evidence needed to lift one ambient DPO witness into the finite
positional essential image.
-/
structure WitnessInPositionalImage
    (w : DPO.Witness left right matching) : Prop where
  interface_mem : (Encoding σ inputTypes outputTypes).essImage K
  left_mem : (Encoding σ inputTypes outputTypes).essImage L
  right_mem : (Encoding σ inputTypes outputTypes).essImage R
  host_mem : (Encoding σ inputTypes outputTypes).essImage G
  complement_mem :
    (Encoding σ inputTypes outputTypes).essImage w.complement.context
  result_mem :
    (Encoding σ inputTypes outputTypes).essImage w.result.cocone.pt

/-- Bundle an ambient object and its positional-image witness. -/
private def imageObject
    (X : Slice σ inputTypes outputTypes)
    (h : (Encoding σ inputTypes outputTypes).essImage X) :
    PositionalImage σ inputTypes outputTypes :=
  ⟨X, h⟩

/-- Bundle an ambient arrow as an arrow of the full essential-image subcategory. -/
private def imageHom
    {X Y : Slice σ inputTypes outputTypes}
    (hX : (Encoding σ inputTypes outputTypes).essImage X)
    (hY : (Encoding σ inputTypes outputTypes).essImage Y)
    (f : X ⟶ Y) :
    imageObject X hX ⟶ imageObject Y hY :=
  ObjectProperty.homMk f

/-- Type of the complete DPO witness after lifting to the essential image. -/
abbrev LiftedWitnessType
    (w : DPO.Witness left right matching)
    (h : WitnessInPositionalImage w) :=
  DPO.Witness
    (C := PositionalImage σ inputTypes outputTypes)
    (K := imageObject K h.interface_mem)
    (L := imageObject L h.left_mem)
    (R := imageObject R h.right_mem)
    (G := imageObject G h.host_mem)
    (imageHom h.interface_mem h.left_mem left)
    (imageHom h.interface_mem h.right_mem right)
    (imageHom h.left_mem h.host_mem matching)

/-- Type of the DPO witness transported back to intrinsic finite graphs. -/
abbrev FiniteWitnessType
    (w : DPO.Witness left right matching)
    (h : WitnessInPositionalImage w) :=
  let E :=
    PositionalDPOI.equivalenceEssImage σ inputTypes outputTypes
  DPO.Witness
    (E.inverse.map
      (imageHom h.interface_mem h.left_mem left))
    (E.inverse.map
      (imageHom h.interface_mem h.right_mem right))
    (E.inverse.map
      (imageHom h.left_mem h.host_mem matching))

/--
Lift the whole ambient DPO witness to the full positional essential image.

All arrows are inherited because the subcategory is full.  Both universal
properties are reflected by its fully faithful inclusion.
-/
noncomputable def liftWitness
    (w : DPO.Witness left right matching)
    (h : WitnessInPositionalImage w) :
    LiftedWitnessType w h where
  complement :=
    { context := imageObject w.complement.context h.complement_mem
      interface :=
        imageHom h.interface_mem h.complement_mem
          w.complement.interface
      inclusion :=
        imageHom h.complement_mem h.host_mem
          w.complement.inclusion
      square := by
        apply ObjectProperty.hom_ext
        exact w.complement.square
      isPushout := by
        apply IsPushout.isColimit
        apply
          isPushout_in_positionalImage
            (σ := σ) (inputTypes := inputTypes)
            (outputTypes := outputTypes)
        exact IsPushout.of_isColimit w.complement.isPushout }
  result :=
    { cocone :=
        PushoutCocone.mk
          (imageHom h.complement_mem h.result_mem
            w.result.cocone.inl)
          (imageHom h.right_mem h.result_mem
            w.result.cocone.inr)
          (by
            apply ObjectProperty.hom_ext
            exact w.result.cocone.condition)
      isPushout := by
        apply IsPushout.isColimit
        apply
          isPushout_in_positionalImage
            (σ := σ) (inputTypes := inputTypes)
            (outputTypes := outputTypes)
        exact IsPushout.of_isColimit w.result.isPushout }

/--
The lifted witness transports across the established equivalence to a genuine
DPO witness in the intrinsic finite positional category.
-/
noncomputable def finiteWitness
    (w : DPO.Witness left right matching)
    (h : WitnessInPositionalImage w) :
    FiniteWitnessType w h := by
  let E :=
    PositionalDPOI.equivalenceEssImage σ inputTypes outputTypes
  exact mapWitness (liftWitness w h) E.inverse

theorem finite_bridge_exists
    (w : DPO.Witness left right matching)
    (h : WitnessInPositionalImage w) :
    Nonempty (FiniteWitnessType w h) :=
  ⟨finiteWitness w h⟩

end Witness

/-! ## Why the bridge cannot be an equivalence with the whole slice -/

section WholeSliceBoundary

/-- Infinitely many copies of every carrier of a presheaf. -/
def natCopies
    {Shape : Type u} [Category Shape]
    (T : AdhesiveDPOI.HypergraphPresheaf Shape) :
    AdhesiveDPOI.HypergraphPresheaf Shape where
  obj X := T.obj X × ℕ
  map f :=
    TypeCat.ofHom fun x => (T.map f x.1, x.2)
  map_id X := by
    ext x <;> cases x <;> simp
  map_comp f g := by
    ext x <;> cases x <;> simp

/-- Projection from infinitely copied carriers to the original presheaf. -/
def natCopiesTyping
    {Shape : Type u} [Category Shape]
    (T : AdhesiveDPOI.HypergraphPresheaf Shape) :
    natCopies T ⟶ T where
  app X := TypeCat.ofHom Prod.fst
  naturality := by
    intro X Y f
    ext x
    rfl

/-- The infinitely copied presheaf as a typed object over `T`. -/
def infiniteTypedHypergraph
    {Shape : Type u} [Category Shape]
    (T : AdhesiveDPOI.HypergraphPresheaf Shape) :
    AdhesiveDPOI.TypedHypergraph T :=
  Over.mk (natCopiesTyping T)

/--
For every signature with at least one object type, the intrinsic finite
encoding is not essentially surjective onto the whole adhesive slice.

The counterexample is a valid typed presheaf with countably many copies of
each carrier.  At the node component an isomorphism from any encoded finite
graph would give a surjection from a finite type onto
`σ.Obj × ℕ`, contradicting infinitude.
-/
theorem infiniteTypedHypergraph_not_in_essImage
    [Nonempty σ.Obj] :
    ¬ (Encoding σ inputTypes outputTypes).essImage
        (infiniteTypedHypergraph
          (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)) := by
  rintro ⟨G, ⟨e⟩⟩
  let component :
      G.encoded.left.obj
          (Opposite.op FinitePresheafDPOI.IncidenceShape.node) ⟶
        (natCopies
          (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)).obj
            (Opposite.op FinitePresheafDPOI.IncidenceShape.node) :=
    e.hom.left.app
      (Opposite.op FinitePresheafDPOI.IncidenceShape.node)
  haveI : IsIso e.hom := e.isIso_hom
  haveI : IsIso e.hom.left := by infer_instance
  haveI : IsIso component := by
    dsimp [component]
    exact
      NatIso.isIso_app_of_isIso
        e.hom.left
        (Opposite.op FinitePresheafDPOI.IncidenceShape.node)
  have component_surjective :
      Function.Surjective component :=
    (ConcreteCategory.bijective_of_isIso component).2
  letI sourceFintype :
      Fintype
        (G.encoded.left.obj
          (Opposite.op FinitePresheafDPOI.IncidenceShape.node)) := by
    change Fintype (PositionalDPOI.FiniteHypergraph.NodeCarrier G)
    infer_instance
  letI sourceFinite :
      Finite
        (G.encoded.left.obj
          (Opposite.op FinitePresheafDPOI.IncidenceShape.node)) :=
    Fintype.finite sourceFintype
  have copied_finite :
      Finite
        ((natCopies
          (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)).obj
            (Opposite.op FinitePresheafDPOI.IncidenceShape.node)) :=
    Finite.of_surjective component component_surjective
  have copied_finite' : Finite (σ.Obj × ℕ) := by
    exact copied_finite
  letI : Finite (σ.Obj × ℕ) := copied_finite'
  exact not_finite (σ.Obj × ℕ)

/-- Consequently there can be no whole-slice essential-surjectivity instance. -/
theorem encodingFunctor_not_essSurj
    [Nonempty σ.Obj] :
    ¬ (Encoding σ inputTypes outputTypes).EssSurj := by
  intro h
  letI : (Encoding σ inputTypes outputTypes).EssSurj := h
  exact
    infiniteTypedHypergraph_not_in_essImage
      (σ := σ) (inputTypes := inputTypes) (outputTypes := outputTypes)
      (Functor.EssSurj.mem_essImage
        (Encoding σ inputTypes outputTypes)
        (infiniteTypedHypergraph
          (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)))

end WholeSliceBoundary

end Cantilune.Core.PositionalDPOIBridge
