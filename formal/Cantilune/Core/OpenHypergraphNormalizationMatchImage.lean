import Cantilune.Core.OpenHypergraphNormalizationFunctor
import Cantilune.Core.OpenCospanDPOI
import Mathlib.CategoryTheory.Limits.FunctorCategory.EpiMono

/-!
# Exact match image of active-support normalization

Concrete `TypedOpenHypergraph.Hom` maps are total on the ambient identifier
types, although only their values on the finite active supports are semantic.
Consequently active-support normalization cannot be faithful on raw ambient
maps: it deliberately forgets all inactive values.

This module records the exact replacement needed by DPOI:

* equality after normalization is implied by equality on the active node and
  edge supports;
* a concrete match is monic after normalization as soon as its restrictions
  to those active supports are injective; and
* every such support-monic match satisfying the ordinary presheaf gluing
  condition has the canonical ambient DPO derivation.

Thus global injectivity of the ambient maps is unnecessary.  The result does
not claim that arbitrary maps of ambient identifier types can be recovered
from normalized maps; such recovery additionally requires a choice of total
extensions outside the active supports.
-/

namespace Cantilune.Core.OpenHypergraphNormalizationMatchImage

open CategoryTheory
open Opposite
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.OpenHypergraphNormalizationFunctor

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
-- The finite normalization implementation currently lives in `Type 0`.
variable {Node₁ Edge₁ Node₂ Edge₂ : Type}
variable [DecidableEq Node₁] [DecidableEq Edge₁]
variable [DecidableEq Node₂] [DecidableEq Edge₂]

namespace TypedOpenHypergraph

variable
  {G : Cantilune.Core.TypedOpenHypergraph
    σ inputTypes outputTypes Node₁ Edge₁}
  {H : Cantilune.Core.TypedOpenHypergraph
    σ inputTypes outputTypes Node₂ Edge₂}

/-- The restriction of a concrete node map to the active node supports. -/
def activeNodeMap
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    {node // node ∈ G.nodes} → {node // node ∈ H.nodes} :=
  fun node => ⟨f.nodeMap node.1, f.node_active node.1 node.2⟩

/-- The restriction of a concrete edge map to the active edge supports. -/
def activeEdgeMap
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    {edge // edge ∈ G.edges} → {edge // edge ∈ H.edges} :=
  fun edge => ⟨f.edgeMap edge.1, f.edge_active edge.1 edge.2⟩

/--
Two ambient morphisms have the same semantic active-support map.

This is the kernel relation of active-support normalization.  Values on
inactive ambient identifiers are intentionally absent.
-/
def ActiveEquivalent
    (f g : Cantilune.Core.TypedOpenHypergraph.Hom G H) : Prop :=
  activeNodeMap f = activeNodeMap g ∧
    activeEdgeMap f = activeEdgeMap g

/--
An arbitrary concrete match which is injective where the graph actually
lives.  This is strictly weaker than global injectivity of both ambient maps.
-/
structure ActiveMonomorphism
    (G : Cantilune.Core.TypedOpenHypergraph
      σ inputTypes outputTypes Node₁ Edge₁)
    (H : Cantilune.Core.TypedOpenHypergraph
      σ inputTypes outputTypes Node₂ Edge₂)
    extends Cantilune.Core.TypedOpenHypergraph.Hom G H where
  node_active_injective : Function.Injective (activeNodeMap toHom)
  edge_active_injective : Function.Injective (activeEdgeMap toHom)

/-- Every globally injective concrete match is support-monic. -/
def ActiveMonomorphism.ofGlobal
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    ActiveMonomorphism G H where
  toHom := f.toHom
  node_active_injective := by
    intro first second equality
    apply Subtype.ext
    exact f.node_injective (congrArg Subtype.val equality)
  edge_active_injective := by
    intro first second equality
    apply Subtype.ext
    exact f.edge_injective (congrArg Subtype.val equality)

private theorem nodeComponent_injective
    (f : ActiveMonomorphism G H) :
    Function.Injective
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.nodeComponent
        f.toHom) := by
  intro first second equality
  rcases first with ⟨object, first⟩
  rcases second with ⟨otherObject, second⟩
  have objectEquality : object = otherObject :=
    congrArg Sigma.fst equality
  subst otherObject
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Subtype.ext
    apply Subtype.ext
    exact congrArg Subtype.val
      (f.node_active_injective
        (Subtype.ext
          (congrArg (fun value => value.2.1.1) equality)))

private theorem edgeComponent_injective
    (f : ActiveMonomorphism G H) :
    Function.Injective
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.edgeComponent
        f.toHom) := by
  intro first second equality
  rcases first with ⟨generator, first⟩
  rcases second with ⟨otherGenerator, second⟩
  have generatorEquality : generator = otherGenerator :=
    congrArg Sigma.fst equality
  subst otherGenerator
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Subtype.ext
    apply Subtype.ext
    exact congrArg Subtype.val
      (f.edge_active_injective
        (Subtype.ext
          (congrArg (fun value => value.2.1.1) equality)))

private theorem sourceComponent_injective
    (f : ActiveMonomorphism G H) :
    Function.Injective
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.sourceComponent
        f.toHom) := by
  intro first second equality
  rcases first with ⟨generator, firstEdge, firstPosition⟩
  rcases second with ⟨otherGenerator, secondEdge, secondPosition⟩
  have generatorEquality : generator = otherGenerator :=
    congrArg Sigma.fst equality
  subst otherGenerator
  have mappedPairEquality :
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.sourceComponent
          f.toHom ⟨generator, firstEdge, firstPosition⟩).2 =
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.sourceComponent
          f.toHom ⟨generator, secondEdge, secondPosition⟩).2 :=
    eq_of_heq (Sigma.mk.inj_iff.mp equality).2
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Prod.ext
    · apply Subtype.ext
      apply Subtype.ext
      exact congrArg Subtype.val
        (f.edge_active_injective
          (Subtype.ext
            (congrArg (fun value => value.1.1.1) mappedPairEquality)))
    · simpa only [
        OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.sourceComponent
      ] using congrArg Prod.snd mappedPairEquality

private theorem targetComponent_injective
    (f : ActiveMonomorphism G H) :
    Function.Injective
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.targetComponent
        f.toHom) := by
  intro first second equality
  rcases first with ⟨generator, firstEdge, firstPosition⟩
  rcases second with ⟨otherGenerator, secondEdge, secondPosition⟩
  have generatorEquality : generator = otherGenerator :=
    congrArg Sigma.fst equality
  subst otherGenerator
  have mappedPairEquality :
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.targetComponent
          f.toHom ⟨generator, firstEdge, firstPosition⟩).2 =
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.targetComponent
          f.toHom ⟨generator, secondEdge, secondPosition⟩).2 :=
    eq_of_heq (Sigma.mk.inj_iff.mp equality).2
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Prod.ext
    · apply Subtype.ext
      apply Subtype.ext
      exact congrArg Subtype.val
        (f.edge_active_injective
          (Subtype.ext
            (congrArg (fun value => value.1.1.1) mappedPairEquality)))
    · simpa only [
        OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.targetComponent
      ] using congrArg Prod.snd mappedPairEquality

/--
Support-monic concrete matches normalize to monomorphisms in the ambient
typed-presheaf slice.
-/
theorem normalizeHom_ambient_mono
    (f : ActiveMonomorphism G H) :
    Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom
          f.toHom)) := by
  letI componentMono (X : IncidenceShapeᵒᵖ) :
      Mono
        ((OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.presheafHom
          f.toHom).app X) := by
    apply (CategoryTheory.mono_iff_injective _).2
    rcases X with ⟨shape⟩
    cases shape with
    | node => exact nodeComponent_injective f
    | edge => exact edgeComponent_injective f
    | source => exact sourceComponent_injective f
    | target => exact targetComponent_injective f
    | input => exact Function.injective_id
    | output => exact Function.injective_id
  letI :
      Mono
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.presheafHom
          f.toHom) :=
    NatTrans.mono_of_mono_app
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.presheafHom
        f.toHom)
  letI :
      Mono
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom
          f.toHom).left := by
    change
      Mono
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.presheafHom
          f.toHom)
    infer_instance
  exact
    Over.mono_of_mono_left
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom
        f.toHom)

/-- The same support-monic match is monic in the positional category. -/
theorem normalizeHom_mono
    (f : ActiveMonomorphism G H) :
    Mono
      (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom
        f.toHom) := by
  exact
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).mono_of_mono_map
      (normalizeHom_ambient_mono f)

/--
Equality on active supports is sufficient for equality after normalization.
This is the constructive half of the exact kernel characterization.
-/
theorem normalizeHom_eq_of_activeEquivalent
    {f g : Cantilune.Core.TypedOpenHypergraph.Hom G H}
    (equivalent : ActiveEquivalent f g) :
    OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom f =
      OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom g := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext X
  apply ConcreteCategory.hom_ext
  intro value
  rcases X with ⟨shape⟩
  cases shape with
  | node =>
      rcases value with ⟨object, node⟩
      apply Sigma.ext
      · rfl
      · apply heq_of_eq
        apply Subtype.ext
        apply Subtype.ext
        have pointwise :=
          congrFun equivalent.1
            (⟨node.1.1, node.1.2⟩ : {n // n ∈ G.nodes})
        exact congrArg Subtype.val pointwise
  | edge =>
      rcases value with ⟨generator, edge⟩
      apply Sigma.ext
      · rfl
      · apply heq_of_eq
        apply Subtype.ext
        apply Subtype.ext
        have pointwise :=
          congrFun equivalent.2
            (⟨edge.1.1, edge.1.2⟩ : {e // e ∈ G.edges})
        exact congrArg Subtype.val pointwise
  | source =>
      rcases value with ⟨generator, edge, position⟩
      apply Sigma.ext
      · rfl
      · apply heq_of_eq
        apply Prod.ext
        · apply Subtype.ext
          apply Subtype.ext
          have pointwise :=
            congrFun equivalent.2
              (⟨edge.1.1, edge.1.2⟩ : {e // e ∈ G.edges})
          exact congrArg Subtype.val pointwise
        · rfl
  | target =>
      rcases value with ⟨generator, edge, position⟩
      apply Sigma.ext
      · rfl
      · apply heq_of_eq
        apply Prod.ext
        · apply Subtype.ext
          apply Subtype.ext
          have pointwise :=
            congrFun equivalent.2
              (⟨edge.1.1, edge.1.2⟩ : {e // e ∈ G.edges})
          exact congrArg Subtype.val pointwise
        · rfl
  | input => rfl
  | output => rfl

/--
Conversely, equality after normalization forces equality on both active
supports. Together with `normalizeHom_eq_of_activeEquivalent`, this identifies
the exact kernel of normalization on concrete morphisms.
-/
theorem activeEquivalent_of_normalizeHom_eq
    {f g : Cantilune.Core.TypedOpenHypergraph.Hom G H}
    (equal :
      OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom f =
        OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom g) :
    ActiveEquivalent f g := by
  have leftEqual :
      OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.presheafHom f =
        OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.presheafHom g :=
    congrArg Over.Hom.left equal
  constructor
  · funext node
    apply Subtype.ext
    let value :
        (OpenHypergraphNormalization.TypedOpenHypergraph.normalize G).NodeCarrier :=
      ⟨G.nodeType node.1, ⟨⟨node.1, node.2⟩, rfl⟩⟩
    have appEqual :=
      congrArg
        (fun transformation =>
          transformation.app (op IncidenceShape.node))
        leftEqual
    have pointEqual :=
      ConcreteCategory.congr_hom appEqual value
    exact congrArg (fun mapped => mapped.2.1.1) pointEqual
  · funext edge
    apply Subtype.ext
    let value :
        (OpenHypergraphNormalization.TypedOpenHypergraph.normalize G).EdgeCarrier :=
      ⟨G.edgeLabel edge.1, ⟨⟨edge.1, edge.2⟩, rfl⟩⟩
    have appEqual :=
      congrArg
        (fun transformation =>
          transformation.app (op IncidenceShape.edge))
        leftEqual
    have pointEqual :=
      ConcreteCategory.congr_hom appEqual value
    exact congrArg (fun mapped => mapped.2.1.1) pointEqual

/-- Exact active-support kernel characterization. -/
theorem normalizeHom_eq_iff_activeEquivalent
    {f g : Cantilune.Core.TypedOpenHypergraph.Hom G H} :
    OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom f =
        OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom g ↔
      ActiveEquivalent f g :=
  ⟨activeEquivalent_of_normalizeHom_eq,
    normalizeHom_eq_of_activeEquivalent⟩

/-- Active equivalence is an actual setoid on concrete ambient morphisms. -/
def activeSetoid :
    Setoid (Cantilune.Core.TypedOpenHypergraph.Hom G H) where
  r := ActiveEquivalent
  iseqv := by
    constructor
    · intro morphism
      exact ⟨rfl, rfl⟩
    · intro first second equivalent
      exact ⟨equivalent.1.symm, equivalent.2.symm⟩
    · intro first second third firstEquivalent secondEquivalent
      exact
        ⟨firstEquivalent.1.trans secondEquivalent.1,
          firstEquivalent.2.trans secondEquivalent.2⟩

/-- Concrete morphisms modulo their deliberately forgotten inactive values. -/
abbrev ActiveHom :=
  Quotient (activeSetoid (G := G) (H := H))

/--
Normalization descends to active-equivalence classes of concrete morphisms.
-/
def normalizeActiveHom :
    ActiveHom (G := G) (H := H) →
      (OpenHypergraphNormalization.TypedOpenHypergraph.normalize G ⟶
        OpenHypergraphNormalization.TypedOpenHypergraph.normalize H) :=
  Quotient.lift
    OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom
    (fun _ _ equivalent =>
      normalizeHom_eq_of_activeEquivalent equivalent)

/--
The descended hom map is injective. This is the precise faithful statement
available without assuming that active maps extend to arbitrary inactive
ambient identifiers.
-/
theorem normalizeActiveHom_injective :
    Function.Injective
      (normalizeActiveHom (G := G) (H := H)) := by
  intro first second equal
  revert equal
  refine Quotient.inductionOn₂ first second ?_
  intro firstRepresentative secondRepresentative normalizedEqual
  apply Quotient.sound
  exact activeEquivalent_of_normalizeHom_eq normalizedEqual

/--
Package a support-monic occurrence as the actual match record consumed by
general presheaf DPO rewriting.
-/
def normalizedActiveMatch
    {rule :
      AdhesiveDPOI.Rule
        (typeGraph σ inputTypes outputTypes)}
    (leftIdentification :
      rule.left =
        (OpenHypergraphNormalization.TypedOpenHypergraph.normalize G).encoded)
    (matching : ActiveMonomorphism G H) :
    AdhesiveDPOI.Match rule
      (OpenHypergraphNormalization.TypedOpenHypergraph.normalize H).encoded where
  arrow :=
    eqToHom leftIdentification ≫
      (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizeHom
          matching.toHom)
  mono := by
    exact mono_comp'
      (show Mono (eqToHom leftIdentification) by infer_instance)
      (normalizeHom_ambient_mono matching)

/--
Every support-monic concrete match satisfying the ordinary gluing condition
has the canonical ambient presheaf DPO derivation.
-/
theorem normalized_active_monic_gluing_has_derivation
    {rule :
      AdhesiveDPOI.Rule
        (typeGraph σ inputTypes outputTypes)}
    (leftIdentification :
      rule.left =
        (OpenHypergraphNormalization.TypedOpenHypergraph.normalize G).encoded)
    (matching : ActiveMonomorphism G H)
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule
        (normalizedActiveMatch leftIdentification matching)) :
    Nonempty
      (AdhesiveDPOI.Derivation rule
        (normalizedActiveMatch leftIdentification matching)) :=
  OpenCospanDPOI.Presheaf.arbitrary_monic_gluing_has_derivation legal

end TypedOpenHypergraph

end Cantilune.Core.OpenHypergraphNormalizationMatchImage
