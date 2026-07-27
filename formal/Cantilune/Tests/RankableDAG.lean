import Cantilune.Projection.RankableDAG
import Cantilune.Projection.DAGScopeObstruction

namespace Cantilune.Tests.RankableDAG

open Cantilune.Core
open Cantilune.Projection.DAGScopeObstruction
open Cantilune.Projection.RankableDAG

inductive Node
  | input
  | output
  deriving DecidableEq

def graph :
    TypedOpenHypergraph loopSignature [] [] Node Unit where
  nodes := {.input, .output}
  edges := {()}
  nodeType := fun _ => ()
  edgeLabel := fun _ => ()
  sources := fun _ => [.input]
  targets := fun _ => [.output]
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

def ranked : RankedOpenHypergraph graph where
  rank
    | .input => 0
    | .output => 1
  rank_strict := by
    intro edge active source sourceMem target targetMem
    simp [graph] at active sourceMem targetMem
    subst source
    subst target
    decide

example :
    (Node.input, Node.output) ∈ ranked.toStrictGraph.edges :=
  ranked.incidence_preserved (edge := ()) (by simp [graph])
    (by simp [graph]) (by simp [graph])

example :
    ¬ Path ranked.toStrictGraph Node.input Node.input :=
  ranked.projected_acyclic Node.input

example :
    ¬ Path ranked.toStrictGraph Node.output Node.output :=
  ranked.projected_acyclic Node.output

end Cantilune.Tests.RankableDAG
