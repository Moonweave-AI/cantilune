import Cantilune.Core.PositionalDPOI

/-!
# Active-support normalization of concrete open hypergraphs

`TypedOpenHypergraph` deliberately uses ambient identifier types together with
finite active supports.  This file forgets the inactive ambient identifiers
and reindexes the active nodes and edges by their object/generator types.  The
result is an intrinsic `PositionalDPOI.FiniteHypergraph`.

The construction is intentionally about the finite positional subcategory.
It does not claim essential surjectivity onto the whole typed-presheaf slice.
-/

namespace Cantilune.Core.OpenHypergraphNormalization

open CategoryTheory
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {Node Edge : Type} [DecidableEq Node] [DecidableEq Edge]

private theorem get_cast_of_eq {α : Type*} {l r : List α}
    (h : l = r) (i : Fin l.length) :
    l.get i = r.get (Fin.cast (congrArg List.length h) i) := by
  cases h
  rfl

namespace TypedOpenHypergraph

variable (G : Cantilune.Core.TypedOpenHypergraph
  σ inputTypes outputTypes Node Edge)

/-- The active nodes of object type `o`. -/
abbrev NodeFiber (o : σ.Obj) :=
  {n : ↥G.nodes // G.nodeType n.1 = o}

/-- The active edges carrying generator label `g`. -/
abbrev EdgeFiber (g : σ.Gen) :=
  {e : ↥G.edges // G.edgeLabel e.1 = g}

instance nodeFiberFintype (o : σ.Obj) : Fintype (NodeFiber G o) :=
  inferInstance

instance edgeFiberFintype (g : σ.Gen) : Fintype (EdgeFiber G g) :=
  inferInstance

private theorem source_length
    {g : σ.Gen} (e : EdgeFiber G g) :
    (G.sources e.1.1).length = (σ.input g).length := by
  have typed :
      (G.sources e.1.1).map G.nodeType = σ.input g := by
    simpa [e.2] using
      G.wellFormed.source_typed e.1.1 e.1.2
  calc
    (G.sources e.1.1).length =
        ((G.sources e.1.1).map G.nodeType).length := by simp
    _ = (σ.input g).length :=
      congrArg List.length typed

private theorem target_length
    {g : σ.Gen} (e : EdgeFiber G g) :
    (G.targets e.1.1).length = (σ.output g).length := by
  have typed := G.wellFormed.target_typed e.1.1 e.1.2
  calc
    (G.targets e.1.1).length =
        ((G.targets e.1.1).map G.nodeType).length := by simp
    _ = (σ.output (G.edgeLabel e.1.1)).length :=
      congrArg List.length typed
    _ = (σ.output g).length := by rw [e.2]

private def sourceIndex
    {g : σ.Gen} (e : EdgeFiber G g)
    (i : Fin (σ.input g).length) :
    Fin (G.sources e.1.1).length :=
  Fin.cast (source_length G e).symm i

private def targetIndex
    {g : σ.Gen} (e : EdgeFiber G g)
    (i : Fin (σ.output g).length) :
    Fin (G.targets e.1.1).length :=
  Fin.cast (target_length G e).symm i

private theorem source_type
    {g : σ.Gen} (e : EdgeFiber G g)
    (i : Fin (σ.input g).length) :
    G.nodeType ((G.sources e.1.1).get (sourceIndex G e i)) =
      (σ.input g).get i := by
  let j := sourceIndex G e i
  have typed :
      (G.sources e.1.1).map G.nodeType = σ.input g := by
    simpa [e.2] using
      G.wellFormed.source_typed e.1.1 e.1.2
  have atIndex :=
    get_cast_of_eq typed
      (Fin.cast (by simp) j)
  simpa [j, sourceIndex] using atIndex

private theorem target_type
    {g : σ.Gen} (e : EdgeFiber G g)
    (i : Fin (σ.output g).length) :
    G.nodeType ((G.targets e.1.1).get (targetIndex G e i)) =
      (σ.output g).get i := by
  let j := targetIndex G e i
  have typed :
      (G.targets e.1.1).map G.nodeType = σ.output g := by
    simpa [e.2] using
      G.wellFormed.target_typed e.1.1 e.1.2
  have atIndex :=
    get_cast_of_eq typed
      (Fin.cast (by simp) j)
  simpa [j, targetIndex] using atIndex

private theorem source_active
    {g : σ.Gen} (e : EdgeFiber G g)
    (i : Fin (σ.input g).length) :
    (G.sources e.1.1).get (sourceIndex G e i) ∈ G.nodes :=
  G.wellFormed.source_active e.1.1 e.1.2 _
    (List.get_mem _ _)

private theorem target_active
    {g : σ.Gen} (e : EdgeFiber G g)
    (i : Fin (σ.output g).length) :
    (G.targets e.1.1).get (targetIndex G e i) ∈ G.nodes :=
  G.wellFormed.target_active e.1.1 e.1.2 _
    (List.get_mem _ _)

/-- Forget the dependent typing proofs and retain the ambient node value. -/
private def nodeFiberValue :
    (Σ o, NodeFiber G o) → Node :=
  fun value => value.2.1.1

private def normalizedInputBoundary
    (i : Fin inputTypes.length) :
    NodeFiber G (inputTypes.get i) :=
  ⟨⟨G.inputBoundary i, G.wellFormed.inputBoundary_active i⟩,
    G.wellFormed.inputBoundary_typed i⟩

private def normalizedOutputBoundary
    (i : Fin outputTypes.length) :
    NodeFiber G (outputTypes.get i) :=
  ⟨⟨G.outputBoundary i, G.wellFormed.outputBoundary_active i⟩,
    G.wellFormed.outputBoundary_typed i⟩

private theorem normalizedInputBoundary_injective :
    Function.Injective
      (fun i =>
        (⟨inputTypes.get i, normalizedInputBoundary G i⟩ :
          Σ o, NodeFiber G o)) := by
  intro i j equality
  apply G.wellFormed.inputBoundary_injective
  exact congrArg (nodeFiberValue G) equality

private theorem normalizedOutputBoundary_injective :
    Function.Injective
      (fun i =>
        (⟨outputTypes.get i, normalizedOutputBoundary G i⟩ :
          Σ o, NodeFiber G o)) := by
  intro i j equality
  apply G.wellFormed.outputBoundary_injective
  exact congrArg (nodeFiberValue G) equality

/--
Intrinsic positional presentation of all and only the active support of `G`.
-/
def normalize :
    PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes where
  Node := NodeFiber G
  Edge := EdgeFiber G
  nodeFintype := nodeFiberFintype G
  edgeFintype := edgeFiberFintype G
  source e i :=
    ⟨⟨(G.sources e.1.1).get (sourceIndex G e i),
        source_active G e i⟩,
      source_type G e i⟩
  target e i :=
    ⟨⟨(G.targets e.1.1).get (targetIndex G e i),
        target_active G e i⟩,
      target_type G e i⟩
  inputBoundary :=
    normalizedInputBoundary
      (inputTypes := inputTypes) (outputTypes := outputTypes) G
  outputBoundary :=
    normalizedOutputBoundary
      (inputTypes := inputTypes) (outputTypes := outputTypes) G
  inputBoundary_injective :=
    normalizedInputBoundary_injective
      (inputTypes := inputTypes) (outputTypes := outputTypes) G
  outputBoundary_injective :=
    normalizedOutputBoundary_injective
      (inputTypes := inputTypes) (outputTypes := outputTypes) G

end TypedOpenHypergraph

end Cantilune.Core.OpenHypergraphNormalization
