import Cantilune.Projection.RankableDAG
import Mathlib.Data.Fintype.Card
import Mathlib.Order.Antisymmetrization

/-!
# Total SCC condensation and the strict rankable DAG subview

A strict rank cannot be assigned to every directed open hypergraph: a legal
self-loop is already a counterexample.  The total DAG projection therefore
first contracts strongly connected components.  This file constructs that
condensation for every finite directed graph and proves, in the kernel, that
its quotient edges carry a strict natural-number rank.

For a source graph that already carries a strict incidence rank,
`RankedOpenHypergraph.toStrictGraph` remains the more precise subview.  The two
constructions are exposed together by `rankableViews`; no cyclic incidence is
silently deleted from the total view.
-/

namespace Cantilune.Projection.SCCCondensation

open Cantilune.Core
open Cantilune.Projection.RankableDAG

variable {Vertex : Type*} [DecidableEq Vertex]

/-- A finite directed graph whose edge endpoints are active vertices. -/
structure FiniteDirectedGraph (Vertex : Type*) [DecidableEq Vertex] where
  nodes : Finset Vertex
  edges : Finset (Vertex × Vertex)
  endpoints :
    ∀ edge ∈ edges, edge.1 ∈ nodes ∧ edge.2 ∈ nodes

namespace FiniteDirectedGraph

variable (graph : FiniteDirectedGraph Vertex)

/-- Active vertices, used so that the SCC quotient itself is finite. -/
abbrev Active := {vertex // vertex ∈ graph.nodes}

/-- One native directed edge between active vertices. -/
def EdgeRel (source target : graph.Active) : Prop :=
  (source.1, target.1) ∈ graph.edges

/-- Reflexive-transitive reachability in the original graph. -/
def Reachable (source target : graph.Active) : Prop :=
  Relation.ReflTransGen graph.EdgeRel source target

instance : LE graph.Active where
  le := graph.Reachable

instance : Preorder graph.Active where
  le_refl _ := Relation.ReflTransGen.refl
  le_trans _ _ _ := Relation.ReflTransGen.trans

/--
The strongly connected components are the antisymmetrization of the
reachability preorder.
-/
abbrev SCC :=
  Antisymmetrization graph.Active (· ≤ ·)

noncomputable instance : Fintype graph.SCC := by
  classical
  letI : Fintype graph.Active := by
    dsimp [Active]
    infer_instance
  letI :
      DecidableRel
        (AntisymmRel
          (fun source target : graph.Active => source ≤ target)) :=
    Classical.decRel _
  change
    Fintype
      (Quotient
        (AntisymmRel.setoid graph.Active
          (fun source target : graph.Active => source ≤ target)))
  exact Quotient.fintype _

noncomputable instance : DecidableEq graph.SCC :=
  Classical.decEq _

/-- The SCC containing an active vertex. -/
def component (vertex : graph.Active) : graph.SCC :=
  toAntisymmetrization (α := graph.Active) (· ≤ ·) vertex

@[simp]
theorem component_le_component_iff
    (source target : graph.Active) :
    graph.component source ≤ graph.component target ↔
      graph.Reachable source target := by
  exact
    toAntisymmetrization_le_toAntisymmetrization_iff
      (α := graph.Active) (a := source) (b := target)

@[simp]
theorem component_eq_component_iff
    (source target : graph.Active) :
    graph.component source = graph.component target ↔
      graph.Reachable source target ∧ graph.Reachable target source := by
  change
    toAntisymmetrization (α := graph.Active) (· ≤ ·) source =
        toAntisymmetrization (α := graph.Active) (· ≤ ·) target ↔
      source ≤ target ∧ target ≤ source
  exact Quotient.eq''

/-- Active source endpoint of a witnessed original edge. -/
def sourceActive (edge : {edge // edge ∈ graph.edges}) :
    graph.Active :=
  ⟨edge.1.1, (graph.endpoints edge.1 edge.2).1⟩

/-- Active target endpoint of a witnessed original edge. -/
def targetActive (edge : {edge // edge ∈ graph.edges}) :
    graph.Active :=
  ⟨edge.1.2, (graph.endpoints edge.1 edge.2).2⟩

theorem edge_reachable (edge : {edge // edge ∈ graph.edges}) :
    graph.Reachable (graph.sourceActive edge) (graph.targetActive edge) :=
  Relation.ReflTransGen.single edge.2

/--
All original edges transported to SCCs, except internal edges whose two
endpoints have the same component.
-/
noncomputable def condensationEdges :
    Finset (graph.SCC × graph.SCC) := by
  classical
  exact
    (graph.edges.attach.image fun edge =>
      (graph.component (graph.sourceActive edge),
        graph.component (graph.targetActive edge))).filter
      (fun edge => edge.1 ≠ edge.2)

theorem mem_condensationEdges_iff
    (source target : graph.SCC) :
    (source, target) ∈ graph.condensationEdges ↔
      source ≠ target ∧
        ∃ edge : {edge // edge ∈ graph.edges},
          graph.component (graph.sourceActive edge) = source ∧
          graph.component (graph.targetActive edge) = target := by
  classical
  simp [condensationEdges, Prod.ext_iff, and_comm]

/-- Every condensation edge is strict in the reachability quotient. -/
theorem condensationEdge_lt
    {source target : graph.SCC}
    (edge : (source, target) ∈ graph.condensationEdges) :
    source < target := by
  rcases (graph.mem_condensationEdges_iff source target).mp edge with
    ⟨distinct, witnessed, sourceEq, targetEq⟩
  have reachable :
      graph.component (graph.sourceActive witnessed) ≤
        graph.component (graph.targetActive witnessed) :=
    (graph.component_le_component_iff _ _).mpr
      (graph.edge_reachable witnessed)
  rw [sourceEq, targetEq] at reachable
  exact lt_of_le_of_ne reachable distinct

/--
In any finite partial order, the number of strict predecessors is a strict
natural-number rank.
-/
noncomputable def lowerCard
    {α : Type*} [Fintype α] [PartialOrder α]
    (value : α) : Nat := by
  classical
  exact (Finset.univ.filter fun candidate => candidate < value).card

theorem lowerCard_strict
    {α : Type*} [Fintype α] [PartialOrder α]
    {source target : α} (strict : source < target) :
    lowerCard source < lowerCard target := by
  classical
  apply Finset.card_lt_card
  apply (Finset.ssubset_iff_of_subset ?_).2
  · exact
      ⟨source, by simp [strict], by simp⟩
  · intro candidate membership
    simp only [Finset.mem_filter, Finset.mem_univ, true_and] at membership ⊢
    exact lt_trans membership strict

/--
The SCC condensation of every finite directed graph is a strict ranked DAG.
-/
noncomputable def condensation :
    StrictGraph graph.SCC where
  nodes := Finset.univ
  edges := graph.condensationEdges
  rank := lowerCard
  endpoints := by
    intro edge membership
    simp
  rank_strict := by
    intro edge membership
    exact lowerCard_strict (graph.condensationEdge_lt membership)

theorem condensation_acyclic (component : graph.SCC) :
    ¬ Path graph.condensation component component :=
  graph.condensation.acyclic component

/--
Every original edge is either internal to one SCC or appears as an edge of
the condensation.  This is the exact no-silent-deletion property.
-/
theorem original_edge_internal_or_condensed
    (edge : {edge // edge ∈ graph.edges}) :
    graph.component (graph.sourceActive edge) =
        graph.component (graph.targetActive edge) ∨
      (graph.component (graph.sourceActive edge),
        graph.component (graph.targetActive edge)) ∈
        graph.condensationEdges := by
  classical
  by_cases internal :
      graph.component (graph.sourceActive edge) =
        graph.component (graph.targetActive edge)
  · exact Or.inl internal
  · exact Or.inr <|
      (graph.mem_condensationEdges_iff _ _).mpr
        ⟨internal, edge, rfl, rfl⟩

end FiniteDirectedGraph

variable
    {σ : FinSignature} {inputs outputs : List σ.Obj}
    {Node Edge : Type*} [DecidableEq Node] [DecidableEq Edge]

/-- Dependency digraph of all source-to-target incidences of an open graph. -/
def dependencyGraph
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge) :
    FiniteDirectedGraph Node where
  nodes := graph.nodes
  edges := incidenceEdges graph
  endpoints := by
    intro edge membership
    rcases edge with ⟨source, target⟩
    rw [mem_incidenceEdges_iff] at membership
    rcases membership with ⟨hyperedge, active, sourceMem, targetMem⟩
    exact
      ⟨graph.wellFormed.source_active hyperedge active source sourceMem,
        graph.wellFormed.target_active hyperedge active target targetMem⟩

/-- Total SCC-condensation DAG for every finite typed open hypergraph. -/
noncomputable def totalDAG
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge) :
    StrictGraph (dependencyGraph graph).SCC :=
  (dependencyGraph graph).condensation

theorem totalDAG_acyclic
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge)
    (component : (dependencyGraph graph).SCC) :
    ¬ Path (totalDAG graph) component component :=
  (dependencyGraph graph).condensation_acyclic component

/--
For a rankable graph expose both the total SCC condensation and the direct
incidence-preserving strict subview.
-/
structure RankableViews
    (graph : TypedOpenHypergraph σ inputs outputs Node Edge) where
  total : StrictGraph (dependencyGraph graph).SCC
  strict : StrictGraph Node

noncomputable def rankableViews
    {graph : TypedOpenHypergraph σ inputs outputs Node Edge}
    (ranked : RankedOpenHypergraph graph) :
    RankableViews graph where
  total := totalDAG graph
  strict := ranked.toStrictGraph

theorem rankableViews_strict_preserves_incidence
    {graph : TypedOpenHypergraph σ inputs outputs Node Edge}
    (ranked : RankedOpenHypergraph graph)
    {edge : Edge} (active : edge ∈ graph.edges)
    {source target : Node}
    (sourceMem : source ∈ graph.sources edge)
    (targetMem : target ∈ graph.targets edge) :
    (source, target) ∈ (rankableViews ranked).strict.edges :=
  ranked.incidence_preserved active sourceMem targetMem

end Cantilune.Projection.SCCCondensation
