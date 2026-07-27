import Cantilune.Theorems.FMSCommonFiniteCrossEpochChain

/-!
# Nonduplicating common-FMS segment paths

`FiniteCommonFMSPathAgreement` records the full trace of a nonempty epoch
chain.  Endpoint-sharing append overlaps on one whole epoch, so concatenating
two full action lists duplicates that epoch.  This module proves that
obstruction and supplies the minimal representation change: an exact FMS path
split into nonempty consecutive segments.

Appending segment paths removes the terminal segment of the left path and
keeps the initial segment of the right path.  The required denotational seam
is equality at entry to the shared segment.  No weak transition or action
filter is used.
-/

noncomputable section

namespace Cantilune.Theorems

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Pi
open Cantilune.Pi.FMSExactAcceptance

/-! ## Exact nonempty segment lists -/

/--
A nonempty list of consecutive native FMS action segments.

Each constructor stores the exact denotational endpoint shared with the next
segment.  The terminal `single` is the segment overlapped by endpoint append.
-/
inductive ExactFMSSegmentPath
    (fms : ExactFMSAcceptancePackage) :
    fms.base.domain.agent.obj 0 →
    fms.base.domain.agent.obj 0 → Type
  | single
      {source target : fms.base.domain.agent.obj 0}
      (segment : List Raw.Action)
      (native : ExactFMSNativePath fms source segment target) :
      ExactFMSSegmentPath fms source target
  | cons
      {source middle target : fms.base.domain.agent.obj 0}
      (segment : List Raw.Action)
      (native : ExactFMSNativePath fms source segment middle)
      (rest : ExactFMSSegmentPath fms middle target) :
      ExactFMSSegmentPath fms source target

namespace ExactFMSSegmentPath

variable {fms : ExactFMSAcceptancePackage}

/-- Flatten all segments in chronological order. -/
def actions
    {source target : fms.base.domain.agent.obj 0}
    (path : ExactFMSSegmentPath fms source target) :
    List Raw.Action :=
  match path with
  | .single segment _ => segment
  | .cons segment _ rest => segment ++ actions rest

/-- The denotational state at entry to the terminal segment. -/
def lastEntry
    {source target : fms.base.domain.agent.obj 0}
    (path : ExactFMSSegmentPath fms source target) :
    fms.base.domain.agent.obj 0 :=
  match path with
  | .single _ _ => source
  | .cons _ _ rest => lastEntry rest

/-- Flatten every segment except the terminal one. -/
def prefixActions
    {source target : fms.base.domain.agent.obj 0}
    (path : ExactFMSSegmentPath fms source target) :
    List Raw.Action :=
  match path with
  | .single _ _ => []
  | .cons segment _ rest => segment ++ prefixActions rest

/-- Flattening is an actual native FMS path. -/
def native
    {source target : fms.base.domain.agent.obj 0}
    (path : ExactFMSSegmentPath fms source target) :
    ExactFMSNativePath fms source path.actions target :=
  match path with
  | .single _ segmentNative => segmentNative
  | .cons _ segmentNative rest =>
      ExactFMSNativePath.append segmentNative rest.native

/-- The half-open prefix is an actual path to the terminal-segment entry. -/
def prefixNative
    {source target : fms.base.domain.agent.obj 0}
    (path : ExactFMSSegmentPath fms source target) :
    ExactFMSNativePath fms source
      path.prefixActions path.lastEntry :=
  match path with
  | .single _ _ => .nil source
  | .cons _ segmentNative rest =>
      ExactFMSNativePath.append segmentNative rest.prefixNative

/--
Nonduplicating endpoint append.

The left terminal segment is discarded and the right path is retained from
the same entry state onward.
-/
def endpointAppend
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head : ExactFMSSegmentPath fms source headTarget)
    (tail : ExactFMSSegmentPath fms tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    ExactFMSSegmentPath fms source tailTarget := by
  induction head with
  | single segment segmentNative =>
      simp only [lastEntry] at seam
      cases seam
      exact tail
  | cons segment segmentNative rest ih =>
      exact .cons segment segmentNative (ih seam)

@[simp]
theorem endpointAppend_single
    {source headTarget tailTarget :
      fms.base.domain.agent.obj 0}
    (segment : List Raw.Action)
    (segmentNative :
      ExactFMSNativePath fms source segment headTarget)
    (tail : ExactFMSSegmentPath fms source tailTarget) :
    endpointAppend (.single segment segmentNative) tail rfl = tail :=
  rfl

@[simp]
theorem endpointAppend_cons
    {source middle headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (segment : List Raw.Action)
    (segmentNative :
      ExactFMSNativePath fms source segment middle)
    (rest : ExactFMSSegmentPath fms middle headTarget)
    (tail : ExactFMSSegmentPath fms tailSource tailTarget)
    (seam : rest.lastEntry = tailSource) :
    endpointAppend (.cons segment segmentNative rest) tail seam =
      .cons segment segmentNative
        (endpointAppend rest tail seam) :=
  rfl

/-- Append retains the right terminal entry. -/
theorem lastEntry_endpointAppend
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head : ExactFMSSegmentPath fms source headTarget)
    (tail : ExactFMSSegmentPath fms tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    (endpointAppend head tail seam).lastEntry = tail.lastEntry := by
  induction head generalizing tailSource tailTarget with
  | single segment segmentNative =>
      simp only [lastEntry] at seam
      cases seam
      rfl
  | cons segment segmentNative rest ih =>
      exact ih tail (by simpa only [lastEntry] using seam)

/-- Prefix actions compose without duplicating the shared segment. -/
theorem prefixActions_endpointAppend
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head : ExactFMSSegmentPath fms source headTarget)
    (tail : ExactFMSSegmentPath fms tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    (endpointAppend head tail seam).prefixActions =
      head.prefixActions ++ tail.prefixActions := by
  induction head generalizing tailSource tailTarget with
  | single segment segmentNative =>
      simp only [lastEntry] at seam
      cases seam
      rfl
  | cons segment segmentNative rest ih =>
      change rest.lastEntry = tailSource at seam
      rw [endpointAppend_cons]
      simp only [prefixActions]
      rw [ih tail seam]
      exact (List.append_assoc _ _ _).symm

/-- Full actions are exactly the left half-open prefix plus the right path. -/
theorem actions_endpointAppend
    {source headTarget tailSource tailTarget :
      fms.base.domain.agent.obj 0}
    (head : ExactFMSSegmentPath fms source headTarget)
    (tail : ExactFMSSegmentPath fms tailSource tailTarget)
    (seam : head.lastEntry = tailSource) :
    (endpointAppend head tail seam).actions =
      head.prefixActions ++ tail.actions := by
  induction head generalizing tailSource tailTarget with
  | single segment segmentNative =>
      simp only [lastEntry] at seam
      cases seam
      rfl
  | cons segment segmentNative rest ih =>
      change rest.lastEntry = tailSource at seam
      rw [endpointAppend_cons]
      simp only [actions, prefixActions]
      rw [ih tail seam]
      exact (List.append_assoc _ _ _).symm

/--
Three-way endpoint append is associative at the exact flattened action list.
Both sides also carry a native path between the same outer denotational
endpoints by construction.
-/
theorem endpointAppend_actions_assoc
    {source secondSource firstTarget secondTarget thirdSource thirdTarget :
      fms.base.domain.agent.obj 0}
    (first : ExactFMSSegmentPath fms source firstTarget)
    (second : ExactFMSSegmentPath fms secondSource secondTarget)
    (third : ExactFMSSegmentPath fms thirdSource thirdTarget)
    (firstSeam : first.lastEntry = secondSource)
    (secondSeam : second.lastEntry = thirdSource) :
    (endpointAppend
        (endpointAppend first second firstSeam)
        third
        ((lastEntry_endpointAppend first second firstSeam).trans
          secondSeam)).actions =
      (endpointAppend first
        (endpointAppend second third secondSeam)
        firstSeam).actions := by
  rw [actions_endpointAppend, prefixActions_endpointAppend,
    actions_endpointAppend, actions_endpointAppend]
  exact List.append_assoc _ _ _

end ExactFMSSegmentPath

/-! ## Full-list append is impossible over a nonempty shared epoch -/

namespace EpochChain

variable {universes : ProjectionUniverses}

/--
Exact event-count equation for endpoint-sharing append.

The shared epoch occurs in both inputs and once in the result.
-/
theorem traceEvents_endpointAppend_length
    {first middle last : SomeReplayEpoch}
    (head : EpochChain universes first middle)
    (tail : EpochChain universes middle last) :
    (traceEvents (endpointAppend head tail)).length +
        middle.epoch.events.length =
      (traceEvents head).length + (traceEvents tail).length := by
  induction head generalizing last with
  | single epoch =>
      simp only [endpointAppend_single, traceEvents, List.length_map]
      omega
  | cons boundary rest ih =>
      have recursive := ih tail
      simp only [endpointAppend_cons, traceEvents, List.length_append,
        List.length_map, List.length_cons]
      omega

end EpochChain

namespace FiniteCommonFMSPathAgreement

variable
    {universes : ProjectionUniverses}
    {fms : ExactFMSAcceptancePackage}
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}

/--
For a nonempty shared source epoch, the positional premise accepted by
`endpointAppendWithPositions` cannot exist.

The proof uses only exact event counts and `List.Forall₂.length_eq`; it does
not depend on the chosen FMS package or on the action interpretation.
-/
theorem no_full_concat_positions_of_shared_events
    (headAgreement :
      FiniteCommonFMSPathAgreement fms head)
    (tailAgreement :
      FiniteCommonFMSPathAgreement fms tail)
    (sharedNonempty : middle.source.epoch.events ≠ [])
    (sourceAction :
      ChainEvent universes
        (FiniteCrossEpochProductChain.endpointAppend
          head tail).sourceChain →
        Raw.Action) :
    ¬ List.Forall₂
        (fun sourceEvent action =>
          sourceAction sourceEvent = action)
        (traceEvents
          (FiniteCrossEpochProductChain.endpointAppend
            head tail).sourceChain)
        (headAgreement.actions ++ tailAgreement.actions) := by
  intro positions
  have appendedLength := positions.length_eq
  have headLength := headAgreement.positions.length_eq
  have tailLength := tailAgreement.positions.length_eq
  have overlapLength :=
    EpochChain.traceEvents_endpointAppend_length
      head.sourceChain tail.sourceChain
  rw [FiniteCrossEpochProductChain.sourceChain_endpointAppend] at appendedLength
  simp only [List.length_append] at appendedLength
  have sharedPositive : 0 < middle.source.epoch.events.length := by
    exact List.length_pos_of_ne_nil sharedNonempty
  omega

end FiniteCommonFMSPathAgreement

end Cantilune.Theorems
