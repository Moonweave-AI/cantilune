import Mathlib
import Cantilune.Core.Projection
import Cantilune.Projection.Reference

/-!
# Declaration-order pre-net projection

Transition declarations retain their list order and an explicit increasing
ordinal.  Markings use tokens with stable identities, so firing is not reduced
to anonymous place counts.
-/

namespace Cantilune.Projection.PreNet

open Cantilune.Core

inductive Place where
  | inbox
  | outbox
  deriving DecidableEq, Repr, Fintype

inductive TransitionName where
  | worker
  deriving DecidableEq, Repr, Fintype

structure Declaration where
  name : TransitionName
  ordinal : Nat
  input : Place
  output : Place
  deriving DecidableEq, Repr

def declarationBefore (left right : Declaration) : Prop :=
  left.ordinal < right.ordinal

/-- Declaration order is data and is certified to be strictly increasing. -/
structure Net where
  places : List Place
  declarations : List Declaration
  places_nodup : places.Nodup
  declarations_nodup : (declarations.map Declaration.name).Nodup
  declaration_order : declarations.Pairwise declarationBefore

def workerDeclaration : Declaration :=
  ⟨.worker, 0, .inbox, .outbox⟩

def baseNet : Net where
  places := [.inbox, .outbox]
  declarations := []
  places_nodup := by decide
  declarations_nodup := by simp
  declaration_order := by simp

def workerNet : Net where
  places := [.inbox, .outbox]
  declarations := [workerDeclaration]
  places_nodup := by decide
  declarations_nodup := by simp
  declaration_order := by simp

/-- Tokens retain identity across a firing. -/
structure Token where
  id : Nat
  place : Place
  deriving DecidableEq, Repr

def inputToken : Token := ⟨0, .inbox⟩
def outputToken : Token := ⟨0, .outbox⟩

structure State where
  net : Net
  marking : Finset Token
  version : Nat

def emptyState : State :=
  ⟨baseNet, {inputToken}, 0⟩

def installedState : State :=
  ⟨workerNet, {inputToken}, 1⟩

def finishedState : State :=
  ⟨workerNet, {outputToken}, 1⟩

inductive Event where
  | declareWorker
  | fireWorker (tokenId : Nat)
  deriving DecidableEq, Repr

/-- Native pre-net declaration and individual-token firing transitions. -/
inductive Step : State → Event → State → Prop where
  | declareWorker :
      Step emptyState .declareWorker installedState
  | fireWorker :
      Step installedState (.fireWorker inputToken.id) finishedState

theorem step_characterization {source : State} {event : Event}
    {target : State} (step : Step source event target) :
    (source = emptyState ∧ event = .declareWorker ∧
      target = installedState) ∨
    (source = installedState ∧
      event = .fireWorker inputToken.id ∧
      target = finishedState) := by
  cases step with
  | declareWorker => exact Or.inl ⟨rfl, rfl, rfl⟩
  | fireWorker => exact Or.inr ⟨rfl, rfl, rfl⟩

def success (state : State) : Prop :=
  state = finishedState

def waiting (_ : State) : Prop := False

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := waiting
  signatureVersion := State.version
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

def mapState : Reference.State → State
  | .empty => emptyState
  | .installed => installedState
  | .finished => finishedState

private def phase (state : State) : Nat :=
  if outputToken ∈ state.marking then 2 else state.version

theorem mapState_injective : Function.Injective mapState := by
  intro left right equality
  have phaseEquality := congrArg phase equality
  cases left <;> cases right <;>
    simp [phase, mapState, emptyState, installedState, finishedState,
      inputToken, outputToken] at phaseEquality ⊢

def mapEvent : Reference.Event → Event
  | .install => .declareWorker
  | .execute => .fireWorker inputToken.id

def Lift (source : Reference.Event) (target : Event) : Prop :=
  target = mapEvent source

/--
The declaration-order pre-net is a complete native one-step projection of the
reference execution.
-/
def certificate : ProjectionCertificate Reference.lts lts where
  mapState := mapState
  mapEvent := mapEvent
  Lift := Lift
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target h
    subst target
    rfl
  sound := by
    intro source event target transition
    rcases transition with ⟨step, _⟩
    cases step with
    | install => exact ⟨Step.declareWorker, trivial⟩
    | execute => exact ⟨Step.fireWorker, trivial⟩
  reflect := by
    intro source targetEvent target transition
    rcases transition with ⟨step, _⟩
    rcases step_characterization step with
      ⟨sourceShape, eventShape, targetShape⟩ |
      ⟨sourceShape, eventShape, targetShape⟩
    · have sourceEq : source = .empty :=
        mapState_injective (by simpa [mapState] using sourceShape)
      subst source
      subst targetEvent
      exact
        ⟨.install, .installed, Reference.install_observable, rfl,
          by
            change target = installedState
            exact targetShape⟩
    · have sourceEq : source = .installed :=
        mapState_injective (by simpa [mapState] using sourceShape)
      subst source
      subst targetEvent
      exact
        ⟨.execute, .finished, Reference.execute_observable, rfl,
          by
            change target = finishedState
            exact targetShape⟩
  success_iff := by
    intro state
    cases state <;> simp [lts, mapState, success, Reference.lts,
      Reference.success, finishedState, installedState, emptyState,
      inputToken, outputToken]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    cases state <;> rfl

/--
The central certificate for the finite declaration-order pre-net reference.

The certified reconfiguration is the explicit `declareWorker` event in this
finite execution.  The declaration is a concrete `ProjectionCertificate`; it
does not claim a general Petri-net or DPO construction.
-/
def reconfigurable_petri_certificate :
    ProjectionCertificate Reference.lts lts :=
  certificate

def tokenIds (marking : Finset Token) : Finset Nat :=
  marking.image Token.id

theorem worker_declaration_ordered :
    workerNet.declarations.Pairwise declarationBefore :=
  workerNet.declaration_order

theorem install_appends_exact_declaration :
    installedState.net.declarations = [workerDeclaration] :=
  rfl

theorem firing_preserves_token_identity :
    tokenIds installedState.marking = tokenIds finishedState.marking := by
  decide

theorem firing_moves_token :
    inputToken ∈ installedState.marking ∧
      outputToken ∈ finishedState.marking := by
  decide

theorem install_native :
    lts.ObservableStep emptyState .declareWorker installedState :=
  reconfigurable_petri_certificate.sound Reference.install_observable

theorem firing_native :
    lts.ObservableStep
      installedState
      (.fireWorker inputToken.id)
      finishedState :=
  reconfigurable_petri_certificate.sound Reference.execute_observable

theorem terminal_certificate (state : Reference.State) :
    (lts.SuccessfulTermination (mapState state) ↔
      Reference.lts.SuccessfulTermination state) ∧
    (lts.ExternalWait (mapState state) ↔
      Reference.lts.ExternalWait state) ∧
    (lts.Deadlocked (mapState state) ↔
      Reference.lts.Deadlocked state) :=
  reconfigurable_petri_certificate.terminal_classification_preserved state

end Cantilune.Projection.PreNet
