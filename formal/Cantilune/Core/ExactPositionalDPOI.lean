import Cantilune.Core.GeneralFiniteOpenDPOI
import Cantilune.Core.PositionalImageCharacterization

/-!
# Exact finite typed-open-hypergraph category

`PositionalImageCharacterization` proves objectwise that the intrinsic finite
positional hypergraphs are exactly the ambient typed presheaves satisfying
`ExactPositionalObject`.  This file lifts that iff to an explicit categorical
equivalence.

The target is a full subcategory of the adhesive slice.  Consequently its
arrows are all ambient typed natural transformations between exact objects;
there is no fixed host, thin-inclusion restriction, or `InterfaceLocal`
hypothesis.  The unrestricted slice is intentionally not the target because
finite incidence-incomplete and duplicate-boundary presheaves are genuine
counterexamples.
-/

noncomputable section

namespace Cantilune.Core.ExactPositionalDPOI

open CategoryTheory
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PositionalImageCharacterization

variable (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)

/--
The direct encoding into the full subcategory selected by the independent
exact-positional predicate.
-/
def exactEncodingFunctor :
    FiniteHypergraph σ inputTypes outputTypes ⥤
      ExactPositionalSubcategory
        (σ := σ) (inputTypes := inputTypes) (outputTypes := outputTypes) where
  obj graph := ⟨graph.encoded, Encoded.exactPositionalObject graph⟩
  map arrow := ObjectProperty.homMk arrow
  map_id _ := rfl
  map_comp _ _ := rfl

instance exactEncodingFunctor_faithful :
    (exactEncodingFunctor σ inputTypes outputTypes).Faithful where
  map_injective := by
    intro source target first second equality
    exact congrArg (fun arrow => arrow.hom) equality

instance exactEncodingFunctor_full :
    (exactEncodingFunctor σ inputTypes outputTypes).Full where
  map_surjective := by
    intro source target arrow
    exact ⟨arrow.hom, rfl⟩

/--
Every exact ambient object is isomorphic, in the exact full subcategory, to
the direct encoding of its reconstructed intrinsic graph.
-/
noncomputable def reconstructionIso
    (X :
      ExactPositionalSubcategory
        (σ := σ) (inputTypes := inputTypes) (outputTypes := outputTypes)) :
    (exactEncodingFunctor σ inputTypes outputTypes).obj
        (Reconstruction.graph X.obj X.property) ≅
      X :=
  ObjectProperty.isoMk _ (Reconstruction.typedIso X.obj X.property)

instance exactEncodingFunctor_essSurj :
    (exactEncodingFunctor σ inputTypes outputTypes).EssSurj where
  mem_essImage X :=
    ⟨Reconstruction.graph X.obj X.property,
      ⟨reconstructionIso σ inputTypes outputTypes X⟩⟩

noncomputable instance exactEncodingFunctor_isEquivalence :
    (exactEncodingFunctor σ inputTypes outputTypes).IsEquivalence where

/--
Categorical form of `essImage_iff_exactPositionalObject`: all finite,
incidence-complete, typed open hypergraphs with the prescribed injective
boundary, and all typed natural transformations between them, are equivalent
to the intrinsic finite-open-hypergraph category.
-/
noncomputable def exact_positional_equivalence :
    FiniteHypergraph σ inputTypes outputTypes ≌
      ExactPositionalSubcategory
        (σ := σ) (inputTypes := inputTypes) (outputTypes := outputTypes) :=
  (exactEncodingFunctor σ inputTypes outputTypes).asEquivalence

@[simp]
theorem exact_positional_equivalence_functor :
    (exact_positional_equivalence σ inputTypes outputTypes).functor =
      exactEncodingFunctor σ inputTypes outputTypes :=
  rfl

/--
The exact encoding reflects monomorphisms.  Thus a categorical mono in the
exact ambient subcategory is not an extra, representation-dependent notion.
-/
theorem mono_of_exactEncoding_mono
    {G H : FiniteHypergraph σ inputTypes outputTypes}
    (arrow : G ⟶ H)
    [Mono ((exactEncodingFunctor σ inputTypes outputTypes).map arrow)] :
    Mono arrow := by
  exact
    (exactEncodingFunctor σ inputTypes outputTypes).mono_of_mono_map
      (inferInstance :
        Mono ((exactEncodingFunctor σ inputTypes outputTypes).map arrow))

/--
Conversely, every intrinsic mono is sent to an ambient mono.  Fullness is the
essential hypothesis: arbitrary functors do not preserve monomorphisms.
-/
theorem exactEncoding_mono_of_mono
    {G H : FiniteHypergraph σ inputTypes outputTypes}
    (arrow : G ⟶ H) [Mono arrow] :
    Mono ((exactEncodingFunctor σ inputTypes outputTypes).map arrow) := by
  infer_instance

/--
The ambient encoded arrow used by the DPO construction is definitionally the
underlying arrow of the exact-subcategory encoding.
-/
theorem exactEncoding_underlying
    {G H : FiniteHypergraph σ inputTypes outputTypes}
    (arrow : G ⟶ H) :
    ((exactEncodingFunctor σ inputTypes outputTypes).map arrow).hom =
      (encodingFunctor σ inputTypes outputTypes).map arrow :=
  rfl

end Cantilune.Core.ExactPositionalDPOI
