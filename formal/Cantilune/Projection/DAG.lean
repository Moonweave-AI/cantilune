import Mathlib
import Cantilune.Core.Projection
import Cantilune.Projection.Reference

/-!
# Strict finite DAG projection

Edges carry an explicit rank proof.  The only reconfiguration represented here
is the finite reference installation of one worker; no general DPO or adhesive
result is claimed.
-/

namespace Cantilune.Projection.DAG

open Cantilune.Core

inductive Vertex where
  | input
  | worker
  | output
  deriving DecidableEq, Repr, Fintype

def rank : Vertex → Nat
  | .input => 0
  | .worker => 1
  | .output => 2

/-- A finite directed graph whose every edge strictly increases rank. -/
structure StrictGraph where
  nodes : Finset Vertex
  edges : Finset (Vertex × Vertex)
  endpoints :
    ∀ edge ∈ edges, edge.1 ∈ nodes ∧ edge.2 ∈ nodes
  rank_strict :
    ∀ edge ∈ edges, rank edge.1 < rank edge.2

/-- A non-empty directed path in a strict graph. -/
inductive Path (graph : StrictGraph) : Vertex → Vertex → Prop where
  | single {source target : Vertex}
      (edge : (source, target) ∈ graph.edges) :
      Path graph source target
  | snoc {source middle target : Vertex}
      (initialPath : Path graph source middle)
      (edge : (middle, target) ∈ graph.edges) :
      Path graph source target

namespace Path

theorem rank_lt {graph : StrictGraph} {source target : Vertex}
    (path : Path graph source target) :
    rank source < rank target := by
  induction path with
  | single edge =>
      exact graph.rank_strict _ edge
  | snoc initialPath edge ih =>
      exact lt_trans ih (graph.rank_strict _ edge)

end Path

/-- Strict rank increase excludes every non-empty directed cycle. -/
theorem StrictGraph.acyclic (graph : StrictGraph) (vertex : Vertex) :
    ¬Path graph vertex vertex := by
  intro cycle
  exact (Nat.lt_irrefl _ cycle.rank_lt)

def baseGraph : StrictGraph where
  nodes := {.input, .output}
  edges := ∅
  endpoints := by simp
  rank_strict := by simp

def workerGraph : StrictGraph where
  nodes := {.input, .worker, .output}
  edges := {(.input, .worker), (.worker, .output)}
  endpoints := by
    intro edge membership
    simp only [Finset.mem_insert, Finset.mem_singleton] at membership
    rcases membership with rfl | rfl <;> simp
  rank_strict := by
    intro edge membership
    simp only [Finset.mem_insert, Finset.mem_singleton] at membership
    rcases membership with rfl | rfl <;> decide

structure State where
  graph : StrictGraph
  completed : Finset Vertex
  version : Nat

def emptyState : State :=
  ⟨baseGraph, ∅, 0⟩

def installedState : State :=
  ⟨workerGraph, ∅, 1⟩

def finishedState : State :=
  ⟨workerGraph, {.worker}, 1⟩

inductive Event where
  | addWorker
  | runWorker
  deriving DecidableEq, Repr, Fintype

/-- Native DAG transitions, specified independently of the source LTS. -/
inductive Step : State → Event → State → Prop where
  | addWorker : Step emptyState .addWorker installedState
  | runWorker : Step installedState .runWorker finishedState

theorem step_characterization {source : State} {event : Event}
    {target : State} (step : Step source event target) :
    (source = emptyState ∧ event = .addWorker ∧
      target = installedState) ∨
    (source = installedState ∧ event = .runWorker ∧
      target = finishedState) := by
  cases step with
  | addWorker => exact Or.inl ⟨rfl, rfl, rfl⟩
  | runWorker => exact Or.inr ⟨rfl, rfl, rfl⟩

def success (state : State) : Prop :=
  state = finishedState

def waiting (_ : State) : Prop := False

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := waiting
  signatureVersion := State.version
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

def mapState : Reference.State → State
  | .empty => emptyState
  | .installed => installedState
  | .finished => finishedState

private def phase (state : State) : Nat :=
  if Vertex.worker ∈ state.completed then 2 else state.version

theorem mapState_injective : Function.Injective mapState := by
  intro left right equality
  have phaseEquality := congrArg phase equality
  cases left <;> cases right <;>
    simp [phase, mapState, emptyState, installedState, finishedState] at phaseEquality ⊢

def mapEvent : Reference.Event → Event
  | .install => .addWorker
  | .execute => .runWorker

def Lift (source : Reference.Event) (target : Event) : Prop :=
  target = mapEvent source

/--
The strict DAG is a complete native one-step projection of the reference
execution.  Reflection ranges over the independently defined `DAG.Step`.
-/
def certificate : ProjectionCertificate Reference.lts lts where
  mapState := mapState
  mapEvent := mapEvent
  Lift := Lift
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target h
    subst target
    rfl
  sound := by
    intro source event target transition
    rcases transition with ⟨step, _⟩
    cases step with
    | install => exact ⟨Step.addWorker, trivial⟩
    | execute => exact ⟨Step.runWorker, trivial⟩
  reflect := by
    intro source targetEvent target transition
    rcases transition with ⟨step, _⟩
    rcases step_characterization step with
      ⟨sourceShape, eventShape, targetShape⟩ |
      ⟨sourceShape, eventShape, targetShape⟩
    · have sourceEq : source = .empty :=
        mapState_injective (by simpa [mapState] using sourceShape)
      subst source
      subst targetEvent
      exact
        ⟨.install, .installed, Reference.install_observable, rfl,
          by
            change target = installedState
            exact targetShape⟩
    · have sourceEq : source = .installed :=
        mapState_injective (by simpa [mapState] using sourceShape)
      subst source
      subst targetEvent
      exact
        ⟨.execute, .finished, Reference.execute_observable, rfl,
          by
            change target = finishedState
            exact targetShape⟩
  success_iff := by
    intro state
    cases state <;> simp [lts, mapState, success, Reference.lts,
      Reference.success, finishedState, installedState, emptyState]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    cases state <;> rfl

/--
The central finite-reference DAG certificate.

This value is a `ProjectionCertificate`, rather than a proposition asserting
that some unspecified certificate exists.  Its scope is exactly the native
two-event reference execution above; it does not state a general DPO result.
-/
def dag_certificate : ProjectionCertificate Reference.lts lts :=
  certificate

theorem workerGraph_is_strict :
    ∀ edge ∈ workerGraph.edges, rank edge.1 < rank edge.2 :=
  workerGraph.rank_strict

theorem workerGraph_acyclic (vertex : Vertex) :
    ¬Path workerGraph vertex vertex :=
  workerGraph.acyclic vertex

theorem install_adds_worker :
    Vertex.worker ∉ emptyState.graph.nodes ∧
      Vertex.worker ∈ installedState.graph.nodes := by
  decide

theorem install_native :
    lts.ObservableStep emptyState .addWorker installedState :=
  dag_certificate.sound Reference.install_observable

theorem execute_native :
    lts.ObservableStep installedState .runWorker finishedState :=
  dag_certificate.sound Reference.execute_observable

theorem terminal_certificate (state : Reference.State) :
    (lts.SuccessfulTermination (mapState state) ↔
      Reference.lts.SuccessfulTermination state) ∧
    (lts.ExternalWait (mapState state) ↔
      Reference.lts.ExternalWait state) ∧
    (lts.Deadlocked (mapState state) ↔
      Reference.lts.Deadlocked state) :=
  dag_certificate.terminal_classification_preserved state

end Cantilune.Projection.DAG
