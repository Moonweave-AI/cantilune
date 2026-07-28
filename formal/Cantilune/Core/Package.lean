import Mathlib
import Cantilune.Core.Execution

/-!
# Execution packages and finite epochs

An `ExecutionPackage` makes the policy and resource assumptions used by an
execution theorem explicit.  In particular, terminal observations are not
inferred from a category and a set of rule names alone.
-/

namespace Cantilune.Core

/--
A ranking certificate for the events classified as internal to an epoch.
External and administrative events are deliberately outside the strict
decrease obligation.
-/
structure InternalRanking (lts : ObservableLTS) where
  internal : lts.Event → Prop
  rank : lts.State → Nat
  epoch : lts.State → Nat
  decreases :
    ∀ {source event target},
      lts.ObservableStep source event target →
      internal event →
      rank target < rank source
  epoch_preserved :
    ∀ {source event target},
      lts.ObservableStep source event target →
      internal event →
      epoch target = epoch source

namespace InternalRanking

/--
Every finite path consisting exclusively of internal events is bounded by the
initial natural-number rank.  This is the kernel-level finite-epoch theorem;
it does not claim that the environment eventually supplies another event.
-/
theorem internal_path_length_le
    {lts : ObservableLTS} (ranking : InternalRanking lts)
    {source target : lts.State} {events : List lts.Event}
    (path : lts.Path source events target)
    (allInternal : events.Forall ranking.internal) :
    events.length ≤ ranking.rank source := by
  induction path with
  | nil state =>
      simp
  | @cons source middle target event rest step path ih =>
      rcases (List.forall_cons ranking.internal event rest).mp allInternal with
        ⟨eventInternal, restInternal⟩
      have decreases := ranking.decreases step eventInternal
      have tailBound := ih restInternal
      simp only [List.length_cons]
      omega

/-- Internal paths never cross an epoch boundary. -/
theorem internal_path_epoch_preserved
    {lts : ObservableLTS} (ranking : InternalRanking lts)
    {source target : lts.State} {events : List lts.Event}
    (path : lts.Path source events target)
    (allInternal : events.Forall ranking.internal) :
    ranking.epoch target = ranking.epoch source := by
  induction path with
  | nil state =>
      rfl
  | @cons source middle target event rest step path ih =>
      rcases (List.forall_cons ranking.internal event rest).mp allInternal with
        ⟨eventInternal, restInternal⟩
      exact
        (ih restInternal).trans
          (ranking.epoch_preserved step eventInternal)

end InternalRanking

/--
The complete executable data needed by the generic epoch theorems.  Resource
and session quiescence are separate predicates because deleting a graph
instance is legal only when both have been established.
-/
structure ExecutionPackage (signature : FinSignature) where
  lts : ObservableLTS
  configOf : lts.State → Config signature
  replayKernel : DPOEvent.ReplayKernel signature
  eventRecord : lts.Event → DPOEvent.Verified replayKernel
  eventEndpoints :
    ∀ {source event target},
      lts.ObservableStep source event target →
      (eventRecord event).Replays (configOf source) (configOf target)
  stateVersion :
    ∀ state,
      (configOf state).signatureVersion = lts.signatureVersion state
  resourcesClear : lts.State → Prop
  sessionsQuiescent : lts.State → Prop
  deletionPermitted : lts.State → Prop
  deletion_requires_resources :
    ∀ state, deletionPermitted state → resourcesClear state
  deletion_requires_quiescence :
    ∀ state, deletionPermitted state → sessionsQuiescent state
  ranking : InternalRanking lts

namespace ExecutionPackage

/-- Complete recorded events replay to only one target configuration. -/
theorem replay_target_unique {signature : FinSignature}
    (package : ExecutionPackage signature)
    {source : package.lts.State}
    {event : package.lts.Event}
    {left right : package.lts.State}
    (leftStep : package.lts.ObservableStep source event left)
    (rightStep : package.lts.ObservableStep source event right) :
    package.configOf left = package.configOf right := by
  exact
    DPOEvent.event_replay_unique
      (package.eventEndpoints leftStep)
      (package.eventEndpoints rightStep)

/-- A permitted deletion cannot silently discard a live resource. -/
theorem deletion_resource_safe {signature : FinSignature}
    (package : ExecutionPackage signature) {state : package.lts.State}
    (permitted : package.deletionPermitted state) :
    package.resourcesClear state :=
  package.deletion_requires_resources state permitted

/-- A permitted deletion cannot tear down an active session. -/
theorem deletion_session_safe {signature : FinSignature}
    (package : ExecutionPackage signature) {state : package.lts.State}
    (permitted : package.deletionPermitted state) :
    package.sessionsQuiescent state :=
  package.deletion_requires_quiescence state permitted

end ExecutionPackage

end Cantilune.Core
