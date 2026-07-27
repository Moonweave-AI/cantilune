import Cantilune.Pi.P1cMatrix

/-!
# Complete native P1c reference matrix

This module discharges the three non-pi columns of the finite P1c reference
calculus.  The target relations are defined independently:

* the DAG column performs one rank-preserving acyclic graph rewrite;
* the Petri column fires one event-labelled, identity-preserving token;
* the morphism column is the total-category identity view of the source LTS.

These are reference-calculus witnesses.  They do not identify the DAG rewrite
with a general DPOI theorem or the finite net with a product Petri API.
-/

namespace Cantilune.Pi.P1cCompleteMatrix

open Cantilune.Core
open Cantilune.Pi.P1cMatrix

namespace DAG

/-- Vertices used by the event-indexed reference DAG. -/
inductive Vertex where
  | input
  | operation (event : SourceEvent)
  | output
  deriving DecidableEq, Repr

def rank : Vertex -> Nat
  | .input => 0
  | .operation _ => 1
  | .output => 2

/-- A finite graph carrying endpoint and strict-rank certificates. -/
structure State where
  event : SourceEvent
  nodes : Finset Vertex
  edges : Finset (Vertex × Vertex)
  version : Nat
  quiescent : Bool
  endpoints :
    ∀ edge ∈ edges, edge.1 ∈ nodes ∧ edge.2 ∈ nodes
  rankStrict :
    ∀ edge ∈ edges, rank edge.1 < rank edge.2

/--
Before a normal/admission event the operation vertex is absent.  Reconnect
starts from a one-sided attachment, while quiescent deletion starts with the
whole operation subgraph present.
-/
def ready (event : SourceEvent) : State :=
  match event with
  | .instanceReconnect =>
      { event := event
        nodes := {.input, .operation event, .output}
        edges := {(.input, .operation event)}
        version := 0
        quiescent := false
        endpoints := by simp
        rankStrict := by simp [rank] }
  | .instanceDeleteQuiescent =>
      { event := event
        nodes := {.input, .operation event, .output}
        edges := {(.input, .operation event), (.operation event, .output)}
        version := 0
        quiescent := true
        endpoints := by
          intro edge membership
          simp only [Finset.mem_insert, Finset.mem_singleton] at membership
          rcases membership with rfl | rfl <;> simp
        rankStrict := by
          intro edge membership
          simp only [Finset.mem_insert, Finset.mem_singleton] at membership
          rcases membership with rfl | rfl <;> simp [rank] }
  | event =>
      { event := event
        nodes := {.input, .output}
        edges := {(.input, .output)}
        version := 0
        quiescent := false
        endpoints := by simp
        rankStrict := by simp [rank] }

/--
Normal/admission events install an operation vertex; reconnect adds its missing
attachment; quiescent deletion removes the operation subgraph.
-/
def completed (event : SourceEvent) : State :=
  match event with
  | .instanceDeleteQuiescent =>
      { event := event
        nodes := {.input, .output}
        edges := {(.input, .output)}
        version := 0
        quiescent := true
        endpoints := by simp
        rankStrict := by simp [rank] }
  | event =>
      { event := event
        nodes := {.input, .operation event, .output}
        edges := {(.input, .operation event), (.operation event, .output)}
        version :=
          if event = .dynamicPartnerAdmission then 1 else 0
        quiescent := false
        endpoints := by
          intro edge membership
          simp only [Finset.mem_insert, Finset.mem_singleton] at membership
          rcases membership with rfl | rfl <;> simp
        rankStrict := by
          intro edge membership
          simp only [Finset.mem_insert, Finset.mem_singleton] at membership
          rcases membership with rfl | rfl <;> simp [rank] }

@[simp]
theorem ready_event (event : SourceEvent) :
    (ready event).event = event := by
  cases event <;> rfl

@[simp]
theorem completed_event (event : SourceEvent) :
    (completed event).event = event := by
  cases event <;> rfl

/-- Native event-indexed DAG rewrite. -/
inductive Step : State -> SourceEvent -> State -> Prop where
  | execute (event : SourceEvent) :
      Step (ready event) event (completed event)

/-- Exact endpoint specification, kept separate from `Step`. -/
inductive Adequate :
    SourceEvent -> State -> SourceEvent -> State -> Prop where
  | execute (event : SourceEvent) :
      Adequate event (ready event) event (completed event)

private theorem operation_absent_ready
    (event : SourceEvent)
    (notReconnect : event ≠ .instanceReconnect)
    (notDelete : event ≠ .instanceDeleteQuiescent) :
    Vertex.operation event ∉ (ready event).nodes := by
  cases event <;> simp_all [ready]

private theorem operation_present_completed
    (event : SourceEvent)
    (notDelete : event ≠ .instanceDeleteQuiescent) :
    Vertex.operation event ∈ (completed event).nodes := by
  cases event <;> simp_all [completed]

theorem changes (event : SourceEvent) :
    ready event ≠ completed event := by
  intro equality
  by_cases reconnect : event = .instanceReconnect
  · subst event
    have edgesEqual := congrArg State.edges equality
    have added :
        (Vertex.operation .instanceReconnect, Vertex.output) ∈
          (completed .instanceReconnect).edges := by
      decide
    rw [← edgesEqual] at added
    exact (by decide : (Vertex.operation .instanceReconnect, Vertex.output) ∉
      (ready .instanceReconnect).edges) added
  · by_cases delete : event = .instanceDeleteQuiescent
    · subst event
      have nodesEqual := congrArg State.nodes equality
      have present :
          Vertex.operation .instanceDeleteQuiescent ∈
            (ready .instanceDeleteQuiescent).nodes := by
        decide
      rw [nodesEqual] at present
      exact (by decide : Vertex.operation .instanceDeleteQuiescent ∉
        (completed .instanceDeleteQuiescent).nodes) present
    · have nodesEqual := congrArg State.nodes equality
      have present := operation_present_completed event delete
      rw [← nodesEqual] at present
      exact operation_absent_ready event reconnect delete present

theorem admission_increases_version :
    (completed .dynamicPartnerAdmission).version =
      (ready .dynamicPartnerAdmission).version + 1 := by
  rfl

theorem reconnect_adds_attachment :
    (Vertex.operation .instanceReconnect, Vertex.output) ∉
        (ready .instanceReconnect).edges ∧
      (Vertex.operation .instanceReconnect, Vertex.output) ∈
        (completed .instanceReconnect).edges := by
  decide

theorem quiescent_delete_removes_operation :
    (ready .instanceDeleteQuiescent).quiescent = true ∧
      Vertex.operation .instanceDeleteQuiescent ∈
        (ready .instanceDeleteQuiescent).nodes ∧
      Vertex.operation .instanceDeleteQuiescent ∉
        (completed .instanceDeleteQuiescent).nodes := by
  decide

/-- Every produced graph remains acyclic because every edge raises rank. -/
inductive Path (state : State) : Vertex -> Vertex -> Prop where
  | single {source target : Vertex}
      (edge : (source, target) ∈ state.edges) :
      Path state source target
  | snoc {source middle target : Vertex}
      (initial : Path state source middle)
      (edge : (middle, target) ∈ state.edges) :
      Path state source target

theorem Path.rank_lt {state : State} {source target : Vertex}
    (path : Path state source target) :
    rank source < rank target := by
  induction path with
  | single edge =>
      exact state.rankStrict _ edge
  | snoc initial edge inductionHypothesis =>
      exact lt_trans inductionHypothesis (state.rankStrict _ edge)

theorem acyclic (state : State) (vertex : Vertex) :
    ¬Path state vertex vertex := by
  intro cycle
  exact Nat.lt_irrefl _ cycle.rank_lt

end DAG

namespace Petri

inductive Place where
  | pending
  | complete
  deriving DecidableEq, Repr

/-- Token identity includes the source event and is preserved by firing. -/
structure Token where
  event : SourceEvent
  identity : Nat
  place : Place
  deriving DecidableEq, Repr

structure State where
  event : SourceEvent
  declared : Finset SourceEvent
  marking : Finset Token
  quiescent : Bool

def inputToken (event : SourceEvent) : Token :=
  ⟨event, 0, .pending⟩

def outputToken (event : SourceEvent) : Token :=
  ⟨event, 0, .complete⟩

def ready (event : SourceEvent) : State :=
  match event with
  | .dynamicPartnerAdmission =>
      ⟨event, ∅, ∅, true⟩
  | .instanceDeleteQuiescent =>
      ⟨event, {event}, ∅, true⟩
  | event =>
      ⟨event, {event}, {inputToken event}, false⟩

def completed (event : SourceEvent) : State :=
  match event with
  | .dynamicPartnerAdmission =>
      ⟨event, {event}, ∅, true⟩
  | .instanceDeleteQuiescent =>
      ⟨event, ∅, ∅, true⟩
  | event =>
      ⟨event, {event}, {outputToken event}, false⟩

@[simp]
theorem ready_event (event : SourceEvent) :
    (ready event).event = event := by
  cases event <;> rfl

@[simp]
theorem completed_event (event : SourceEvent) :
    (completed event).event = event := by
  cases event <;> rfl

/-- One native individual-token firing. -/
inductive Step : State -> SourceEvent -> State -> Prop where
  | fire (event : SourceEvent) :
      Step (ready event) event (completed event)

inductive Adequate :
    SourceEvent -> State -> SourceEvent -> State -> Prop where
  | fire (event : SourceEvent) :
      Adequate event (ready event) event (completed event)

theorem changes (event : SourceEvent) :
    ready event ≠ completed event := by
  intro equality
  have footprint :=
    congrArg
      (fun state : State => (state.declared, state.marking, state.quiescent))
      equality
  cases event <;>
    simp [ready, completed, inputToken, outputToken] at footprint

theorem firing_preserves_identity (event : SourceEvent) :
    (inputToken event).identity = (outputToken event).identity :=
  rfl

theorem admission_appends_declaration :
    (ready .dynamicPartnerAdmission).declared = ∅ ∧
      (completed .dynamicPartnerAdmission).declared =
        {.dynamicPartnerAdmission} := by
  decide

theorem quiescent_delete_has_empty_marking :
    (ready .instanceDeleteQuiescent).quiescent = true ∧
      (ready .instanceDeleteQuiescent).marking = ∅ ∧
      (completed .instanceDeleteQuiescent).declared = ∅ := by
  decide

end Petri

namespace Morphism

/-- The morphism view is an independently named identity transition system. -/
inductive Step : SourceState -> SourceEvent -> SourceState -> Prop where
  | map (event : SourceEvent) :
      Step (.ready event) event (.completed event)

inductive Adequate :
    SourceEvent -> SourceState -> SourceEvent -> SourceState -> Prop where
  | map (event : SourceEvent) :
      Adequate event (.ready event) event (.completed event)

theorem changes (event : SourceEvent) :
    SourceState.ready event ≠ SourceState.completed event := by
  intro equality
  cases equality

end Morphism

def dagSemantics : NativeSemantics where
  State := DAG.State
  Label := SourceEvent
  step := DAG.Step
  adequate := DAG.Adequate

def petriSemantics : NativeSemantics where
  State := Petri.State
  Label := SourceEvent
  step := Petri.Step
  adequate := Petri.Adequate

def morphismSemantics : NativeSemantics where
  State := SourceState
  Label := SourceEvent
  step := Morphism.Step
  adequate := Morphism.Adequate

/-- All four independently defined target relations. -/
def completeTargets : ProjectionTargets where
  dag := dagSemantics
  petri := petriSemantics
  pi := piSemantics
  morphism := morphismSemantics

private def dagCell (event : SourceEvent) :
    Cell completeTargets event .dag :=
  .nativeStrong
    { sourceStep := source_event_observable event
      source := DAG.ready event
      label := event
      target := DAG.completed event
      nativeStep := DAG.Step.execute event
      adequate := DAG.Adequate.execute event
      changesState := DAG.changes event
      provenance := .dagRewrite }

private def petriCell (event : SourceEvent) :
    Cell completeTargets event .petri :=
  .nativeStrong
    { sourceStep := source_event_observable event
      source := Petri.ready event
      label := event
      target := Petri.completed event
      nativeStep := Petri.Step.fire event
      adequate := Petri.Adequate.fire event
      changesState := Petri.changes event
      provenance := .petriFiring }

private def morphismCell (event : SourceEvent) :
    Cell completeTargets event .morphism :=
  .nativeStrong
    { sourceStep := source_event_observable event
      source := .ready event
      label := event
      target := .completed event
      nativeStep := Morphism.Step.map event
      adequate := Morphism.Adequate.map event
      changesState := Morphism.changes event
      provenance := .morphismIdentity }

private def piDerivation (event : SourceEvent) :
    NativeDerivation completeTargets event .pi := by
  have derivation := piReferenceDerivation event
  exact
    { sourceStep := derivation.sourceStep
      source := derivation.source
      label := derivation.label
      target := derivation.target
      nativeStep := derivation.nativeStep
      adequate := derivation.adequate
      changesState := derivation.changesState
      provenance := derivation.provenance }

private def completePiCell (event : SourceEvent) :
    Cell completeTargets event .pi :=
  .nativeStrong (piDerivation event)

/-- The fully native 15-by-4 reference matrix. -/
def completeMatrix : RuleMatrix completeTargets where
  cell event projection :=
    match projection with
    | .dag => dagCell event
    | .petri => petriCell event
    | .pi => completePiCell event
    | .morphism => morphismCell event

/-- Every one of the sixty cells contains a direct state-changing derivation. -/
theorem p1c_rule_matrix_complete :
    RuleMatrix.Complete completeMatrix := by
  constructor
  intro event projection
  cases projection <;>
    simp [completeMatrix, dagCell, petriCell, completePiCell,
      morphismCell, Cell.Complete]

def nativeCellCount : Nat :=
  (allKeys.filter fun key =>
    (completeMatrix.cell key.1 key.2).isNative).card

theorem all_sixty_cells_native :
    nativeCellCount = 60 := by
  decide

end Cantilune.Pi.P1cCompleteMatrix
