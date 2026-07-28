import Mathlib
import Cantilune.Core.Package

/-!
# Quiescent node-deletion reference obligation

This module connects a concrete deletion obligation to an
`ExecutionPackage`, its selected native transition, and its deterministically
verified event record.  `NodeOnlyDanglingFree` is intentionally the explicit
condition for a node-only reference deletion: no source edge may be incident
to a deleted node.  It is not a general DPO dangling-condition theorem.
-/

namespace Cantilune.Core

/--
The explicit dangling-free condition for a node-only deletion.  Every selected
node exists in the source and no source edge is incident to one of those
nodes.
-/
def NodeOnlyDanglingFree {signature : FinSignature}
    (source : Config signature) (deletedNodes : Finset Nat) : Prop :=
  deletedNodes ⊆ source.nodes ∧
    ∀ edge ∈ source.edges,
      edge.1 ∉ deletedNodes ∧ edge.2 ∉ deletedNodes

/--
A non-empty, replayable, quiescent node-deletion obligation.

The selected source transition is native and observable.  Its event is linked
to an endpoint-free replay kernel through `ExecutionPackage.eventRecord` and
`eventEndpoints`; see `verified_replay` below.  Resource and active-session
clearance are not duplicated as assumptions: they follow from the package's
`deletionPermitted` contract.
-/
structure QuiescentDeletion {signature : FinSignature}
    (package : ExecutionPackage signature) where
  source : package.lts.State
  event : package.lts.Event
  target : package.lts.State
  observableStep :
    package.lts.ObservableStep source event target
  permitted : package.deletionPermitted source
  deletedNodes : Finset Nat
  deletesSomething : deletedNodes.Nonempty
  danglingFree :
    NodeOnlyDanglingFree (package.configOf source) deletedNodes
  targetNodes :
    (package.configOf target).nodes =
      (package.configOf source).nodes \ deletedNodes
  targetEdges :
    (package.configOf target).edges =
      (package.configOf source).edges
  tombstonesRecorded :
    deletedNodes ⊆ (package.configOf target).tombstones

namespace QuiescentDeletion

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}

/--
The package's verified event record recomputes the claimed deletion endpoint
from its endpoint-free recipe and source configuration.
-/
theorem verified_replay (deletion : QuiescentDeletion package) :
    (package.eventRecord deletion.event).Replays
      (package.configOf deletion.source)
      (package.configOf deletion.target) :=
  package.eventEndpoints deletion.observableStep

/--
Every permitted reference deletion is resource-safe, session-quiescent,
explicitly dangling-free, and permanently represented by target tombstones.
-/
theorem permitted_deletion_safe
    (deletion : QuiescentDeletion package) :
    package.resourcesClear deletion.source ∧
      package.sessionsQuiescent deletion.source ∧
      NodeOnlyDanglingFree
        (package.configOf deletion.source) deletion.deletedNodes ∧
      deletion.deletedNodes ⊆
        (package.configOf deletion.target).tombstones := by
  exact
    ⟨package.deletion_resource_safe deletion.permitted,
      package.deletion_session_safe deletion.permitted,
      deletion.danglingFree,
      deletion.tombstonesRecorded⟩

end QuiescentDeletion

end Cantilune.Core
