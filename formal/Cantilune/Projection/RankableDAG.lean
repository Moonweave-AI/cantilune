import Cantilune.Core.OpenHypergraph
import Cantilune.Projection.DAGScopeObstruction

/-!
# The strict-DAG view of rankable typed open hypergraphs

`DAGScopeObstruction` proves that a strict DAG view cannot be total on all
typed open hypergraphs.  This module supplies the corresponding positive
construction at the exact admissible scope: a graph equipped with a strict
rank for every source-to-target incidence.

The constructed binary edge relation contains every source/target pair of
every active hyperedge.  Thus no directed incidence is silently discarded.
It is a static construction; operational DPO preservation still has to be
proved by each admitted rule family.
-/

namespace Cantilune.Projection.RankableDAG

open Cantilune.Core
open Cantilune.Projection.DAGScopeObstruction

variable {σ : FinSignature} {inputs outputs : List σ.Obj}
variable {Node Edge : Type*} [DecidableEq Node] [DecidableEq Edge]

/-- A finite directed graph with an explicit strictly increasing rank. -/
structure StrictGraph (Vertex : Type*) [DecidableEq Vertex] where
  nodes : Finset Vertex
  edges : Finset (Vertex × Vertex)
  rank : Vertex → Nat
  endpoints :
    ∀ edge ∈ edges, edge.1 ∈ nodes ∧ edge.2 ∈ nodes
  rank_strict :
    ∀ edge ∈ edges, rank edge.1 < rank edge.2

/-- Nonempty directed paths in a generic strict graph. -/
inductive Path {Vertex : Type*} [DecidableEq Vertex]
    (graph : StrictGraph Vertex) : Vertex → Vertex → Prop where
  | single {source target : Vertex}
      (edge : (source, target) ∈ graph.edges) :
      Path graph source target
  | snoc {source middle target : Vertex}
      (initial : Path graph source middle)
      (edge : (middle, target) ∈ graph.edges) :
      Path graph source target

namespace Path

theorem rank_lt {Vertex : Type*} [DecidableEq Vertex]
    {graph : StrictGraph Vertex} {source target : Vertex}
    (path : Path graph source target) :
    graph.rank source < graph.rank target := by
  induction path with
  | single edge =>
      exact graph.rank_strict _ edge
  | snoc initial edge inductionHypothesis =>
      exact lt_trans inductionHypothesis (graph.rank_strict _ edge)

end Path

/-- Strict rank increase excludes every nonempty directed cycle. -/
theorem StrictGraph.acyclic {Vertex : Type*} [DecidableEq Vertex]
    (graph : StrictGraph Vertex) (vertex : Vertex) :
    ¬ Path graph vertex vertex := by
  intro cycle
  exact (Nat.lt_irrefl _ cycle.rank_lt)

/--
All binary source-to-target incidences of active hyperedges.  Hyperedge
identity and port order remain available in the source graph; this relation
is precisely its DAG dependency view.
-/
def incidenceEdges
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge) :
    Finset (Node × Node) :=
  graph.edges.biUnion fun edge =>
    graph.sources edge |>.toFinset.product
      (graph.targets edge |>.toFinset)

theorem mem_incidenceEdges_iff
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge)
    (source target : Node) :
    (source, target) ∈ incidenceEdges graph ↔
      ∃ edge ∈ graph.edges,
        source ∈ graph.sources edge ∧
        target ∈ graph.targets edge := by
  simp [incidenceEdges]

/--
Positive input to the strict-DAG projection: an actual rank function and its
proof, rather than a bare existential that would hide the projected ranks.
-/
structure RankedOpenHypergraph
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge) where
  rank : Node → Nat
  rank_strict :
    ∀ edge, edge ∈ graph.edges →
      ∀ source, source ∈ graph.sources edge →
        ∀ target, target ∈ graph.targets edge →
          rank source < rank target

namespace RankedOpenHypergraph

variable {graph : TypedOpenHypergraph σ inputs outputs Node Edge}

/-- Forget the chosen witness and recover the rankability proposition. -/
theorem hasStrictIncidenceRank (ranked : RankedOpenHypergraph graph) :
    HasStrictIncidenceRank graph :=
  ⟨ranked.rank, ranked.rank_strict⟩

/--
Construct the dependency DAG without dropping any active source/target
incidence.
-/
def toStrictGraph (ranked : RankedOpenHypergraph graph) :
    StrictGraph Node where
  nodes := graph.nodes
  edges := incidenceEdges graph
  rank := ranked.rank
  endpoints := by
    intro edge membership
    rcases edge with ⟨source, target⟩
    rw [mem_incidenceEdges_iff] at membership
    rcases membership with ⟨hyperedge, active, sourceMem, targetMem⟩
    exact
      ⟨graph.wellFormed.source_active hyperedge active source sourceMem,
        graph.wellFormed.target_active hyperedge active target targetMem⟩
  rank_strict := by
    intro edge membership
    rcases edge with ⟨source, target⟩
    rw [mem_incidenceEdges_iff] at membership
    rcases membership with ⟨hyperedge, active, sourceMem, targetMem⟩
    exact
      ranked.rank_strict hyperedge active source sourceMem target targetMem

/-- The projection contains an edge for every active directed incidence. -/
theorem incidence_preserved
    (ranked : RankedOpenHypergraph graph)
    {edge : Edge} (active : edge ∈ graph.edges)
    {source target : Node}
    (sourceMem : source ∈ graph.sources edge)
    (targetMem : target ∈ graph.targets edge) :
    (source, target) ∈ ranked.toStrictGraph.edges := by
  change (source, target) ∈ incidenceEdges graph
  rw [mem_incidenceEdges_iff]
  exact ⟨edge, active, sourceMem, targetMem⟩

/-- Every projected edge comes from a real active hyperedge incidence. -/
theorem incidence_reflected
    (ranked : RankedOpenHypergraph graph)
    {source target : Node}
    (projected : (source, target) ∈ ranked.toStrictGraph.edges) :
    ∃ edge ∈ graph.edges,
      source ∈ graph.sources edge ∧
      target ∈ graph.targets edge := by
  change (source, target) ∈ incidenceEdges graph at projected
  exact (mem_incidenceEdges_iff graph source target).mp projected

/-- Every boundary node remains present in the projected DAG. -/
theorem inputBoundary_present
    (ranked : RankedOpenHypergraph graph)
    (index : Fin inputs.length) :
    graph.inputBoundary index ∈ ranked.toStrictGraph.nodes :=
  graph.wellFormed.inputBoundary_active index

/-- Every output boundary node remains present in the projected DAG. -/
theorem outputBoundary_present
    (ranked : RankedOpenHypergraph graph)
    (index : Fin outputs.length) :
    graph.outputBoundary index ∈ ranked.toStrictGraph.nodes :=
  graph.wellFormed.outputBoundary_active index

/-- The dependency view of every rankable typed open hypergraph is acyclic. -/
theorem projected_acyclic
    (ranked : RankedOpenHypergraph graph) (node : Node) :
    ¬ Path ranked.toStrictGraph node node :=
  ranked.toStrictGraph.acyclic node

end RankedOpenHypergraph

/--
A rank-preserving open-hypergraph morphism sends every projected dependency
edge to a projected dependency edge.
-/
theorem hom_preserves_incidenceEdges
    {Node₂ Edge₂ : Type*} [DecidableEq Node₂] [DecidableEq Edge₂]
    {sourceGraph :
      TypedOpenHypergraph σ inputs outputs Node Edge}
    {targetGraph :
      TypedOpenHypergraph σ inputs outputs Node₂ Edge₂}
    (hom : TypedOpenHypergraph.Hom sourceGraph targetGraph)
    {source target : Node}
    (edge : (source, target) ∈ incidenceEdges sourceGraph) :
    (hom.nodeMap source, hom.nodeMap target) ∈
      incidenceEdges targetGraph := by
  rw [mem_incidenceEdges_iff] at edge ⊢
  rcases edge with ⟨hyperedge, active, sourceMem, targetMem⟩
  refine
    ⟨hom.edgeMap hyperedge, hom.edge_active hyperedge active, ?_, ?_⟩
  · rw [← hom.sources_preserved hyperedge active]
    exact List.mem_map.mpr ⟨source, sourceMem, rfl⟩
  · rw [← hom.targets_preserved hyperedge active]
    exact List.mem_map.mpr ⟨target, targetMem, rfl⟩

end Cantilune.Projection.RankableDAG
