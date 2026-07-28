import Mathlib
import Cantilune.Core.Package
import Cantilune.Feedback.Core
import Cantilune.Feedback.Voting

/-!
# Execution/feedback bridge and external productivity

The first section connects a concrete execution package to deterministic
feedback replay.  The finite-epoch ranking then has a useful global
consequence: an infinite execution cannot eventually consist only of internal
steps.  Thus continued infinite operation must expose non-internal
opportunities infinitely often; it is not an unobservable internal
oscillation.

This module does not assume that an environment supplies those opportunities.
It classifies an already supplied infinite execution.
-/

namespace Cantilune.Feedback

open Cantilune.Core

/--
A deterministic bridge from one concrete execution package to one configured
feedback system.

The state and event maps are data.  `step_commutes` is the non-vacuous
operational obligation: every selected native source step must be interpreted
by exactly one `applyEvent` step.  This structure deliberately contains no
probability kernel and makes no fairness or convergence claim.
-/
structure ExecutionFeedbackBridge
    (signature : FinSignature)
    (Observer Subject : Type) (height : Nat) (Payload : Type)
    [Fintype Observer] [DecidableEq Observer] where
  package : ExecutionPackage signature
  feedbackSystem : FeedbackSystem Observer Subject height
  stateMap : package.lts.State → FeedbackState height
  eventMap : package.lts.Event → FeedbackEvent height Payload
  step_commutes :
    ∀ {source event target},
      package.lts.ObservableStep source event target →
      stateMap target = applyEvent (stateMap source) (eventMap event)

namespace ExecutionFeedbackBridge

variable
    {signature : FinSignature}
    {Observer Subject : Type} {height : Nat} {Payload : Type}
    [Fintype Observer] [DecidableEq Observer]

/-- Map a complete finite source event record to its feedback event record. -/
def mapEvents
    (bridge :
      ExecutionFeedbackBridge signature Observer Subject height Payload) :
    List bridge.package.lts.Event → List (FeedbackEvent height Payload) :=
  List.map bridge.eventMap

/--
Finite source paths replay exactly as finite `applyEvents` executions.  This
is an equality of mapped endpoint states, not merely a reachability claim.
-/
theorem path_replay
    (bridge :
      ExecutionFeedbackBridge signature Observer Subject height Payload)
    {source target : bridge.package.lts.State}
    {events : List bridge.package.lts.Event}
    (path : bridge.package.lts.Path source events target) :
    applyEvents (bridge.stateMap source) (bridge.mapEvents events) =
      bridge.stateMap target := by
  induction path with
  | nil state =>
      rfl
  | @cons source middle target event events step path ih =>
      simp only [mapEvents, List.map_cons, applyEvents]
      rw [← bridge.step_commutes step]
      exact ih

/--
Any threshold-stable initial feedback state remains stable at the mapped end
of a finite source path.
-/
theorem path_preserves_stable
    (bridge :
      ExecutionFeedbackBridge signature Observer Subject height Payload)
    {source target : bridge.package.lts.State}
    {events : List bridge.package.lts.Event}
    {threshold : Nat}
    (path : bridge.package.lts.Path source events target)
    (stable :
      (bridge.stateMap source).evidence.StableRegion threshold) :
    (bridge.stateMap target).evidence.StableRegion threshold := by
  have replayStable :
      (applyEvents
        (bridge.stateMap source)
        (bridge.mapEvents events)).evidence.StableRegion threshold :=
    feedback_state_stable_set
      (bridge.stateMap source) (bridge.mapEvents events) stable
  rw [bridge.path_replay path] at replayStable
  exact replayStable

end ExecutionFeedbackBridge

/-- A fully witnessed infinite sequence of native observable steps. -/
structure InfiniteExecution (lts : ObservableLTS) where
  state : Nat → lts.State
  event : Nat → lts.Event
  step :
    ∀ n, lts.ObservableStep (state n) (event n) (state (n + 1))

/--
Every suffix of the trace contains a non-internal step.  This is the
qualitative productivity property used to distinguish ongoing observation
from internal divergence.
-/
def ExternallyProductive {lts : ObservableLTS}
    (ranking : InternalRanking lts)
    (trace : InfiniteExecution lts) : Prop :=
  ∀ start, ∃ offset,
    ¬ranking.internal (trace.event (start + offset))

/-- There is no infinite native execution made exclusively of internal steps. -/
theorem no_infinite_internal_oscillation
    {lts : ObservableLTS}
    (ranking : InternalRanking lts)
    (trace : InfiniteExecution lts)
    (allInternal : ∀ n, ranking.internal (trace.event n)) :
    False := by
  have descending :
      StrictAnti (fun n => ranking.rank (trace.state n)) :=
    strictAnti_nat_of_succ_lt fun n =>
      ranking.decreases (trace.step n) (allInternal n)
  exact (not_strictAnti_of_wellFoundedLT _ descending)

/--
An infinite ranked execution necessarily contains non-internal steps
arbitrarily far into the trace.
-/
theorem infinite_execution_productive
    {lts : ObservableLTS}
    (ranking : InternalRanking lts)
    (trace : InfiniteExecution lts) :
    ExternallyProductive ranking trace := by
  intro start
  by_contra noExternal
  simp only [not_exists, not_not] at noExternal
  let suffix : InfiniteExecution lts :=
    { state := fun n => trace.state (start + n)
      event := fun n => trace.event (start + n)
      step := by
        intro n
        simpa [Nat.add_assoc] using trace.step (start + n) }
  exact no_infinite_internal_oscillation ranking suffix noExternal

end Cantilune.Feedback
