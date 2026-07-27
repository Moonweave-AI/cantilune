import Cantilune.Pi.LateMarkedIndependentExchange

namespace Cantilune.Tests.LateMarkedIndependentExchange

open Cantilune.Pi
open Cantilune.Pi.LateMarkedIndependentExchange

/-! ## Mark/erasure totality -/

example
    {source target : Raw.Proc} {action : Raw.Action}
    (step : Late.NativeStep source action target) :
    ∃ event, RawMarkedStep source action event target :=
  rawNativeStep_hasMark step

example
    {source target : RecursiveProc} {action : Raw.Action}
    (step : RecursiveLate.NativeStep source action target) :
    ∃ event, RecursiveMarkedStep source action event target :=
  recursiveNativeStep_hasMark step

example
    {source target : RecursiveProc} {action : Raw.Action}
    {event : RecursiveNativeEvent}
    (step : RecursiveMarkedStep source action event target) :
    RecursiveLate.NativeStep source action target :=
  step.erase

/-! ## Hidden same-channel synchronization support -/

def sameChannelFirstEvent : RecursiveNativeEvent :=
  .syncLeft 7 1 11
    (.prefixOutput 7 1) (.prefixInput 7 11)

def sameChannelSecondEvent : RecursiveNativeEvent :=
  .syncLeft 7 2 12
    (.prefixOutput 7 2) (.prefixInput 7 12)

theorem sameChannelFirstMarked :
    RecursiveMarkedStep
      (.par (.send 7 1 .zero) (.recv 7 11 .zero))
      .tau sameChannelFirstEvent
      (.par .zero .zero) := by
  simpa [sameChannelFirstEvent,
    RecursiveProc.substituteCaptureAvoiding,
    RecursiveProc.captureRisk, RecursiveProc.substRaw] using
    (RecursiveMarkedStep.syncLeft
      (RecursiveMarkedStep.prefixOutput
        (channel := 7) (value := 1) (next := .zero))
      (RecursiveMarkedStep.prefixInput
        (channel := 7) (binder := 11) (next := .zero))
      (by simp [RecursiveProc.freeNames] :
        11 ∉ (RecursiveProc.zero).freeNames))

theorem sameChannelSecondMarked :
    RecursiveMarkedStep
      (.par (.send 7 2 .zero) (.recv 7 12 .zero))
      .tau sameChannelSecondEvent
      (.par .zero .zero) := by
  simpa [sameChannelSecondEvent,
    RecursiveProc.substituteCaptureAvoiding,
    RecursiveProc.captureRisk, RecursiveProc.substRaw] using
    (RecursiveMarkedStep.syncLeft
      (RecursiveMarkedStep.prefixOutput
        (channel := 7) (value := 2) (next := .zero))
      (RecursiveMarkedStep.prefixInput
        (channel := 7) (binder := 12) (next := .zero))
      (by simp [RecursiveProc.freeNames] :
        12 ∉ (RecursiveProc.zero).freeNames))

/--
Although both ordinary labels are `tau`, the occurrence supports retain
channel `7` and therefore reject support independence.
-/
example :
    ¬ RecursiveEventIndependent
        sameChannelFirstEvent sameChannelSecondEvent := by
  simp [RecursiveEventIndependent,
    sameChannelFirstEvent, sameChannelSecondEvent,
    RecursiveNativeEvent.support, Finset.disjoint_left]

/-! ## A reversed choice pair is not a parallel residual square -/

def choiceAB : RecursiveProc :=
  .send 0 1 (.send 2 3 .zero)

def choiceBA : RecursiveProc :=
  .send 2 3 (.send 0 1 .zero)

def exclusiveChoice : RecursiveProc :=
  .choice choiceAB choiceBA

theorem exclusiveChoice_first_trace :
    RecursiveMarkedTrace
      exclusiveChoice
      [.choiceLeft (.prefixOutput 0 1),
        .prefixOutput 2 3]
      .zero := by
  exact RecursiveMarkedTrace.cons
    (RecursiveMarkedStep.choiceLeft
      RecursiveMarkedStep.prefixOutput)
    (RecursiveMarkedTrace.cons
      RecursiveMarkedStep.prefixOutput
      (RecursiveMarkedTrace.nil _))

theorem exclusiveChoice_second_trace :
    RecursiveMarkedTrace
      exclusiveChoice
      [.choiceRight (.prefixOutput 2 3),
        .prefixOutput 0 1]
      .zero := by
  exact RecursiveMarkedTrace.cons
    (RecursiveMarkedStep.choiceRight
      RecursiveMarkedStep.prefixOutput)
    (RecursiveMarkedTrace.cons
      RecursiveMarkedStep.prefixOutput
      (RecursiveMarkedTrace.nil _))

/--
The two reversed native traces above do not provide the component
occurrences required by `ParallelResidualSquare.ofComponents`.
-/
example :
    ¬ ParallelResidualSquare
        exclusiveChoice
        (.prefixOutput 0 1)
        (.prefixOutput 2 3)
        .zero :=
  no_parallelResidualSquare_from_choice _ _ _ _ _

/-! ## A non-vacuous guarded-replication residual diamond -/

def replicatedLeft : RecursiveProc :=
  .repSend 0 1 .zero

def replicatedRight : RecursiveProc :=
  .repSend 2 3 .zero

def replicatedLeftTarget : RecursiveProc :=
  .par .zero replicatedLeft

def replicatedRightTarget : RecursiveProc :=
  .par .zero replicatedRight

def replicatedLeftEvent : RecursiveNativeEvent :=
  .replicatedOutput 0 1

def replicatedRightEvent : RecursiveNativeEvent :=
  .replicatedOutput 2 3

theorem replicatedDistinctChannelSquare :
    ParallelResidualSquare
      (.par replicatedLeft replicatedRight)
      replicatedLeftEvent replicatedRightEvent
      (.par replicatedLeftTarget replicatedRightTarget) := by
  apply ParallelResidualSquare.ofComponents
  · exact RecursiveMarkedStep.replicatedOutput
  · exact RecursiveMarkedStep.replicatedOutput
  · simp [RecursiveEventIndependent,
      replicatedLeftEvent, replicatedRightEvent,
      RecursiveNativeEvent.support, Finset.disjoint_left]
  · simp [Raw.Action.boundNames]
  · simp [Raw.Action.boundNames]
  · simp [Raw.Action.boundNames]
  · simp [Raw.Action.boundNames]

example :
    RecursiveMarkedTrace
        (.par replicatedLeft replicatedRight)
        [.parLeft replicatedLeftEvent,
          .parRight replicatedRightEvent]
        (.par replicatedLeftTarget replicatedRightTarget) ∧
      RecursiveMarkedTrace
        (.par replicatedLeft replicatedRight)
        [.parRight replicatedRightEvent,
          .parLeft replicatedLeftEvent]
        (.par replicatedLeftTarget replicatedRightTarget) :=
  replicatedDistinctChannelSquare.exact_marked_diamond

#print axioms Cantilune.Pi.LateMarkedIndependentExchange.RawMarkedStep.erase
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.rawNativeStep_hasMark
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.RecursiveMarkedStep.erase
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.recursiveNativeStep_hasMark
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.ParallelResidualSquare.exact_marked_diamond
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.no_parallelResidualSquare_from_choice

end Cantilune.Tests.LateMarkedIndependentExchange
