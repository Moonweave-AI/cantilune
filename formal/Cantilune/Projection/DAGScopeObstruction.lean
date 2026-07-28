import Cantilune.Core.OpenHypergraph

/-!
# The exact scope obstruction for a total DAG projection

An arbitrary typed open directed hypergraph may contain a directed cycle.
Any incidence-preserving projection into a strict DAG would assign ranks
which strictly increase along every source/target incidence.  The one-node
self-loop below is a well-typed open hypergraph, but no such rank exists.

This kernel-checked counterexample forces the P1a source class to carry an
acyclic/rankability certificate (or forces the target to stop being a DAG).
It prevents a conditional certificate interface from being mistaken for an
unconditional construction on all typed open hypergraphs.
-/

namespace Cantilune.Projection.DAGScopeObstruction

open Cantilune.Core

/-- One linear object and one endomorphism generator. -/
def loopSignature : FinSignature where
  Obj := Unit
  Gen := Unit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => [()]
  output := fun _ => [()]
  mode := fun _ => .linear
  contract := fun _ => {}

/-- A legal, boundary-free, one-node hypergraph with one self-loop edge. -/
def loopGraph :
    TypedOpenHypergraph loopSignature [] [] Unit Unit where
  nodes := {()}
  edges := {()}
  nodeType := fun _ => ()
  edgeLabel := fun _ => ()
  sources := fun _ => [()]
  targets := fun _ => [()]
  inputBoundary := Fin.elim0
  outputBoundary := Fin.elim0
  wellFormed := {
    source_active := by simp
    target_active := by simp
    source_typed := by simp [loopSignature]
    target_typed := by simp [loopSignature]
    inputBoundary_active := by intro index; exact Fin.elim0 index
    outputBoundary_active := by intro index; exact Fin.elim0 index
    inputBoundary_injective := by intro index; exact Fin.elim0 index
    outputBoundary_injective := by intro index; exact Fin.elim0 index
    inputBoundary_typed := by intro index; exact Fin.elim0 index
    outputBoundary_typed := by intro index; exact Fin.elim0 index
  }

/--
A strict rank compatible with every directed incidence of an open
hypergraph.  This is the invariant used by any incidence-preserving
translation into a ranked DAG.
-/
def HasStrictIncidenceRank
    {σ : FinSignature} {inputs outputs : List σ.Obj}
    {Node Edge : Type*} [DecidableEq Node] [DecidableEq Edge]
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge) : Prop :=
  ∃ rank : Node → Nat,
    ∀ edge, edge ∈ graph.edges →
      ∀ source, source ∈ graph.sources edge →
        ∀ target, target ∈ graph.targets edge →
          rank source < rank target

/-- The well-typed self-loop cannot carry a strictly increasing rank. -/
theorem loopGraph_not_rankable :
    ¬ HasStrictIncidenceRank loopGraph := by
  rintro ⟨rank, strictlyIncreasing⟩
  have impossible :
      rank () < rank () :=
    strictlyIncreasing () (by simp [loopGraph])
      () (by simp [loopGraph])
      () (by simp [loopGraph])
  exact (Nat.lt_irrefl _) impossible

/--
Therefore no theorem can assign a strict incidence rank to every typed open
hypergraph.  A general P1a DAG certificate must expose a rankability premise.
-/
theorem no_total_strict_rank_assignment :
    ¬ (∀ {σ : FinSignature} {inputs outputs : List σ.Obj}
        {Node Edge : Type} [DecidableEq Node] [DecidableEq Edge]
        (graph : TypedOpenHypergraph σ inputs outputs Node Edge),
        HasStrictIncidenceRank graph) := by
  intro total
  have rankable : HasStrictIncidenceRank loopGraph :=
    total (σ := loopSignature) (inputs := []) (outputs := [])
      (Node := Unit) (Edge := Unit) loopGraph
  exact loopGraph_not_rankable rankable

end Cantilune.Projection.DAGScopeObstruction
