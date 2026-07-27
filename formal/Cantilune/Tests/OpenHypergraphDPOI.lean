import Cantilune.Core.DPOI

/-!
# Finite typed open-hypergraph and DPOI fixtures

The positive fixtures exhibit a nonempty typed rewrite and two independent
insertions.  The negative fixture deletes an incident node while retaining its
edge and is therefore rejected by the dangling condition.
-/

namespace Cantilune.Tests.OpenHypergraphDPOI

open Cantilune.Core
open Cantilune.Core.DPOI

inductive Obj
  | wire
  deriving DecidableEq, Fintype

inductive Gen
  | link
  deriving DecidableEq, Fintype

def signature : FinSignature where
  Obj := Obj
  Gen := Gen
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input
    | .link => [.wire]
  output
    | .link => [.wire]
  mode := fun _ => .linear
  contract := fun _ => {}

def graphRaw :
    RawTypedOpenHypergraph signature [] [] (Fin 6) (Fin 4) where
  nodes := {0, 1, 2}
  edges := {0}
  nodeType := fun _ => .wire
  edgeLabel := fun _ => .link
  sources
    | 0 => [0]
    | _ => []
  targets
    | 0 => [1]
    | _ => []
  inputBoundary := Fin.elim0
  outputBoundary := Fin.elim0

theorem graphRaw_wellFormed : graphRaw.IsWellFormed := by
  constructor
  · simp [graphRaw, signature]
  · simp [graphRaw, signature]
  · simp [graphRaw, signature]
  · simp [graphRaw, signature]
  · simp [graphRaw]
  · simp [graphRaw]
  · intro i
    exact Fin.elim0 i
  · intro i
    exact Fin.elim0 i
  · simp [graphRaw]
  · simp [graphRaw]

def graph :
    TypedOpenHypergraph signature [] [] (Fin 6) (Fin 4) where
  toRawTypedOpenHypergraph := graphRaw
  wellFormed := graphRaw_wellFormed

def wholeMatch : InclusionMatch graph where
  nodes := graph.nodes
  edges := graph.edges
  nodes_active := Finset.Subset.rfl
  edges_active := Finset.Subset.rfl
  source_closed := graph.wellFormed.source_active
  target_closed := graph.wellFormed.target_active

/-- Delete the isolated node `2`; the incident edge is retained legally. -/
def deleteIsolated : AdmissibleRewrite graph where
  matching := wholeMatch
  support := {
    deleteNodes := {2}
    deleteEdges := ∅
    insertNodes := ∅
    insertEdges := ∅
  }
  deleteNodes_matched := by simp [wholeMatch, graph, graphRaw]
  deleteEdges_matched := by simp
  insertNodes_fresh := by simp
  insertEdges_fresh := by simp
  dangling := by
    intro e he heKeep
    fin_cases e <;> simp_all [graph, graphRaw]
  boundary := by simp [BoundaryCondition]
  insertedSources_active := by simp
  insertedTargets_active := by simp
  insertedSources_typed := by simp
  insertedTargets_typed := by simp

example : deleteIsolated.result.nodes = {0, 1} := by
  native_decide

example : deleteIsolated.IsResult deleteIsolated.result :=
  deleteIsolated.result_isResult

example : deleteIsolated.result.inputBoundary = graph.inputBoundary :=
  deleteIsolated.result_inputBoundary

/--
The bad proposal deletes node `0` but retains edge `0`, whose source is node
`0`; the finite dangling check rejects it.
-/
def danglingSupport : RewriteSupport (Fin 6) (Fin 4) where
  deleteNodes := {0}
  deleteEdges := ∅
  insertNodes := ∅
  insertEdges := ∅

theorem dangling_rejected :
    ¬ DanglingCondition graph danglingSupport := by
  intro h
  have hEdge := h 0 (by simp [graph, graphRaw]) (by simp [danglingSupport])
  exact hEdge.1 0 (by simp [graph, graphRaw]) (by simp [danglingSupport])

/-- First fresh isolated-node insertion. -/
def insertLeft : AdmissibleRewrite graph where
  matching := wholeMatch
  support := {
    deleteNodes := ∅
    deleteEdges := ∅
    insertNodes := {3}
    insertEdges := ∅
  }
  deleteNodes_matched := by simp
  deleteEdges_matched := by simp
  insertNodes_fresh := by simp [graph, graphRaw]
  insertEdges_fresh := by simp
  dangling := by simp [DanglingCondition]
  boundary := by simp [BoundaryCondition]
  insertedSources_active := by simp
  insertedTargets_active := by simp
  insertedSources_typed := by simp
  insertedTargets_typed := by simp

/-- Second fresh isolated-node insertion. -/
def insertRight : AdmissibleRewrite graph where
  matching := wholeMatch
  support := {
    deleteNodes := ∅
    deleteEdges := ∅
    insertNodes := {4}
    insertEdges := ∅
  }
  deleteNodes_matched := by simp
  deleteEdges_matched := by simp
  insertNodes_fresh := by simp [graph, graphRaw]
  insertEdges_fresh := by simp
  dangling := by simp [DanglingCondition]
  boundary := by simp [BoundaryCondition]
  insertedSources_active := by simp
  insertedTargets_active := by simp
  insertedSources_typed := by simp
  insertedTargets_typed := by simp

theorem insertions_independent :
    AdmissibleRewrite.Independent insertLeft insertRight := by
  constructor <;>
    constructor <;>
      simp [AdmissibleRewrite.nodeEvent, AdmissibleRewrite.edgeEvent,
        insertLeft, insertRight]

example :
    insertRight.nodeEvent.apply (insertLeft.nodeEvent.apply graph.nodes) =
      insertLeft.nodeEvent.apply (insertRight.nodeEvent.apply graph.nodes) :=
  (AdmissibleRewrite.concurrency insertions_independent).2.2.1

end Cantilune.Tests.OpenHypergraphDPOI
