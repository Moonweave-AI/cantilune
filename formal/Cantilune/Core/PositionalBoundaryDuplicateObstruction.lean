import Cantilune.Core.PositionalImageCharacterization

/-!
# Boundary no-duplicate obstruction

Finite carriers, complete source/target incidences, and boundary carriers
bijective with the fixed ordered positions still do not characterize the
positional image.  Two boundary positions may attach to the same node.

This module gives a finite typed-presheaf counterexample and proves that the
missing boundary-injectivity clause is essential.
-/

namespace Cantilune.Core.PositionalBoundaryDuplicateObstruction

open CategoryTheory
open Opposite
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PositionalImageCharacterization

/-- One object type, no generators, and two input positions of the same type. -/
def boundarySignature : FinSignature where
  Obj := PUnit
  Gen := Empty
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun generator => nomatch generator
  output := fun generator => nomatch generator
  mode := fun _ => .linear
  contract := fun generator => nomatch generator

abbrev boundaryTypes : List boundarySignature.Obj :=
  [PUnit.unit, PUnit.unit]

/-- One node, two input positions, and no edge or incidence carriers. -/
def duplicateCarrier : IncidenceShape → Type
  | .node => PUnit
  | .input => Fin 2
  | _ => Empty

/-- Both input positions attach to the unique node. -/
def duplicateMap {A B : IncidenceShape} :
    IncidenceShape.Hom A B → duplicateCarrier B → duplicateCarrier A
  | .id _, value => value
  | .nodeSource, value => nomatch value
  | .edgeSource, value => nomatch value
  | .nodeTarget, value => nomatch value
  | .edgeTarget, value => nomatch value
  | .nodeInput, _ => PUnit.unit
  | .nodeOutput, value => nomatch value

@[simp]
theorem duplicateMap_id (shape : IncidenceShape) :
    TypeCat.ofHom (duplicateMap (IncidenceShape.Hom.id shape)) =
      𝟙 (duplicateCarrier shape) := by
  cases shape <;> rfl

theorem duplicateMap_comp
    {A B C : IncidenceShape}
    (first : IncidenceShape.Hom A B)
    (second : IncidenceShape.Hom B C) :
    TypeCat.ofHom (duplicateMap (IncidenceShape.comp first second)) =
      TypeCat.ofHom (duplicateMap second) ≫
        TypeCat.ofHom (duplicateMap first) := by
  cases first <;> cases second <;> rfl

def duplicatePresheaf : IncidenceShapeᵒᵖ ⥤ Type where
  obj shape := duplicateCarrier (unop shape)
  map arrow := TypeCat.ofHom (duplicateMap arrow.unop)
  map_id shape := duplicateMap_id (unop shape)
  map_comp first second := by
    simpa only [CategoryTheory.unop_comp] using
      duplicateMap_comp second.unop first.unop

def duplicateTypingComponent :
    (shape : IncidenceShape) →
      duplicateCarrier shape →
        TypeCarrier boundarySignature boundaryTypes [] shape
  | .node, _ => PUnit.unit
  | .edge, value => nomatch value
  | .source, value => nomatch value
  | .target, value => nomatch value
  | .input, position => position
  | .output, value => nomatch value

theorem duplicateTyping_naturality_base
    {A B : IncidenceShape} (arrow : IncidenceShape.Hom A B) :
    TypeCat.ofHom (duplicateMap arrow) ≫
        TypeCat.ofHom (duplicateTypingComponent A) =
      TypeCat.ofHom (duplicateTypingComponent B) ≫
        TypeCat.ofHom
          (typeMap boundarySignature boundaryTypes [] arrow) := by
  cases arrow with
  | id shape =>
      cases A with
      | node =>
          ext value
          cases value
          rfl
      | edge =>
          ext value
          exact value.elim
      | source =>
          ext value
          exact value.elim
      | target =>
          ext value
          exact value.elim
      | input =>
          ext value
          rfl
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
      change PUnit.unit = PUnit.unit
      rfl
  | nodeOutput =>
      ext value
      exact value.elim

def duplicateTyping :
    duplicatePresheaf ⟶
      typeGraph boundarySignature boundaryTypes [] where
  app shape :=
    TypeCat.ofHom (duplicateTypingComponent (unop shape))
  naturality := by
    intro A B arrow
    exact duplicateTyping_naturality_base arrow.unop

/-- The finite typed object with duplicated boundary attachment. -/
def duplicateTyped :
    AdhesiveDPOI.TypedHypergraph
      (typeGraph boundarySignature boundaryTypes []) :=
  Over.mk duplicateTyping

/--
The tempting finite + incidence-complete + fixed-boundary predicate holds.
Source and target completeness are vacuous because the signature has no
generators, while the input typing component is literally the identity.
-/
theorem duplicateTyped_finiteCompleteFixedBoundary :
    FiniteCompleteFixedBoundary duplicateTyped where
  carrier_finite shape := by
    change Finite (duplicateCarrier shape)
    cases shape with
    | node => exact Finite.of_fintype PUnit
    | edge => exact Finite.of_fintype Empty
    | source => exact Finite.of_fintype Empty
    | target => exact Finite.of_fintype Empty
    | input => exact Finite.of_fintype (Fin 2)
    | output => exact Finite.of_fintype Empty
  source_bijective := by
    constructor
    · intro source
      exact source.elim
    · intro descriptor
      exact descriptor.1.1.elim
  target_bijective := by
    constructor
    · intro target
      exact target.elim
    · intro descriptor
      exact descriptor.1.1.elim
  input_bijective := by
    constructor
    · intro first second equality
      exact equality
    · intro position
      exact ⟨position, rfl⟩
  output_bijective := by
    constructor
    · intro output
      exact output.elim
    · intro position
      exact Fin.elim0 position

/-- The two distinct ordered input positions attach to the same node. -/
theorem duplicateTyped_input_node_not_injective :
    ¬ Function.Injective
      (structureMap duplicateTyped IncidenceShape.Hom.nodeInput) := by
  intro injective
  let first : Fin 2 := ⟨0, by decide⟩
  let second : Fin 2 := ⟨1, by decide⟩
  have equality : first = second := injective rfl
  have valueEquality : first.val = second.val :=
    congrArg Fin.val equality
  change (0 : Nat) = 1 at valueEquality
  omega

/-- Hence the exact independent positional predicate correctly rejects it. -/
theorem duplicateTyped_not_exactPositionalObject :
    ¬ ExactPositionalObject duplicateTyped := by
  intro exact
  exact duplicateTyped_input_node_not_injective
    exact.input_node_injective

/--
Mechanical obstruction theorem: the naive predicate is not sufficient for
essential-image membership.
-/
theorem duplicateTyped_not_in_essImage :
    ¬ (encodingFunctor boundarySignature boundaryTypes []).essImage
        duplicateTyped := by
  intro membership
  exact duplicateTyped_not_exactPositionalObject
    ((essImage_iff_exactPositionalObject duplicateTyped).mp membership)

end Cantilune.Core.PositionalBoundaryDuplicateObstruction
