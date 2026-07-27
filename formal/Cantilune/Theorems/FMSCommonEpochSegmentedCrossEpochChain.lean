import Cantilune.Theorems.FMSCommonSegmentedCrossEpochChain

/-!
# Epoch-indexed nonduplicating common-FMS paths

`ExactFMSSegmentPath` proves that nonempty FMS segments can be composed
without duplicating an overlapping terminal segment.  This module connects
that representation to the actual dependent `EpochChain` and
`FiniteCrossEpochProductChain` indices.

The constructors are intentionally exact:

* `single` contains the native FMS path and positional interpretation for all
  events of one replay epoch;
* `cons` contains the same evidence for the first epoch, one distinguished
  admission action with one native FMS transition, and the recursively
  indexed tail.

Consequently the flattened action list is positionally related to
`traceEvents` by construction.  Endpoint append discards the left terminal
epoch segment and retains the right initial segment at the same denotational
entry.  It does not filter actions and it does not use a weak transition.
-/

noncomputable section

namespace Cantilune.Theorems

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Pi
open Cantilune.Pi.FMSExactAcceptance

universe u v w

private theorem mapLeftPositions
    {α : Type u} {β : Type v} {γ : Type w}
    (f : α → β) (embed : α → γ) (g : γ → β)
    {xs : List α} {ys : List β}
    (positions : List.Forall₂ (fun x y => f x = y) xs ys)
    (compatibility : ∀ x, g (embed x) = f x) :
    List.Forall₂ (fun z y => g z = y) (xs.map embed) ys := by
  induction positions with
  | nil =>
      exact .nil
  | cons relation tail ih =>
      exact .cons ((compatibility _).trans relation) ih

/-! ## A path indexed by the real heterogeneous epoch chain -/

/--
An exact common-FMS path segmented by the dependent heterogeneous epoch
chain.

The two denotational state indices are exact.  In the `cons` constructor the
event segment ends at `afterEvents`, the native admission action ends at
`afterAdmission`, and the recursive tail starts at that exact same state.
-/
inductive EpochIndexedExactFMSPath
    (universes : ProjectionUniverses)
    (fms : ExactFMSAcceptancePackage) :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) →
      fms.base.domain.agent.obj 0 →
      fms.base.domain.agent.obj 0 →
      Type 2
  | single
      {epoch : SomeReplayEpoch}
      {source target : fms.base.domain.agent.obj 0}
      (eventAction : epoch.package.lts.Event → Raw.Action)
      (eventActions : List Raw.Action)
      (positions :
        List.Forall₂
          (fun event action => eventAction event = action)
          epoch.epoch.events eventActions)
      (native :
        ExactFMSNativePath fms source eventActions target) :
      EpochIndexedExactFMSPath universes fms
        (.single epoch) source target
  | cons
      {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      {source afterEvents afterAdmission target :
        fms.base.domain.agent.obj 0}
      (eventAction : first.package.lts.Event → Raw.Action)
      (eventActions : List Raw.Action)
      (positions :
        List.Forall₂
          (fun event action => eventAction event = action)
          first.epoch.events eventActions)
      (eventNative :
        ExactFMSNativePath fms source eventActions afterEvents)
      (admissionAction : Raw.Action)
      (admissionNative :
        fms.base.lateFullAbstraction.transition
          afterEvents admissionAction afterAdmission)
      (rest :
        EpochIndexedExactFMSPath universes fms
          tail afterAdmission target) :
      EpochIndexedExactFMSPath universes fms
        (.cons boundary tail) source target

namespace EpochIndexedExactFMSPath

variable
    {universes : ProjectionUniverses}
    {fms : ExactFMSAcceptancePackage}

/-- Interpret every exact dependent source mark as its stored FMS action. -/
def sourceAction
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    ChainEvent universes chain → Raw.Action :=
  match path with
  | .single eventAction _ _ _ =>
      fun
      | .single event => eventAction event
  | .cons eventAction _ _ _ admissionAction _ rest =>
      fun
      | .head event => eventAction event
      | .admission => admissionAction
      | .tail event => rest.sourceAction event

/-- Flatten the event segments and admission actions in trace order. -/
def actions
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    List Raw.Action :=
  match path with
  | .single _ eventActions _ _ =>
      eventActions
  | .cons _ eventActions _ _ admissionAction _ rest =>
      eventActions ++ admissionAction :: rest.actions

/-- Denotational state at entry to the terminal epoch segment. -/
def lastEntry
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    fms.base.domain.agent.obj 0 :=
  match path with
  | .single _ _ _ _ =>
      source
  | .cons _ _ _ _ _ _ rest =>
      rest.lastEntry

/-- Flatten all actions strictly before the terminal epoch segment. -/
def prefixActions
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    List Raw.Action :=
  match path with
  | .single _ _ _ _ =>
      []
  | .cons _ eventActions _ _ admissionAction _ rest =>
      eventActions ++ admissionAction :: rest.prefixActions

/-- Flattening yields one exact native path in the common FMS package. -/
def native
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    ExactFMSNativePath fms source path.actions target :=
  match path with
  | .single _ _ _ segmentNative =>
      segmentNative
  | .cons _ _ _ eventNative _ admissionNative rest =>
      ExactFMSNativePath.append eventNative
        (.cons admissionNative rest.native)

/--
The half-open prefix is an exact native path to the entry of the terminal
epoch segment.
-/
def prefixNative
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    ExactFMSNativePath fms source path.prefixActions path.lastEntry :=
  match path with
  | .single _ _ _ _ =>
      .nil source
  | .cons _ _ _ eventNative _ admissionNative rest =>
      ExactFMSNativePath.append eventNative
        (.cons admissionNative rest.prefixNative)

/--
Forget only the dependent epoch labels, retaining the exact nonempty segment
path from `FMSCommonSegmentedCrossEpochChain`.

For a nonterminal epoch, its fixed-signature actions and following admission
action form one segment.  The terminal epoch remains the final segment.
-/
def toSegmentPath
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    ExactFMSSegmentPath fms source target :=
  match path with
  | .single _ eventActions _ segmentNative =>
      .single eventActions segmentNative
  | .cons _ eventActions _ eventNative admissionAction
      admissionNative rest =>
      .cons
        (eventActions ++ [admissionAction])
        (ExactFMSNativePath.append eventNative
          (.cons admissionNative (.nil _)))
        rest.toSegmentPath

/-- Forgetting dependency preserves the complete flattened action list. -/
theorem toSegmentPath_actions
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    path.toSegmentPath.actions = path.actions := by
  induction path with
  | single eventAction eventActions positions segmentNative =>
      rfl
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      simp only [toSegmentPath, ExactFMSSegmentPath.actions, actions]
      rw [ih, List.append_assoc]
      rfl

/-- Forgetting dependency preserves the half-open action prefix. -/
theorem toSegmentPath_prefixActions
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    path.toSegmentPath.prefixActions = path.prefixActions := by
  induction path with
  | single eventAction eventActions positions segmentNative =>
      rfl
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      simp only [toSegmentPath, ExactFMSSegmentPath.prefixActions,
        prefixActions]
      rw [ih, List.append_assoc]
      rfl

/-- Forgetting dependency preserves the terminal-segment entry state. -/
theorem toSegmentPath_lastEntry
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    path.toSegmentPath.lastEntry = path.lastEntry := by
  induction path with
  | single eventAction eventActions positions segmentNative =>
      rfl
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      exact ih

/--
Every flattened action has exactly the same position as its dependent source
event or admission mark.
-/
theorem flatten_positions
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    List.Forall₂
      (fun sourceEvent action =>
        path.sourceAction sourceEvent = action)
      (traceEvents chain) path.actions := by
  induction path with
  | @single epoch source target eventAction eventActions
      positions native =>
      exact
        mapLeftPositions eventAction ChainEvent.single
          (sourceAction
            (.single eventAction eventActions positions native))
          positions (fun _ => rfl)
  | @cons first middle last boundary tail source afterEvents
      afterAdmission target eventAction eventActions positions
      eventNative admissionAction admissionNative rest ih =>
      let whole :
          EpochIndexedExactFMSPath universes fms
            (.cons boundary tail) source target :=
        .cons eventAction eventActions positions eventNative
          admissionAction admissionNative rest
      have headPositions :
          List.Forall₂
            (fun sourceEvent action =>
              whole.sourceAction sourceEvent = action)
            (first.epoch.events.map
              (fun event =>
                ChainEvent.head
                  (boundary := boundary) (tail := tail) event))
            eventActions :=
        mapLeftPositions eventAction
          (fun event =>
            ChainEvent.head
              (boundary := boundary) (tail := tail) event)
          whole.sourceAction positions
          (fun _ => by simp only [whole, sourceAction])
      have tailPositions :
          List.Forall₂
            (fun sourceEvent action =>
              whole.sourceAction sourceEvent = action)
            ((traceEvents tail).map
              (fun event =>
                ChainEvent.tail
                  (boundary := boundary) event))
            rest.actions :=
        mapLeftPositions rest.sourceAction
          (fun event =>
            ChainEvent.tail
              (boundary := boundary) event)
          whole.sourceAction ih
          (fun _ => by simp only [whole, sourceAction])
      change
        List.Forall₂
          (fun sourceEvent action =>
            whole.sourceAction sourceEvent = action)
          (first.epoch.events.map
              (fun event =>
                ChainEvent.head
                  (boundary := boundary) (tail := tail) event) ++
            ChainEvent.admission ::
              (traceEvents tail).map
                (fun event =>
                  ChainEvent.tail
                    (boundary := boundary) event))
          (eventActions ++ admissionAction :: rest.actions)
      exact List.rel_append headPositions (.cons rfl tailPositions)

/-- Flattened action count equals the exact dependent trace-event count. -/
theorem actions_length
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (path :
      EpochIndexedExactFMSPath universes fms chain source target) :
    path.actions.length = (traceEvents chain).length :=
  path.flatten_positions.length_eq.symm

/-! ## Nonduplicating endpoint append -/

/-- Transport only the denotational source index of a segmented path. -/
def rebaseSource
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {oldSource newSource target : fms.base.domain.agent.obj 0}
    (sourceEquality : newSource = oldSource)
    (path :
      EpochIndexedExactFMSPath universes fms
        chain oldSource target) :
    EpochIndexedExactFMSPath universes fms
      chain newSource target := by
  cases sourceEquality
  exact path

@[simp]
theorem actions_rebaseSource
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {oldSource newSource target : fms.base.domain.agent.obj 0}
    (sourceEquality : newSource = oldSource)
    (path :
      EpochIndexedExactFMSPath universes fms
        chain oldSource target) :
    (rebaseSource sourceEquality path).actions = path.actions := by
  cases sourceEquality
  rfl

@[simp]
theorem prefixActions_rebaseSource
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {oldSource newSource target : fms.base.domain.agent.obj 0}
    (sourceEquality : newSource = oldSource)
    (path :
      EpochIndexedExactFMSPath universes fms
        chain oldSource target) :
    (rebaseSource sourceEquality path).prefixActions =
      path.prefixActions := by
  cases sourceEquality
  rfl

@[simp]
theorem lastEntry_rebaseSource
    {first last : SomeReplayEpoch}
    {chain : EpochChain universes first last}
    {oldSource newSource target : fms.base.domain.agent.obj 0}
    (sourceEquality : newSource = oldSource)
    (path :
      EpochIndexedExactFMSPath universes fms
        chain oldSource target) :
    (rebaseSource sourceEquality path).lastEntry =
      path.lastEntry := by
  cases sourceEquality
  rfl

/--
Core endpoint append with a definitionally shared terminal entry.

Separating this operation from `rebaseSource` makes its constructor equations
free of equality transports.
-/
def endpointAppendExact
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain head.lastEntry tailTarget) :
    EpochIndexedExactFMSPath universes fms
      (EpochChain.endpointAppend headChain tailChain)
      source tailTarget := by
  induction head with
  | single eventAction eventActions positions native =>
      exact tail
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      exact
        .cons eventAction eventActions positions eventNative
          admissionAction admissionNative (ih tail)

/--
Append at a shared terminal/initial epoch entry.

The terminal epoch segment of `head` is discarded; `tail` supplies that
shared epoch exactly once.  The seam is equality of the denotational entry,
not equality of the completed left path target.
-/
def endpointAppend
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    EpochIndexedExactFMSPath universes fms
      (EpochChain.endpointAppend headChain tailChain)
      source tailTarget :=
  endpointAppendExact head (rebaseSource seam tail)

@[simp]
theorem endpointAppendExact_cons
    {first middle last final : SomeReplayEpoch}
    {boundary : AdjacentAdmission universes first middle}
    {restChain : EpochChain universes middle last}
    {tailChain : EpochChain universes last final}
    {source afterEvents afterAdmission headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (eventAction : first.package.lts.Event → Raw.Action)
    (eventActions : List Raw.Action)
    (positions :
      List.Forall₂
        (fun event action => eventAction event = action)
        first.epoch.events eventActions)
    (eventNative :
      ExactFMSNativePath fms source eventActions afterEvents)
    (admissionAction : Raw.Action)
    (admissionNative :
      fms.base.lateFullAbstraction.transition
        afterEvents admissionAction afterAdmission)
    (rest :
      EpochIndexedExactFMSPath universes fms
        restChain afterAdmission headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain rest.lastEntry tailTarget) :
    endpointAppendExact
      (headChain := .cons boundary restChain)
      (tailChain := tailChain)
      (.cons (boundary := boundary)
        eventAction eventActions positions eventNative
        admissionAction admissionNative rest)
      tail =
        .cons (boundary := boundary)
          eventAction eventActions positions eventNative
          admissionAction admissionNative
          (endpointAppendExact rest tail) :=
  rfl

@[simp]
theorem endpointAppendExact_single
    {middle last : SomeReplayEpoch}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (eventAction : middle.package.lts.Event → Raw.Action)
    (eventActions : List Raw.Action)
    (positions :
      List.Forall₂
        (fun event action => eventAction event = action)
        middle.epoch.events eventActions)
    (native :
      ExactFMSNativePath fms source eventActions headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain source tailTarget) :
    endpointAppendExact
      (.single eventAction eventActions positions native)
      tail = tail :=
  rfl

/-- Exact append retains the right terminal-segment entry. -/
theorem lastEntry_endpointAppendExact
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain head.lastEntry tailTarget) :
    (endpointAppendExact head tail).lastEntry = tail.lastEntry := by
  induction head generalizing tailTarget with
  | single eventAction eventActions positions native =>
      rfl
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      exact ih tail

/-- Exact half-open prefixes concatenate without a shared epoch segment. -/
theorem prefixActions_endpointAppendExact
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain head.lastEntry tailTarget) :
    (endpointAppendExact head tail).prefixActions =
      head.prefixActions ++ tail.prefixActions := by
  induction head generalizing tailTarget with
  | single eventAction eventActions positions native =>
      rfl
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      rw [endpointAppendExact_cons]
      simp only [prefixActions]
      rw [ih tail]
      simp only [List.append_assoc, List.cons_append]
      rfl

/--
Exact full append is the left half-open prefix plus the complete right path.
-/
theorem actions_endpointAppendExact
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain head.lastEntry tailTarget) :
    (endpointAppendExact head tail).actions =
      head.prefixActions ++ tail.actions := by
  induction head generalizing tailTarget with
  | single eventAction eventActions positions native =>
      rfl
  | cons eventAction eventActions positions eventNative
      admissionAction admissionNative rest ih =>
      rw [endpointAppendExact_cons]
      simp only [actions, prefixActions]
      rw [ih tail]
      simp only [List.append_assoc, List.cons_append]
      rfl

/-- Endpoint append retains the right terminal-segment entry. -/
theorem lastEntry_endpointAppend
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    (endpointAppend head tail seam).lastEntry = tail.lastEntry := by
  rw [endpointAppend, lastEntry_endpointAppendExact,
    lastEntry_rebaseSource]

/-- Half-open prefixes concatenate and contain no shared epoch segment. -/
theorem prefixActions_endpointAppend
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    (endpointAppend head tail seam).prefixActions =
      head.prefixActions ++ tail.prefixActions := by
  rw [endpointAppend, prefixActions_endpointAppendExact,
    prefixActions_rebaseSource]

/--
Full append is exactly the left half-open prefix followed by the complete
right path.
-/
theorem actions_endpointAppend
    {first middle last : SomeReplayEpoch}
    {headChain : EpochChain universes first middle}
    {tailChain : EpochChain universes middle last}
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head :
      EpochIndexedExactFMSPath universes fms
        headChain source headTarget)
    (tail :
      EpochIndexedExactFMSPath universes fms
        tailChain tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    (endpointAppend head tail seam).actions =
      head.prefixActions ++ tail.actions := by
  rw [endpointAppend, actions_endpointAppendExact,
    actions_rebaseSource]

/-- Three endpoint appends are associative at their exact flattened actions. -/
theorem endpointAppend_actions_assoc
    {first second third last : SomeReplayEpoch}
    {firstChain : EpochChain universes first second}
    {secondChain : EpochChain universes second third}
    {thirdChain : EpochChain universes third last}
    {source firstTarget secondSource secondTarget thirdSource thirdTarget :
      fms.base.domain.agent.obj 0}
    (firstPath :
      EpochIndexedExactFMSPath universes fms
        firstChain source firstTarget)
    (secondPath :
      EpochIndexedExactFMSPath universes fms
        secondChain secondSource secondTarget)
    (thirdPath :
      EpochIndexedExactFMSPath universes fms
        thirdChain thirdSource thirdTarget)
    (firstSeam : firstPath.lastEntry = secondSource)
    (secondSeam : secondPath.lastEntry = thirdSource) :
    (endpointAppend
        (endpointAppend firstPath secondPath firstSeam)
        thirdPath
        ((lastEntry_endpointAppend firstPath secondPath firstSeam).trans
          secondSeam)).actions =
      (endpointAppend firstPath
        (endpointAppend secondPath thirdPath secondSeam)
        firstSeam).actions := by
  rw [actions_endpointAppend, prefixActions_endpointAppend,
    actions_endpointAppend, actions_endpointAppend]
  exact List.append_assoc _ _ _

/-- Transport only the dependent epoch-chain index. -/
def reindex
    {first last : SomeReplayEpoch}
    {left right : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (indexEquality : left = right)
    (path :
      EpochIndexedExactFMSPath universes fms left source target) :
    EpochIndexedExactFMSPath universes fms right source target :=
  indexEquality ▸ path

@[simp]
theorem actions_reindex
    {first last : SomeReplayEpoch}
    {left right : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (indexEquality : left = right)
    (path :
      EpochIndexedExactFMSPath universes fms left source target) :
    (reindex indexEquality path).actions = path.actions := by
  cases indexEquality
  rfl

@[simp]
theorem prefixActions_reindex
    {first last : SomeReplayEpoch}
    {left right : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (indexEquality : left = right)
    (path :
      EpochIndexedExactFMSPath universes fms left source target) :
    (reindex indexEquality path).prefixActions = path.prefixActions := by
  cases indexEquality
  rfl

@[simp]
theorem lastEntry_reindex
    {first last : SomeReplayEpoch}
    {left right : EpochChain universes first last}
    {source target : fms.base.domain.agent.obj 0}
    (indexEquality : left = right)
    (path :
      EpochIndexedExactFMSPath universes fms left source target) :
    (reindex indexEquality path).lastEntry = path.lastEntry := by
  cases indexEquality
  rfl

end EpochIndexedExactFMSPath

/-! ## Five-view product-chain wrapper -/

/--
A common-FMS segmented agreement indexed by the source component of one real
five-view product chain.
-/
structure FiniteCommonFMSSegmentedAgreement
    (universes : ProjectionUniverses)
    (fms : ExactFMSAcceptancePackage)
    {first last : FourProjectionReplayEpoch}
    (chain : FiniteCrossEpochProductChain universes first last) where
  source : fms.base.domain.agent.obj 0
  target : fms.base.domain.agent.obj 0
  path :
    EpochIndexedExactFMSPath universes fms
      chain.sourceChain source target

namespace FiniteCommonFMSSegmentedAgreement

variable
    {universes : ProjectionUniverses}
    {fms : ExactFMSAcceptancePackage}
    {first last : FourProjectionReplayEpoch}
    {chain : FiniteCrossEpochProductChain universes first last}

/-- Flattened common-FMS actions for the exact product-chain source trace. -/
def actions
    (agreement : FiniteCommonFMSSegmentedAgreement universes fms chain) :
    List Raw.Action :=
  agreement.path.actions

/-- Exact interpretation of every dependent source-chain mark. -/
def sourceAction
    (agreement : FiniteCommonFMSSegmentedAgreement universes fms chain) :
    ChainEvent universes chain.sourceChain → Raw.Action :=
  agreement.path.sourceAction

/-- The flattened action list remains exactly position aligned. -/
theorem flatten_positions
    (agreement : FiniteCommonFMSSegmentedAgreement universes fms chain) :
    List.Forall₂
      (fun sourceEvent action =>
        agreement.sourceAction sourceEvent = action)
      (traceEvents chain.sourceChain) agreement.actions :=
  agreement.path.flatten_positions

/-- Flattening is one native path in the supplied common FMS package. -/
def native
    (agreement : FiniteCommonFMSSegmentedAgreement universes fms chain) :
    ExactFMSNativePath fms
      agreement.source agreement.actions agreement.target :=
  agreement.path.native

/-- Entry state of the terminal epoch segment. -/
def lastEntry
    (agreement : FiniteCommonFMSSegmentedAgreement universes fms chain) :
    fms.base.domain.agent.obj 0 :=
  agreement.path.lastEntry

/-- Actions strictly before the terminal epoch segment. -/
def prefixActions
    (agreement : FiniteCommonFMSSegmentedAgreement universes fms chain) :
    List Raw.Action :=
  agreement.path.prefixActions

/--
Endpoint append for two real five-view product chains.  Rewriting by the
proved source-projection/append equation transports the indexed path without
erasing its epoch dependency.
-/
def endpointAppend
    {middle final : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle final}
    (headAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms head)
    (tailAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms tail)
    (seam :
      headAgreement.lastEntry = tailAgreement.source) :
    FiniteCommonFMSSegmentedAgreement universes fms
      (FiniteCrossEpochProductChain.endpointAppend head tail) where
  source := headAgreement.source
  target := tailAgreement.target
  path :=
    EpochIndexedExactFMSPath.reindex
      (FiniteCrossEpochProductChain.sourceChain_endpointAppend
        head tail).symm
      (EpochIndexedExactFMSPath.endpointAppend
        headAgreement.path tailAgreement.path seam)

/--
Abstract nonempty-shared-epoch inhabitant theorem.

Unlike full-list concatenation, segmented append remains inhabited when the
shared epoch contains native events.  The package, both native paths, and
their denotational entry seam are real supplied inputs; this theorem does not
manufacture an `ExactFMSAcceptancePackage`.
-/
def endpointAppend_of_nonempty_shared_epoch
    {middle final : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle final}
    (headAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms head)
    (tailAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms tail)
    (_sharedNonempty : middle.source.epoch.events ≠ [])
    (seam :
      headAgreement.lastEntry = tailAgreement.source) :
    FiniteCommonFMSSegmentedAgreement universes fms
      (FiniteCrossEpochProductChain.endpointAppend head tail) :=
  endpointAppend headAgreement tailAgreement seam

/--
The wrapper's appended native action list contains the shared epoch only via
the right agreement.
-/
theorem actions_endpointAppend
    {middle final : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle final}
    (headAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms head)
    (tailAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms tail)
    (seam :
      headAgreement.lastEntry = tailAgreement.source) :
    (endpointAppend headAgreement tailAgreement seam).actions =
      headAgreement.prefixActions ++ tailAgreement.actions := by
  change
    (EpochIndexedExactFMSPath.reindex
      (FiniteCrossEpochProductChain.sourceChain_endpointAppend
        head tail).symm
      (EpochIndexedExactFMSPath.endpointAppend
        headAgreement.path tailAgreement.path seam)).actions =
      headAgreement.path.prefixActions ++ tailAgreement.path.actions
  rw [EpochIndexedExactFMSPath.actions_reindex]
  exact
    EpochIndexedExactFMSPath.actions_endpointAppend
      headAgreement.path tailAgreement.path seam

/-- Product-wrapper append retains the right terminal epoch entry. -/
theorem lastEntry_endpointAppend
    {middle final : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle final}
    (headAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms head)
    (tailAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms tail)
    (seam :
      headAgreement.lastEntry = tailAgreement.source) :
    (endpointAppend headAgreement tailAgreement seam).lastEntry =
      tailAgreement.lastEntry := by
  change
    (EpochIndexedExactFMSPath.reindex
      (FiniteCrossEpochProductChain.sourceChain_endpointAppend
        head tail).symm
      (EpochIndexedExactFMSPath.endpointAppend
        headAgreement.path tailAgreement.path seam)).lastEntry =
      tailAgreement.path.lastEntry
  rw [EpochIndexedExactFMSPath.lastEntry_reindex]
  exact
    EpochIndexedExactFMSPath.lastEntry_endpointAppend
      headAgreement.path tailAgreement.path seam

/-- Product-wrapper half-open prefixes compose without duplicating the seam. -/
theorem prefixActions_endpointAppend
    {middle final : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle final}
    (headAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms head)
    (tailAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms tail)
    (seam :
      headAgreement.lastEntry = tailAgreement.source) :
    (endpointAppend headAgreement tailAgreement seam).prefixActions =
      headAgreement.prefixActions ++ tailAgreement.prefixActions := by
  change
    (EpochIndexedExactFMSPath.reindex
      (FiniteCrossEpochProductChain.sourceChain_endpointAppend
        head tail).symm
      (EpochIndexedExactFMSPath.endpointAppend
        headAgreement.path tailAgreement.path seam)).prefixActions =
      headAgreement.path.prefixActions ++ tailAgreement.path.prefixActions
  rw [EpochIndexedExactFMSPath.prefixActions_reindex]
  exact
    EpochIndexedExactFMSPath.prefixActions_endpointAppend
      headAgreement.path tailAgreement.path seam

/--
Three product-chain appends are associative at the exact common-FMS action
list, including nonempty shared epochs.
-/
theorem endpointAppend_actions_assoc
    {second third final : FourProjectionReplayEpoch}
    {firstChain :
      FiniteCrossEpochProductChain universes first second}
    {secondChain :
      FiniteCrossEpochProductChain universes second third}
    {thirdChain :
      FiniteCrossEpochProductChain universes third final}
    (firstAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms firstChain)
    (secondAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms secondChain)
    (thirdAgreement :
      FiniteCommonFMSSegmentedAgreement universes fms thirdChain)
    (firstSeam :
      firstAgreement.lastEntry = secondAgreement.source)
    (secondSeam :
      secondAgreement.lastEntry = thirdAgreement.source) :
    (endpointAppend
        (endpointAppend firstAgreement secondAgreement firstSeam)
        thirdAgreement
        ((lastEntry_endpointAppend
          firstAgreement secondAgreement firstSeam).trans secondSeam)).actions =
      (endpointAppend firstAgreement
        (endpointAppend secondAgreement thirdAgreement secondSeam)
        firstSeam).actions := by
  rw [actions_endpointAppend, prefixActions_endpointAppend,
    actions_endpointAppend, actions_endpointAppend]
  exact List.append_assoc _ _ _

end FiniteCommonFMSSegmentedAgreement

end Cantilune.Theorems
