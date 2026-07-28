import Mathlib.CategoryTheory.Adhesive.Over
import Mathlib.CategoryTheory.Limits.Shapes.Pullback.IsPullback.Basic

/-!
# Typed presheaf hypergraphs and adhesive DPOI squares

Typed hypergraphs can be represented as objects of the slice over a fixed type
graph in a presheaf category.  Mathlib proves that functor categories into
`Type` are adhesive and that slices of adhesive categories remain adhesive.
This module instantiates those results and records the categorical DPOI data:

* monic open-boundary legs;
* monic DPO rule legs and matches;
* an explicitly witnessed pushout complement;
* the second pushout producing the rewrite result;
* Van Kampen and pullback consequences for both squares; and
* uniqueness of a fixed second pushout up to canonical isomorphism.

Adhesivity does **not** imply that every proposed match has a pushout
complement.  A `Derivation` therefore carries that square as evidence.  The
finite executable gluing conditions in `Core.DPOI` provide a separate concrete
existence construction for inclusion matches.
-/

namespace Cantilune.Core.AdhesiveDPOI

open CategoryTheory
open CategoryTheory.Limits

universe u v

variable (Shape : Type u) [Category.{v} Shape]

/-- Presheaf-valued hypergraphs on an arbitrary small incidence shape. -/
abbrev HypergraphPresheaf :=
  Shapeᵒᵖ ⥤ Type (max u v)

variable {Shape}

/--
Hypergraphs typed by a fixed type graph.  A signature/type graph is an object
of the presheaf category; typing is the structure map in its slice.
-/
abbrev TypedHypergraph
    (typeGraph : HypergraphPresheaf Shape) :=
  Over typeGraph

/-- The presheaf category has the full adhesive structure. -/
theorem presheaf_isAdhesive :
    Adhesive (HypergraphPresheaf Shape) := by
  infer_instance

/-- The category of hypergraphs over a fixed type graph is adhesive. -/
theorem typedHypergraph_isAdhesive
    (typeGraph : HypergraphPresheaf Shape) :
    Adhesive (TypedHypergraph typeGraph) := by
  infer_instance

/--
An open typed hypergraph is a cospan whose boundary legs are monomorphisms.
The input and output objects may themselves carry typed port structure.
-/
structure OpenTypedHypergraph
    (typeGraph : HypergraphPresheaf Shape) where
  input : TypedHypergraph typeGraph
  apex : TypedHypergraph typeGraph
  output : TypedHypergraph typeGraph
  inputLeg : input ⟶ apex
  outputLeg : output ⟶ apex
  input_mono : Mono inputLeg
  output_mono : Mono outputLeg

/-- A linear DPO rule `L ← K → R` in the typed presheaf slice. -/
structure Rule
    (typeGraph : HypergraphPresheaf Shape) where
  interface : TypedHypergraph typeGraph
  left : TypedHypergraph typeGraph
  right : TypedHypergraph typeGraph
  leftLeg : interface ⟶ left
  rightLeg : interface ⟶ right
  left_mono : Mono leftLeg
  right_mono : Mono rightLeg

/-- A monic occurrence of the rule's left-hand side in a host graph. -/
structure Match
    {typeGraph : HypergraphPresheaf Shape}
    (rule : Rule typeGraph)
    (host : TypedHypergraph typeGraph) where
  arrow : rule.left ⟶ host
  mono : Mono arrow

/--
One categorical DPO derivation.  The first square is the pushout complement;
the second square constructs the result.
-/
structure Derivation
    {typeGraph : HypergraphPresheaf Shape}
    (rule : Rule typeGraph)
    {host : TypedHypergraph typeGraph}
    (matching : Match rule host) where
  complement : TypedHypergraph typeGraph
  result : TypedHypergraph typeGraph
  interfaceToComplement : rule.interface ⟶ complement
  complementToHost : complement ⟶ host
  rightToResult : rule.right ⟶ result
  complementToResult : complement ⟶ result
  complementSquare :
    IsPushout
      rule.leftLeg interfaceToComplement
      matching.arrow complementToHost
  resultSquare :
    IsPushout
      rule.rightLeg interfaceToComplement
      rightToResult complementToResult

namespace Derivation

variable
    {typeGraph : HypergraphPresheaf Shape}
    {rule : Rule typeGraph}
    {host : TypedHypergraph typeGraph}
    {matching : Match rule host}
    (derivation : Derivation rule matching)

/-- The witnessed pushout-complement square is Van Kampen. -/
theorem complement_vanKampen :
    derivation.complementSquare.IsVanKampen := by
  letI : Mono rule.leftLeg := rule.left_mono
  exact Adhesive.van_kampen derivation.complementSquare

/-- The second DPO square is Van Kampen. -/
theorem result_vanKampen :
    derivation.resultSquare.IsVanKampen := by
  letI : Mono rule.rightLeg := rule.right_mono
  exact Adhesive.van_kampen derivation.resultSquare

/--
In an adhesive category, each of the witnessed pushouts along the monic rule
leg is also a pullback.
-/
theorem complement_isPullback :
    IsPullback
      rule.leftLeg derivation.interfaceToComplement
      matching.arrow derivation.complementToHost := by
  letI : Mono rule.leftLeg := rule.left_mono
  exact
    Adhesive.isPullback_of_isPushout_of_mono_left
      derivation.complementSquare

theorem result_isPullback :
    IsPullback
      rule.rightLeg derivation.interfaceToComplement
      derivation.rightToResult derivation.complementToResult := by
  letI : Mono rule.rightLeg := rule.right_mono
  exact
    Adhesive.isPullback_of_isPushout_of_mono_left
      derivation.resultSquare

end Derivation

/--
Two result objects satisfying the second pushout for the same interface map
are canonically isomorphic.
-/
noncomputable def resultIso
    {typeGraph : HypergraphPresheaf Shape}
    {interface right complement firstResult secondResult :
      TypedHypergraph typeGraph}
    {rightLeg : interface ⟶ right}
    {toComplement : interface ⟶ complement}
    {rightToFirst : right ⟶ firstResult}
    {complementToFirst : complement ⟶ firstResult}
    {rightToSecond : right ⟶ secondResult}
    {complementToSecond : complement ⟶ secondResult}
    (first :
      IsPushout rightLeg toComplement
        rightToFirst complementToFirst)
    (second :
      IsPushout rightLeg toComplement
        rightToSecond complementToSecond) :
    firstResult ≅ secondResult :=
  first.isoIsPushout right complement second

theorem resultIso_rightLeg
    {typeGraph : HypergraphPresheaf Shape}
    {interface right complement firstResult secondResult :
      TypedHypergraph typeGraph}
    {rightLeg : interface ⟶ right}
    {toComplement : interface ⟶ complement}
    {rightToFirst : right ⟶ firstResult}
    {complementToFirst : complement ⟶ firstResult}
    {rightToSecond : right ⟶ secondResult}
    {complementToSecond : complement ⟶ secondResult}
    (first :
      IsPushout rightLeg toComplement
        rightToFirst complementToFirst)
    (second :
      IsPushout rightLeg toComplement
        rightToSecond complementToSecond) :
    rightToFirst ≫
        (resultIso first second).hom =
      rightToSecond :=
  first.inl_isoIsPushout_hom right complement second

theorem resultIso_complementLeg
    {typeGraph : HypergraphPresheaf Shape}
    {interface right complement firstResult secondResult :
      TypedHypergraph typeGraph}
    {rightLeg : interface ⟶ right}
    {toComplement : interface ⟶ complement}
    {rightToFirst : right ⟶ firstResult}
    {complementToFirst : complement ⟶ firstResult}
    {rightToSecond : right ⟶ secondResult}
    {complementToSecond : complement ⟶ secondResult}
    (first :
      IsPushout rightLeg toComplement
        rightToFirst complementToFirst)
    (second :
      IsPushout rightLeg toComplement
        rightToSecond complementToSecond) :
    complementToFirst ≫
        (resultIso first second).hom =
      complementToSecond :=
  first.inr_isoIsPushout_hom right complement second

end Cantilune.Core.AdhesiveDPOI
