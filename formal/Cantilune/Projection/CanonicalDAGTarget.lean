import Cantilune.Projection.P1aSemanticCertificate

/-!
# Canonical data-level DAG target

`DAGSemanticCertificate` proves that a product-labelled DAG projection uses
the selected DPO endpoints, but its target execution package could still have
the same carrier as the source package.  The central DAG conclusion must not
accept that identity carrier as the DAG representation.

This module constructs an independent target LTS.  Its states contain a
canonical finite dependency graph computed from a runtime `Config`, together
with an exactness proof.  SCC condensation and its strict rank are functions
of this stored target graph.  Its events are verified DPO records and its only
native step constructor is deterministic replay of that exact record.

`CanonicalDAGProjection` then binds this target step, the source occurrence,
and the product target occurrence to one selected candidate.  Thus the
central result exposes an actual SCC/rank target carrier even when a legacy
product projection package happened to use an identity carrier.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Projection.CanonicalDAGTarget

open Cantilune.Core
open Cantilune.Core.DPO
open Cantilune.Projection.RankableDAG
open Cantilune.Projection.SCCCondensation
open Cantilune.Projection.P1aSemanticCertificate
open Cantilune.Theorems.ProductRuleProofBundle

/-- Data-level canonical DAG state for one runtime configuration. -/
structure State (signature : FinSignature) where
  config : Config signature
  wellFormed : config.WellFormed
  graph : FiniteDirectedGraph Nat
  graphExact :
    graph = configDependencyGraph config wellFormed

/-- Canonical constructor: callers cannot choose a different graph. -/
def State.ofConfig
    {signature : FinSignature}
    (config : Config signature) (wellFormed : config.WellFormed) :
    State signature where
  config := config
  wellFormed := wellFormed
  graph := configDependencyGraph config wellFormed
  graphExact := rfl

namespace State

/-- The total SCC condensation stored by the target view. -/
noncomputable def condensation
    {signature : FinSignature} (state : State signature) :
    StrictGraph state.graph.SCC :=
  state.graph.condensation

/-- Every target condensation edge strictly increases the canonical rank. -/
theorem condensation_edge_rank_strict
    {signature : FinSignature} (state : State signature)
    {left right : state.graph.SCC}
    (edge : (left, right) ∈ state.condensation.edges) :
    state.condensation.rank left < state.condensation.rank right :=
  state.condensation.rank_strict (left, right) edge

/-- The data-level target condensation is acyclic. -/
theorem condensation_acyclic
    {signature : FinSignature} (state : State signature)
    (component : state.graph.SCC) :
    ¬ Path state.condensation component component :=
  state.graph.condensation_acyclic component

/-- The stored graph nodes are exactly the runtime nodes. -/
theorem graph_nodes_exact
    {signature : FinSignature} (state : State signature) :
    state.graph.nodes = state.config.nodes := by
  rw [state.graphExact]
  rfl

/-- The stored graph edges are exactly the runtime edges. -/
theorem graph_edges_exact
    {signature : FinSignature} (state : State signature) :
    state.graph.edges = state.config.edges := by
  rw [state.graphExact]
  rfl

end State

/--
Native transition relation of the canonical DAG target.

There is no identity/source-step constructor.  A transition can only be made
from a verified DPO record, at its recorded endpoints.
-/
inductive NativeStep
    {signature : FinSignature}
    (source : ExecutionPackage signature) :
    State signature →
      DPOEvent.Verified source.replayKernel →
      State signature → Prop
  | replay (event : DPOEvent.Verified source.replayKernel) :
      NativeStep source
        (State.ofConfig event.event.source event.event.sourceWellFormed)
        event
        (State.ofConfig event.event.target event.event.targetWellFormed)

namespace NativeStep

/--
Inversion: every native target step has exactly the verified DPO endpoints.
This rules out an identity/source transition constructor hidden in the target
relation.
-/
theorem exact_endpoints
    {signature : FinSignature}
    {source : ExecutionPackage signature}
    {before : State signature}
    {event : DPOEvent.Verified source.replayKernel}
    {after : State signature}
    (step : NativeStep source before event after) :
    before =
        State.ofConfig event.event.source event.event.sourceWellFormed ∧
      after =
        State.ofConfig event.event.target event.event.targetWellFormed := by
  cases step
  exact ⟨rfl, rfl⟩

end NativeStep

/-- Independent canonical DAG target LTS. -/
def lts
    {signature : FinSignature}
    (source : ExecutionPackage signature) : ObservableLTS where
  State := State signature
  Event := DPOEvent.Verified source.replayKernel
  stateSetoid := ObservableLTS.equalitySetoid _
  step := NativeStep source
  observable := fun _ => True
  success := fun _ => False
  waiting := fun _ => False
  signatureVersion := fun state => state.config.signatureVersion
  step_congr := by
    intro state state' event target target' stateEqual targetEqual
    subst state'
    subst target'
    rfl
  success_congr := by
    intro state target equal
    subst target
    rfl
  waiting_congr := by
    intro state target equal
    subst target
    rfl
  signatureVersion_congr := by
    intro state target equal
    subst target
    rfl

/-- One selected occurrence in the independent canonical DAG target. -/
structure CanonicalDAGProjection
    {signature : FinSignature}
    (source dag : ExecutionPackage signature)
    (projection : ProjectionCertificate source.lts dag.lts)
    (candidate : Candidate source) where
  semantic :
    DAGSemanticCertificate source dag projection candidate
  before : (lts source).State
  event : (lts source).Event
  after : (lts source).State
  beforeExact :
    before =
      State.ofConfig
        (source.eventRecord candidate.event).event.source
        (source.eventRecord candidate.event).event.sourceWellFormed
  eventExact :
    event = source.eventRecord candidate.event
  afterExact :
    after =
      State.ofConfig
        (source.eventRecord candidate.event).event.target
        (source.eventRecord candidate.event).event.targetWellFormed
  targetNative :
    (lts source).ObservableStep before event after
  sourceNative :
    source.lts.ObservableStep
      candidate.before candidate.event candidate.after
  productTargetNative :
    dag.lts.ObservableStep
      (projection.mapState candidate.before)
      (projection.mapEvent candidate.event)
      (projection.mapState candidate.after)
  productEventExact :
    (dag.eventRecord (projection.mapEvent candidate.event)).event =
      event.event
  productBeforeConfigExact :
    dag.configOf (projection.mapState candidate.before) =
      before.config
  productAfterConfigExact :
    dag.configOf (projection.mapState candidate.after) =
      after.config

namespace CanonicalDAGProjection

/-- Construct the independent target occurrence from the semantic cell. -/
def ofSemanticCertificate
    {signature : FinSignature}
    {source dag : ExecutionPackage signature}
    {projection : ProjectionCertificate source.lts dag.lts}
    {candidate : Candidate source}
    (semantic :
      DAGSemanticCertificate source dag projection candidate) :
    CanonicalDAGProjection source dag projection candidate where
  semantic := semantic
  before :=
    State.ofConfig semantic.selectedEvent.source
      semantic.selectedEvent.sourceWellFormed
  event := source.eventRecord candidate.event
  after :=
    State.ofConfig semantic.selectedEvent.target
      semantic.selectedEvent.targetWellFormed
  beforeExact := rfl
  eventExact := rfl
  afterExact := rfl
  targetNative := ⟨NativeStep.replay _, trivial⟩
  sourceNative := semantic.sourceOccurrence.native
  productTargetNative := semantic.occurrence.native
  productEventExact := semantic.dag_event_record_exact
  productBeforeConfigExact := semantic.dag_before_eq_event_source
  productAfterConfigExact := semantic.dag_after_eq_event_target

variable
    {signature : FinSignature}
    {source dag : ExecutionPackage signature}
    {projection : ProjectionCertificate source.lts dag.lts}
    {candidate : Candidate source}
    (view : CanonicalDAGProjection source dag projection candidate)

/-- The target before graph is canonical data, not a caller-selected label. -/
theorem before_graph_exact :
    view.before.graph =
      configDependencyGraph view.before.config view.before.wellFormed :=
  view.before.graphExact

/-- The target after graph is canonical data, not a caller-selected label. -/
theorem after_graph_exact :
    view.after.graph =
      configDependencyGraph view.after.config view.after.wellFormed :=
  view.after.graphExact

/-- The selected verified event is literally the source candidate's record. -/
theorem selected_verified_event_exact :
    view.event = source.eventRecord candidate.event :=
  view.eventExact

/--
The data-level target step and the product-labelled target step share the
same complete DPO event.
-/
theorem target_and_product_event_agree :
    (dag.eventRecord (projection.mapEvent candidate.event)).event =
      view.event.event :=
  view.productEventExact

/-- The before target carries a strict, acyclic SCC condensation. -/
theorem before_condensation_acyclic
    (component : view.before.graph.SCC) :
    ¬ Path view.before.condensation component component :=
  view.before.condensation_acyclic component

/-- The after target carries a strict, acyclic SCC condensation. -/
theorem after_condensation_acyclic
    (component : view.after.graph.SCC) :
    ¬ Path view.after.condensation component component :=
  view.after.condensation_acyclic component

end CanonicalDAGProjection

end Cantilune.Projection.CanonicalDAGTarget
