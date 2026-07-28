import Cantilune.Pi.LateGuardedReplication

/-!
# Provenanced marked events and parallel residual squares for late pi

`Late.NativeStep` and `RecursiveLate.NativeStep` deliberately remain the
authoritative operational relations.  This module adds an independent marked
presentation whose event values retain information erased by a
`Raw.Action`:

* the selected `choice` and `par` path;
* the hidden channel and premises of `sync` and `close`;
* restriction/open provenance; and
* the particular guarded-replication rule which fired.

Every marked step erases to exactly one existing native step, and every
existing native step has at least one mark.  No weak transition or new
operational rule is introduced.

The `ParallelResidualSquare` relation has only one constructor.  It can be
built only from one marked occurrence in the left component and one marked
occurrence in the right component.  In particular, two coincidentally
reversed traces through different choice branches are not sufficient.

This first residual theorem intentionally carries all four native
bound-name freshness premises explicitly.  It does not claim that residual
freshness follows from event-support disjointness, nor does it perform
alpha-freshening of a conflicting bound action.  Those are separate nominal
residual obligations.
-/

namespace Cantilune.Pi
namespace LateMarkedIndependentExchange

/-! ## Finite-control marked events -/

/--
Data retained for one finite-control native occurrence.

Unlike `Raw.Action.tau`, the `sync` and `close` constructors retain the
communication channel and their two premise occurrences.
-/
inductive RawNativeEvent where
  | prefixTau
  | prefixOutput (channel value : Name)
  | prefixInput (channel binder : Name)
  | matchGuard (name : Name) (inner : RawNativeEvent)
  | mismatchGuard (left right : Name) (inner : RawNativeEvent)
  | choiceLeft (inner : RawNativeEvent)
  | choiceRight (inner : RawNativeEvent)
  | parLeft (inner : RawNativeEvent)
  | parRight (inner : RawNativeEvent)
  | syncLeft
      (channel value binder : Name)
      (output input : RawNativeEvent)
  | syncRight
      (channel value binder : Name)
      (input output : RawNativeEvent)
  | restrict (binder : Name) (inner : RawNativeEvent)
  | open
      (channel fresh : Name) (output : RawNativeEvent)
  | closeLeft
      (channel fresh binder : Name)
      (output input : RawNativeEvent)
  | closeRight
      (channel fresh binder : Name)
      (input output : RawNativeEvent)
  deriving DecidableEq, Repr

namespace RawNativeEvent

/-- The ordinary strong-late label obtained by forgetting occurrence data. -/
def action : RawNativeEvent → Raw.Action
  | .prefixTau => .tau
  | .prefixOutput channel value => .output channel value
  | .prefixInput channel binder => .input channel binder
  | .matchGuard _ inner
  | .mismatchGuard _ _ inner
  | .choiceLeft inner
  | .choiceRight inner
  | .parLeft inner
  | .parRight inner
  | .restrict _ inner => inner.action
  | .syncLeft _ _ _ _ _
  | .syncRight _ _ _ _ _
  | .closeLeft _ _ _ _ _
  | .closeRight _ _ _ _ _ => .tau
  | .open channel fresh _ => .boundOutput channel fresh

/--
Finite operational support of an occurrence.

For a silent communication this deliberately retains the channel, payload,
input binder, and premise supports which the `tau` label itself forgets.
Restriction also retains its hidden boundary name.
-/
def support : RawNativeEvent → Finset Name
  | .prefixTau => ∅
  | .prefixOutput channel value => {channel, value}
  | .prefixInput channel binder => {channel, binder}
  | .matchGuard name inner =>
      insert name inner.support
  | .mismatchGuard left right inner =>
      insert left (insert right inner.support)
  | .choiceLeft inner
  | .choiceRight inner
  | .parLeft inner
  | .parRight inner => inner.support
  | .syncLeft channel value binder output input
  | .syncRight channel value binder input output =>
      insert channel
        (insert value
          (insert binder (output.support ∪ input.support)))
  | .restrict binder inner =>
      insert binder inner.support
  | .open channel fresh output =>
      insert channel (insert fresh output.support)
  | .closeLeft channel fresh binder output input
  | .closeRight channel fresh binder input output =>
      insert channel
        (insert fresh
          (insert binder (output.support ∪ input.support)))

end RawNativeEvent

/--
A finite-control native step with a data-valued occurrence mark.

The action remains an index so communication premises are checked against
their exact output/input labels.  `RawMarkedStep.event_action` proves that
the data mark computes that same index.
-/
inductive RawMarkedStep :
    Raw.Proc → Raw.Action → RawNativeEvent → Raw.Proc → Prop where
  | prefixTau :
      RawMarkedStep (.tau next) .tau .prefixTau next
  | prefixOutput :
      RawMarkedStep
        (.send channel value next)
        (.output channel value)
        (.prefixOutput channel value)
        next
  | prefixInput :
      RawMarkedStep
        (.recv channel binder next)
        (.input channel binder)
        (.prefixInput channel binder)
        next
  | matchGuard
      (step : RawMarkedStep body action event target) :
      RawMarkedStep
        (.matchEq name name body) action
        (.matchGuard name event) target
  | mismatchGuard
      (distinct : left ≠ right)
      (step : RawMarkedStep body action event target) :
      RawMarkedStep
        (.matchNe left right body) action
        (.mismatchGuard left right event) target
  | choiceLeft
      (step : RawMarkedStep left action event next) :
      RawMarkedStep
        (.choice left right) action (.choiceLeft event) next
  | choiceRight
      (step : RawMarkedStep right action event next) :
      RawMarkedStep
        (.choice left right) action (.choiceRight event) next
  | parLeft
      (fresh : Disjoint action.boundNames right.freeNames)
      (step : RawMarkedStep left action event next) :
      RawMarkedStep
        (.par left right) action (.parLeft event) (.par next right)
  | parRight
      (fresh : Disjoint action.boundNames left.freeNames)
      (step : RawMarkedStep right action event next) :
      RawMarkedStep
        (.par left right) action (.parRight event) (.par left next)
  | syncLeft
      (outputStep :
        RawMarkedStep left (.output channel value)
          outputEvent left')
      (inputStep :
        RawMarkedStep right (.input channel binder)
          inputEvent right')
      (fresh : binder ∉ left'.freeNames) :
      RawMarkedStep
        (.par left right) .tau
        (.syncLeft channel value binder outputEvent inputEvent)
        (.par left'
          (right'.substituteCaptureAvoiding binder value))
  | syncRight
      (inputStep :
        RawMarkedStep left (.input channel binder)
          inputEvent left')
      (outputStep :
        RawMarkedStep right (.output channel value)
          outputEvent right')
      (fresh : binder ∉ right'.freeNames) :
      RawMarkedStep
        (.par left right) .tau
        (.syncRight channel value binder inputEvent outputEvent)
        (.par
          (left'.substituteCaptureAvoiding binder value)
          right')
  | restrict
      (fresh : binder ∉ action.names)
      (step : RawMarkedStep body action event next) :
      RawMarkedStep
        (.new binder body) action
        (.restrict binder event) (.new binder next)
  | open
      (distinct : fresh ≠ channel)
      (step :
        RawMarkedStep body (.output channel fresh)
          outputEvent next) :
      RawMarkedStep
        (.new fresh body) (.boundOutput channel fresh)
        (.open channel fresh outputEvent) next
  | closeLeft
      (outputStep :
        RawMarkedStep left (.boundOutput channel fresh)
          outputEvent left')
      (inputStep :
        RawMarkedStep right (.input channel binder)
          inputEvent right')
      (freshForReceiver : fresh ∉ right.freeNames)
      (binderFresh : binder ∉ left'.freeNames) :
      RawMarkedStep
        (.par left right) .tau
        (.closeLeft channel fresh binder outputEvent inputEvent)
        (.new fresh
          (.par left'
            (right'.substituteCaptureAvoiding binder fresh)))
  | closeRight
      (inputStep :
        RawMarkedStep left (.input channel binder)
          inputEvent left')
      (outputStep :
        RawMarkedStep right (.boundOutput channel fresh)
          outputEvent right')
      (freshForReceiver : fresh ∉ left.freeNames)
      (binderFresh : binder ∉ right'.freeNames) :
      RawMarkedStep
        (.par left right) .tau
        (.closeRight channel fresh binder inputEvent outputEvent)
        (.new fresh
          (.par
            (left'.substituteCaptureAvoiding binder fresh)
            right'))

namespace RawMarkedStep

/-- A finite marked step's event computes its indexed native action. -/
theorem event_action
    (step : RawMarkedStep source action event target) :
    event.action = action := by
  induction step <;>
    simp_all [RawNativeEvent.action]

/-- Forgetting a finite event mark yields exactly the existing native step. -/
theorem erase
    (step : RawMarkedStep source action event target) :
    Late.NativeStep source action target := by
  induction step with
  | prefixTau =>
      exact Late.NativeStep.prefixTau
  | prefixOutput =>
      exact Late.NativeStep.prefixOutput
  | prefixInput =>
      exact Late.NativeStep.prefixInput
  | matchGuard _ inductionHypothesis =>
      exact Late.NativeStep.matchGuard inductionHypothesis
  | mismatchGuard distinct _ inductionHypothesis =>
      exact Late.NativeStep.mismatchGuard distinct inductionHypothesis
  | choiceLeft _ inductionHypothesis =>
      exact Late.NativeStep.choiceLeft inductionHypothesis
  | choiceRight _ inductionHypothesis =>
      exact Late.NativeStep.choiceRight inductionHypothesis
  | parLeft fresh _ inductionHypothesis =>
      exact Late.NativeStep.parLeft fresh inductionHypothesis
  | parRight fresh _ inductionHypothesis =>
      exact Late.NativeStep.parRight fresh inductionHypothesis
  | syncLeft _ _ fresh outputIH inputIH =>
      exact Late.NativeStep.syncLeft outputIH inputIH fresh
  | syncRight _ _ fresh inputIH outputIH =>
      exact Late.NativeStep.syncRight inputIH outputIH fresh
  | restrict fresh _ inductionHypothesis =>
      exact Late.NativeStep.restrict fresh inductionHypothesis
  | «open» distinct _ inductionHypothesis =>
      exact Late.NativeStep.open distinct inductionHypothesis
  | closeLeft _ _ freshForReceiver binderFresh outputIH inputIH =>
      exact Late.NativeStep.closeLeft
        outputIH inputIH freshForReceiver binderFresh
  | closeRight _ _ freshForReceiver binderFresh inputIH outputIH =>
      exact Late.NativeStep.closeRight
        inputIH outputIH freshForReceiver binderFresh

end RawMarkedStep

/-- Every finite native derivation has a path- and cause-preserving mark. -/
theorem rawNativeStep_hasMark
    (step : Late.NativeStep source action target) :
    ∃ event, RawMarkedStep source action event target := by
  induction step with
  | prefixTau =>
      exact ⟨.prefixTau, RawMarkedStep.prefixTau⟩
  | prefixOutput =>
      exact ⟨.prefixOutput _ _, RawMarkedStep.prefixOutput⟩
  | prefixInput =>
      exact ⟨.prefixInput _ _, RawMarkedStep.prefixInput⟩
  | matchGuard _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.matchGuard _ event, RawMarkedStep.matchGuard marked⟩
  | mismatchGuard distinct _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact
        ⟨.mismatchGuard _ _ event,
          RawMarkedStep.mismatchGuard distinct marked⟩
  | choiceLeft _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.choiceLeft event, RawMarkedStep.choiceLeft marked⟩
  | choiceRight _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.choiceRight event, RawMarkedStep.choiceRight marked⟩
  | parLeft fresh _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.parLeft event, RawMarkedStep.parLeft fresh marked⟩
  | parRight fresh _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.parRight event, RawMarkedStep.parRight fresh marked⟩
  | syncLeft _ _ fresh outputIH inputIH =>
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      exact
        ⟨.syncLeft _ _ _ outputEvent inputEvent,
          RawMarkedStep.syncLeft outputMarked inputMarked fresh⟩
  | syncRight _ _ fresh inputIH outputIH =>
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      exact
        ⟨.syncRight _ _ _ inputEvent outputEvent,
          RawMarkedStep.syncRight inputMarked outputMarked fresh⟩
  | restrict fresh _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.restrict _ event, RawMarkedStep.restrict fresh marked⟩
  | «open» distinct _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact
        ⟨.open _ _ event,
          RawMarkedStep.open distinct marked⟩
  | closeLeft _ _ freshForReceiver binderFresh outputIH inputIH =>
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      exact
        ⟨.closeLeft _ _ _ outputEvent inputEvent,
          RawMarkedStep.closeLeft outputMarked inputMarked
            freshForReceiver binderFresh⟩
  | closeRight _ _ freshForReceiver binderFresh inputIH outputIH =>
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      exact
        ⟨.closeRight _ _ _ inputEvent outputEvent,
          RawMarkedStep.closeRight inputMarked outputMarked
            freshForReceiver binderFresh⟩

/-! ## Guarded-recursive marked events -/

/--
Data retained for one guarded-recursive native occurrence.

`embedded` distinguishes use of the conservative finite-control inclusion;
the three final constructors distinguish the replication rule which fired.
-/
inductive RecursiveNativeEvent where
  | embedded (event : RawNativeEvent)
  | prefixTau
  | prefixOutput (channel value : Name)
  | prefixInput (channel binder : Name)
  | matchGuard (name : Name) (inner : RecursiveNativeEvent)
  | mismatchGuard (left right : Name) (inner : RecursiveNativeEvent)
  | choiceLeft (inner : RecursiveNativeEvent)
  | choiceRight (inner : RecursiveNativeEvent)
  | parLeft (inner : RecursiveNativeEvent)
  | parRight (inner : RecursiveNativeEvent)
  | syncLeft
      (channel value binder : Name)
      (output input : RecursiveNativeEvent)
  | syncRight
      (channel value binder : Name)
      (input output : RecursiveNativeEvent)
  | restrict (binder : Name) (inner : RecursiveNativeEvent)
  | open
      (channel fresh : Name) (output : RecursiveNativeEvent)
  | closeLeft
      (channel fresh binder : Name)
      (output input : RecursiveNativeEvent)
  | closeRight
      (channel fresh binder : Name)
      (input output : RecursiveNativeEvent)
  | replicatedTau
  | replicatedOutput (channel value : Name)
  | replicatedInput (channel binder : Name)
  deriving DecidableEq, Repr

namespace RecursiveNativeEvent

/-- The ordinary strong-late label obtained by forgetting occurrence data. -/
def action : RecursiveNativeEvent → Raw.Action
  | .embedded event => event.action
  | .prefixTau
  | .replicatedTau => .tau
  | .prefixOutput channel value
  | .replicatedOutput channel value => .output channel value
  | .prefixInput channel binder
  | .replicatedInput channel binder => .input channel binder
  | .matchGuard _ inner
  | .mismatchGuard _ _ inner
  | .choiceLeft inner
  | .choiceRight inner
  | .parLeft inner
  | .parRight inner
  | .restrict _ inner => inner.action
  | .syncLeft _ _ _ _ _
  | .syncRight _ _ _ _ _
  | .closeLeft _ _ _ _ _
  | .closeRight _ _ _ _ _ => .tau
  | .open channel fresh _ => .boundOutput channel fresh

/-- Finite operational support, including hidden communication subjects. -/
def support : RecursiveNativeEvent → Finset Name
  | .embedded event => event.support
  | .prefixTau
  | .replicatedTau => ∅
  | .prefixOutput channel value
  | .replicatedOutput channel value => {channel, value}
  | .prefixInput channel binder
  | .replicatedInput channel binder => {channel, binder}
  | .matchGuard name inner =>
      insert name inner.support
  | .mismatchGuard left right inner =>
      insert left (insert right inner.support)
  | .choiceLeft inner
  | .choiceRight inner
  | .parLeft inner
  | .parRight inner => inner.support
  | .syncLeft channel value binder output input
  | .syncRight channel value binder input output =>
      insert channel
        (insert value
          (insert binder (output.support ∪ input.support)))
  | .restrict binder inner =>
      insert binder inner.support
  | .open channel fresh output =>
      insert channel (insert fresh output.support)
  | .closeLeft channel fresh binder output input
  | .closeRight channel fresh binder input output =>
      insert channel
        (insert fresh
          (insert binder (output.support ∪ input.support)))

end RecursiveNativeEvent

/-- Guarded-recursive native steps with data-valued occurrence marks. -/
inductive RecursiveMarkedStep :
    RecursiveProc → Raw.Action → RecursiveNativeEvent →
      RecursiveProc → Prop where
  | embedded
      (step : RawMarkedStep source action event target) :
      RecursiveMarkedStep
        (RecursiveProc.ofRaw source) action
        (.embedded event) (RecursiveProc.ofRaw target)
  | prefixTau :
      RecursiveMarkedStep (.tau next) .tau .prefixTau next
  | prefixOutput :
      RecursiveMarkedStep
        (.send channel value next)
        (.output channel value)
        (.prefixOutput channel value)
        next
  | prefixInput :
      RecursiveMarkedStep
        (.recv channel binder next)
        (.input channel binder)
        (.prefixInput channel binder)
        next
  | matchGuard
      (step : RecursiveMarkedStep body action event target) :
      RecursiveMarkedStep
        (.matchEq name name body) action
        (.matchGuard name event) target
  | mismatchGuard
      (distinct : left ≠ right)
      (step : RecursiveMarkedStep body action event target) :
      RecursiveMarkedStep
        (.matchNe left right body) action
        (.mismatchGuard left right event) target
  | choiceLeft
      (step : RecursiveMarkedStep left action event next) :
      RecursiveMarkedStep
        (.choice left right) action (.choiceLeft event) next
  | choiceRight
      (step : RecursiveMarkedStep right action event next) :
      RecursiveMarkedStep
        (.choice left right) action (.choiceRight event) next
  | parLeft
      (fresh : Disjoint action.boundNames right.freeNames)
      (step : RecursiveMarkedStep left action event next) :
      RecursiveMarkedStep
        (.par left right) action (.parLeft event) (.par next right)
  | parRight
      (fresh : Disjoint action.boundNames left.freeNames)
      (step : RecursiveMarkedStep right action event next) :
      RecursiveMarkedStep
        (.par left right) action (.parRight event) (.par left next)
  | syncLeft
      (outputStep :
        RecursiveMarkedStep left (.output channel value)
          outputEvent left')
      (inputStep :
        RecursiveMarkedStep right (.input channel binder)
          inputEvent right')
      (fresh : binder ∉ left'.freeNames) :
      RecursiveMarkedStep
        (.par left right) .tau
        (.syncLeft channel value binder outputEvent inputEvent)
        (.par left'
          (right'.substituteCaptureAvoiding binder value))
  | syncRight
      (inputStep :
        RecursiveMarkedStep left (.input channel binder)
          inputEvent left')
      (outputStep :
        RecursiveMarkedStep right (.output channel value)
          outputEvent right')
      (fresh : binder ∉ right'.freeNames) :
      RecursiveMarkedStep
        (.par left right) .tau
        (.syncRight channel value binder inputEvent outputEvent)
        (.par
          (left'.substituteCaptureAvoiding binder value)
          right')
  | restrict
      (fresh : binder ∉ action.names)
      (step : RecursiveMarkedStep body action event next) :
      RecursiveMarkedStep
        (.new binder body) action
        (.restrict binder event) (.new binder next)
  | open
      (distinct : fresh ≠ channel)
      (step :
        RecursiveMarkedStep body (.output channel fresh)
          outputEvent next) :
      RecursiveMarkedStep
        (.new fresh body) (.boundOutput channel fresh)
        (.open channel fresh outputEvent) next
  | closeLeft
      (outputStep :
        RecursiveMarkedStep left (.boundOutput channel fresh)
          outputEvent left')
      (inputStep :
        RecursiveMarkedStep right (.input channel binder)
          inputEvent right')
      (freshForReceiver : fresh ∉ right.freeNames)
      (binderFresh : binder ∉ left'.freeNames) :
      RecursiveMarkedStep
        (.par left right) .tau
        (.closeLeft channel fresh binder outputEvent inputEvent)
        (.new fresh
          (.par left'
            (right'.substituteCaptureAvoiding binder fresh)))
  | closeRight
      (inputStep :
        RecursiveMarkedStep left (.input channel binder)
          inputEvent left')
      (outputStep :
        RecursiveMarkedStep right (.boundOutput channel fresh)
          outputEvent right')
      (freshForReceiver : fresh ∉ left.freeNames)
      (binderFresh : binder ∉ right'.freeNames) :
      RecursiveMarkedStep
        (.par left right) .tau
        (.closeRight channel fresh binder inputEvent outputEvent)
        (.new fresh
          (.par
            (left'.substituteCaptureAvoiding binder fresh)
            right'))
  | replicatedTau :
      RecursiveMarkedStep
        (.repTau body) .tau .replicatedTau
        (.par body (.repTau body))
  | replicatedOutput :
      RecursiveMarkedStep
        (.repSend channel value body)
        (.output channel value)
        (.replicatedOutput channel value)
        (.par body (.repSend channel value body))
  | replicatedInput :
      RecursiveMarkedStep
        (.repRecv channel binder body)
        (.input channel binder)
        (.replicatedInput channel binder)
        (.par body (.repRecv channel binder body))

namespace RecursiveMarkedStep

/-- A recursive marked step's event computes its indexed native action. -/
theorem event_action
    (step : RecursiveMarkedStep source action event target) :
    event.action = action := by
  induction step <;>
    simp_all [RecursiveNativeEvent.action]
  apply RawMarkedStep.event_action
  assumption

/-- Forgetting a recursive event mark yields the existing native step. -/
theorem erase
    (step : RecursiveMarkedStep source action event target) :
    RecursiveLate.NativeStep source action target := by
  induction step with
  | embedded rawStep =>
      exact RecursiveLate.NativeStep.embedded rawStep.erase
  | prefixTau =>
      exact RecursiveLate.NativeStep.prefixTau
  | prefixOutput =>
      exact RecursiveLate.NativeStep.prefixOutput
  | prefixInput =>
      exact RecursiveLate.NativeStep.prefixInput
  | matchGuard _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.matchGuard inductionHypothesis
  | mismatchGuard distinct _ inductionHypothesis =>
      exact
        RecursiveLate.NativeStep.mismatchGuard
          distinct inductionHypothesis
  | choiceLeft _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.choiceLeft inductionHypothesis
  | choiceRight _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.choiceRight inductionHypothesis
  | parLeft fresh _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.parLeft fresh inductionHypothesis
  | parRight fresh _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.parRight fresh inductionHypothesis
  | syncLeft _ _ fresh outputIH inputIH =>
      exact RecursiveLate.NativeStep.syncLeft outputIH inputIH fresh
  | syncRight _ _ fresh inputIH outputIH =>
      exact RecursiveLate.NativeStep.syncRight inputIH outputIH fresh
  | restrict fresh _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.restrict fresh inductionHypothesis
  | «open» distinct _ inductionHypothesis =>
      exact RecursiveLate.NativeStep.open distinct inductionHypothesis
  | closeLeft _ _ freshForReceiver binderFresh outputIH inputIH =>
      exact RecursiveLate.NativeStep.closeLeft
        outputIH inputIH freshForReceiver binderFresh
  | closeRight _ _ freshForReceiver binderFresh inputIH outputIH =>
      exact RecursiveLate.NativeStep.closeRight
        inputIH outputIH freshForReceiver binderFresh
  | replicatedTau =>
      exact RecursiveLate.NativeStep.replicatedTau
  | replicatedOutput =>
      exact RecursiveLate.NativeStep.replicatedOutput
  | replicatedInput =>
      exact RecursiveLate.NativeStep.replicatedInput

end RecursiveMarkedStep

/-- Every guarded-recursive native derivation has a cause-preserving mark. -/
theorem recursiveNativeStep_hasMark
    (step : RecursiveLate.NativeStep source action target) :
    ∃ event, RecursiveMarkedStep source action event target := by
  induction step with
  | embedded oldStep =>
      rcases rawNativeStep_hasMark oldStep with ⟨event, marked⟩
      exact ⟨.embedded event, RecursiveMarkedStep.embedded marked⟩
  | prefixTau =>
      exact ⟨.prefixTau, RecursiveMarkedStep.prefixTau⟩
  | prefixOutput =>
      exact ⟨.prefixOutput _ _, RecursiveMarkedStep.prefixOutput⟩
  | prefixInput =>
      exact ⟨.prefixInput _ _, RecursiveMarkedStep.prefixInput⟩
  | matchGuard _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.matchGuard _ event, RecursiveMarkedStep.matchGuard marked⟩
  | mismatchGuard distinct _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact
        ⟨.mismatchGuard _ _ event,
          RecursiveMarkedStep.mismatchGuard distinct marked⟩
  | choiceLeft _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.choiceLeft event, RecursiveMarkedStep.choiceLeft marked⟩
  | choiceRight _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.choiceRight event, RecursiveMarkedStep.choiceRight marked⟩
  | parLeft fresh _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.parLeft event, RecursiveMarkedStep.parLeft fresh marked⟩
  | parRight fresh _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact ⟨.parRight event, RecursiveMarkedStep.parRight fresh marked⟩
  | syncLeft _ _ fresh outputIH inputIH =>
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      exact
        ⟨.syncLeft _ _ _ outputEvent inputEvent,
          RecursiveMarkedStep.syncLeft outputMarked inputMarked fresh⟩
  | syncRight _ _ fresh inputIH outputIH =>
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      exact
        ⟨.syncRight _ _ _ inputEvent outputEvent,
          RecursiveMarkedStep.syncRight inputMarked outputMarked fresh⟩
  | restrict fresh _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact
        ⟨.restrict _ event,
          RecursiveMarkedStep.restrict fresh marked⟩
  | «open» distinct _ inductionHypothesis =>
      rcases inductionHypothesis with ⟨event, marked⟩
      exact
        ⟨.open _ _ event,
          RecursiveMarkedStep.open distinct marked⟩
  | closeLeft _ _ freshForReceiver binderFresh outputIH inputIH =>
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      exact
        ⟨.closeLeft _ _ _ outputEvent inputEvent,
          RecursiveMarkedStep.closeLeft outputMarked inputMarked
            freshForReceiver binderFresh⟩
  | closeRight _ _ freshForReceiver binderFresh inputIH outputIH =>
      rcases inputIH with ⟨inputEvent, inputMarked⟩
      rcases outputIH with ⟨outputEvent, outputMarked⟩
      exact
        ⟨.closeRight _ _ _ inputEvent outputEvent,
          RecursiveMarkedStep.closeRight inputMarked outputMarked
            freshForReceiver binderFresh⟩
  | replicatedTau =>
      exact ⟨.replicatedTau, RecursiveMarkedStep.replicatedTau⟩
  | replicatedOutput =>
      exact
        ⟨.replicatedOutput _ _,
          RecursiveMarkedStep.replicatedOutput⟩
  | replicatedInput =>
      exact
        ⟨.replicatedInput _ _,
          RecursiveMarkedStep.replicatedInput⟩

/-! ## Provenanced recursive traces and residual squares -/

/-- Exact ordered trace of data-valued recursive native events. -/
inductive RecursiveMarkedTrace :
    RecursiveProc → List RecursiveNativeEvent →
      RecursiveProc → Prop where
  | nil (process : RecursiveProc) :
      RecursiveMarkedTrace process [] process
  | cons
      (step :
        RecursiveMarkedStep source action event middle)
      (tail :
        RecursiveMarkedTrace middle events target) :
      RecursiveMarkedTrace source (event :: events) target

/--
Two marked effects are support-independent when the complete operational
supports of their occurrence data are disjoint.

Unlike label-only independence, this sees the hidden channel of `sync` and
`close`.
-/
def RecursiveEventIndependent
    (left right : RecursiveNativeEvent) : Prop :=
  Disjoint left.support right.support

theorem recursiveEventIndependent_symm
    {left right : RecursiveNativeEvent}
    (independent : RecursiveEventIndependent left right) :
    RecursiveEventIndependent right left :=
  independent.symm

/--
A certified parallel residual square generated only from component
occurrences.

All four bound-name freshness premises are explicit:

* the first two lift the occurrences in the original source;
* `leftResidualFresh` lifts the left occurrence after the right moved; and
* `rightResidualFresh` lifts the right occurrence after the left moved.

No theorem in this module derives the residual premises from support
independence.
-/
inductive ParallelResidualSquare :
    RecursiveProc → RecursiveNativeEvent →
      RecursiveNativeEvent → RecursiveProc → Prop where
  | ofComponents
      (leftStep :
        RecursiveMarkedStep left leftAction leftEvent left')
      (rightStep :
        RecursiveMarkedStep right rightAction rightEvent right')
      (effects :
        RecursiveEventIndependent leftEvent rightEvent)
      (leftSourceFresh :
        Disjoint leftAction.boundNames right.freeNames)
      (rightSourceFresh :
        Disjoint rightAction.boundNames left.freeNames)
      (leftResidualFresh :
        Disjoint leftAction.boundNames right'.freeNames)
      (rightResidualFresh :
        Disjoint rightAction.boundNames left'.freeNames) :
      ParallelResidualSquare
        (.par left right) leftEvent rightEvent (.par left' right')

namespace ParallelResidualSquare

/-- Execute the marked left occurrence and then its right residual. -/
theorem first_then_second
    (square :
      ParallelResidualSquare source leftEvent rightEvent target) :
    RecursiveMarkedTrace
      source
      [.parLeft leftEvent, .parRight rightEvent]
      target := by
  cases square with
  | ofComponents leftStep rightStep effects
      leftSourceFresh rightSourceFresh
      leftResidualFresh rightResidualFresh =>
      exact RecursiveMarkedTrace.cons
        (RecursiveMarkedStep.parLeft leftSourceFresh leftStep)
        (RecursiveMarkedTrace.cons
          (RecursiveMarkedStep.parRight
            rightResidualFresh rightStep)
          (RecursiveMarkedTrace.nil _))

/-- Execute the marked right occurrence and then its left residual. -/
theorem second_then_first
    (square :
      ParallelResidualSquare source leftEvent rightEvent target) :
    RecursiveMarkedTrace
      source
      [.parRight rightEvent, .parLeft leftEvent]
      target := by
  cases square with
  | ofComponents leftStep rightStep effects
      leftSourceFresh rightSourceFresh
      leftResidualFresh rightResidualFresh =>
      exact RecursiveMarkedTrace.cons
        (RecursiveMarkedStep.parRight rightSourceFresh rightStep)
        (RecursiveMarkedTrace.cons
          (RecursiveMarkedStep.parLeft
            leftResidualFresh leftStep)
          (RecursiveMarkedTrace.nil _))

/-- The two occurrence orders form an exact marked native diamond. -/
theorem exact_marked_diamond
    (square :
      ParallelResidualSquare source leftEvent rightEvent target) :
    RecursiveMarkedTrace
        source
        [.parLeft leftEvent, .parRight rightEvent]
        target ∧
      RecursiveMarkedTrace
        source
        [.parRight rightEvent, .parLeft leftEvent]
        target :=
  ⟨square.first_then_second, square.second_then_first⟩

end ParallelResidualSquare

/--
Mutually exclusive choice branches cannot be supplied as the source of a
parallel residual square merely because they possess reversed traces.
-/
theorem no_parallelResidualSquare_from_choice
    (left right target : RecursiveProc)
    (first second : RecursiveNativeEvent) :
    ¬ ParallelResidualSquare
        (.choice left right) first second target := by
  intro square
  cases square

end LateMarkedIndependentExchange
end Cantilune.Pi
