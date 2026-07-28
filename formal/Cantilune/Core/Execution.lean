import Mathlib
import Cantilune.Core.Signature

/-!
# Configurations, complete events, and observable transition systems

Complete events contain their source, target, match embedding, complement tag,
fresh names, and policy/external evidence.  A rule name alone is therefore not
a replay record.
-/

namespace Cantilune.Core

/-- Runtime state over a fixed finite signature. -/
structure Config (σ : FinSignature) where
  signatureVersion : Nat
  nodes : Finset Nat
  edges : Finset (Nat × Nat)
  nodeLabel : Nat → Option σ.Gen
  dataTokens : Finset Nat
  resourceTokens : Finset Nat
  names : Finset Nat
  /-- Runtime ownership of each live data token by a graph node. -/
  dataOwner : Nat → Option Nat
  /-- Runtime ownership of each live linear resource by a graph node. -/
  resourceOwner : Nat → Option Nat
  /-- Runtime ownership of each live session/name by a graph node. -/
  sessionOwner : Nat → Option Nat
  externalObservations : List Nat
  policyState : Nat
  tombstones : Finset Nat

namespace Config

/-- A minimal graph well-formedness predicate independent of any rule set. -/
def WellFormed {σ : FinSignature} (c : Config σ) : Prop :=
  (∀ n, n ∈ c.nodes ↔ ∃ g, c.nodeLabel n = some g) ∧
  ∀ edge ∈ c.edges, edge.1 ∈ c.nodes ∧ edge.2 ∈ c.nodes

/--
Every live token, resource, and session has a live node owner.  Ownership is
kept separate from graph well-formedness so generic graph DPO results do not
silently acquire runtime-resource assumptions.
-/
def OwnershipWellFormed {σ : FinSignature} (c : Config σ) : Prop :=
  (∀ token ∈ c.dataTokens,
      ∃ owner, c.dataOwner token = some owner ∧ owner ∈ c.nodes) ∧
  (∀ token ∈ c.resourceTokens,
      ∃ owner, c.resourceOwner token = some owner ∧ owner ∈ c.nodes) ∧
  ∀ name ∈ c.names,
      ∃ owner, c.sessionOwner name = some owner ∧ owner ∈ c.nodes

/-- Reindex labels along a monotone signature extension. -/
def reindex {σ τ : FinSignature} (ι : SignatureExtension σ τ)
    (c : Config σ) : Config τ where
  signatureVersion := c.signatureVersion
  nodes := c.nodes
  edges := c.edges
  nodeLabel := fun n => (c.nodeLabel n).map ι.gen
  dataTokens := c.dataTokens
  resourceTokens := c.resourceTokens
  names := c.names
  dataOwner := c.dataOwner
  resourceOwner := c.resourceOwner
  sessionOwner := c.sessionOwner
  externalObservations := c.externalObservations
  policyState := c.policyState
  tombstones := c.tombstones

@[simp] theorem reindex_signatureVersion {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (c : Config σ) :
    (reindex ι c).signatureVersion = c.signatureVersion := rfl

@[simp] theorem reindex_nodes {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (c : Config σ) :
    (reindex ι c).nodes = c.nodes := rfl

@[simp] theorem reindex_refl {σ : FinSignature} (c : Config σ) :
    reindex (SignatureExtension.refl σ) c = c := by
  cases c with
  | mk signatureVersion nodes edges nodeLabel dataTokens resourceTokens names
      dataOwner resourceOwner sessionOwner externalObservations policyState
      tombstones =>
      unfold reindex
      congr 1
      funext n
      change Option.map id (nodeLabel n) = nodeLabel n
      cases nodeLabel n <;> rfl

@[simp] theorem reindex_trans {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
    (c : Config σ) :
    reindex (SignatureExtension.trans ι κ) c =
      reindex κ (reindex ι c) := by
  cases c
  simp [reindex, SignatureExtension.trans, Option.map_map,
    Function.comp_def]

theorem wellFormed_reindex {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) {c : Config σ}
    (hc : c.WellFormed) : (reindex ι c).WellFormed := by
  constructor
  · intro n
    constructor
    · intro hn
      obtain ⟨g, hg⟩ := (hc.1 n).mp hn
      exact ⟨ι.gen g, by simp [reindex, hg]⟩
    · rintro ⟨g, hg⟩
      simp only [reindex] at hg
      cases hlabel : c.nodeLabel n with
      | none => simp [hlabel] at hg
      | some old =>
          exact (hc.1 n).mpr ⟨old, hlabel⟩
  · intro edge hedge
    exact hc.2 edge hedge

theorem ownershipWellFormed_reindex {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) {c : Config σ}
    (hc : c.OwnershipWellFormed) :
    (reindex ι c).OwnershipWellFormed := by
  exact hc

end Config

/-- Native visibility class for a complete event. -/
inductive EventKind
  | internal
  | external
  | administrative
  deriving DecidableEq, Repr

namespace EventKind

def Observable : EventKind → Prop
  | .internal | .external => True
  | .administrative => False

instance (kind : EventKind) : Decidable kind.Observable :=
  match kind with
  | .internal => isTrue trivial
  | .external => isTrue trivial
  | .administrative => isFalse id

end EventKind

/--
A complete concrete rule-application record.  `matchEmbedding` is the
monomorphism witness; `complementTag` identifies the selected
pushout-complement/derivation witness without pretending that DPO existence has
already been formalised here.
-/
structure DPOEvent (σ : FinSignature) where
  signatureVersion : Nat
  ruleId : Nat
  source : Config σ
  target : Config σ
  matchDomainSize : Nat
  matchCodomainSize : Nat
  matchEmbedding : Fin matchDomainSize ↪ Fin matchCodomainSize
  complementTag : Nat
  freshNames : Finset Nat
  policyEvidence : List Nat
  externalEvidence : List Nat
  kind : EventKind
  sourceVersion : source.signatureVersion = signatureVersion
  targetVersion : target.signatureVersion = signatureVersion
  freshForSource : Disjoint freshNames source.names
  sourceWellFormed : source.WellFormed
  targetWellFormed : target.WellFormed

namespace DPOEvent

/--
Replay input extracted from an event record.  Crucially, it contains neither
the recorded source nor the recorded target, so a replay kernel cannot return
the target merely by projecting it from the event.
-/
structure ReplayRecipe (σ : FinSignature) where
  signatureVersion : Nat
  ruleId : Nat
  matchDomainSize : Nat
  matchCodomainSize : Nat
  matchEmbedding : Fin matchDomainSize ↪ Fin matchCodomainSize
  complementTag : Nat
  freshNames : Finset Nat
  policyEvidence : List Nat
  externalEvidence : List Nat
  kind : EventKind

/-- Forget the stored endpoints and proof fields before deterministic replay. -/
def replayRecipe {σ : FinSignature} (event : DPOEvent σ) : ReplayRecipe σ where
  signatureVersion := event.signatureVersion
  ruleId := event.ruleId
  matchDomainSize := event.matchDomainSize
  matchCodomainSize := event.matchCodomainSize
  matchEmbedding := event.matchEmbedding
  complementTag := event.complementTag
  freshNames := event.freshNames
  policyEvidence := event.policyEvidence
  externalEvidence := event.externalEvidence
  kind := event.kind

/--
A deterministic executable semantics for complete replay recipes.  The source
configuration is explicit input and the result may reject an invalid record.
-/
structure ReplayKernel (σ : FinSignature) where
  run : ReplayRecipe σ → Config σ → Option (Config σ)

/--
An event accepted by a replay kernel.  The proof binds the stored target to
actual deterministic recomputation from the endpoint-free recipe and source.
-/
structure Verified (kernel : ReplayKernel σ) where
  event : DPOEvent σ
  replay_correct :
    kernel.run event.replayRecipe event.source = some event.target

namespace Verified

/-- Replay uses the claimed source and independently recomputes the target. -/
def Replays {σ : FinSignature} {kernel : ReplayKernel σ}
    (event : Verified kernel) (source target : Config σ) : Prop :=
  source = event.event.source ∧
    kernel.run event.event.replayRecipe source = some target

/-- Every verified record replays at its recorded endpoints. -/
theorem replays_recorded {σ : FinSignature} {kernel : ReplayKernel σ}
    (event : Verified kernel) :
    event.Replays event.event.source event.event.target :=
  ⟨rfl, event.replay_correct⟩

end Verified

theorem replay_source_unique {σ : FinSignature}
    {kernel : ReplayKernel σ} {event : Verified kernel}
    {s₁ s₂ t : Config σ}
    (h₁ : event.Replays s₁ t) (h₂ : event.Replays s₂ t) : s₁ = s₂ :=
  h₁.1.trans h₂.1.symm

/--
Complete-event replay is deterministic because the kernel is a function of
the endpoint-free recipe and claimed source.  The theorem does not hold for a
bare `ruleId`, and it does not use the record's stored target in the replay
relation.
-/
theorem event_replay_unique {σ : FinSignature}
    {kernel : ReplayKernel σ} {event : Verified kernel}
    {s t₁ t₂ : Config σ}
    (h₁ : event.Replays s t₁) (h₂ : event.Replays s t₂) : t₁ = t₂ := by
  exact Option.some.inj (h₁.2.symm.trans h₂.2)

/-- A successful replay from the recorded source must recover the recorded target. -/
theorem replay_recovers_recorded_target {σ : FinSignature}
    {kernel : ReplayKernel σ} {event : Verified kernel}
    {target : Config σ}
    (replay : event.Replays event.event.source target) :
    target = event.event.target :=
  event_replay_unique replay event.replays_recorded

end DPOEvent

/--
An LTS whose `step` field is the independently specified native transition
relation.  The setoid records the selected quotient equality; saturation
proofs prevent transitions, terminal observations, and signature versions from
depending on representatives.
-/
structure ObservableLTS where
  State : Type
  Event : Type
  stateSetoid : Setoid State
  step : State → Event → State → Prop
  observable : Event → Prop
  success : State → Prop
  waiting : State → Prop
  signatureVersion : State → Nat
  step_congr :
    ∀ {s s' e t t'}, stateSetoid.r s s' →
      stateSetoid.r t t' → (step s e t ↔ step s' e t')
  success_congr :
    ∀ {s t}, stateSetoid.r s t → (success s ↔ success t)
  waiting_congr :
    ∀ {s t}, stateSetoid.r s t → (waiting s ↔ waiting t)
  signatureVersion_congr :
    ∀ {s t}, stateSetoid.r s t →
      signatureVersion s = signatureVersion t

namespace ObservableLTS

/-- The explicit equality setoid, useful for already-quotiented state types. -/
def equalitySetoid (α : Type) : Setoid α where
  r := Eq
  iseqv := ⟨Eq.refl, Eq.symm, Eq.trans⟩

/-- A native transition retained by the LTS's observation policy. -/
def ObservableStep (L : ObservableLTS)
    (s : L.State) (e : L.Event) (t : L.State) : Prop :=
  L.step s e t ∧ L.observable e

/--
Native observable rewriting is independent of the chosen representatives of
the source and target state classes.
-/
theorem rewrite_respects_equiv (L : ObservableLTS)
    {source source' target target' : L.State} {event : L.Event}
    (sourceEquivalent : L.stateSetoid.r source source')
    (targetEquivalent : L.stateSetoid.r target target') :
    L.ObservableStep source event target ↔
      L.ObservableStep source' event target' := by
  constructor
  · rintro ⟨step, observable⟩
    exact
      ⟨(L.step_congr sourceEquivalent targetEquivalent).mp step,
        observable⟩
  · rintro ⟨step, observable⟩
    exact
      ⟨(L.step_congr sourceEquivalent targetEquivalent).mpr step,
        observable⟩

/-- No selected observable event leaves the state. -/
def Normal (L : ObservableLTS) (s : L.State) : Prop :=
  ¬∃ e t, L.ObservableStep s e t

/-- A normal state satisfying the separately supplied success predicate. -/
def SuccessfulTermination (L : ObservableLTS) (s : L.State) : Prop :=
  L.Normal s ∧ L.success s

/-- A normal, non-successful state explicitly waiting for external input. -/
def ExternalWait (L : ObservableLTS) (s : L.State) : Prop :=
  L.Normal s ∧ ¬L.success s ∧ L.waiting s

/-- A normal state that is neither successful nor waiting. -/
def Deadlocked (L : ObservableLTS) (s : L.State) : Prop :=
  L.Normal s ∧ ¬L.success s ∧ ¬L.waiting s

/--
The three terminal observations form an exhaustive classification of normal
states.  In particular, open external waiting is not classified as deadlock.
-/
theorem terminal_classification_iff (L : ObservableLTS) (s : L.State) :
    L.Normal s ↔
      L.SuccessfulTermination s ∨ L.ExternalWait s ∨ L.Deadlocked s := by
  constructor
  · intro hn
    by_cases hs : L.success s
    · exact Or.inl ⟨hn, hs⟩
    · by_cases hw : L.waiting s
      · exact Or.inr (Or.inl ⟨hn, hs, hw⟩)
      · exact Or.inr (Or.inr ⟨hn, hs, hw⟩)
  · rintro (hs | hw | hd)
    · exact hs.1
    · exact hw.1
    · exact hd.1

theorem successful_not_externalWait (L : ObservableLTS) (s : L.State) :
    ¬(L.SuccessfulTermination s ∧ L.ExternalWait s) := by
  rintro ⟨hs, hw⟩
  exact hw.2.1 hs.2

theorem successful_not_deadlocked (L : ObservableLTS) (s : L.State) :
    ¬(L.SuccessfulTermination s ∧ L.Deadlocked s) := by
  rintro ⟨hs, hd⟩
  exact hd.2.1 hs.2

theorem externalWait_not_deadlocked (L : ObservableLTS) (s : L.State) :
    ¬(L.ExternalWait s ∧ L.Deadlocked s) := by
  rintro ⟨hw, hd⟩
  exact hd.2.2 hw.2.2

/-- Finite paths in the selected observable transition relation. -/
inductive Path (L : ObservableLTS) :
    L.State → List L.Event → L.State → Prop
  | nil (s : L.State) : Path L s [] s
  | cons {s m t : L.State} {e : L.Event} {events : List L.Event} :
      L.ObservableStep s e m →
      Path L m events t →
      Path L s (e :: events) t

end ObservableLTS

/-- The observable LTS induced by deterministically replayable DPO records. -/
def dpoObservableLTS {σ : FinSignature}
    (kernel : DPOEvent.ReplayKernel σ)
    (success waiting : Config σ → Prop) : ObservableLTS where
  State := Config σ
  Event := DPOEvent.Verified kernel
  stateSetoid := ObservableLTS.equalitySetoid (Config σ)
  step := fun s e t => e.Replays s t
  observable := fun e => e.event.kind.Observable
  success := success
  waiting := waiting
  signatureVersion := Config.signatureVersion
  step_congr := by
    intro s s' e t t' hs ht
    subst s'
    subst t'
    rfl
  success_congr := by
    intro s t h
    subst t
    rfl
  waiting_congr := by
    intro s t h
    subst t
    rfl
  signatureVersion_congr := by
    intro s t h
    subst t
    rfl

theorem dpo_observable_step_deterministic {σ : FinSignature}
    (kernel : DPOEvent.ReplayKernel σ)
    (success waiting : Config σ → Prop)
    {s : Config σ} {e : DPOEvent.Verified kernel}
    {t₁ t₂ : Config σ}
    (h₁ : (dpoObservableLTS kernel success waiting).ObservableStep s e t₁)
    (h₂ : (dpoObservableLTS kernel success waiting).ObservableStep s e t₂) :
    t₁ = t₂ :=
  DPOEvent.event_replay_unique h₁.1 h₂.1

end Cantilune.Core
