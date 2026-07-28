import Cantilune.Theorems.FMSCommonTwoRowCrossEpochChain

/-!
# Composable finite common-FMS cross-epoch chains

This module exposes endpoint-sharing append operations for the two indexed
path types used by the common-FMS interface.

`FiniteCrossEpochProductChain` is a nonempty list of replay epochs.  Appending
two chains with a definitionally shared endpoint replaces the terminal
`single` of the left chain by the right chain; it does not duplicate the
shared replay epoch.  The five dependent projections commute with this
operation, and replay, strictness, fixed-event marks, and admission marks are
preserved.

There is a deliberate boundary at the final constructor below.  A
`FiniteCommonFMSPathAgreement` describes the *full* trace of each nonempty
chain, including events in both endpoint epochs.  Concatenating two such
action lists duplicates the events of their shared epoch, whereas chain
append retains that epoch once.  Therefore composition of two full agreements
requires a positional witness for the appended trace.  Removing that witness
would require a half-open/segmented trace representation.
-/

noncomputable section

namespace Cantilune.Theorems

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Pi
open Cantilune.Pi.FMSExactAcceptance

/-! ## Native FMS paths -/

namespace ExactFMSNativePath

variable
    {fms : ExactFMSAcceptancePackage}
    {source middle target :
      fms.base.domain.agent.obj 0}
    {headActions tailActions : List Raw.Action}

/-- Concatenate native paths whose denotational endpoint is shared exactly. -/
theorem append
    (head :
      ExactFMSNativePath fms
        source headActions middle)
    (tail :
      ExactFMSNativePath fms
        middle tailActions target) :
    ExactFMSNativePath fms source
      (headActions ++ tailActions) target := by
  induction head with
  | nil state =>
      exact tail
  | cons transition rest ih =>
      exact .cons transition (ih tail)

/-- Three native segments compose independently of parenthesisation. -/
theorem append_three
    {final : fms.base.domain.agent.obj 0}
    {finalActions : List Raw.Action}
    (first :
      ExactFMSNativePath fms
        source headActions middle)
    (second :
      ExactFMSNativePath fms
        middle tailActions target)
    (third :
      ExactFMSNativePath fms
        target finalActions final) :
    ExactFMSNativePath fms source
      (headActions ++ tailActions ++ finalActions) final :=
  append (append first second) third

/-- The action-list length of an appended native path is additive. -/
theorem append_action_length
    (_head :
      ExactFMSNativePath fms
        source headActions middle)
    (_tail :
      ExactFMSNativePath fms
        middle tailActions target) :
    (headActions ++ tailActions).length =
      headActions.length + tailActions.length := by
  exact List.length_append

end ExactFMSNativePath

/-! ## Endpoint-sharing append for heterogeneous epoch chains -/

namespace EpochChain

variable {universes : ProjectionUniverses}

/--
Append two nonempty heterogeneous chains at their definitionally shared
endpoint.  The shared replay epoch occurs once in the result.
-/
def endpointAppend
    {first middle last : SomeReplayEpoch}
    (head : EpochChain universes first middle)
    (tail : EpochChain universes middle last) :
    EpochChain universes first last :=
  match head with
  | .single _ => tail
  | .cons boundary rest =>
      .cons boundary (endpointAppend rest tail)

@[simp]
theorem endpointAppend_single
    {middle last : SomeReplayEpoch}
    (tail : EpochChain universes middle last) :
    endpointAppend (.single middle) tail = tail :=
  rfl

@[simp]
theorem endpointAppend_cons
    {first next middle last : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes first next)
    (rest : EpochChain universes next middle)
    (tail : EpochChain universes middle last) :
    endpointAppend (.cons boundary rest) tail =
      .cons boundary (endpointAppend rest tail) :=
  rfl

/-- Endpoint append is associative. -/
theorem endpointAppend_assoc
    {first second third last : SomeReplayEpoch}
    (firstChain : EpochChain universes first second)
    (secondChain : EpochChain universes second third)
    (thirdChain : EpochChain universes third last) :
    endpointAppend
        (endpointAppend firstChain secondChain)
        thirdChain =
      endpointAppend firstChain
        (endpointAppend secondChain thirdChain) := by
  induction firstChain with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons]
      rw [ih]

end EpochChain

/-! ## Endpoint-sharing append for five-view product chains -/

namespace FiniteCrossEpochProductChain

variable {universes : ProjectionUniverses}

/--
Append two five-view chains at one definitionally shared
`FourProjectionReplayEpoch`.
-/
def endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    (head :
      FiniteCrossEpochProductChain universes first middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    FiniteCrossEpochProductChain universes first last :=
  match head with
  | .single _ => tail
  | .cons boundary rest =>
      .cons boundary (endpointAppend rest tail)

@[simp]
theorem endpointAppend_single
    {middle last : FourProjectionReplayEpoch}
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    endpointAppend (.single middle) tail = tail :=
  rfl

@[simp]
theorem endpointAppend_cons
    {first next middle last : FourProjectionReplayEpoch}
    (boundary : FiveViewBoundary universes first next)
    (rest :
      FiniteCrossEpochProductChain universes next middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    endpointAppend (.cons boundary rest) tail =
      .cons boundary (endpointAppend rest tail) :=
  rfl

/-- Product-chain append is associative. -/
theorem endpointAppend_assoc
    {first second third last : FourProjectionReplayEpoch}
    (firstChain :
      FiniteCrossEpochProductChain universes first second)
    (secondChain :
      FiniteCrossEpochProductChain universes second third)
    (thirdChain :
      FiniteCrossEpochProductChain universes third last) :
    endpointAppend
        (endpointAppend firstChain secondChain)
        thirdChain =
      endpointAppend firstChain
        (endpointAppend secondChain thirdChain) := by
  induction firstChain with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons]
      rw [ih]

/-- The source projection commutes with endpoint append. -/
theorem sourceChain_endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    (head :
      FiniteCrossEpochProductChain universes first middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    sourceChain (endpointAppend head tail) =
      EpochChain.endpointAppend
        (sourceChain head) (sourceChain tail) := by
  induction head with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons, sourceChain,
        EpochChain.endpointAppend_cons]
      rw [ih]

/-- The DAG projection commutes with endpoint append. -/
theorem dagChain_endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    (head :
      FiniteCrossEpochProductChain universes first middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    dagChain (endpointAppend head tail) =
      EpochChain.endpointAppend
        (dagChain head) (dagChain tail) := by
  induction head with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons, dagChain,
        EpochChain.endpointAppend_cons]
      rw [ih]

/-- The Petri projection commutes with endpoint append. -/
theorem petriChain_endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    (head :
      FiniteCrossEpochProductChain universes first middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    petriChain (endpointAppend head tail) =
      EpochChain.endpointAppend
        (petriChain head) (petriChain tail) := by
  induction head with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons, petriChain,
        EpochChain.endpointAppend_cons]
      rw [ih]

/-- The pi projection commutes with endpoint append. -/
theorem piChain_endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    (head :
      FiniteCrossEpochProductChain universes first middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    piChain (endpointAppend head tail) =
      EpochChain.endpointAppend
        (piChain head) (piChain tail) := by
  induction head with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons, piChain,
        EpochChain.endpointAppend_cons]
      rw [ih]

/-- The morphism projection commutes with endpoint append. -/
theorem morphismChain_endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    (head :
      FiniteCrossEpochProductChain universes first middle)
    (tail :
      FiniteCrossEpochProductChain universes middle last) :
    morphismChain (endpointAppend head tail) =
      EpochChain.endpointAppend
        (morphismChain head) (morphismChain tail) := by
  induction head with
  | single epoch =>
      rfl
  | cons boundary rest ih =>
      simp only [endpointAppend_cons, morphismChain,
        EpochChain.endpointAppend_cons]
      rw [ih]

/--
Replay remains exact after append in all five views.  The arguments expose
that this is a preservation interface; the result is reconstructed from the
same certified replay data stored in the appended chain.
-/
theorem ReplayAgreement.endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}
    (_ : ReplayAgreement head)
    (_ : ReplayAgreement tail) :
    ReplayAgreement
      (FiniteCrossEpochProductChain.endpointAppend
        head tail) :=
  completeReplayAgreement
    (FiniteCrossEpochProductChain.endpointAppend
      head tail)

/-- Boundary strictness is structurally preserved by endpoint append. -/
theorem AllBoundariesStrict.endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}
    (_ : AllBoundariesStrict head)
    (_ : AllBoundariesStrict tail) :
    AllBoundariesStrict
      (FiniteCrossEpochProductChain.endpointAppend
        head tail) :=
  allBoundariesStrict
    (FiniteCrossEpochProductChain.endpointAppend
      head tail)

/-- Fixed-epoch source-to-projection marks are preserved by append. -/
theorem AllEventMarksPreserved.endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}
    (_ : AllEventMarksPreserved head)
    (_ : AllEventMarksPreserved tail) :
    AllEventMarksPreserved
      (FiniteCrossEpochProductChain.endpointAppend
        head tail) :=
  allEventMarksPreserved
    (FiniteCrossEpochProductChain.endpointAppend
      head tail)

/-- Typed admission marks are preserved by append. -/
theorem AllAdmissionMarksPreserved.endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}
    (_ : AllAdmissionMarksPreserved head)
    (_ : AllAdmissionMarksPreserved tail) :
    AllAdmissionMarksPreserved
      (FiniteCrossEpochProductChain.endpointAppend
        head tail) :=
  allAdmissionMarksPreserved
    (FiniteCrossEpochProductChain.endpointAppend
      head tail)

/-- Complete five-view agreement composes at a shared endpoint. -/
theorem CompleteAgreement.endpointAppend
    {first middle last : FourProjectionReplayEpoch}
    {head :
      FiniteCrossEpochProductChain universes first middle}
    {tail :
      FiniteCrossEpochProductChain universes middle last}
    (headAgreement : CompleteAgreement head)
    (tailAgreement : CompleteAgreement tail) :
    CompleteAgreement
      (FiniteCrossEpochProductChain.endpointAppend
        head tail) := by
  exact
    { replay :=
        headAgreement.replay.endpointAppend
          tailAgreement.replay
      strict :=
        headAgreement.strict.endpointAppend
          tailAgreement.strict
      events :=
        headAgreement.events.endpointAppend
          tailAgreement.events
      admissions :=
        headAgreement.admissions.endpointAppend
          tailAgreement.admissions }

end FiniteCrossEpochProductChain

/-! ## Common-package positional composition -/

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
Compose the native FMS portions of two full agreements in one common
package, provided their denotational endpoint is identified and the caller
supplies the exact positional relation for the nonduplicating appended chain.

The positional premise is essential with the current full-trace
representation: `head.actions ++ tail.actions` contains both copies of the
shared epoch's actions, while `endpointAppend head tail` retains the epoch
once.  It is satisfiable directly when the shared epoch contributes no
fixed-signature actions, and otherwise a half-open segmentation API is
needed.
-/
def endpointAppendWithPositions
    (headAgreement :
      FiniteCommonFMSPathAgreement fms head)
    (tailAgreement :
      FiniteCommonFMSPathAgreement fms tail)
    (endpoint :
      headAgreement.target = tailAgreement.source)
    (sourceAction :
      ChainEvent universes
        (FiniteCrossEpochProductChain.endpointAppend
          head tail).sourceChain →
        Raw.Action)
    (positions :
      List.Forall₂
        (fun sourceEvent action =>
          sourceAction sourceEvent = action)
        (traceEvents
          (FiniteCrossEpochProductChain.endpointAppend
            head tail).sourceChain)
        (headAgreement.actions ++ tailAgreement.actions)) :
    FiniteCommonFMSPathAgreement fms
      (FiniteCrossEpochProductChain.endpointAppend
        head tail) := by
  have tailNative :
      ExactFMSNativePath fms
        headAgreement.target
        tailAgreement.actions
        tailAgreement.target := by
    rw [endpoint]
    exact tailAgreement.native
  exact
    { sourceAction := sourceAction
      actions :=
        headAgreement.actions ++ tailAgreement.actions
      source := headAgreement.source
      target := tailAgreement.target
      positions := positions
      native :=
        ExactFMSNativePath.append
          headAgreement.native tailNative }

end FiniteCommonFMSPathAgreement

end Cantilune.Theorems
