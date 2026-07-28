import Mathlib

/-!
# Finite-epoch feedback

This module formalizes the deterministic layer of Cantilune's feedback loop.
Evidence has a finite natural-number grade.  Evidence events can only join new
evidence into the current state; acceptance remains an explicit external
event.  Consequently, the module proves finite strict progress and stability
without assuming that an observed party must accept feedback.

No probability-one claim is made here.  A probabilistic convergence result
requires a concrete probability kernel and an explicit positive-progress
assumption.
-/

namespace Cantilune.Feedback

/--
Abstract finite-height join evidence.  `rank_strict` turns every strict
information increase into a strict natural-number increase, while
`rank_bounded` supplies the global finite-height bound.
-/
structure RankedJoinEvidence
    (Evidence : Type) [SemilatticeSup Evidence] where
  height : Nat
  rank : Evidence → Nat
  rank_bounded : ∀ evidence, rank evidence ≤ height
  rank_strict :
    ∀ {less more : Evidence}, less < more → rank less < rank more

namespace RankedJoinEvidence

variable {Evidence : Type}
variable [SemilatticeSup Evidence]

/-- A qualitative stable region is any upward-closed evidence predicate. -/
structure StableRegion (Evidence : Type)
    [SemilatticeSup Evidence] : Type where
  holds : Evidence → Prop
  upward_closed :
    ∀ {less more}, less ≤ more → holds less → holds more

/-- Deterministic evidence accumulation by finite joins. -/
def accumulate (initial : Evidence) : List Evidence → Evidence
  | [] => initial
  | delta :: rest => accumulate (initial ⊔ delta) rest

/-- Accumulation never loses the evidence available at the start. -/
theorem initial_le_accumulate
    (initial : Evidence) (deltas : List Evidence) :
    initial ≤ accumulate initial deltas := by
  induction deltas generalizing initial with
  | nil =>
      rfl
  | cons delta rest ih =>
      exact le_trans le_sup_left (ih (initial ⊔ delta))

/--
Every upward-closed stable region is forward invariant under arbitrary finite
join accumulation.
-/
theorem stable_set
    (region : StableRegion Evidence)
    (initial : Evidence) (deltas : List Evidence)
    (stable : region.holds initial) :
    region.holds (accumulate initial deltas) :=
  region.upward_closed (initial_le_accumulate initial deltas) stable

/-- A list of consecutive strict evidence increases. -/
inductive StrictChain :
    Evidence → List Evidence → Prop
  | nil (initial : Evidence) :
      StrictChain initial []
  | cons {initial next : Evidence} {rest : List Evidence}
      (progress : initial < next)
      (tail : StrictChain next rest) :
      StrictChain initial (next :: rest)

/-- A finite-height evidence order admits no overlong strict chain. -/
theorem StrictChain.length_bound
    (system : RankedJoinEvidence Evidence)
    {initial : Evidence} {rest : List Evidence}
    (chain : StrictChain initial rest) :
    system.rank initial + rest.length ≤ system.height := by
  induction chain with
  | nil initial =>
      simpa using system.rank_bounded initial
  | @cons initial next rest progress tail ih =>
      have increase := system.rank_strict progress
      simp only [List.length_cons]
      omega

end RankedJoinEvidence

/-- Evidence whose qualitative grade is bounded by a fixed finite height. -/
structure Evidence (height : Nat) where
  level : Nat
  bounded : level ≤ height
  deriving DecidableEq, Repr

namespace Evidence

/-- Evidence values are equal when their qualitative levels are equal. -/
@[ext]
theorem ext {height : Nat} {left right : Evidence height}
    (levels : left.level = right.level) :
    left = right := by
  cases left
  cases right
  cases levels
  rfl

/-- Monotone accumulation of two evidence values. -/
def sup {height : Nat} (left right : Evidence height) : Evidence height where
  level := max left.level right.level
  bounded := max_le left.bounded right.bounded

@[simp]
theorem sup_level {height : Nat} (left right : Evidence height) :
    (left.sup right).level = max left.level right.level := rfl

theorem level_le_sup {height : Nat} (left right : Evidence height) :
    left.level ≤ (left.sup right).level := by
  exact Nat.le_max_left _ _

theorem sup_level_mono {height : Nat}
    {left₁ left₂ right₁ right₂ : Evidence height}
    (hleft : left₁.level ≤ left₂.level)
    (hright : right₁.level ≤ right₂.level) :
    (left₁.sup right₁).level ≤ (left₂.sup right₂).level := by
  exact max_le_max hleft hright

/-- The top qualitative grade. -/
def HardStable {height : Nat} (evidence : Evidence height) : Prop :=
  evidence.level = height

/-- A threshold region in the finite evidence lattice. -/
def StableRegion {height : Nat} (threshold : Nat)
    (evidence : Evidence height) : Prop :=
  threshold ≤ evidence.level

theorem sup_eq_left_of_hardStable {height : Nat}
    {current : Evidence height} (stable : current.HardStable)
    (incoming : Evidence height) :
    current.sup incoming = current := by
  apply Evidence.ext
  have incoming_le : incoming.level ≤ current.level := by
    rw [stable]
    exact incoming.bounded
  simp [Evidence.sup, Nat.max_eq_left incoming_le]

end Evidence

/-- An observed party's feedback state. -/
structure FeedbackState (height : Nat) where
  evidence : Evidence height
  accepted : Bool
  deriving DecidableEq, Repr

/--
Evidence is internal data.  Acceptance is deliberately represented as a
separate external event so aggregation cannot force the observed party.
-/
inductive FeedbackEvent (height : Nat) (Payload : Type) where
  | evidence (delta : Evidence height)
  | externalAccept (payload : Payload)
  | externalReject (payload : Payload)
  deriving Repr

/-- Apply exactly one feedback event. -/
def applyEvent {height : Nat} {Payload : Type}
    (state : FeedbackState height) :
    FeedbackEvent height Payload → FeedbackState height
  | .evidence delta =>
      { evidence := state.evidence.sup delta
        accepted := state.accepted }
  | .externalAccept _ =>
      { state with accepted := true }
  | .externalReject _ =>
      state

/-- Replay a finite epoch's feedback events. -/
def applyEvents {height : Nat} {Payload : Type}
    (state : FeedbackState height) :
    List (FeedbackEvent height Payload) → FeedbackState height
  | [] => state
  | event :: rest => applyEvents (applyEvent state event) rest

def Accepted {height : Nat} (state : FeedbackState height) : Prop :=
  state.accepted = true

def Productive {height : Nat} {Payload : Type}
    (state : FeedbackState height)
    (event : FeedbackEvent height Payload) : Prop :=
  state.evidence.level < (applyEvent state event).evidence.level

def IsExternalAccept {height : Nat} {Payload : Type} :
    FeedbackEvent height Payload → Prop
  | .evidence _ => False
  | .externalAccept _ => True
  | .externalReject _ => False

def IsExternalReject {height : Nat} {Payload : Type} :
    FeedbackEvent height Payload → Prop
  | .evidence _ => False
  | .externalAccept _ => False
  | .externalReject _ => True

theorem stableRegion_forward {height threshold : Nat} {Payload : Type}
    (state : FeedbackState height) (event : FeedbackEvent height Payload)
    (stable : state.evidence.StableRegion threshold) :
    (applyEvent state event).evidence.StableRegion threshold := by
  cases event with
  | evidence delta =>
      exact le_trans stable (Evidence.level_le_sup state.evidence delta)
  | externalAccept payload =>
      simpa [applyEvent] using stable
  | externalReject payload =>
      simpa [applyEvent] using stable

/--
The threshold-stable region is forward invariant under every finite replay.
This is the deterministic hard layer of the feedback convergence contract.
-/
theorem feedback_state_stable_set {height threshold : Nat} {Payload : Type}
    (state : FeedbackState height)
    (events : List (FeedbackEvent height Payload))
    (stable : state.evidence.StableRegion threshold) :
    (applyEvents state events).evidence.StableRegion threshold := by
  induction events generalizing state with
  | nil =>
      simpa [applyEvents] using stable
  | cons event rest ih =>
      exact ih (applyEvent state event)
        (stableRegion_forward state event stable)

/--
Stable central theorem: any upward-closed region of a finite-height join
evidence order is invariant under every finite sequence of legal joins.
-/
theorem feedback_stable_set
    {AbstractEvidence : Type}
    [SemilatticeSup AbstractEvidence]
    (_system : RankedJoinEvidence AbstractEvidence)
    (region : RankedJoinEvidence.StableRegion AbstractEvidence)
    (initial : AbstractEvidence) (deltas : List AbstractEvidence)
    (stable : region.holds initial) :
    region.holds (RankedJoinEvidence.accumulate initial deltas) :=
  RankedJoinEvidence.stable_set region initial deltas stable

theorem hardStable_evidence_forward {height : Nat} {Payload : Type}
    (state : FeedbackState height) (event : FeedbackEvent height Payload)
    (stable : state.evidence.HardStable) :
    (applyEvent state event).evidence = state.evidence := by
  cases event with
  | evidence delta =>
      exact Evidence.sup_eq_left_of_hardStable stable delta
  | externalAccept payload =>
      rfl
  | externalReject payload =>
      rfl

theorem accepted_persistent_event {height : Nat} {Payload : Type}
    (state : FeedbackState height) (event : FeedbackEvent height Payload)
    (accepted : Accepted state) :
    Accepted (applyEvent state event) := by
  cases event with
  | evidence delta =>
      exact accepted
  | externalAccept payload =>
      rfl
  | externalReject payload =>
      exact accepted

theorem accepted_persistent {height : Nat} {Payload : Type}
    (state : FeedbackState height)
    (events : List (FeedbackEvent height Payload))
    (accepted : Accepted state) :
    Accepted (applyEvents state events) := by
  induction events generalizing state with
  | nil =>
      simpa [applyEvents] using accepted
  | cons event rest ih =>
      exact ih (applyEvent state event)
        (accepted_persistent_event state event accepted)

theorem externalAccept_accepts {height : Nat} {Payload : Type}
    (state : FeedbackState height) (payload : Payload) :
    Accepted (applyEvent state (.externalAccept payload)) := by
  simp [Accepted, applyEvent]

theorem externalAccept_not_productive {height : Nat} {Payload : Type}
    (state : FeedbackState height) (payload : Payload) :
    ¬Productive state (.externalAccept payload) := by
  simp [Productive, applyEvent]

/-- Explicit rejection neither changes evidence nor forces acceptance. -/
theorem externalReject_preserves_state {height : Nat} {Payload : Type}
    (state : FeedbackState height) (payload : Payload) :
    applyEvent state (.externalReject payload) = state :=
  rfl

theorem externalReject_not_productive {height : Nat} {Payload : Type}
    (state : FeedbackState height) (payload : Payload) :
    ¬Productive state (.externalReject payload) := by
  simp [Productive, applyEvent]

theorem productive_not_externalAccept {height : Nat} {Payload : Type}
    (state : FeedbackState height) (event : FeedbackEvent height Payload)
    (productive : Productive state event) :
    ¬IsExternalAccept event := by
  cases event with
  | evidence delta =>
      simp [IsExternalAccept]
  | externalAccept payload =>
      intro _external
      exact (externalAccept_not_productive state payload) productive
  | externalReject payload =>
      simp [IsExternalAccept]

/-- A list witnessing consecutive strict qualitative evidence increases. -/
inductive StrictEvidenceChain {height : Nat} :
    Evidence height → List (Evidence height) → Prop
  | nil (initial : Evidence height) :
      StrictEvidenceChain initial []
  | cons {initial next : Evidence height} {rest : List (Evidence height)}
      (progress : initial.level < next.level)
      (tail : StrictEvidenceChain next rest) :
      StrictEvidenceChain initial (next :: rest)

theorem StrictEvidenceChain.length_bound {height : Nat}
    {initial : Evidence height} {rest : List (Evidence height)}
    (chain : StrictEvidenceChain initial rest) :
    initial.level + rest.length ≤ height := by
  induction chain with
  | nil initial =>
      simpa using initial.bounded
  | @cons initial next rest progress tail ih =>
      simp only [List.length_cons]
      omega

/-- A finite replay record for one externally delimited epoch. -/
structure EpochTrace (height : Nat) (Payload : Type) where
  initial : FeedbackState height
  events : List (FeedbackEvent height Payload)
  final : FeedbackState height
  replay : final = applyEvents initial events

/-- Constructive evidence that a finite schedule contains an acceptance event. -/
inductive HasExternalAccept {height : Nat} {Payload : Type} :
    List (FeedbackEvent height Payload) → Prop
  | head (payload : Payload) (rest : List (FeedbackEvent height Payload)) :
      HasExternalAccept (.externalAccept payload :: rest)
  | tail (event : FeedbackEvent height Payload)
      {rest : List (FeedbackEvent height Payload)}
      (contains : HasExternalAccept rest) :
      HasExternalAccept (event :: rest)

theorem hasExternalAccept_implies_accepted {height : Nat} {Payload : Type}
    (state : FeedbackState height)
    {events : List (FeedbackEvent height Payload)}
    (contains : HasExternalAccept events) :
    Accepted (applyEvents state events) := by
  induction contains generalizing state with
  | head payload rest =>
      exact accepted_persistent
        (applyEvent state (.externalAccept payload)) rest
        (externalAccept_accepts state payload)
  | tail event contains ih =>
      exact ih (applyEvent state event)

theorem EpochTrace.accepted_of_contains {height : Nat} {Payload : Type}
    (trace : EpochTrace height Payload)
    (contains : HasExternalAccept trace.events) :
    Accepted trace.final := by
  rw [trace.replay]
  exact hasExternalAccept_implies_accepted trace.initial contains

end Cantilune.Feedback
