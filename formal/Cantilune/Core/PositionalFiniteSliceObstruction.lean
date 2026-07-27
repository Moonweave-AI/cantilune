import Cantilune.Core.PositionalDPOIBridge

/-!
# A finite object outside the positional typed-hypergraph image

The intrinsic positional encoding is equivalent to its essential image in the
typed incidence-presheaf slice.  The whole slice is larger even before
infinite carriers are considered: a slice object may declare an edge while
omitting the source-incidence position required by that edge's generator.

This file gives a finite counterexample.  It complements the countably
infinite counterexample in `PositionalDPOIBridge` and makes precise why the
correct categorical target is the positional essential image, not every
object of the unrestricted slice.
-/

namespace Cantilune.Core.PositionalFiniteSliceObstruction

open CategoryTheory
open Opposite
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI

/-- One object and one generator with exactly one required input position. -/
def oneInputSignature : FinSignature where
  Obj := PUnit
  Gen := PUnit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => [PUnit.unit]
  output := fun _ => []
  mode := fun _ => .linear
  contract := fun _ => {}

/--
A finite carrier family with one edge but no node or incidence values.  It is
a perfectly valid presheaf carrier, but it is not a positional hypergraph.
-/
def malformedCarrier : IncidenceShape → Type
  | .edge => PUnit
  | _ => Empty

def malformedMap {X Y : IncidenceShape} :
    IncidenceShape.Hom X Y → malformedCarrier Y → malformedCarrier X
  | .id _, value => value
  | .nodeSource, value => nomatch value
  | .edgeSource, value => nomatch value
  | .nodeTarget, value => nomatch value
  | .edgeTarget, value => nomatch value
  | .nodeInput, value => nomatch value
  | .nodeOutput, value => nomatch value

@[simp]
theorem malformedMap_id (X : IncidenceShape) :
    TypeCat.ofHom
        (malformedMap (IncidenceShape.Hom.id X)) =
      𝟙 (malformedCarrier X) := by
  cases X <;> rfl

theorem malformedMap_comp {X Y Z : IncidenceShape}
    (first : IncidenceShape.Hom X Y)
    (second : IncidenceShape.Hom Y Z) :
    TypeCat.ofHom
        (malformedMap (IncidenceShape.comp first second)) =
      TypeCat.ofHom (malformedMap second) ≫
        TypeCat.ofHom (malformedMap first) := by
  cases first <;> cases second <;> rfl

def malformedPresheaf : IncidenceShapeᵒᵖ ⥤ Type where
  obj X := malformedCarrier (unop X)
  map f := TypeCat.ofHom (malformedMap f.unop)
  map_id X := malformedMap_id (unop X)
  map_comp f g := by
    simpa only [CategoryTheory.unop_comp] using
      malformedMap_comp g.unop f.unop

def malformedTypingComponent :
    (X : IncidenceShape) →
      malformedCarrier X →
        TypeCarrier oneInputSignature [] [] X
  | .node, value => nomatch value
  | .edge, _ => PUnit.unit
  | .source, value => nomatch value
  | .target, value => nomatch value
  | .input, value => nomatch value
  | .output, value => nomatch value

theorem malformedTyping_naturality_base
    {X Y : IncidenceShape} (f : IncidenceShape.Hom X Y) :
    TypeCat.ofHom (malformedMap f) ≫
        TypeCat.ofHom (malformedTypingComponent X) =
      TypeCat.ofHom (malformedTypingComponent Y) ≫
        TypeCat.ofHom
          (typeMap oneInputSignature [] [] f) := by
  cases f with
  | id X =>
      cases X with
      | node =>
          ext value
          exact value.elim
      | edge =>
          ext value
          cases value
          rfl
      | source =>
          ext value
          exact value.elim
      | target =>
          ext value
          exact value.elim
      | input =>
          ext value
          exact value.elim
      | output =>
          ext value
          exact value.elim
  | nodeSource =>
      ext value
      exact value.elim
  | edgeSource =>
      ext value
      exact value.elim
  | nodeTarget =>
      ext value
      exact value.elim
  | edgeTarget =>
      ext value
      exact value.elim
  | nodeInput =>
      ext value
      exact value.elim
  | nodeOutput =>
      ext value
      exact value.elim

def malformedTyping :
    malformedPresheaf ⟶ typeGraph oneInputSignature [] [] where
  app X := TypeCat.ofHom (malformedTypingComponent (unop X))
  naturality := by
    intro X Y f
    exact malformedTyping_naturality_base f.unop

/-- The finite malformed object in the typed slice. -/
def malformedTyped :
    AdhesiveDPOI.TypedHypergraph
      (typeGraph oneInputSignature [] []) :=
  Over.mk malformedTyping

/--
No intrinsic finite positional graph can encode the malformed finite object:
an isomorphism would send its unique edge back to an intrinsic edge, whose
required input position supplies a source incidence; the forward isomorphism
would then have to map that incidence into `Empty`.
-/
theorem malformedTyped_not_in_essImage :
    ¬ (PositionalDPOI.encodingFunctor oneInputSignature [] []).essImage
        malformedTyped := by
  rintro ⟨graph, ⟨equivalence⟩⟩
  let edgeValue :
      graph.encoded.left.obj (op IncidenceShape.edge) :=
    equivalence.inv.left.app (op IncidenceShape.edge) PUnit.unit
  have inputPosition :
      Fin (oneInputSignature.input edgeValue.1).length := by
    cases edgeValue.1
    exact ⟨0, by decide⟩
  let sourceValue :
      graph.encoded.left.obj (op IncidenceShape.source) :=
    ⟨edgeValue.1, edgeValue.2, inputPosition⟩
  exact
    (equivalence.hom.left.app
      (op IncidenceShape.source) sourceValue).elim

/-- Hence the positional encoding is not essentially surjective even on this finite witness. -/
theorem encodingFunctor_not_essSurj_from_finite_witness :
    ¬ (PositionalDPOI.encodingFunctor
        oneInputSignature [] []).EssSurj := by
  intro essentiallySurjective
  letI :
      (PositionalDPOI.encodingFunctor
        oneInputSignature [] []).EssSurj :=
    essentiallySurjective
  exact malformedTyped_not_in_essImage
    (Functor.EssSurj.mem_essImage
      (PositionalDPOI.encodingFunctor oneInputSignature [] [])
      malformedTyped)

end Cantilune.Core.PositionalFiniteSliceObstruction
