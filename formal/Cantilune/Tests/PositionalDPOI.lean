import Cantilune.Core.PositionalDPOI

/-!
# Positional incidence regression checks

The test signature deliberately gives one generator two source ports of the
same object type.  The positional type graph must still distinguish them.
-/

namespace Cantilune.Tests.PositionalDPOI

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI

inductive Obj
  | wire
  deriving DecidableEq, Fintype

inductive Gen
  | fork
  deriving DecidableEq, Fintype

def signature : FinSignature where
  Obj := Obj
  Gen := Gen
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input
    | .fork => [.wire, .wire]
  output
    | .fork => [.wire]
  mode := fun _ => .linear
  contract := fun _ => {}

def graph : FiniteHypergraph signature [] [] where
  Node := fun _ => Fin 2
  Edge := fun _ => Unit
  nodeFintype := fun _ => inferInstance
  edgeFintype := fun _ => inferInstance
  source := fun _ i => i
  target := fun _ _ => 0
  inputBoundary := Fin.elim0
  outputBoundary := Fin.elim0
  inputBoundary_injective := by
    intro i
    exact Fin.elim0 i
  outputBoundary_injective := by
    intro i
    exact Fin.elim0 i

theorem repeated_typed_ports_remain_distinct :
    (⟨Gen.fork, (0 : Fin 2)⟩ :
        TypeCarrier signature [] [] .source) ≠
      ⟨Gen.fork, (1 : Fin 2)⟩ := by
  intro h
  have := congrArg (fun p => p.2.val) h
  simp at this

example :
    (encodingFunctor signature [] []).Full := by
  infer_instance

example :
    (encodingFunctor signature [] []).Faithful := by
  infer_instance

example (p : graph.SourceCarrier) :
    graph.typingComponent .source
        ((𝟙 graph : graph ⟶ graph).left.app
          (.op .source) p) =
      graph.typingComponent .source p :=
  graph.hom_source_typing (𝟙 graph) p

end Cantilune.Tests.PositionalDPOI
