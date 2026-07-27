import Cantilune.Pi.P1cMultiState.Protocol
import Cantilune.Pi.P1cMultiState.Operations
import Cantilune.Pi.P1cMultiState.Matrix

/-!
# P1c multi-state translation seam

This module gives a total, executable translation from the 60-operation
reference protocol into late-pi syntax and proves exact round trips on the
image of that translation.

It intentionally does **not** call the generated syntax pair a native
late-pi transition.  Native operational correspondence is supplied by the
existing P1c late-transition certificates elsewhere in `Cantilune.Pi`; a
constructor-only translation cannot manufacture such a derivation.
-/

namespace Cantilune.Pi.P1cMultiState

/-! ## Reference graph syntax -/

/-- Finite graph data used by this reference translation. -/
structure CantiluneGraph where
  nodes : List Name
  edges : List (Name × Name)
  deriving DecidableEq, Repr

/--
A proposed graph rewrite.  This record contains endpoints and an operation;
it is not itself a DPO or policy-validity proof.
-/
structure MorphismRewrite where
  graph : CantiluneGraph
  operation : P1cOperation
  target : CantiluneGraph
  deriving Repr

/--
Translate graph edges into output prefixes.  Reflexive edges are silent in
this small reference encoding.
-/
def graphToProcess (graph : CantiluneGraph) : Proc :=
  graph.edges.foldl
    (fun process edge =>
      if edge.1 = edge.2 then process
      else
        Proc.par process
          (Proc.send ⟨edge.1, .data⟩ edge.2 Proc.zero))
    Proc.zero

/-- Translate an observable label into the corresponding process constructor. -/
def labelToProcessStep : P1cObservableLabel → Proc → Proc
  | .comm _, _ => Proc.tau Proc.zero
  | .input channel value, continuation =>
      Proc.recv ⟨channel, .data⟩ value continuation
  | .output channel value, continuation =>
      Proc.send ⟨channel, .data⟩ value continuation
  | .reconnect old new, continuation =>
      Proc.send ⟨old, .channel⟩ new continuation
  | .delete channel, _ => Proc.new channel Proc.zero
  | .mismatch left right, continuation =>
      Proc.matchNe left right continuation
  | .quiescentDelete channel, _ => Proc.new channel Proc.zero

/-! ## Observable transition records -/

abbrev MorphismObservableState := CantiluneGraph

structure MorphismTransition where
  source : MorphismObservableState
  label : P1cObservableLabel
  target : MorphismObservableState
  deriving Repr

abbrev PiObservableState := Proc

structure PiTransition where
  source : PiObservableState
  label : P1cObservableLabel
  target : PiObservableState
  deriving Repr

def liftMorphism (rewrite : MorphismRewrite) : MorphismTransition where
  source := rewrite.graph
  label := rewrite.operation.toObservableLabel
  target := rewrite.target

/--
The total syntax-level translation of a graph rewrite.  The target is the
label constructor applied to the translation of the graph target.
-/
def translateRewrite (rewrite : MorphismRewrite) : PiTransition where
  source := graphToProcess rewrite.graph
  label := rewrite.operation.toObservableLabel
  target :=
    labelToProcessStep rewrite.operation.toObservableLabel
      (graphToProcess rewrite.target)

/-- A translated transition is precisely one produced by `translateRewrite`. -/
def InTranslationImage (transition : PiTransition) : Prop :=
  ∃ rewrite, translateRewrite rewrite = transition

/-! ## Exact translation laws -/

theorem static_correspondence (graph : CantiluneGraph) :
    ∃ process, process = graphToProcess graph :=
  ⟨graphToProcess graph, rfl⟩

theorem label_correspondence (operation : P1cOperation) :
    (liftMorphism
        { graph := ⟨[], []⟩
          operation := operation
          target := ⟨[], []⟩ }).label =
      operation.toObservableLabel :=
  rfl

theorem operational_correspondence (rewrite : MorphismRewrite) :
    (translateRewrite rewrite).source = graphToProcess rewrite.graph ∧
    (translateRewrite rewrite).label =
      rewrite.operation.toObservableLabel ∧
    (translateRewrite rewrite).target =
      labelToProcessStep rewrite.operation.toObservableLabel
        (graphToProcess rewrite.target) :=
  ⟨rfl, rfl, rfl⟩

/--
Reflection is exact on the declared translation image; unlike the earlier
scaffold, this theorem makes no false surjectivity claim for arbitrary
late-pi processes.
-/
theorem reflection_correspondence
    (transition : PiTransition)
    (inImage : InTranslationImage transition) :
    ∃ rewrite : MorphismRewrite,
      graphToProcess rewrite.graph = transition.source ∧
      rewrite.operation.toObservableLabel = transition.label ∧
      labelToProcessStep rewrite.operation.toObservableLabel
          (graphToProcess rewrite.target) =
        transition.target := by
  obtain ⟨rewrite, rfl⟩ := inImage
  exact ⟨rewrite, rfl, rfl, rfl⟩

/-- Every operation and pair of graph endpoints has a translated transition. -/
theorem p1c_translation_total
    (operation : P1cOperation)
    (source target : CantiluneGraph) :
    ∃ transition,
      transition =
        translateRewrite
          { graph := source
            operation := operation
            target := target } :=
  ⟨_, rfl⟩

/-! ## Terminal predicate chosen at this translation seam -/

def processTerminal (process : Proc) : Prop :=
  process = Proc.zero

/--
Reference-graph terminality is deliberately defined through the translation.
This avoids the false assertion that `edges = []` is necessary when the
encoding intentionally ignores reflexive edges.
-/
def graphTerminal (graph : CantiluneGraph) : Prop :=
  processTerminal (graphToProcess graph)

theorem terminal_preservation (graph : CantiluneGraph) :
    graphTerminal graph ↔ processTerminal (graphToProcess graph) :=
  Iff.rfl

/-! ## Soundness and image completeness -/

theorem reflection_soundness (rewrite : MorphismRewrite) :
    InTranslationImage (translateRewrite rewrite) :=
  ⟨rewrite, rfl⟩

theorem reflection_completeness
    (transition : PiTransition)
    (inImage : InTranslationImage transition) :
    ∃ rewrite : MorphismRewrite, translateRewrite rewrite = transition :=
  inImage

/--
Each matrix entry supplies two total translation witnesses.  This certifies
coverage of the operation enumeration, not a native reduction or independence
claim.
-/
theorem matrix_cell_translation (i j : Fin 60) :
    ∀ graph : CantiluneGraph,
      InTranslationImage
        (translateRewrite
          { graph := graph
            operation := (buildMatrix i j).op1
            target := graph }) ∧
      InTranslationImage
        (translateRewrite
          { graph := graph
            operation := (buildMatrix i j).op2
            target := graph }) := by
  intro graph
  exact
    ⟨reflection_soundness _,
      reflection_soundness _⟩

/--
The protocol-level completion theorem for every enumerated operation.
This is the strongest result established by this reference module without
importing a native late-pi transition certificate.
-/
theorem p1c_complete_protocol (operation : P1cOperation) :
    ∃ initial final : OperationStateMachine,
      initial = operation.initStateMachine ∧
      ProtocolTransitionStar initial final ∧
      final.state = .complete := by
  obtain ⟨final, path, complete⟩ := p1c_protocol_completion operation
  exact ⟨operation.initStateMachine, final, rfl, path, complete⟩

end Cantilune.Pi.P1cMultiState
