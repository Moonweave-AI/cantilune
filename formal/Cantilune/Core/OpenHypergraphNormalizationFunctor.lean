import Cantilune.Core.OpenHypergraphNormalization
import Cantilune.Core.OpenCospanDPOI
import Mathlib.CategoryTheory.Limits.FunctorCategory.EpiMono

/-!
# Functoriality of active-support normalization

`OpenHypergraphNormalization.TypedOpenHypergraph.normalize` removes inactive
ambient identifiers from one concrete finite-support graph.  This file proves
that the construction is functorial on the concrete structure-preserving
morphisms, even when source and target use different ambient identifier
types.

The result is deliberately a heterogeneous functoriality theorem rather than
an equivalence with all objects of the typed-presheaf slice.  The latter
contains finite objects which are not incidence-complete and therefore are
not positional hypergraphs.
-/

namespace Cantilune.Core.OpenHypergraphNormalizationFunctor

open CategoryTheory
open Opposite
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.OpenHypergraphNormalization

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {Node₁ Edge₁ Node₂ Edge₂ Node₃ Edge₃ : Type}
variable [DecidableEq Node₁] [DecidableEq Edge₁]
variable [DecidableEq Node₂] [DecidableEq Edge₂]
variable [DecidableEq Node₃] [DecidableEq Edge₃]

private theorem map_get_of_map_eq
    {α β : Type} (map : α → β) {source : List α} {target : List β}
    (preserved : source.map map = target)
    (index : Nat)
    (sourceBound : index < source.length)
    (targetBound : index < target.length) :
    map (source.get ⟨index, sourceBound⟩) =
      target.get ⟨index, targetBound⟩ := by
  have atIndex :=
    congrArg (fun values : List β => values[index]?) preserved
  simp [sourceBound, targetBound] at atIndex
  exact atIndex

namespace TypedOpenHypergraph

variable
  {G : Cantilune.Core.TypedOpenHypergraph
    σ inputTypes outputTypes Node₁ Edge₁}
  {H : Cantilune.Core.TypedOpenHypergraph
    σ inputTypes outputTypes Node₂ Edge₂}
  {J : Cantilune.Core.TypedOpenHypergraph
    σ inputTypes outputTypes Node₃ Edge₃}

abbrev normalized
    (G : Cantilune.Core.TypedOpenHypergraph
      σ inputTypes outputTypes Node₁ Edge₁) :=
  Cantilune.Core.OpenHypergraphNormalization.TypedOpenHypergraph.normalize G

/-- Map the dependent node fibres of the active support. -/
def nodeComponent
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    (normalized G).NodeCarrier → (normalized H).NodeCarrier :=
  fun value =>
    ⟨value.1,
      ⟨⟨f.nodeMap value.2.1.1, f.node_active _ value.2.1.2⟩,
        (f.node_typed _ value.2.1.2).trans value.2.2⟩⟩

/-- Map the dependent edge fibres of the active support. -/
def edgeComponent
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    (normalized G).EdgeCarrier → (normalized H).EdgeCarrier :=
  fun value =>
    ⟨value.1,
      ⟨⟨f.edgeMap value.2.1.1, f.edge_active _ value.2.1.2⟩,
        (f.edge_typed _ value.2.1.2).trans value.2.2⟩⟩

/-- Source incidences retain their generator and ordered port. -/
def sourceComponent
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    (normalized G).SourceCarrier → (normalized H).SourceCarrier :=
  fun value =>
    ⟨value.1,
      ⟨⟨⟨f.edgeMap value.2.1.1.1,
            f.edge_active _ value.2.1.1.2⟩,
          (f.edge_typed _ value.2.1.1.2).trans value.2.1.2⟩,
        value.2.2⟩⟩

/-- Target incidences retain their generator and ordered port. -/
def targetComponent
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    (normalized G).TargetCarrier → (normalized H).TargetCarrier :=
  fun value =>
    ⟨value.1,
      ⟨⟨⟨f.edgeMap value.2.1.1.1,
            f.edge_active _ value.2.1.1.2⟩,
          (f.edge_typed _ value.2.1.1.2).trans value.2.1.2⟩,
        value.2.2⟩⟩

/-- The six component maps of active-support normalization. -/
def carrierComponent
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    (shape : IncidenceShape) →
      (normalized G).Carrier shape → (normalized H).Carrier shape
  | .node => nodeComponent f
  | .edge => edgeComponent f
  | .source => sourceComponent f
  | .target => targetComponent f
  | .input => id
  | .output => id

private theorem source_preserved
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H)
    (value : (normalized G).SourceCarrier) :
    nodeComponent f ((normalized G).map .nodeSource value) =
      (normalized H).map .nodeSource (sourceComponent f value) := by
  rcases value with ⟨g, edge, position⟩
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Subtype.ext
    apply Subtype.ext
    have preserved :=
      f.sources_preserved edge.1.1 edge.1.2
    simp only [normalized,
      Cantilune.Core.OpenHypergraphNormalization.TypedOpenHypergraph.normalize,
      FiniteHypergraph.map, nodeComponent, sourceComponent]
    have sourceLength :
        (G.sources edge.1.1).length = (σ.input g).length := by
      have typed := G.wellFormed.source_typed edge.1.1 edge.1.2
      calc
        (G.sources edge.1.1).length =
            ((G.sources edge.1.1).map G.nodeType).length := by simp
        _ = (σ.input (G.edgeLabel edge.1.1)).length :=
          congrArg List.length typed
        _ = (σ.input g).length := by rw [edge.2]
    have sourceBound :
        position.val < (G.sources edge.1.1).length := by
      rw [sourceLength]
      exact position.isLt
    have targetBound :
        position.val < (H.sources (f.edgeMap edge.1.1)).length := by
      rw [← preserved]
      simpa using sourceBound
    convert
      map_get_of_map_eq f.nodeMap preserved position.val
        sourceBound targetBound using 1 <;> rfl

private theorem target_preserved
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H)
    (value : (normalized G).TargetCarrier) :
    nodeComponent f ((normalized G).map .nodeTarget value) =
      (normalized H).map .nodeTarget (targetComponent f value) := by
  rcases value with ⟨g, edge, position⟩
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Subtype.ext
    apply Subtype.ext
    have preserved :=
      f.targets_preserved edge.1.1 edge.1.2
    simp only [normalized,
      Cantilune.Core.OpenHypergraphNormalization.TypedOpenHypergraph.normalize,
      FiniteHypergraph.map, nodeComponent, targetComponent]
    have sourceLength :
        (G.targets edge.1.1).length = (σ.output g).length := by
      have typed := G.wellFormed.target_typed edge.1.1 edge.1.2
      calc
        (G.targets edge.1.1).length =
            ((G.targets edge.1.1).map G.nodeType).length := by simp
        _ = (σ.output (G.edgeLabel edge.1.1)).length :=
          congrArg List.length typed
        _ = (σ.output g).length := by rw [edge.2]
    have sourceBound :
        position.val < (G.targets edge.1.1).length := by
      rw [sourceLength]
      exact position.isLt
    have targetBound :
        position.val < (H.targets (f.edgeMap edge.1.1)).length := by
      rw [← preserved]
      simpa using sourceBound
    convert
      map_get_of_map_eq f.nodeMap preserved position.val
        sourceBound targetBound using 1 <;> rfl

private theorem carrier_naturality_base
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    ∀ {X Y : IncidenceShape} (arrow : IncidenceShape.Hom X Y),
      TypeCat.ofHom ((normalized G).map arrow) ≫
          TypeCat.ofHom (carrierComponent f X) =
        TypeCat.ofHom (carrierComponent f Y) ≫
          TypeCat.ofHom ((normalized H).map arrow) := by
  intro X Y arrow
  apply ConcreteCategory.hom_ext
  intro value
  cases arrow with
  | id _ =>
      cases X <;> rfl
  | nodeSource =>
      exact source_preserved f value
  | edgeSource =>
      rfl
  | nodeTarget =>
      exact target_preserved f value
  | edgeTarget =>
      rfl
  | nodeInput =>
      apply Sigma.ext
      · rfl
      · apply heq_of_eq
        apply Subtype.ext
        apply Subtype.ext
        exact f.inputBoundary_preserved value
  | nodeOutput =>
      apply Sigma.ext
      · rfl
      · apply heq_of_eq
        apply Subtype.ext
        apply Subtype.ext
        exact f.outputBoundary_preserved value

/-- The active-support maps form a natural transformation of presheaves. -/
def presheafHom
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    (normalized G).presheaf ⟶ (normalized H).presheaf where
  app X := TypeCat.ofHom (carrierComponent f (unop X))
  naturality := by
    intro X Y arrow
    exact carrier_naturality_base f arrow.unop

private theorem typing_preserved
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    presheafHom f ≫ (normalized H).typing =
      (normalized G).typing := by
  apply NatTrans.ext
  funext X
  apply ConcreteCategory.hom_ext
  intro value
  rcases X with ⟨shape⟩
  cases shape <;> rfl

/--
Normalization of a concrete morphism as a morphism in the intrinsic finite
positional category (equivalently, in the typed presheaf slice).
-/
def normalizeHom
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H) :
    normalized G ⟶ normalized H :=
  Over.homMk (presheafHom f) (typing_preserved f)

@[simp]
theorem normalizeHom_id :
    normalizeHom (Cantilune.Core.TypedOpenHypergraph.Hom.id G) =
      𝟙 (normalized G) := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext X
  apply ConcreteCategory.hom_ext
  intro value
  rcases X with ⟨shape⟩
  cases shape <;> rfl

@[simp]
theorem normalizeHom_comp
    (f : Cantilune.Core.TypedOpenHypergraph.Hom G H)
    (g : Cantilune.Core.TypedOpenHypergraph.Hom H J) :
    normalizeHom (Cantilune.Core.TypedOpenHypergraph.Hom.comp f g) =
      normalizeHom f ≫ normalizeHom g := by
  apply Over.OverMorphism.ext
  apply NatTrans.ext
  funext X
  apply ConcreteCategory.hom_ext
  intro value
  rcases X with ⟨shape⟩
  cases shape <;> rfl

private theorem nodeComponent_injective
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    Function.Injective (nodeComponent f.toHom) := by
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
    exact f.node_injective
      (congrArg (fun value => value.2.1.1) equality)

private theorem edgeComponent_injective
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    Function.Injective (edgeComponent f.toHom) := by
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
    exact f.edge_injective
      (congrArg (fun value => value.2.1.1) equality)

private theorem sourceComponent_injective
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    Function.Injective (sourceComponent f.toHom) := by
  intro first second equality
  rcases first with ⟨generator, firstEdge, firstPosition⟩
  rcases second with ⟨otherGenerator, secondEdge, secondPosition⟩
  have generatorEquality : generator = otherGenerator :=
    congrArg Sigma.fst equality
  subst otherGenerator
  have mappedPairEquality :
      (sourceComponent f.toHom
          ⟨generator, firstEdge, firstPosition⟩).2 =
        (sourceComponent f.toHom
          ⟨generator, secondEdge, secondPosition⟩).2 :=
    eq_of_heq (Sigma.mk.inj_iff.mp equality).2
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Prod.ext
    · apply Subtype.ext
      apply Subtype.ext
      exact f.edge_injective
        (congrArg (fun value => value.1.1.1) mappedPairEquality)
    · simpa only [sourceComponent] using
        congrArg Prod.snd mappedPairEquality

private theorem targetComponent_injective
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    Function.Injective (targetComponent f.toHom) := by
  intro first second equality
  rcases first with ⟨generator, firstEdge, firstPosition⟩
  rcases second with ⟨otherGenerator, secondEdge, secondPosition⟩
  have generatorEquality : generator = otherGenerator :=
    congrArg Sigma.fst equality
  subst otherGenerator
  have mappedPairEquality :
      (targetComponent f.toHom
          ⟨generator, firstEdge, firstPosition⟩).2 =
        (targetComponent f.toHom
          ⟨generator, secondEdge, secondPosition⟩).2 :=
    eq_of_heq (Sigma.mk.inj_iff.mp equality).2
  apply Sigma.ext
  · rfl
  · apply heq_of_eq
    apply Prod.ext
    · apply Subtype.ext
      apply Subtype.ext
      exact f.edge_injective
        (congrArg (fun value => value.1.1.1) mappedPairEquality)
    · simpa only [targetComponent] using
        congrArg Prod.snd mappedPairEquality

/--
Active-support normalization sends every concrete globally injective match
to a monomorphism in the ambient typed-presheaf slice.  This is the exact
form consumed by `AdhesiveDPOI.Match`.
-/
theorem normalizeHom_ambient_mono
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        (normalizeHom f.toHom)) := by
  letI componentMono (X : IncidenceShapeᵒᵖ) :
      Mono ((presheafHom f.toHom).app X) := by
    apply (CategoryTheory.mono_iff_injective _).2
    rcases X with ⟨shape⟩
    cases shape with
    | node => exact nodeComponent_injective f
    | edge => exact edgeComponent_injective f
    | source => exact sourceComponent_injective f
    | target => exact targetComponent_injective f
    | input => exact Function.injective_id
    | output => exact Function.injective_id
  letI : Mono (presheafHom f.toHom) :=
    NatTrans.mono_of_mono_app (presheafHom f.toHom)
  letI : Mono (normalizeHom f.toHom).left := by
    change Mono (presheafHom f.toHom)
    infer_instance
  exact Over.mono_of_mono_left (normalizeHom f.toHom)

/--
The same map is monic in the intrinsic finite positional category.  Thus the
transport is available both to concrete finite DPO closure results and to the
general adhesive slice construction; no `InterfaceLocal` restriction is
needed at this boundary.
-/
theorem normalizeHom_mono
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    Mono (normalizeHom f.toHom) := by
  exact
    (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).mono_of_mono_map
      (normalizeHom_ambient_mono f)

/--
Turn a concrete globally injective occurrence into the actual monic match
record consumed by general presheaf DPO rewriting.  The equality witnesses
only that the supplied rule uses the normalized concrete graph as its
left-hand side; it does not narrow the occurrence to an inclusion map.
-/
def normalizedMatch
    {rule :
      AdhesiveDPOI.Rule
        (typeGraph σ inputTypes outputTypes)}
    (leftIdentification :
      rule.left = (normalized G).encoded)
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H) :
    AdhesiveDPOI.Match rule (normalized H).encoded where
  arrow :=
    eqToHom leftIdentification ≫
      (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        (normalizeHom f.toHom)
  mono := by
    exact mono_comp'
      (show Mono (eqToHom leftIdentification) by infer_instance)
      (normalizeHom_ambient_mono f)

/--
For every concrete injective occurrence transported by `normalizedMatch`, the
ordinary presheaf gluing condition is sufficient for existence of a full DPO
derivation.  This connects the concrete finite-support representation to the
general M-adhesive construction without claiming the false equivalence with
the unrestricted typed-presheaf slice.
-/
theorem normalized_monic_gluing_has_derivation
    {rule :
      AdhesiveDPOI.Rule
        (typeGraph σ inputTypes outputTypes)}
    (leftIdentification :
      rule.left = (normalized G).encoded)
    (f : Cantilune.Core.TypedOpenHypergraph.Monomorphism G H)
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule
        (normalizedMatch leftIdentification f)) :
    Nonempty
      (AdhesiveDPOI.Derivation rule
        (normalizedMatch leftIdentification f)) :=
  OpenCospanDPOI.Presheaf.arbitrary_monic_gluing_has_derivation legal

end TypedOpenHypergraph

end Cantilune.Core.OpenHypergraphNormalizationFunctor
