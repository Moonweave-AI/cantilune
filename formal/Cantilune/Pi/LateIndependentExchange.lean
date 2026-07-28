import Cantilune.Pi.Late

/-!
# Independent exchange in the native late-pi LTS

The native late semantics deliberately retains causal order.  This module
isolates the exact case in which two transitions in disjoint parallel
components possess a commuting square.

The operational trace keeps its ordered list of labels.  A separate quotient
identifies only the two replay records of an explicitly proved native
commuting square.  Mere disjointness of two label supports is deliberately not
enough: it carries no provenance and could otherwise exchange sequential
prefixes.  Consequently dependent communication is not silently exchanged or
weakened to an unlabelled multi-step.

This is an operational independence theorem.  It is not a claim that every
pair of pi actions commutes, nor a construction of the FMS powerdomain.
-/

namespace Cantilune.Pi.LateIndependentExchange

open Cantilune.Pi
open Cantilune.Pi.Late

/-- Two observable effects are independent when their complete name supports
are disjoint.  Bound names are included through `Action.names`. -/
def ActionIndependent (left right : Raw.Action) : Prop :=
  Disjoint left.names right.names

theorem actionIndependent_symm
    {left right : Raw.Action}
    (independent : ActionIndependent left right) :
    ActionIndependent right left :=
  independent.symm

theorem output_input_same_channel_dependent
    (channel value binder : Name) :
    ¬ ActionIndependent
        (.output channel value) (.input channel binder) := by
  intro independent
  have channelLeft :
      channel ∈ (Raw.Action.output channel value).names := by
    simp [Raw.Action.names]
  have channelRight :
      channel ∈ (Raw.Action.input channel binder).names := by
    simp [Raw.Action.names]
  exact Finset.disjoint_left.mp independent channelLeft channelRight

/-- An exact ordered native trace.  No structural or weak closure is hidden in
the constructors. -/
inductive NativeTrace :
    Raw.Proc → List Raw.Action → Raw.Proc → Prop where
  | nil (process : Raw.Proc) :
      NativeTrace process [] process
  | cons
      (step : Late.NativeStep source action middle)
      (tail : NativeTrace middle actions target) :
      NativeTrace source (action :: actions) target

/--
Freshness data sufficient to lift two component transitions in either order.

The first two fields lift each transition in the original parallel source;
the last two fields lift the residual transitions after the other component
has moved.  Action-support disjointness is retained explicitly because it is
the semantic independence condition used by the trace quotient.
-/
structure ParallelIndependent
    (left right left' right' : Raw.Proc)
    (leftAction rightAction : Raw.Action) : Prop where
  actions : ActionIndependent leftAction rightAction
  leftSourceFresh :
    Disjoint leftAction.boundNames right.freeNames
  rightSourceFresh :
    Disjoint rightAction.boundNames left.freeNames
  leftResidualFresh :
    Disjoint leftAction.boundNames right'.freeNames
  rightResidualFresh :
    Disjoint rightAction.boundNames left'.freeNames

/--
Independent native component transitions form an exact two-step diamond.

Both branches start from the same raw parallel process and end in the
definitionally same derivative.  The labels remain in their actual execution
order; no `tau*`, structural quotient, or endpoint isomorphism is used.
-/
theorem native_independent_diamond
    {left right left' right' : Raw.Proc}
    {leftAction rightAction : Raw.Action}
    (leftStep : Late.NativeStep left leftAction left')
    (rightStep : Late.NativeStep right rightAction right')
    (independent :
      ParallelIndependent
        left right left' right' leftAction rightAction) :
    NativeTrace
        (.par left right)
        [leftAction, rightAction]
        (.par left' right') ∧
      NativeTrace
        (.par left right)
        [rightAction, leftAction]
        (.par left' right') := by
  constructor
  · exact NativeTrace.cons
      (Late.NativeStep.parLeft independent.leftSourceFresh leftStep)
      (NativeTrace.cons
        (Late.NativeStep.parRight independent.rightResidualFresh rightStep)
        (NativeTrace.nil _))
  · exact NativeTrace.cons
      (Late.NativeStep.parRight independent.rightSourceFresh rightStep)
      (NativeTrace.cons
        (Late.NativeStep.parLeft independent.leftResidualFresh leftStep)
        (NativeTrace.nil _))

/--
An exact replay record retains source, target, ordered labels, and the native
derivation.  In particular, labels without their operational provenance are
not quotient inputs.
-/
structure ReplayRecord where
  source : Raw.Proc
  target : Raw.Proc
  actions : List Raw.Action
  native : NativeTrace source actions target

/--
The diamond supplies two replay records with a common endpoint, while their
ordered action lists remain available before quotienting.
-/
structure IndependentReplaySquare where
  source : Raw.Proc
  target : Raw.Proc
  first : Raw.Action
  second : Raw.Action
  firstThenSecond :
    NativeTrace source [first, second] target
  secondThenFirst :
    NativeTrace source [second, first] target
  independent : ActionIndependent first second

namespace IndependentReplaySquare

def firstRecord (square : IndependentReplaySquare) : ReplayRecord where
  source := square.source
  target := square.target
  actions := [square.first, square.second]
  native := square.firstThenSecond

def secondRecord (square : IndependentReplaySquare) : ReplayRecord where
  source := square.source
  target := square.target
  actions := [square.second, square.first]
  native := square.secondThenFirst

end IndependentReplaySquare

/--
Certified replay equivalence is generated by actual native commuting squares.
This prevents label-only false positives such as exchanging the two prefixes
of a sequential `tau.a.0` process.
-/
inductive CertifiedReplayEquiv :
    ReplayRecord → ReplayRecord → Prop where
  | refl (trace) :
      CertifiedReplayEquiv trace trace
  | symm
      (relation : CertifiedReplayEquiv left right) :
      CertifiedReplayEquiv right left
  | trans
      (first : CertifiedReplayEquiv left middle)
      (second : CertifiedReplayEquiv middle right) :
      CertifiedReplayEquiv left right
  | square (witness : IndependentReplaySquare) :
      CertifiedReplayEquiv
        witness.firstRecord witness.secondRecord

namespace CertifiedReplayEquiv

theorem equivalence : Equivalence CertifiedReplayEquiv :=
  ⟨CertifiedReplayEquiv.refl, @CertifiedReplayEquiv.symm,
    @CertifiedReplayEquiv.trans⟩

def setoid : Setoid ReplayRecord where
  r := CertifiedReplayEquiv
  iseqv := equivalence

end CertifiedReplayEquiv

/-- Replay classes forget only reorderings backed by native squares. -/
abbrev CertifiedReplayClass :=
  Quot CertifiedReplayEquiv.setoid

def replayClass (record : ReplayRecord) : CertifiedReplayClass :=
  Quot.mk _ record

def replaySquareOfParallel
    {left right left' right' : Raw.Proc}
    {leftAction rightAction : Raw.Action}
    (leftStep : Late.NativeStep left leftAction left')
    (rightStep : Late.NativeStep right rightAction right')
    (independent :
      ParallelIndependent
        left right left' right' leftAction rightAction) :
    IndependentReplaySquare where
  source := .par left right
  target := .par left' right'
  first := leftAction
  second := rightAction
  firstThenSecond :=
    (native_independent_diamond leftStep rightStep independent).1
  secondThenFirst :=
    (native_independent_diamond leftStep rightStep independent).2
  independent := independent.actions

theorem replay_square_class_agrees
    (square : IndependentReplaySquare) :
    replayClass square.firstRecord =
      replayClass square.secondRecord := by
  apply Quot.sound
  exact CertifiedReplayEquiv.square square

/-! ## A non-vacuous native example -/

def exampleLeft : Raw.Proc :=
  .send 0 1 .zero

def exampleRight : Raw.Proc :=
  .send 2 3 .zero

theorem exampleActionsIndependent :
    ActionIndependent
      (Raw.Action.output 0 1) (.output 2 3) := by
  simp [ActionIndependent, Raw.Action.names, Finset.disjoint_left]

theorem exampleParallelIndependent :
    ParallelIndependent
      exampleLeft exampleRight .zero .zero
      (.output 0 1) (.output 2 3) := by
  refine
    { actions := exampleActionsIndependent
      leftSourceFresh := ?_
      rightSourceFresh := ?_
      leftResidualFresh := ?_
      rightResidualFresh := ?_ }
  all_goals
    simp [Raw.Action.boundNames, Raw.Proc.freeNames]

theorem example_native_independent_diamond :
    NativeTrace
        (.par exampleLeft exampleRight)
        [.output 0 1, .output 2 3]
        (.par .zero .zero) ∧
      NativeTrace
        (.par exampleLeft exampleRight)
        [.output 2 3, .output 0 1]
        (.par .zero .zero) := by
  exact native_independent_diamond
    Late.NativeStep.prefixOutput
    Late.NativeStep.prefixOutput
    exampleParallelIndependent

/--
A native communication remains one causally dependent tau event.  In
particular, its two premises are not exposed as an independently swappable
two-label replay.
-/
theorem dependent_sync_is_native_tau
    {left right left' right' : Raw.Proc}
    {channel value binder : Name}
    (outputStep :
      Late.NativeStep left (.output channel value) left')
    (inputStep :
      Late.NativeStep right (.input channel binder) right')
    (fresh : binder ∉ left'.freeNames) :
    Late.NativeStep
      (.par left right)
      .tau
      (.par left'
        (right'.substituteCaptureAvoiding binder value)) :=
  Late.NativeStep.syncLeft outputStep inputStep fresh

end Cantilune.Pi.LateIndependentExchange
