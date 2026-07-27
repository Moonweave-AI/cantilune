import Cantilune.Pi.FMSCpoUnseparatedSourceCore
import Cantilune.Pi.FMSCpoFinitePower
import Cantilune.Pi.LateGuardedReplicationDivergence

/-!
# Guarded-recursive Hoare trace semantics for the D1-A effect

The unseparated D1-A effect cannot be fully abstract for the
constructor-sensitive strong observation used by
`FMSUnseparatedFiniteStrongNoGo`; that module proves the obstruction on a
finite tau/choice fragment.  This file constructs the selected compatible
guarded-recursive trace theorem instead.

The source is the actual guarded-recursive late-pi syntax and every trace
edge is a genuine `RecursiveLate.NativeStep`.  The target is the concrete
all-object lower omega-Scott powerdomain at the equality-ordered carrier of
nonempty finite action traces.  Since every omega-chain in an equality order
is constant, every trace language is omega-Scott closed.

No weak transition, bisimulation quotient, supplied denotation, or theorem
field is used.  The denotation is the native finite-trace language itself,
packaged in the lower/Hoare effect, so the resulting full-abstraction theorem
is for that deliberately defined trace observation.  It is not the recursively
solved FMS `Agent` model or the source-paper Agent-observation theorem.  Native
strong-step reflection and terminal divergence/deadlock classification remain
separate theorems.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSGuardedHoareTrace

open Cantilune.Pi
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open OmegaCompletePartialOrder
open Set
open CategoryTheory

/-! ## Genuine nonempty strong traces -/

/--
A nonempty finite trace made only from genuine guarded-recursive native
steps.  The target is retained, so trace membership has an operational
witness rather than merely a list label.
-/
inductive NativeTrace :
    RecursiveProc → List Raw.Action → RecursiveProc → Prop
  | one
      (step : RecursiveLate.NativeStep source action target) :
      NativeTrace source [action] target
  | cons
      (step : RecursiveLate.NativeStep source action middle)
      (tail : NativeTrace middle actions target) :
      NativeTrace source (action :: actions) target

theorem NativeTrace.actions_nonempty
    (trace : NativeTrace source actions target) :
    actions ≠ [] := by
  cases trace <;> simp

/-- Prefix a genuine native step to a possibly singleton trace. -/
theorem NativeTrace.prepend
    (head : RecursiveLate.NativeStep source action middle)
    (tail : NativeTrace middle actions target) :
    NativeTrace source (action :: actions) target :=
  .cons head tail

/-- A process operationally observes a nonempty finite native trace. -/
def Observes
    (process : RecursiveProc) (actions : List Raw.Action) : Prop :=
  ∃ target, NativeTrace process actions target

theorem observes_nonempty
    (observed : Observes process actions) :
    actions ≠ [] := by
  obtain ⟨target, trace⟩ := observed
  exact trace.actions_nonempty

/-! ## The actual all-object D1-A computation -/

/-- Equality-ordered finite action traces form an omega-CPO. -/
abbrev TraceCPO : ωCPO :=
  ωCPO.of (EqualityOrder (List Raw.Action))

/-- The concrete D1-A lower omega-Scott effect at the trace carrier. -/
abbrev TraceEffect :=
  Effect TraceCPO

/--
Every omega-chain in an equality-ordered carrier has singleton range.
-/
theorem equalityChain_range
    (chain : Chain (WithOmegaScott (EqualityOrder α))) :
    Set.range chain = {chain 0} := by
  ext value
  constructor
  · rintro ⟨index, rfl⟩
    have equal := chain.monotone (Nat.zero_le index)
    change chain 0 = chain index at equal
    simpa [equal]
  · intro member
    have equal : value = chain 0 := by
      simpa using member
    subst value
    exact ⟨0, rfl⟩

/--
Any subset of an equality-ordered omega-CPO is closed in the omega-Scott
topology used by the concrete D1-A powerdomain.
-/
theorem equalityOrder_isClosed
    (values : Set (WithOmegaScott (EqualityOrder α))) :
    IsClosed values := by
  rw [isClosed_iff_isLowerSet_and_chainSupClosed]
  constructor
  · intro upper lower lowerLe upperMember
    change lower = upper at lowerLe
    simpa [lowerLe] using upperMember
  · intro directed directedRange directedSubset _nonempty _directed
      supremum isLUB
    obtain ⟨chain, rfl⟩ := directedRange
    have rangeEqual :
        Set.range chain = {chain 0} :=
      equalityChain_range chain
    have singletonLUB :
        IsLUB {chain 0} supremum := by
      simpa [rangeEqual] using isLUB
    have supremumEqual :
        supremum = chain 0 := by
      exact singletonLUB.unique isLUB_singleton
    rw [supremumEqual]
    exact directedSubset ⟨0, rfl⟩

/-- The concrete closed trace language of a guarded-recursive process. -/
def denote (process : RecursiveProc) : TraceEffect :=
  ⟨
    { lifted |
      Observes process
        (show List Raw.Action from
          WithOmegaScott.ofOmegaScott lifted) },
    equalityOrder_isClosed _
  ⟩

/-- Membership in the concrete denotation is exactly a genuine native trace. -/
theorem mem_denote_iff
    (process : RecursiveProc)
    (actions : List Raw.Action) :
    WithOmegaScott.toOmegaScott
          (show EqualityOrder (List Raw.Action) from actions) ∈
        carrier (denote process) ↔
      Observes process actions := by
  rfl

/-- Adequacy for every guarded-recursive process and every finite trace. -/
theorem guarded_hoare_adequacy
    (process : RecursiveProc)
    (actions : List Raw.Action) :
    WithOmegaScott.toOmegaScott
          (show EqualityOrder (List Raw.Action) from actions) ∈
        carrier (denote process) ↔
      ∃ target, NativeTrace process actions target :=
  mem_denote_iff process actions

/-- Native finite-trace equivalence on arbitrary guarded-recursive processes. -/
def TraceEquivalent
    (left right : RecursiveProc) : Prop :=
  ∀ actions, Observes left actions ↔ Observes right actions

/--
Full abstraction for the D1-A-compatible native finite-trace observation.
-/
theorem guarded_hoare_full_abstraction
    (left right : RecursiveProc) :
    denote left = denote right ↔
      TraceEquivalent left right := by
  constructor
  · intro equal actions
    rw [← mem_denote_iff, ← mem_denote_iff, equal]
  · intro equivalent
    apply SetLike.ext
    intro lifted
    let actions : List Raw.Action :=
      show List Raw.Action from
        WithOmegaScott.ofOmegaScott lifted
    have liftedEqual :
        WithOmegaScott.toOmegaScott
            (show EqualityOrder (List Raw.Action) from actions) =
          lifted :=
      WithOmegaScott.toOmegaScott_ofOmegaScott lifted
    rw [← liftedEqual]
    change Observes left actions ↔ Observes right actions
    exact equivalent actions

/-! ## Concrete compositional soundness -/

/-- Every left-branch trace remains a genuine trace after adding choice. -/
theorem observes_choice_left
    (observed : Observes left actions) :
    Observes (.choice left right) actions := by
  obtain ⟨target, trace⟩ := observed
  refine ⟨target, ?_⟩
  cases trace with
  | one step =>
      exact .one (.choiceLeft step)
  | cons step tail =>
      exact .cons (.choiceLeft step) tail

/-- Every right-branch trace remains a genuine trace after adding choice. -/
theorem observes_choice_right
    (observed : Observes right actions) :
    Observes (.choice left right) actions := by
  obtain ⟨target, trace⟩ := observed
  refine ⟨target, ?_⟩
  cases trace with
  | one step =>
      exact .one (.choiceRight step)
  | cons step tail =>
      exact .cons (.choiceRight step) tail

/--
The actual semilattice union of branch computations is below the native
choice denotation.  The finite compiled fragment proves equality separately;
this general guarded theorem states only the direction independent of the
duplicated conservative `embedded` transition constructor.
-/
theorem effectChoice_le_denote_choice
    (left right : RecursiveProc) :
    effectChoice TraceCPO (denote left) (denote right) ≤
      denote (.choice left right) := by
  intro lifted member
  rcases member with leftMember | rightMember
  · exact observes_choice_left leftMember
  · exact observes_choice_right rightMember

/-- Concrete prefixing of a lower trace computation by one tau action. -/
def tauPrefixEffect
    (values : TraceEffect) : TraceEffect :=
  ⟨
    { lifted |
      let actions : List Raw.Action :=
        show List Raw.Action from
          WithOmegaScott.ofOmegaScott lifted
      actions = [.tau] ∨
        ∃ rest,
          actions = .tau :: rest ∧
          WithOmegaScott.toOmegaScott
                (show EqualityOrder (List Raw.Action) from rest) ∈
              carrier values },
    equalityOrder_isClosed _
  ⟩

/-- Tau-prefix computation soundly embeds into the native trace denotation. -/
theorem tauPrefixEffect_le_denote_tau
    (process : RecursiveProc) :
    tauPrefixEffect (denote process) ≤
      denote (.tau process) := by
  intro lifted member
  change
    let actions : List Raw.Action :=
      show List Raw.Action from
        WithOmegaScott.ofOmegaScott lifted
    actions = [.tau] ∨
      ∃ rest,
        actions = .tau :: rest ∧
        Observes process rest
  at member
  change
    Observes (.tau process)
      (show List Raw.Action from
        WithOmegaScott.ofOmegaScott lifted)
  rcases member with single | ⟨rest, equal, target, trace⟩
  · rw [single]
    exact ⟨process, .one .prefixTau⟩
  · rw [equal]
    exact ⟨target, .cons .prefixTau trace⟩

/-! ## Operational separation above the unseparated nullary effect -/

/-- Inactive process denotes the unique empty D1-A computation. -/
@[simp]
theorem denote_zero :
    denote (.zero : RecursiveProc) =
      effectBottom TraceCPO := by
  apply SetLike.ext
  intro lifted
  constructor
  · intro observed
    change Observes (.zero : RecursiveProc) _ at observed
    obtain ⟨target, trace⟩ := observed
    cases trace with
    | one step => exact step.source_ne_zero rfl
    | cons step tail => exact step.source_ne_zero rfl
  · intro impossible
    exact impossible.elim

/-- Every first edge of a native infinite run is denotationally observable. -/
theorem infiniteRun_first_mem
    (run : RecursiveLate.InfiniteNativeRun process) :
    WithOmegaScott.toOmegaScott
          (show EqualityOrder (List Raw.Action) from [run.action 0]) ∈
        carrier (denote process) := by
  rw [mem_denote_iff]
  refine ⟨run.state 1, ?_⟩
  have first := run.native 0
  rw [run.initial] at first
  simpa using NativeTrace.one first

/--
Guarded replicated tau is denotationally nonbottom because its genuine first
native action is retained by the trace effect.
-/
theorem denote_repTau_ne_bottom
    (body : RecursiveProc) :
    denote (.repTau body) ≠
      effectBottom TraceCPO := by
  intro equal
  have member :
      WithOmegaScott.toOmegaScott
            (show EqualityOrder (List Raw.Action) from [.tau]) ∈
          carrier (denote (.repTau body)) :=
    infiniteRun_first_mem
      (RecursiveLate.replicatedTauInfiniteRun body)
  rw [equal] at member
  exact member

/--
The effect-level nullary collapse and the guarded agent-level operational
separation coexist without identifying deadlock and divergence in the native
or terminal layers.
-/
theorem guarded_divergence_deadlock_separated_above_effect
    (body : RecursiveProc) :
    denote (.zero : RecursiveProc) =
        effectBottom TraceCPO ∧
      denote (.repTau body) ≠
        effectBottom TraceCPO ∧
      RecursiveLate.OperationalDeadlocked
        (.zero : RecursiveProc) ∧
      RecursiveLate.NativeDiverges (.repTau body) := by
  exact
    ⟨denote_zero,
      denote_repTau_ne_bottom body,
      RecursiveLate.zero_operationalDeadlocked,
      RecursiveLate.replicatedTau_nativeDiverges body⟩

end Cantilune.Pi.FMSGuardedHoareTrace
