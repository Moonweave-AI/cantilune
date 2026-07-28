import Cantilune.Pi.LateAlphaSupport

/-!
# Finite-control operational boundary for named identities

The presented `OpenSMC` has algebraic identities, but an operational
realization by one fixed `Raw.Proc` must respect the finite-control late-pi
syntax: there is no replication or recursion.  This file records the exact
consequence of that restriction.

Every structurally closed strong-late step strictly decreases
`Raw.Proc.prefixCount`.  Hence a length-indexed run from a fixed process has
length at most the source prefix count, and neither structural nor native
semantics admits an infinite run from that process.

This is only a reusable-identity boundary.  Any implementation that forwards
arbitrarily many requests, with at least one operational transition per use,
would require arbitrarily long runs and is therefore not representable by one
fixed finite-control process.  The result does not exclude finite linear
one-shot wiring: a concrete two-action receive/send relay is exhibited below.
It also does not prove that every possible named open-pi category is
impossible; replication, recursion, a state-indexed family of processes, or a
separate wiring semantics lie outside the theorem.
-/

namespace Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary

open Cantilune.Pi

/-! ## Finite structurally closed runs -/

/--
A finite strong-late run modulo structural congruence.

The index is the exact number of operational transitions.  Pure structural
congruence is not counted as a transition; it occurs only inside `Late.Step`.
-/
inductive StrongLateTrace :
    Nat → Raw.Proc → Raw.Proc → Prop
  | nil (process : Raw.Proc) :
      StrongLateTrace 0 process process
  | snoc
      (history : StrongLateTrace length source middle)
      (last : Late.Step middle action target) :
      StrongLateTrace (Nat.succ length) source target

namespace StrongLateTrace

/--
After `length` structurally closed steps, the remaining prefix budget plus
the number of consumed steps is bounded by the initial prefix budget.
-/
theorem target_prefixCount_add_length_le
    (trace : StrongLateTrace length source target) :
    target.prefixCount + length ≤ source.prefixCount := by
  induction trace with
  | nil =>
      simp
  | snoc history last inductionHypothesis =>
      have decrease :=
        Late.Step.target_prefixCount_lt last
      omega

/-- Every structurally closed finite run is bounded by its source syntax. -/
theorem length_le_source_prefixCount
    (trace : StrongLateTrace length source target) :
    length ≤ source.prefixCount := by
  have bound := trace.target_prefixCount_add_length_le
  omega

end StrongLateTrace

/-! ## Native runs embed into the structural relation -/

/-- A finite run using only genuine `Late.NativeStep` constructors. -/
inductive NativeTrace :
    Nat → Raw.Proc → Raw.Proc → Prop
  | nil (process : Raw.Proc) :
      NativeTrace 0 process process
  | snoc
      (history : NativeTrace length source middle)
      (last : Late.NativeStep middle action target) :
      NativeTrace (Nat.succ length) source target

namespace NativeTrace

/-- Every native run is also a run in the structurally closed late LTS. -/
theorem toStrongLate
    (trace : NativeTrace length source target) :
    StrongLateTrace length source target := by
  induction trace with
  | nil process =>
      exact StrongLateTrace.nil process
  | snoc history last inductionHypothesis =>
      exact
        StrongLateTrace.snoc inductionHypothesis
          (Late.Step.native last)

/-- Native runs inherit the exact remaining-prefix budget. -/
theorem target_prefixCount_add_length_le
    (trace : NativeTrace length source target) :
    target.prefixCount + length ≤ source.prefixCount :=
  trace.toStrongLate.target_prefixCount_add_length_le

/-- A native run cannot exceed the source prefix count. -/
theorem length_le_source_prefixCount
    (trace : NativeTrace length source target) :
    length ≤ source.prefixCount :=
  trace.toStrongLate.length_le_source_prefixCount

end NativeTrace

/-! ## Unbounded and infinite executions are impossible -/

/--
The minimal execution-budget condition needed by any fixed process that is
claimed to serve arbitrarily many operational uses: for every requested
length there is a run at least that long.

This predicate deliberately says nothing about forwarding labels or category
laws.  It is a necessary budget condition, not a definition of an identity.
-/
def HasArbitrarilyLongStrongLateRuns
    (process : Raw.Proc) : Prop :=
  ∀ requested,
    ∃ length target,
      requested ≤ length ∧
      StrongLateTrace length process target

/-- No fixed finite-control process has arbitrarily long strong-late runs. -/
theorem no_arbitrarily_long_strong_late_runs
    (process : Raw.Proc) :
    ¬ HasArbitrarilyLongStrongLateRuns process := by
  intro unbounded
  obtain ⟨length, target, requestedLe, trace⟩ :=
    unbounded (process.prefixCount + 1)
  have lengthLe :=
    trace.length_le_source_prefixCount
  omega

/-- Native-only version of the same minimal unbounded-run condition. -/
def HasArbitrarilyLongNativeRuns
    (process : Raw.Proc) : Prop :=
  ∀ requested,
    ∃ length target,
      requested ≤ length ∧
      NativeTrace length process target

/--
No fixed finite-control process can be an unbounded native forwarder in the
minimal sense of admitting arbitrarily long native executions.
-/
theorem no_unbounded_native_forwarder
    (process : Raw.Proc) :
    ¬ HasArbitrarilyLongNativeRuns process := by
  intro unbounded
  obtain ⟨length, target, requestedLe, trace⟩ :=
    unbounded (process.prefixCount + 1)
  have lengthLe :=
    trace.length_le_source_prefixCount
  omega

/-- A coherent infinite structural run, including every adjacent action. -/
structure InfiniteStrongLateRun
    (initial : Raw.Proc) where
  state : Nat → Raw.Proc
  action : Nat → Raw.Action
  state_zero : state 0 = initial
  step :
    ∀ index,
      Late.Step
        (state index) (action index) (state (index + 1))

namespace InfiniteStrongLateRun

/-- Every finite initial segment of an alleged infinite run is bounded. -/
theorem take
    (run : InfiniteStrongLateRun initial) :
    (length : Nat) →
      StrongLateTrace length initial (run.state length)
  | 0 => by
      simpa [run.state_zero] using
        (StrongLateTrace.nil initial)
  | length + 1 =>
      StrongLateTrace.snoc
        (run.take length)
        (run.step length)

end InfiniteStrongLateRun

/-- There is no infinite structurally closed run from a finite raw process. -/
theorem no_infinite_strong_late_run
    (process : Raw.Proc) :
    ¬ Nonempty (InfiniteStrongLateRun process) := by
  rintro ⟨run⟩
  have trace :=
    run.take (process.prefixCount + 1)
  have bound :=
    trace.length_le_source_prefixCount
  omega

/-- A coherent infinite native run. -/
structure InfiniteNativeRun
    (initial : Raw.Proc) where
  state : Nat → Raw.Proc
  action : Nat → Raw.Action
  state_zero : state 0 = initial
  step :
    ∀ index,
      Late.NativeStep
        (state index) (action index) (state (index + 1))

namespace InfiniteNativeRun

/-- Native infinite runs would induce structural infinite runs. -/
def toStrongLate
    (run : InfiniteNativeRun initial) :
    InfiniteStrongLateRun initial where
  state := run.state
  action := run.action
  state_zero := run.state_zero
  step index := Late.Step.native (run.step index)

end InfiniteNativeRun

/-- In particular, no fixed finite-control raw process has an infinite run. -/
theorem no_infinite_native_run
    (process : Raw.Proc) :
    ¬ Nonempty (InfiniteNativeRun process) := by
  rintro ⟨run⟩
  exact
    no_infinite_strong_late_run process
      ⟨run.toStrongLate⟩

/-! ## A finite one-shot relay remains possible -/

/--
A concrete linear relay: receive once on name `0`, then output the received
binder once on name `1`.

This is an operational witness only.  It is not claimed to satisfy category
identity laws or the named plug/hide discipline.
-/
def oneShotRelay : Raw.Proc :=
  .recv 0 2 (.send 1 2 .zero)

@[simp]
theorem oneShotRelay_prefixCount :
    oneShotRelay.prefixCount = 2 :=
  rfl

@[simp]
theorem oneShotRelay_support :
    oneShotRelay.freeNames = {0, 1} := by
  ext name
  simp [oneShotRelay, Raw.Proc.freeNames]
  aesop

/-- The relay has the intended finite two-step input/output execution. -/
theorem oneShotRelay_native_trace :
    NativeTrace 2 oneShotRelay .zero := by
  exact
    NativeTrace.snoc
      (NativeTrace.snoc
        (NativeTrace.nil oneShotRelay)
        Late.NativeStep.prefixInput)
      Late.NativeStep.prefixOutput

/--
The finite-control obstruction leaves the concrete two-step relay intact,
while correctly rejecting arbitrary reuse of that same fixed syntax.
-/
theorem oneShotRelay_not_unbounded :
    ¬ HasArbitrarilyLongNativeRuns oneShotRelay :=
  no_unbounded_native_forwarder oneShotRelay

end Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary
