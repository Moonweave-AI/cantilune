import Cantilune.Core.Signature
import Mathlib.Data.Finset.Basic

/-!
# Finite typed open directed hypergraphs

This file gives the finite, executable open-hypergraph carrier used by the
local DPOI fragment.  A graph has finite active node and hyperedge sets inside
fixed ambient identifier types.  Every hyperedge has ordered source and target
ports, and both the edge declaration and every port are checked against a
`FinSignature`.

The input and output interfaces are ordered typed words.  Their maps into the
active node set are required to be injective; hence they are genuine boundary
embeddings, rather than unverified lists of names.

This is deliberately a concrete finite presentation.  It does not assert that
the category below is a presheaf category or that it carries a general
M-adhesive structure.
-/

namespace Cantilune.Core

/--
Raw finite-support data for a typed open directed hypergraph.

`Node` and `Edge` are ambient identifier types.  Finiteness is carried by the
active `nodes` and `edges` finsets, which lets an executable rewrite reuse
identifiers from a fixed universe while still producing a finite graph.
-/
structure RawTypedOpenHypergraph
    (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)
    (Node Edge : Type*) [DecidableEq Node] [DecidableEq Edge] where
  nodes : Finset Node
  edges : Finset Edge
  nodeType : Node → σ.Obj
  edgeLabel : Edge → σ.Gen
  sources : Edge → List Node
  targets : Edge → List Node
  inputBoundary : Fin inputTypes.length → Node
  outputBoundary : Fin outputTypes.length → Node

namespace RawTypedOpenHypergraph

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {Node Edge : Type*} [DecidableEq Node] [DecidableEq Edge]

/--
The complete legality predicate for a raw open hypergraph.

The first six fields are the typed-hypergraph obligations.  The last six
fields say that each boundary map is an injective, active, type-preserving
embedding.
-/
structure IsWellFormed
    (G : RawTypedOpenHypergraph σ inputTypes outputTypes Node Edge) : Prop where
  source_active :
    ∀ e, e ∈ G.edges → ∀ n, n ∈ G.sources e → n ∈ G.nodes
  target_active :
    ∀ e, e ∈ G.edges → ∀ n, n ∈ G.targets e → n ∈ G.nodes
  source_typed :
    ∀ e, e ∈ G.edges →
      (G.sources e).map G.nodeType = σ.input (G.edgeLabel e)
  target_typed :
    ∀ e, e ∈ G.edges →
      (G.targets e).map G.nodeType = σ.output (G.edgeLabel e)
  inputBoundary_active :
    ∀ i, G.inputBoundary i ∈ G.nodes
  outputBoundary_active :
    ∀ i, G.outputBoundary i ∈ G.nodes
  inputBoundary_injective :
    Function.Injective G.inputBoundary
  outputBoundary_injective :
    Function.Injective G.outputBoundary
  inputBoundary_typed :
    ∀ i, G.nodeType (G.inputBoundary i) = inputTypes.get i
  outputBoundary_typed :
    ∀ i, G.nodeType (G.outputBoundary i) = outputTypes.get i

end RawTypedOpenHypergraph

/-- A raw open hypergraph together with its complete legality certificate. -/
structure TypedOpenHypergraph
    (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)
    (Node Edge : Type*) [DecidableEq Node] [DecidableEq Edge]
    extends RawTypedOpenHypergraph σ inputTypes outputTypes Node Edge where
  wellFormed : toRawTypedOpenHypergraph.IsWellFormed

namespace TypedOpenHypergraph

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {Node₁ Edge₁ Node₂ Edge₂ Node₃ Edge₃ : Type*}
variable [DecidableEq Node₁] [DecidableEq Edge₁]
variable [DecidableEq Node₂] [DecidableEq Edge₂]
variable [DecidableEq Node₃] [DecidableEq Edge₃]

/-- Equality of certified graphs is determined by their raw graph data. -/
@[ext]
theorem ext
    {G H : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    (h : G.toRawTypedOpenHypergraph = H.toRawTypedOpenHypergraph) :
    G = H := by
  cases G
  cases H
  cases h
  rfl

/-- The input boundary as an actual embedding of its finite ordinal. -/
def inputEmbedding
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁) :
    Fin inputTypes.length ↪ Node₁ :=
  ⟨G.inputBoundary, G.wellFormed.inputBoundary_injective⟩

/-- The output boundary as an actual embedding of its finite ordinal. -/
def outputEmbedding
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁) :
    Fin outputTypes.length ↪ Node₁ :=
  ⟨G.outputBoundary, G.wellFormed.outputBoundary_injective⟩

/--
A structure-preserving morphism of typed open hypergraphs with fixed boundary
types.  Incidence lists are preserved in order, so the map cannot silently
permute hyperedge ports.
-/
structure Hom
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁)
    (H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂) where
  nodeMap : Node₁ → Node₂
  edgeMap : Edge₁ → Edge₂
  node_active :
    ∀ n, n ∈ G.nodes → nodeMap n ∈ H.nodes
  edge_active :
    ∀ e, e ∈ G.edges → edgeMap e ∈ H.edges
  node_typed :
    ∀ n, n ∈ G.nodes → H.nodeType (nodeMap n) = G.nodeType n
  edge_typed :
    ∀ e, e ∈ G.edges → H.edgeLabel (edgeMap e) = G.edgeLabel e
  sources_preserved :
    ∀ e, e ∈ G.edges →
      (G.sources e).map nodeMap = H.sources (edgeMap e)
  targets_preserved :
    ∀ e, e ∈ G.edges →
      (G.targets e).map nodeMap = H.targets (edgeMap e)
  inputBoundary_preserved :
    ∀ i, nodeMap (G.inputBoundary i) = H.inputBoundary i
  outputBoundary_preserved :
    ∀ i, nodeMap (G.outputBoundary i) = H.outputBoundary i

/-- A hypergraph morphism is determined by its node and edge maps. -/
@[ext]
theorem Hom.ext
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
    {f g : Hom G H}
    (nodes : f.nodeMap = g.nodeMap)
    (edges : f.edgeMap = g.edgeMap) :
    f = g := by
  cases f
  cases g
  cases nodes
  cases edges
  rfl

/--
A concrete monomorphism.  Global injectivity is stronger than injectivity only
on the finite active support and makes finite match images executable without
choosing representatives.
-/
structure Monomorphism
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁)
    (H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂)
    extends Hom G H where
  node_injective : Function.Injective toHom.nodeMap
  edge_injective : Function.Injective toHom.edgeMap

/-- Identity open-hypergraph morphism. -/
def Hom.id
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁) :
    Hom G G where
  nodeMap := fun n => n
  edgeMap := fun e => e
  node_active := by simp
  edge_active := by simp
  node_typed := by simp
  edge_typed := by simp
  sources_preserved := by simp
  targets_preserved := by simp
  inputBoundary_preserved := by simp
  outputBoundary_preserved := by simp

/-- Composition of structure-preserving open-hypergraph morphisms. -/
def Hom.comp
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
    {J : TypedOpenHypergraph σ inputTypes outputTypes Node₃ Edge₃}
    (f : Hom G H) (g : Hom H J) :
    Hom G J where
  nodeMap := g.nodeMap ∘ f.nodeMap
  edgeMap := g.edgeMap ∘ f.edgeMap
  node_active := by
    intro n hn
    exact g.node_active _ (f.node_active n hn)
  edge_active := by
    intro e he
    exact g.edge_active _ (f.edge_active e he)
  node_typed := by
    intro n hn
    exact (g.node_typed _ (f.node_active n hn)).trans (f.node_typed n hn)
  edge_typed := by
    intro e he
    exact (g.edge_typed _ (f.edge_active e he)).trans (f.edge_typed e he)
  sources_preserved := by
    intro e he
    change
      (G.sources e).map (g.nodeMap ∘ f.nodeMap) =
        J.sources (g.edgeMap (f.edgeMap e))
    calc
      (G.sources e).map (g.nodeMap ∘ f.nodeMap) =
          ((G.sources e).map f.nodeMap).map g.nodeMap := by
            simp [List.map_map, Function.comp_def]
      _ = (H.sources (f.edgeMap e)).map g.nodeMap := by
            rw [f.sources_preserved e he]
      _ = J.sources (g.edgeMap (f.edgeMap e)) :=
            g.sources_preserved _ (f.edge_active e he)
  targets_preserved := by
    intro e he
    change
      (G.targets e).map (g.nodeMap ∘ f.nodeMap) =
        J.targets (g.edgeMap (f.edgeMap e))
    calc
      (G.targets e).map (g.nodeMap ∘ f.nodeMap) =
          ((G.targets e).map f.nodeMap).map g.nodeMap := by
            simp [List.map_map, Function.comp_def]
      _ = (H.targets (f.edgeMap e)).map g.nodeMap := by
            rw [f.targets_preserved e he]
      _ = J.targets (g.edgeMap (f.edgeMap e)) :=
            g.targets_preserved _ (f.edge_active e he)
  inputBoundary_preserved := by
    intro i
    simp only [Function.comp_apply, f.inputBoundary_preserved, g.inputBoundary_preserved]
  outputBoundary_preserved := by
    intro i
    simp only [Function.comp_apply, f.outputBoundary_preserved, g.outputBoundary_preserved]

@[simp]
theorem Hom.id_comp
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
    (f : Hom G H) :
    Hom.comp (Hom.id G) f = f := by
  apply Hom.ext <;> rfl

@[simp]
theorem Hom.comp_id
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
    (f : Hom G H) :
    Hom.comp f (Hom.id H) = f := by
  apply Hom.ext <;> rfl

theorem Hom.comp_assoc
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
    {J : TypedOpenHypergraph σ inputTypes outputTypes Node₃ Edge₃}
    {Node₄ Edge₄ : Type*} [DecidableEq Node₄] [DecidableEq Edge₄]
    {K : TypedOpenHypergraph σ inputTypes outputTypes Node₄ Edge₄}
    (f : Hom G H) (g : Hom H J) (h : Hom J K) :
    Hom.comp (Hom.comp f g) h = Hom.comp f (Hom.comp g h) := by
  apply Hom.ext <;> rfl

/-- Identity is a concrete monomorphism. -/
def Monomorphism.id
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁) :
    Monomorphism G G where
  toHom := Hom.id G
  node_injective := fun _ _ h => h
  edge_injective := fun _ _ h => h

/-- Concrete monomorphisms are closed under composition. -/
def Monomorphism.comp
    {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
    {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
    {J : TypedOpenHypergraph σ inputTypes outputTypes Node₃ Edge₃}
    (f : Monomorphism G H) (g : Monomorphism H J) :
    Monomorphism G J where
  toHom := Hom.comp f.toHom g.toHom
  node_injective := g.node_injective.comp f.node_injective
  edge_injective := g.edge_injective.comp f.edge_injective

end TypedOpenHypergraph

end Cantilune.Core
