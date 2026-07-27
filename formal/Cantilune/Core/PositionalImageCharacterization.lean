import Cantilune.Core.PositionalDPOI

/-!
# Intrinsic characterization of the finite positional image

This module gives an object predicate on the ambient typed-presheaf slice
which does not mention `Functor.essImage`.

Finiteness alone is not enough.  A positional object must additionally have
exactly one source and target incidence for every typed edge/port pair,
exactly the prescribed ordered input/output positions, and injective boundary
attachments.  The latter clauses are the no-duplicate boundary condition.
-/

noncomputable section

namespace Cantilune.Core.PositionalImageCharacterization

open CategoryTheory
open Opposite
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

/-- The ambient typed-presheaf slice at the fixed signature and boundary. -/
abbrev Ambient :=
  AdhesiveDPOI.TypedHypergraph (typeGraph σ inputTypes outputTypes)

/-- Carrier of one incidence sort of an ambient typed presheaf. -/
abbrev Carrier
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes))
    (shape : IncidenceShape) :=
  X.left.obj (op shape)

/-- One of the six ambient incidence-structure maps. -/
def structureMap
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes))
    {A B : IncidenceShape} (f : IncidenceShape.Hom A B) :
    Carrier X B → Carrier X A :=
  X.left.map (Quiver.Hom.op f)

/-- Component of the ambient typing map at a sort. -/
def typingAt
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes))
    (shape : IncidenceShape) :
    Carrier X shape → TypeCarrier σ inputTypes outputTypes shape :=
  X.hom.app (op shape)

/-- Typing is compatible with every ambient incidence-structure map. -/
theorem typing_structureMap
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes))
    {A B : IncidenceShape} (f : IncidenceShape.Hom A B)
    (x : Carrier X B) :
    typingAt X A (structureMap X f x) =
      typeMap σ inputTypes outputTypes f (typingAt X B x) := by
  have h := X.hom.naturality (Quiver.Hom.op f)
  exact ConcreteCategory.congr_hom h x

/--
The expected source positions over the actual ambient edge carrier.  The
subtype equation says that the generator attached to a position is exactly
the generator typing of the edge.
-/
def SourceDescriptor
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) :=
  {p :
      Carrier X .edge × TypeCarrier σ inputTypes outputTypes .source //
    typingAt X .edge p.1 =
      typeMap σ inputTypes outputTypes
        IncidenceShape.Hom.edgeSource p.2}

/-- Every ambient source incidence has a canonical edge/position descriptor. -/
def sourceDescriptorMap
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) :
    Carrier X .source → SourceDescriptor X :=
  fun s =>
    ⟨(structureMap X IncidenceShape.Hom.edgeSource s,
        typingAt X .source s),
      typing_structureMap X IncidenceShape.Hom.edgeSource s⟩

/-- Target analogue of `SourceDescriptor`. -/
def TargetDescriptor
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) :=
  {p :
      Carrier X .edge × TypeCarrier σ inputTypes outputTypes .target //
    typingAt X .edge p.1 =
      typeMap σ inputTypes outputTypes
        IncidenceShape.Hom.edgeTarget p.2}

/-- Every ambient target incidence has a canonical edge/position descriptor. -/
def targetDescriptorMap
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) :
    Carrier X .target → TargetDescriptor X :=
  fun t =>
    ⟨(structureMap X IncidenceShape.Hom.edgeTarget t,
        typingAt X .target t),
      typing_structureMap X IncidenceShape.Hom.edgeTarget t⟩

/--
The tempting but insufficient predicate: finite carriers, complete positional
edge incidences, and fixed ordered boundary carriers.  It omits boundary
attachment injectivity; `PositionalBoundaryDuplicateObstruction` supplies a
finite counterexample.
-/
structure FiniteCompleteFixedBoundary
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) : Prop where
  carrier_finite : ∀ shape, Finite (Carrier X shape)
  source_bijective : Function.Bijective (sourceDescriptorMap X)
  target_bijective : Function.Bijective (targetDescriptorMap X)
  input_bijective : Function.Bijective (typingAt X .input)
  output_bijective : Function.Bijective (typingAt X .output)

/--
Exact, independent object predicate for the positional essential image.

* `source_bijective` and `target_bijective` encode existence and uniqueness
  of every generator/port incidence, hence both completeness and no
  duplicated incidences.
* `input_bijective` and `output_bijective` identify the ambient boundary
  carriers with the fixed ordered positions.
* the final two fields forbid two distinct boundary positions from attaching
  to the same typed node.
-/
structure ExactPositionalObject
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) : Prop where
  carrier_finite : ∀ shape, Finite (Carrier X shape)
  source_bijective : Function.Bijective (sourceDescriptorMap X)
  target_bijective : Function.Bijective (targetDescriptorMap X)
  input_bijective : Function.Bijective (typingAt X .input)
  output_bijective : Function.Bijective (typingAt X .output)
  input_node_injective :
    Function.Injective (structureMap X IncidenceShape.Hom.nodeInput)
  output_node_injective :
    Function.Injective (structureMap X IncidenceShape.Hom.nodeOutput)

/-- Forget only the two no-duplicate boundary clauses. -/
theorem ExactPositionalObject.toFiniteCompleteFixedBoundary
    {X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)}
    (h : ExactPositionalObject X) :
    FiniteCompleteFixedBoundary X where
  carrier_finite := h.carrier_finite
  source_bijective := h.source_bijective
  target_bijective := h.target_bijective
  input_bijective := h.input_bijective
  output_bijective := h.output_bijective

namespace Reconstruction

variable
  (X : Ambient (σ := σ) (inputTypes := inputTypes)
    (outputTypes := outputTypes))
  (h : ExactPositionalObject X)

/-- Fibre of ambient nodes over one object type. -/
abbrev NodeFibre (o : σ.Obj) :=
  {n : Carrier X .node // typingAt X .node n = o}

/-- Fibre of ambient edges over one generator. -/
abbrev EdgeFibre (g : σ.Gen) :=
  {e : Carrier X .edge // typingAt X .edge e = g}

/-- Completeness and uniqueness as an actual source-carrier equivalence. -/
noncomputable def sourceDescriptorEquiv :
    Carrier X .source ≃ SourceDescriptor X :=
  Equiv.ofBijective (sourceDescriptorMap X) h.source_bijective

/-- Completeness and uniqueness as an actual target-carrier equivalence. -/
noncomputable def targetDescriptorEquiv :
    Carrier X .target ≃ TargetDescriptor X :=
  Equiv.ofBijective (targetDescriptorMap X) h.target_bijective

/-- Fixed ordered inputs as an equivalence of carriers. -/
noncomputable def inputEquiv :
    Carrier X .input ≃ Fin inputTypes.length :=
  Equiv.ofBijective (typingAt X .input) h.input_bijective

/-- Fixed ordered outputs as an equivalence of carriers. -/
noncomputable def outputEquiv :
    Carrier X .output ≃ Fin outputTypes.length :=
  Equiv.ofBijective (typingAt X .output) h.output_bijective

/-- The unique ambient source incidence for an edge and ordered port. -/
noncomputable def sourceIncidence
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.input g).length) :
    Carrier X .source :=
  (sourceDescriptorEquiv X h).symm
    ⟨(edge.1, ⟨g, position⟩), edge.2⟩

/-- The selected source incidence has exactly the requested descriptor. -/
theorem sourceIncidence_descriptor
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.input g).length) :
    sourceDescriptorMap X (sourceIncidence X h edge position) =
      ⟨(edge.1, ⟨g, position⟩), edge.2⟩ :=
  (sourceDescriptorEquiv X h).apply_symm_apply _

/-- In particular, the selected incidence has the requested source typing. -/
theorem sourceIncidence_typing
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.input g).length) :
    typingAt X .source (sourceIncidence X h edge position) =
      ⟨g, position⟩ := by
  have descriptor :=
    congrArg (fun value : SourceDescriptor X => value.1.2)
      (sourceIncidence_descriptor X h edge position)
  exact descriptor

/-- The selected source incidence lies over the requested ambient edge. -/
theorem sourceIncidence_edge
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.input g).length) :
    structureMap X IncidenceShape.Hom.edgeSource
        (sourceIncidence X h edge position) =
      edge.1 := by
  have descriptor :=
    congrArg (fun value : SourceDescriptor X => value.1.1)
      (sourceIncidence_descriptor X h edge position)
  exact descriptor

/-- The unique ambient target incidence for an edge and ordered port. -/
noncomputable def targetIncidence
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.output g).length) :
    Carrier X .target :=
  (targetDescriptorEquiv X h).symm
    ⟨(edge.1, ⟨g, position⟩), edge.2⟩

/-- The selected target incidence has exactly the requested descriptor. -/
theorem targetIncidence_descriptor
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.output g).length) :
    targetDescriptorMap X (targetIncidence X h edge position) =
      ⟨(edge.1, ⟨g, position⟩), edge.2⟩ :=
  (targetDescriptorEquiv X h).apply_symm_apply _

theorem targetIncidence_typing
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.output g).length) :
    typingAt X .target (targetIncidence X h edge position) =
      ⟨g, position⟩ := by
  have descriptor :=
    congrArg (fun value : TargetDescriptor X => value.1.2)
      (targetIncidence_descriptor X h edge position)
  exact descriptor

theorem targetIncidence_edge
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.output g).length) :
    structureMap X IncidenceShape.Hom.edgeTarget
        (targetIncidence X h edge position) =
      edge.1 := by
  have descriptor :=
    congrArg (fun value : TargetDescriptor X => value.1.1)
      (targetIncidence_descriptor X h edge position)
  exact descriptor

/-- Ambient representative of a fixed input position. -/
noncomputable def inputPort (i : Fin inputTypes.length) :
    Carrier X .input :=
  (inputEquiv X h).symm i

theorem inputPort_typing (i : Fin inputTypes.length) :
    typingAt X .input (inputPort X h i) = i :=
  (inputEquiv X h).apply_symm_apply i

/-- Ambient representative of a fixed output position. -/
noncomputable def outputPort (i : Fin outputTypes.length) :
    Carrier X .output :=
  (outputEquiv X h).symm i

theorem outputPort_typing (i : Fin outputTypes.length) :
    typingAt X .output (outputPort X h i) = i :=
  (outputEquiv X h).apply_symm_apply i

/-- Intrinsic finite graph reconstructed solely from the independent predicate. -/
noncomputable def graph :
    FiniteHypergraph σ inputTypes outputTypes := by
  classical
  letI finiteCarrier (shape : IncidenceShape) :
      Finite (Carrier X shape) :=
    h.carrier_finite shape
  exact
    { Node := NodeFibre X
      Edge := EdgeFibre X
      nodeFintype := fun _ => Fintype.ofFinite _
      edgeFintype := fun _ => Fintype.ofFinite _
      source := fun edge position =>
        ⟨structureMap X IncidenceShape.Hom.nodeSource
            (sourceIncidence X h edge position),
          by
            rw [typing_structureMap,
              sourceIncidence_typing X h edge position]
            rfl⟩
      target := fun edge position =>
        ⟨structureMap X IncidenceShape.Hom.nodeTarget
            (targetIncidence X h edge position),
          by
            rw [typing_structureMap,
              targetIncidence_typing X h edge position]
            rfl⟩
      inputBoundary := fun i =>
        ⟨structureMap X IncidenceShape.Hom.nodeInput
            (inputPort X h i),
          by
            rw [typing_structureMap, inputPort_typing X h i]
            rfl⟩
      outputBoundary := fun i =>
        ⟨structureMap X IncidenceShape.Hom.nodeOutput
            (outputPort X h i),
          by
            rw [typing_structureMap, outputPort_typing X h i]
            rfl⟩
      inputBoundary_injective := by
        intro i j equality
        apply (inputEquiv X h).symm.injective
        apply h.input_node_injective
        exact congrArg
          (fun value : Σ o, NodeFibre X o => value.2.1) equality
      outputBoundary_injective := by
        intro i j equality
        apply (outputEquiv X h).symm.injective
        apply h.output_node_injective
        exact congrArg
          (fun value : Σ o, NodeFibre X o => value.2.1) equality }

/-- Dependent node fibres reassemble to the ambient node carrier. -/
def nodeCarrierEquiv :
    (Σ o : σ.Obj, NodeFibre X o) ≃ Carrier X .node where
  toFun value := value.2.1
  invFun node := ⟨typingAt X .node node, node, rfl⟩
  left_inv := by
    rintro ⟨object, node, typing⟩
    subst object
    rfl
  right_inv _ := rfl

/-- Dependent edge fibres reassemble to the ambient edge carrier. -/
def edgeCarrierEquiv :
    (Σ g : σ.Gen, EdgeFibre X g) ≃ Carrier X .edge where
  toFun value := value.2.1
  invFun edge := ⟨typingAt X .edge edge, edge, rfl⟩
  left_inv := by
    rintro ⟨generator, edge, typing⟩
    subst generator
    rfl
  right_inv _ := rfl

/-- Intrinsic source triples are exactly the typed source descriptors. -/
def sourcePresentationEquiv :
    (Σ g : σ.Gen, EdgeFibre X g × Fin (σ.input g).length) ≃
      SourceDescriptor X where
  toFun value :=
    ⟨(value.2.1.1, ⟨value.1, value.2.2⟩), value.2.1.2⟩
  invFun descriptor :=
    ⟨descriptor.1.2.1,
      ⟨descriptor.1.1, descriptor.2⟩,
      descriptor.1.2.2⟩
  left_inv := by
    rintro ⟨generator, ⟨edge, typing⟩, position⟩
    rfl
  right_inv := by
    rintro ⟨⟨edge, ⟨generator, position⟩⟩, typing⟩
    rfl

/-- Intrinsic target triples are exactly the typed target descriptors. -/
def targetPresentationEquiv :
    (Σ g : σ.Gen, EdgeFibre X g × Fin (σ.output g).length) ≃
      TargetDescriptor X where
  toFun value :=
    ⟨(value.2.1.1, ⟨value.1, value.2.2⟩), value.2.1.2⟩
  invFun descriptor :=
    ⟨descriptor.1.2.1,
      ⟨descriptor.1.1, descriptor.2⟩,
      descriptor.1.2.2⟩
  left_inv := by
    rintro ⟨generator, ⟨edge, typing⟩, position⟩
    rfl
  right_inv := by
    rintro ⟨⟨edge, ⟨generator, position⟩⟩, typing⟩
    rfl

/-- Reconstructed source carrier is equivalent to the ambient one. -/
noncomputable def sourceCarrierEquiv :
    (graph X h).SourceCarrier ≃ Carrier X .source :=
  (sourcePresentationEquiv X).trans (sourceDescriptorEquiv X h).symm

/-- Reconstructed target carrier is equivalent to the ambient one. -/
noncomputable def targetCarrierEquiv :
    (graph X h).TargetCarrier ≃ Carrier X .target :=
  (targetPresentationEquiv X).trans (targetDescriptorEquiv X h).symm

@[simp]
theorem sourceCarrierEquiv_apply
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.input g).length) :
    sourceCarrierEquiv X h ⟨g, edge, position⟩ =
      sourceIncidence X h edge position :=
  rfl

@[simp]
theorem targetCarrierEquiv_apply
    {g : σ.Gen} (edge : EdgeFibre X g)
    (position : Fin (σ.output g).length) :
    targetCarrierEquiv X h ⟨g, edge, position⟩ =
      targetIncidence X h edge position :=
  rfl

/-- The six carrier equivalences of the reconstruction. -/
noncomputable def componentEquiv :
    (shape : IncidenceShape) →
      (graph X h).Carrier shape ≃ Carrier X shape
  | .node => nodeCarrierEquiv X
  | .edge => edgeCarrierEquiv X
  | .source => sourceCarrierEquiv X h
  | .target => targetCarrierEquiv X h
  | .input => (inputEquiv X h).symm
  | .output => (outputEquiv X h).symm

/-- Carrier equivalences commute with every incidence-structure arrow. -/
theorem component_naturality_base
    {A B : IncidenceShape} (arrow : IncidenceShape.Hom A B)
    (value : (graph X h).Carrier B) :
    componentEquiv X h A ((graph X h).map arrow value) =
      structureMap X arrow (componentEquiv X h B value) := by
  cases arrow with
  | id shape =>
      change
        componentEquiv X h A value =
          X.left.map (𝟙 (op A)) (componentEquiv X h A value)
      rw [X.left.map_id]
      rfl
  | nodeSource =>
      rcases value with ⟨generator, edge, position⟩
      rfl
  | edgeSource =>
      rcases value with ⟨generator, edge, position⟩
      exact (sourceIncidence_edge X h edge position).symm
  | nodeTarget =>
      rcases value with ⟨generator, edge, position⟩
      rfl
  | edgeTarget =>
      rcases value with ⟨generator, edge, position⟩
      exact (targetIncidence_edge X h edge position).symm
  | nodeInput => rfl
  | nodeOutput => rfl

/-- Carrier equivalences preserve the typing map at all six sorts. -/
theorem component_typing
    (shape : IncidenceShape) (value : (graph X h).Carrier shape) :
    typingAt X shape (componentEquiv X h shape value) =
      (graph X h).typingComponent shape value := by
  cases shape with
  | node =>
      rcases value with ⟨object, node, typing⟩
      exact typing
  | edge =>
      rcases value with ⟨generator, edge, typing⟩
      exact typing
  | source =>
      rcases value with ⟨generator, edge, position⟩
      exact sourceIncidence_typing X h edge position
  | target =>
      rcases value with ⟨generator, edge, position⟩
      exact targetIncidence_typing X h edge position
  | input =>
      exact inputPort_typing X h value
  | output =>
      exact outputPort_typing X h value

/-- Reconstructed and ambient incidence presheaves are naturally isomorphic. -/
noncomputable def presheafIso :
    (graph X h).presheaf ≅ X.left :=
  NatIso.ofComponents
    (fun shape => (componentEquiv X h (unop shape)).toIso)
    (fun {A B} arrow => by
      apply ConcreteCategory.hom_ext
      intro value
      exact component_naturality_base X h arrow.unop value)

/--
The reconstruction is an isomorphism in the typed slice, not merely an
untyped carrierwise isomorphism.
-/
noncomputable def typedIso :
    (graph X h).encoded ≅ X :=
  Over.isoMk (presheafIso X h) (by
    apply NatTrans.ext
    funext shape
    apply ConcreteCategory.hom_ext
    intro value
    exact component_typing X h (unop shape) value)

end Reconstruction

/-- The independent exact predicate is sufficient for essential-image membership. -/
theorem exactPositionalObject_mem_essImage
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes))
    (h : ExactPositionalObject X) :
    (encodingFunctor σ inputTypes outputTypes).essImage X :=
  ⟨Reconstruction.graph X h, ⟨Reconstruction.typedIso X h⟩⟩

namespace IsoTransport

variable
  {X Y :
    Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)}

/-- Carrier equivalence induced by an isomorphism in the typed slice. -/
noncomputable def carrierEquiv (e : X ≅ Y) (shape : IncidenceShape) :
    Carrier X shape ≃ Carrier Y shape := by
  let component := e.hom.left.app (op shape)
  haveI : IsIso component := by
    dsimp [component]
    infer_instance
  exact
    Equiv.ofBijective component
      (ConcreteCategory.bijective_of_isIso component)

/-- A typed-slice isomorphism preserves the typing component pointwise. -/
theorem typing_carrierEquiv
    (e : X ≅ Y) (shape : IncidenceShape) (value : Carrier X shape) :
    typingAt Y shape (carrierEquiv e shape value) =
      typingAt X shape value := by
  have equality := Over.w e.hom
  have componentEquality :=
    congrArg (fun transformation => transformation.app (op shape)) equality
  exact ConcreteCategory.congr_hom componentEquality value

/-- A typed-slice isomorphism commutes with every incidence map. -/
theorem structure_carrierEquiv
    (e : X ≅ Y) {A B : IncidenceShape}
    (arrow : IncidenceShape.Hom A B) (value : Carrier X B) :
    carrierEquiv e A (structureMap X arrow value) =
      structureMap Y arrow (carrierEquiv e B value) := by
  have equality := e.hom.left.naturality (Quiver.Hom.op arrow)
  exact ConcreteCategory.congr_hom equality value

/-- Source descriptors transport along any typed-slice isomorphism. -/
noncomputable def sourceDescriptorEquiv (e : X ≅ Y) :
    SourceDescriptor X ≃ SourceDescriptor Y where
  toFun descriptor :=
    ⟨(carrierEquiv e .edge descriptor.1.1, descriptor.1.2),
      (typing_carrierEquiv e .edge descriptor.1.1).trans descriptor.2⟩
  invFun descriptor :=
    ⟨((carrierEquiv e .edge).symm descriptor.1.1, descriptor.1.2),
      by
        calc
          typingAt X .edge ((carrierEquiv e .edge).symm descriptor.1.1) =
              typingAt Y .edge
                (carrierEquiv e .edge
                  ((carrierEquiv e .edge).symm descriptor.1.1)) :=
            (typing_carrierEquiv e .edge
              ((carrierEquiv e .edge).symm descriptor.1.1)).symm
          _ = typingAt Y .edge descriptor.1.1 := by
            rw [(carrierEquiv e .edge).apply_symm_apply]
          _ = typeMap σ inputTypes outputTypes
                IncidenceShape.Hom.edgeSource descriptor.1.2 :=
            descriptor.2⟩
  left_inv descriptor := by
    apply Subtype.ext
    apply Prod.ext
    · exact (carrierEquiv e .edge).left_inv descriptor.1.1
    · rfl
  right_inv descriptor := by
    apply Subtype.ext
    apply Prod.ext
    · exact (carrierEquiv e .edge).right_inv descriptor.1.1
    · rfl

/-- Target descriptors transport along any typed-slice isomorphism. -/
noncomputable def targetDescriptorEquiv (e : X ≅ Y) :
    TargetDescriptor X ≃ TargetDescriptor Y where
  toFun descriptor :=
    ⟨(carrierEquiv e .edge descriptor.1.1, descriptor.1.2),
      (typing_carrierEquiv e .edge descriptor.1.1).trans descriptor.2⟩
  invFun descriptor :=
    ⟨((carrierEquiv e .edge).symm descriptor.1.1, descriptor.1.2),
      by
        calc
          typingAt X .edge ((carrierEquiv e .edge).symm descriptor.1.1) =
              typingAt Y .edge
                (carrierEquiv e .edge
                  ((carrierEquiv e .edge).symm descriptor.1.1)) :=
            (typing_carrierEquiv e .edge
              ((carrierEquiv e .edge).symm descriptor.1.1)).symm
          _ = typingAt Y .edge descriptor.1.1 := by
            rw [(carrierEquiv e .edge).apply_symm_apply]
          _ = typeMap σ inputTypes outputTypes
                IncidenceShape.Hom.edgeTarget descriptor.1.2 :=
            descriptor.2⟩
  left_inv descriptor := by
    apply Subtype.ext
    apply Prod.ext
    · exact (carrierEquiv e .edge).left_inv descriptor.1.1
    · rfl
  right_inv descriptor := by
    apply Subtype.ext
    apply Prod.ext
    · exact (carrierEquiv e .edge).right_inv descriptor.1.1
    · rfl

/-- The source descriptor square commutes under a typed-slice isomorphism. -/
theorem sourceDescriptor_naturality
    (e : X ≅ Y) (source : Carrier X .source) :
    sourceDescriptorEquiv e (sourceDescriptorMap X source) =
      sourceDescriptorMap Y (carrierEquiv e .source source) := by
  apply Subtype.ext
  apply Prod.ext
  · exact structure_carrierEquiv e
      IncidenceShape.Hom.edgeSource source
  · exact (typing_carrierEquiv e .source source).symm

/-- The target descriptor square commutes under a typed-slice isomorphism. -/
theorem targetDescriptor_naturality
    (e : X ≅ Y) (target : Carrier X .target) :
    targetDescriptorEquiv e (targetDescriptorMap X target) =
      targetDescriptorMap Y (carrierEquiv e .target target) := by
  apply Subtype.ext
  apply Prod.ext
  · exact structure_carrierEquiv e
      IncidenceShape.Hom.edgeTarget target
  · exact (typing_carrierEquiv e .target target).symm

/-- The exact positional predicate is invariant under ambient typed isomorphism. -/
theorem exactPositionalObject_of_iso
    (e : X ≅ Y) (h : ExactPositionalObject X) :
    ExactPositionalObject Y where
  carrier_finite shape := by
    letI : Finite (Carrier X shape) := h.carrier_finite shape
    exact
      Finite.of_surjective (carrierEquiv e shape)
        (carrierEquiv e shape).surjective
  source_bijective := by
    constructor
    · intro first second equality
      apply (carrierEquiv e .source).symm.injective
      apply h.source_bijective.1
      apply (sourceDescriptorEquiv e).injective
      rw [sourceDescriptor_naturality, sourceDescriptor_naturality]
      simpa only [Equiv.apply_symm_apply] using equality
    · intro descriptor
      obtain ⟨source, equality⟩ :=
        h.source_bijective.2 ((sourceDescriptorEquiv e).symm descriptor)
      refine ⟨carrierEquiv e .source source, ?_⟩
      calc
        sourceDescriptorMap Y (carrierEquiv e .source source) =
            sourceDescriptorEquiv e (sourceDescriptorMap X source) :=
          (sourceDescriptor_naturality e source).symm
        _ = sourceDescriptorEquiv e
              ((sourceDescriptorEquiv e).symm descriptor) := by
          rw [equality]
        _ = descriptor := (sourceDescriptorEquiv e).apply_symm_apply descriptor
  target_bijective := by
    constructor
    · intro first second equality
      apply (carrierEquiv e .target).symm.injective
      apply h.target_bijective.1
      apply (targetDescriptorEquiv e).injective
      rw [targetDescriptor_naturality, targetDescriptor_naturality]
      simpa only [Equiv.apply_symm_apply] using equality
    · intro descriptor
      obtain ⟨target, equality⟩ :=
        h.target_bijective.2 ((targetDescriptorEquiv e).symm descriptor)
      refine ⟨carrierEquiv e .target target, ?_⟩
      calc
        targetDescriptorMap Y (carrierEquiv e .target target) =
            targetDescriptorEquiv e (targetDescriptorMap X target) :=
          (targetDescriptor_naturality e target).symm
        _ = targetDescriptorEquiv e
              ((targetDescriptorEquiv e).symm descriptor) := by
          rw [equality]
        _ = descriptor := (targetDescriptorEquiv e).apply_symm_apply descriptor
  input_bijective := by
    constructor
    · intro first second equality
      apply (carrierEquiv e .input).symm.injective
      apply h.input_bijective.1
      calc
        typingAt X .input ((carrierEquiv e .input).symm first) =
            typingAt Y .input first := by
          rw [← typing_carrierEquiv e]
          simp
        _ = typingAt Y .input second := equality
        _ = typingAt X .input ((carrierEquiv e .input).symm second) := by
          rw [← typing_carrierEquiv e]
          simp
    · intro position
      obtain ⟨port, equality⟩ := h.input_bijective.2 position
      refine ⟨carrierEquiv e .input port, ?_⟩
      exact (typing_carrierEquiv e .input port).trans equality
  output_bijective := by
    constructor
    · intro first second equality
      apply (carrierEquiv e .output).symm.injective
      apply h.output_bijective.1
      calc
        typingAt X .output ((carrierEquiv e .output).symm first) =
            typingAt Y .output first := by
          rw [← typing_carrierEquiv e]
          simp
        _ = typingAt Y .output second := equality
        _ = typingAt X .output ((carrierEquiv e .output).symm second) := by
          rw [← typing_carrierEquiv e]
          simp
    · intro position
      obtain ⟨port, equality⟩ := h.output_bijective.2 position
      refine ⟨carrierEquiv e .output port, ?_⟩
      exact (typing_carrierEquiv e .output port).trans equality
  input_node_injective := by
    intro first second equality
    apply (carrierEquiv e .input).symm.injective
    apply h.input_node_injective
    apply (carrierEquiv e .node).injective
    rw [structure_carrierEquiv, structure_carrierEquiv]
    simpa only [Equiv.apply_symm_apply] using equality
  output_node_injective := by
    intro first second equality
    apply (carrierEquiv e .output).symm.injective
    apply h.output_node_injective
    apply (carrierEquiv e .node).injective
    rw [structure_carrierEquiv, structure_carrierEquiv]
    simpa only [Equiv.apply_symm_apply] using equality

end IsoTransport

namespace Encoded

variable (G : FiniteHypergraph σ inputTypes outputTypes)

private theorem sourceDescriptorMap_injective :
    Function.Injective (sourceDescriptorMap G.encoded) := by
  rintro ⟨g, edge, position⟩ ⟨g', edge', position'⟩ equality
  have descriptorEquality :=
    congrArg (fun value : SourceDescriptor G.encoded => value.1) equality
  change
    ((⟨g, edge⟩, ⟨g, position⟩) :
      G.EdgeCarrier × TypeCarrier σ inputTypes outputTypes .source) =
    (⟨g', edge'⟩, ⟨g', position'⟩)
    at descriptorEquality
  cases descriptorEquality
  rfl

private theorem sourceDescriptorMap_surjective :
    Function.Surjective (sourceDescriptorMap G.encoded) := by
  rintro ⟨⟨⟨g, edge⟩, ⟨g', position⟩⟩, generatorEquality⟩
  change g = g' at generatorEquality
  subst g'
  exact ⟨⟨g, edge, position⟩, rfl⟩

private theorem targetDescriptorMap_injective :
    Function.Injective (targetDescriptorMap G.encoded) := by
  rintro ⟨g, edge, position⟩ ⟨g', edge', position'⟩ equality
  have descriptorEquality :=
    congrArg (fun value : TargetDescriptor G.encoded => value.1) equality
  change
    ((⟨g, edge⟩, ⟨g, position⟩) :
      G.EdgeCarrier × TypeCarrier σ inputTypes outputTypes .target) =
    (⟨g', edge'⟩, ⟨g', position'⟩)
    at descriptorEquality
  cases descriptorEquality
  rfl

private theorem targetDescriptorMap_surjective :
    Function.Surjective (targetDescriptorMap G.encoded) := by
  rintro ⟨⟨⟨g, edge⟩, ⟨g', position⟩⟩, generatorEquality⟩
  change g = g' at generatorEquality
  subst g'
  exact ⟨⟨g, edge, position⟩, rfl⟩

/-- Every encoded intrinsic finite hypergraph satisfies the independent predicate. -/
theorem exactPositionalObject :
    ExactPositionalObject G.encoded where
  carrier_finite shape := by
    exact Finite.of_fintype (G.Carrier shape)
  source_bijective :=
    ⟨sourceDescriptorMap_injective G,
      sourceDescriptorMap_surjective G⟩
  target_bijective :=
    ⟨targetDescriptorMap_injective G,
      targetDescriptorMap_surjective G⟩
  input_bijective := Function.bijective_id
  output_bijective := Function.bijective_id
  input_node_injective := G.inputBoundary_injective
  output_node_injective := G.outputBoundary_injective

end Encoded

/--
Objectwise characterization theorem: the categorical essential image is
exactly the independently stated finite, positional, typed, fixed-boundary,
no-duplicate predicate.
-/
theorem essImage_iff_exactPositionalObject
    (X : Ambient (σ := σ) (inputTypes := inputTypes)
      (outputTypes := outputTypes)) :
    (encodingFunctor σ inputTypes outputTypes).essImage X ↔
      ExactPositionalObject X := by
  constructor
  · rintro ⟨graph, ⟨equivalence⟩⟩
    exact
      IsoTransport.exactPositionalObject_of_iso equivalence
        (Encoded.exactPositionalObject graph)
  · exact exactPositionalObject_mem_essImage X

/-- Full ambient subcategory selected by the independent exact predicate. -/
abbrev ExactPositionalSubcategory :=
  ObjectProperty.FullSubcategory
    (ExactPositionalObject :
      Ambient (σ := σ) (inputTypes := inputTypes)
        (outputTypes := outputTypes) → Prop)

end Cantilune.Core.PositionalImageCharacterization
