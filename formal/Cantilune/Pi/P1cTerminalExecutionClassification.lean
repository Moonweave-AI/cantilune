import Cantilune.Core.TerminalPartition
import Cantilune.Feedback.Execution
import Cantilune.Pi.P1cAdmittedTrajectory

/-!
# Concrete terminal/productive classification for admitted P1c operations

The generic `ObservableLTS.terminal_classification_iff` partitions a state
only after `Normal` has already been supplied.  It neither relates the three
terminal predicates to a concrete execution package nor accounts for an
infinite productive continuation.

This module closes that gap for every concrete occurrence admitted by
`P1cAdmittedOperations`.  One actual business step, backed by the occurrence's
endpoint-free replay record and four native derivations, may be discharged by
an external policy in exactly one of four ways:

* successful termination;
* an open external wait;
* genuine deadlock; or
* a productive state with an explicit infinite external-hold trace.

The four outcomes share the same computed target `Config`.  Consequently the
classification does not invent four graph rewrites.  It classifies what the
runtime does *after* the one admitted rewrite.  Completeness is stated over
states reached by the native business step, rather than over arbitrary
premises or a definitionally supplied trichotomy.
-/

noncomputable section

namespace Cantilune.Pi.P1cTerminalExecutionClassification

open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedTrajectory

variable {σ : FinSignature}

/-- Runtime control around one concrete admitted business occurrence. -/
inductive State
  | ready
  | successful
  | waiting
  | deadlocked
  | productive
  deriving DecidableEq, Repr

/--
The business transition is the same admitted P1c rewrite in every branch.
The branch records only the external terminal/productivity disposition.
-/
inductive NativeStep : State → Event → State → Prop
  | businessSuccess :
      NativeStep .ready .business .successful
  | businessWait :
      NativeStep .ready .business .waiting
  | businessDeadlock :
      NativeStep .ready .business .deadlocked
  | businessProductive :
      NativeStep .ready .business .productive
  | productiveExternalHold :
      NativeStep .productive .completedExternalHold .productive

def success : State → Prop
  | .successful => True
  | _ => False

def waiting : State → Prop
  | .waiting => True
  | _ => False

/--
The LTS exposes only the real business event and the completed-state external
hold.  The zero-mass totalisation events from `P1cAdmittedTrajectory` remain
available as record identities but are not transitions of this package.
-/
def lts (occurrence : Occurrence σ) : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := NativeStep
  observable
    | .business | .completedExternalHold => True
    | .pendingExternalHold | .nullPathAdministrativeReset => False
  success := success
  waiting := waiting
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

/-- Every post-business disposition denotes the one computed target config. -/
def configOf (occurrence : Occurrence σ) : State → Config σ
  | .ready => occurrence.source
  | .successful | .waiting | .deadlocked | .productive =>
      occurrence.target

@[simp]
theorem configOf_ready (occurrence : Occurrence σ) :
    configOf occurrence .ready = occurrence.source :=
  rfl

@[simp]
theorem configOf_successful (occurrence : Occurrence σ) :
    configOf occurrence .successful = occurrence.target :=
  rfl

@[simp]
theorem configOf_waiting (occurrence : Occurrence σ) :
    configOf occurrence .waiting = occurrence.target :=
  rfl

@[simp]
theorem configOf_deadlocked (occurrence : Occurrence σ) :
    configOf occurrence .deadlocked = occurrence.target :=
  rfl

@[simp]
theorem configOf_productive (occurrence : Occurrence σ) :
    configOf occurrence .productive = occurrence.target :=
  rfl

@[simp]
theorem configOf_signatureVersion
    (occurrence : Occurrence σ) (state : State) :
    (configOf occurrence state).signatureVersion =
      occurrence.source.signatureVersion := by
  cases state
  · rfl
  all_goals
    change
      (applyRequest occurrence.source occurrence.request).signatureVersion =
        occurrence.source.signatureVersion
    cases occurrence.request <;> rfl

/--
For a delete occurrence, no live resource in the represented config is owned
by the victim.  Other request families have no deletion-resource obligation.
-/
def resourcesClear (occurrence : Occurrence σ) (state : State) : Prop :=
  match occurrence.request with
  | .quiescentDelete victim =>
      ∀ token ∈ (configOf occurrence state).resourceTokens,
        (configOf occurrence state).resourceOwner token ≠ some victim
  | _ => True

/-- The analogous ownership-based quiescence predicate for live sessions. -/
def sessionsQuiescent (occurrence : Occurrence σ) (state : State) : Prop :=
  match occurrence.request with
  | .quiescentDelete victim =>
      ∀ name ∈ (configOf occurrence state).names,
        (configOf occurrence state).sessionOwner name ≠ some victim
  | _ => True

/--
Deletion is permitted only at the pre-state of an actually admitted delete
request.  It is not silently inferred for mismatch or reconnect.
-/
def deletionPermitted (occurrence : Occurrence σ) (state : State) : Prop :=
  state = .ready ∧
    match occurrence.request with
    | .quiescentDelete _ => True
    | _ => False

theorem resourcesClear_all
    (occurrence : Occurrence σ) (state : State) :
    resourcesClear occurrence state := by
  rcases occurrence with ⟨source, request, admitted⟩
  cases request with
  | mismatch left right =>
      trivial
  | reconnect reconnectSource reconnectTarget =>
      trivial
  | quiescentDelete victim =>
      have clear :
          ∀ token ∈ source.resourceTokens,
            source.resourceOwner token ≠ some victim :=
        admitted.2.2.1.2.2.1
      cases state <;>
        simpa [resourcesClear, configOf, Occurrence.target, applyRequest]
          using clear

theorem sessionsQuiescent_all
    (occurrence : Occurrence σ) (state : State) :
    sessionsQuiescent occurrence state := by
  rcases occurrence with ⟨source, request, admitted⟩
  cases request with
  | mismatch left right =>
      trivial
  | reconnect reconnectSource reconnectTarget =>
      trivial
  | quiescentDelete victim =>
      have quiescent :
          ∀ name ∈ source.names,
            source.sessionOwner name ≠ some victim :=
        admitted.2.2.1.2.2.2
      cases state <;>
        simpa [sessionsQuiescent, configOf, Occurrence.target, applyRequest]
          using quiescent

theorem deletion_requires_resources
    (occurrence : Occurrence σ) (state : State)
    (_permitted : deletionPermitted occurrence state) :
    resourcesClear occurrence state :=
  resourcesClear_all occurrence state

theorem deletion_requires_quiescence
    (occurrence : Occurrence σ) (state : State)
    (_permitted : deletionPermitted occurrence state) :
    sessionsQuiescent occurrence state :=
  sessionsQuiescent_all occurrence state

/--
One concrete execution package.  Its business and hold records are exactly
the independently verified records from `P1cAdmittedTrajectory`.
-/
def package (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := lts occurrence
  configOf := configOf occurrence
  replayKernel := P1cAdmittedTrajectory.replayKernel occurrence
  eventRecord := P1cAdmittedTrajectory.verifiedRecord occurrence
  eventEndpoints := by
    rintro source event target ⟨step, _observable⟩
    cases step
    · exact
        (P1cAdmittedTrajectory.verifiedRecord occurrence .business)
          |>.replays_recorded
    · exact
        (P1cAdmittedTrajectory.verifiedRecord occurrence .business)
          |>.replays_recorded
    · exact
        (P1cAdmittedTrajectory.verifiedRecord occurrence .business)
          |>.replays_recorded
    · exact
        (P1cAdmittedTrajectory.verifiedRecord occurrence .business)
          |>.replays_recorded
    · exact
        (P1cAdmittedTrajectory.verifiedRecord occurrence
          .completedExternalHold).replays_recorded
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := resourcesClear occurrence
  sessionsQuiescent := sessionsQuiescent occurrence
  deletionPermitted := deletionPermitted occurrence
  deletion_requires_resources :=
    deletion_requires_resources occurrence
  deletion_requires_quiescence :=
    deletion_requires_quiescence occurrence
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

theorem native_business_success (occurrence : Occurrence σ) :
    (package occurrence).lts.ObservableStep
      .ready .business .successful :=
  ⟨NativeStep.businessSuccess, trivial⟩

theorem native_business_wait (occurrence : Occurrence σ) :
    (package occurrence).lts.ObservableStep
      .ready .business .waiting :=
  ⟨NativeStep.businessWait, trivial⟩

theorem native_business_deadlock (occurrence : Occurrence σ) :
    (package occurrence).lts.ObservableStep
      .ready .business .deadlocked :=
  ⟨NativeStep.businessDeadlock, trivial⟩

theorem native_business_productive (occurrence : Occurrence σ) :
    (package occurrence).lts.ObservableStep
      .ready .business .productive :=
  ⟨NativeStep.businessProductive, trivial⟩

theorem native_productive_hold (occurrence : Occurrence σ) :
    (package occurrence).lts.ObservableStep
      .productive .completedExternalHold .productive :=
  ⟨NativeStep.productiveExternalHold, trivial⟩

@[simp]
theorem ready_not_normal (occurrence : Occurrence σ) :
    ¬(package occurrence).lts.Normal .ready := by
  intro normal
  exact normal ⟨.business, .successful, native_business_success occurrence⟩

@[simp]
theorem productive_not_normal (occurrence : Occurrence σ) :
    ¬(package occurrence).lts.Normal .productive := by
  intro normal
  exact normal
    ⟨.completedExternalHold, .productive,
      native_productive_hold occurrence⟩

@[simp]
theorem successful_normal (occurrence : Occurrence σ) :
    (package occurrence).lts.Normal .successful := by
  rintro ⟨event, target, step, _observable⟩
  cases step

@[simp]
theorem waiting_normal (occurrence : Occurrence σ) :
    (package occurrence).lts.Normal .waiting := by
  rintro ⟨event, target, step, _observable⟩
  cases step

@[simp]
theorem deadlocked_normal (occurrence : Occurrence σ) :
    (package occurrence).lts.Normal .deadlocked := by
  rintro ⟨event, target, step, _observable⟩
  cases step

@[simp]
theorem successfulTermination_iff
    (occurrence : Occurrence σ) (state : State) :
    (package occurrence).lts.SuccessfulTermination state ↔
      state = .successful := by
  cases state with
  | ready =>
      constructor
      · intro terminal
        exact False.elim (ready_not_normal occurrence terminal.1)
      · intro impossible
        contradiction
  | successful =>
      constructor
      · intro _terminal
        rfl
      · intro _equality
        exact
          ⟨successful_normal occurrence,
            by
              change True
              trivial⟩
  | waiting =>
      constructor
      · intro terminal
        exact False.elim terminal.2
      · intro impossible
        contradiction
  | deadlocked =>
      constructor
      · intro terminal
        exact False.elim terminal.2
      · intro impossible
        contradiction
  | productive =>
      constructor
      · intro terminal
        exact False.elim (productive_not_normal occurrence terminal.1)
      · intro impossible
        contradiction

@[simp]
theorem externalWait_iff
    (occurrence : Occurrence σ) (state : State) :
    (package occurrence).lts.ExternalWait state ↔
      state = .waiting := by
  cases state with
  | ready =>
      constructor
      · intro waitingState
        exact False.elim (ready_not_normal occurrence waitingState.1)
      · intro impossible
        contradiction
  | successful =>
      constructor
      · intro waitingState
        exact False.elim
          (waitingState.2.1
            (by
              change True
              trivial))
      · intro impossible
        contradiction
  | waiting =>
      constructor
      · intro _waitingState
        rfl
      · intro _equality
        exact
          ⟨waiting_normal occurrence,
            by
              change ¬False
              trivial,
            by
              change True
              trivial⟩
  | deadlocked =>
      constructor
      · intro waitingState
        exact False.elim waitingState.2.2
      · intro impossible
        contradiction
  | productive =>
      constructor
      · intro waitingState
        exact False.elim
          (productive_not_normal occurrence waitingState.1)
      · intro impossible
        contradiction

@[simp]
theorem deadlocked_iff
    (occurrence : Occurrence σ) (state : State) :
    (package occurrence).lts.Deadlocked state ↔
      state = .deadlocked := by
  cases state with
  | ready =>
      constructor
      · intro deadlock
        exact False.elim (ready_not_normal occurrence deadlock.1)
      · intro impossible
        contradiction
  | successful =>
      constructor
      · intro deadlock
        exact False.elim
          (deadlock.2.1
            (by
              change True
              trivial))
      · intro impossible
        contradiction
  | waiting =>
      constructor
      · intro deadlock
        exact False.elim
          (deadlock.2.2
            (by
              change True
              trivial))
      · intro impossible
        contradiction
  | deadlocked =>
      constructor
      · intro _deadlock
        rfl
      · intro _equality
        exact
          ⟨deadlocked_normal occurrence,
            by
              change ¬False
              trivial,
            by
              change ¬False
              trivial⟩
  | productive =>
      constructor
      · intro deadlock
        exact False.elim
          (productive_not_normal occurrence deadlock.1)
      · intro impossible
        contradiction

/-- No transition from the ready control point can return to ready. -/
theorem ready_step_target_ne_ready
    (occurrence : Occurrence σ) {event : Event} {target : State}
    (step :
      (package occurrence).lts.ObservableStep .ready event target) :
    target ≠ .ready := by
  rcases step with ⟨native, _observable⟩
  cases native <;> simp

/-- The canonical infinite continuation consists of real external hold steps. -/
def productiveTrace (occurrence : Occurrence σ) :
    InfiniteExecution (package occurrence).lts where
  state := fun _ => .productive
  event := fun _ => .completedExternalHold
  step := fun _ => native_productive_hold occurrence

/--
A steady productive continuation is an actual infinite execution, remains in
the selected state, and is externally productive under the package ranking.
-/
def SteadyProductive
    (occurrence : Occurrence σ) (state : State) : Prop :=
  ∃ trace : InfiniteExecution (package occurrence).lts,
    trace.state 0 = state ∧
      (∀ n, trace.state n = state) ∧
      ExternallyProductive (package occurrence).ranking trace

theorem productiveTrace_externallyProductive
    (occurrence : Occurrence σ) :
    ExternallyProductive
      (package occurrence).ranking (productiveTrace occurrence) :=
  infinite_execution_productive
    (package occurrence).ranking (productiveTrace occurrence)

theorem productive_steady (occurrence : Occurrence σ) :
    SteadyProductive occurrence .productive := by
  refine
    ⟨productiveTrace occurrence, rfl, ?_,
      productiveTrace_externallyProductive occurrence⟩
  intro n
  rfl

@[simp]
theorem steadyProductive_iff
    (occurrence : Occurrence σ) (state : State) :
    SteadyProductive occurrence state ↔ state = .productive := by
  constructor
  · rintro ⟨trace, initial, steady, _external⟩
    cases state with
    | ready =>
        have first := trace.step 0
        rw [initial] at first
        have targetEq : trace.state (0 + 1) = .ready := by
          simpa using steady 1
        exact False.elim
          (ready_step_target_ne_ready occurrence first targetEq)
    | successful =>
        have first := trace.step 0
        rw [initial] at first
        exact False.elim
          (successful_normal occurrence
            ⟨trace.event 0, trace.state (0 + 1), first⟩)
    | waiting =>
        have first := trace.step 0
        rw [initial] at first
        exact False.elim
          (waiting_normal occurrence
            ⟨trace.event 0, trace.state (0 + 1), first⟩)
    | deadlocked =>
        have first := trace.step 0
        rw [initial] at first
        exact False.elim
          (deadlocked_normal occurrence
            ⟨trace.event 0, trace.state (0 + 1), first⟩)
    | productive =>
        rfl
  · intro equality
    subst state
    exact productive_steady occurrence

theorem steadyProductive_not_normal
    (occurrence : Occurrence σ) (state : State)
    (productive : SteadyProductive occurrence state) :
    ¬(package occurrence).lts.Normal state := by
  intro normal
  rcases productive with ⟨trace, initial, _steady, _external⟩
  have first := trace.step 0
  rw [initial] at first
  exact normal ⟨trace.event 0, trace.state 1, first⟩

/--
The native business-step endpoints are exactly the four post-business control
states.  This is an inversion theorem for `NativeStep`, not a supplied policy
premise.
-/
theorem business_endpoint_iff
    (occurrence : Occurrence σ) (state : State) :
    (package occurrence).lts.ObservableStep .ready .business state ↔
      state = .successful ∨ state = .waiting ∨
        state = .deadlocked ∨ state = .productive := by
  constructor
  · rintro ⟨step, _observable⟩
    cases step <;> simp
  · rintro (equality | equality | equality | equality)
    · subst state
      exact native_business_success occurrence
    · subst state
      exact native_business_wait occurrence
    · subst state
      exact native_business_deadlock occurrence
    · subst state
      exact native_business_productive occurrence

/--
Central concrete classification theorem: a state is reached by the one real
business event iff it is success, external wait, genuine deadlock, or carries
a steady productive infinite trace.
-/
theorem terminal_or_productive_classification_iff
    (occurrence : Occurrence σ) (state : State) :
    (package occurrence).lts.ObservableStep .ready .business state ↔
      (package occurrence).lts.SuccessfulTermination state ∨
        (package occurrence).lts.ExternalWait state ∨
        (package occurrence).lts.Deadlocked state ∨
        SteadyProductive occurrence state := by
  rw [business_endpoint_iff, successfulTermination_iff,
    externalWait_iff, deadlocked_iff, steadyProductive_iff]

/-- Stable theorem alias intended for the CENTRAL-17 concrete refinement. -/
theorem p1c_terminal_classification_iff
    (occurrence : Occurrence σ) (state : State) :
    (package occurrence).lts.ObservableStep .ready .business state ↔
      (package occurrence).lts.SuccessfulTermination state ∨
        (package occurrence).lts.ExternalWait state ∨
        (package occurrence).lts.Deadlocked state ∨
        SteadyProductive occurrence state :=
  terminal_or_productive_classification_iff occurrence state

/-- All six pairs among the four concrete classes are disjoint. -/
theorem terminal_or_productive_pairwise_disjoint
    (occurrence : Occurrence σ) (state : State) :
    (¬((package occurrence).lts.SuccessfulTermination state ∧
      (package occurrence).lts.ExternalWait state)) ∧
    (¬((package occurrence).lts.SuccessfulTermination state ∧
      (package occurrence).lts.Deadlocked state)) ∧
    (¬((package occurrence).lts.ExternalWait state ∧
      (package occurrence).lts.Deadlocked state)) ∧
    (¬((package occurrence).lts.SuccessfulTermination state ∧
      SteadyProductive occurrence state)) ∧
    (¬((package occurrence).lts.ExternalWait state ∧
      SteadyProductive occurrence state)) ∧
    ¬((package occurrence).lts.Deadlocked state ∧
      SteadyProductive occurrence state) := by
  refine
    ⟨(package occurrence).lts.successful_not_externalWait state,
      (package occurrence).lts.successful_not_deadlocked state,
      (package occurrence).lts.externalWait_not_deadlocked state, ?_⟩
  constructor
  · rintro ⟨terminal, productive⟩
    exact steadyProductive_not_normal occurrence state productive terminal.1
  constructor
  · rintro ⟨waitingState, productive⟩
    exact
      steadyProductive_not_normal occurrence state productive waitingState.1
  · rintro ⟨deadlock, productive⟩
    exact steadyProductive_not_normal occurrence state productive deadlock.1

/--
Every classified endpoint replays the exact admitted business record from the
actual source configuration to its represented target configuration.
-/
theorem classified_endpoint_replays
    (occurrence : Occurrence σ) (state : State)
    (classified :
      (package occurrence).lts.SuccessfulTermination state ∨
        (package occurrence).lts.ExternalWait state ∨
        (package occurrence).lts.Deadlocked state ∨
        SteadyProductive occurrence state) :
    ((package occurrence).eventRecord .business).Replays
      occurrence.source ((package occurrence).configOf state) := by
  have step :
      (package occurrence).lts.ObservableStep .ready .business state :=
    (terminal_or_productive_classification_iff occurrence state).mpr
      classified
  exact (package occurrence).eventEndpoints step

theorem classified_endpoint_is_computed_target
    (occurrence : Occurrence σ) (state : State)
    (classified :
      (package occurrence).lts.SuccessfulTermination state ∨
        (package occurrence).lts.ExternalWait state ∨
        (package occurrence).lts.Deadlocked state ∨
        SteadyProductive occurrence state) :
    (package occurrence).configOf state = occurrence.target := by
  have replay := classified_endpoint_replays occurrence state classified
  exact
    DPOEvent.event_replay_unique replay
      ((package occurrence).eventRecord .business).replays_recorded

/--
The terminal/productive result retains the concrete four-view derivation and
the package's ownership-based resource/session guarantees.
-/
structure ClassifiedEndpointEvidence
    (occurrence : Occurrence σ) (state : State) : Prop where
  classified :
    (package occurrence).lts.SuccessfulTermination state ∨
      (package occurrence).lts.ExternalWait state ∨
      (package occurrence).lts.Deadlocked state ∨
      SteadyProductive occurrence state
  replay :
    ((package occurrence).eventRecord .business).Replays
      occurrence.source ((package occurrence).configOf state)
  endpoint :
    (package occurrence).configOf state = occurrence.target
  common : P1cAdmittedOperations.CommonDerivation occurrence
  resources : (package occurrence).resourcesClear state
  sessions : (package occurrence).sessionsQuiescent state

theorem classified_endpoint_evidence
    (occurrence : Occurrence σ) (state : State)
    (step :
      (package occurrence).lts.ObservableStep .ready .business state) :
    ClassifiedEndpointEvidence occurrence state := by
  have classified :=
    (terminal_or_productive_classification_iff occurrence state).mp step
  exact
    { classified := classified
      replay := (package occurrence).eventEndpoints step
      endpoint :=
        classified_endpoint_is_computed_target occurrence state classified
      common := P1cAdmittedOperations.commonDerivation occurrence
      resources := resourcesClear_all occurrence state
      sessions := sessionsQuiescent_all occurrence state }

end Cantilune.Pi.P1cTerminalExecutionClassification
