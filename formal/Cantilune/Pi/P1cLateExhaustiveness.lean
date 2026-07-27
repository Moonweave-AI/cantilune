import Cantilune.Core.Projection
import Cantilune.Pi.P1cLateBridge

/-!
# Exhaustiveness boundary for the P1c late-pi reference processes

The P1c matrix proves that every source event has a designated native
late-pi derivation.  That fact must not be confused with exhaustiveness with
respect to the *whole* standard late LTS.  In particular, an un-restricted
parallel offer can interact internally, but either endpoint may also perform
its visible prefix with an environment.

This file records that boundary in the kernel:

* the mismatch decision has exactly its designated native transition;
* reconnect and quiescent-delete each have an additional visible output;
* the additional endpoints are not the designated completed endpoints;
* consequently no `ProjectionCertificate` whose states are the actual
  reference processes can use the complete `Late.NativeStep` relation.

The event-indexed `P1cProjectionCertificates.PiTarget.Step` remains a sound
one-step wrapper, but its reflection theorem is only about that restricted
wrapper, not about every transition of the underlying standard late process.
-/

namespace Cantilune.Pi.P1cLateExhaustiveness

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.P1cMatrix

/-! ## Exact mismatch behaviour -/

/--
The proof-guarded mismatch process has no native action other than the
designated `tau`, and that action reaches `0`.
-/
theorem mismatch_native_exact
    {action : Raw.Action} {target : Raw.Proc}
    (step : Late.NativeStep mismatchDecision.erase action target) :
    action = .tau ∧ target = .zero := by
  change
    Late.NativeStep
      (.matchNe payload payloadBinder (.tau .zero)) action target at step
  cases step with
  | mismatchGuard _ bodyStep =>
      cases bodyStep
      exact ⟨rfl, rfl⟩

theorem mismatch_native_iff
    {action : Raw.Action} {target : Raw.Proc} :
    Late.NativeStep mismatchDecision.erase action target ↔
      action = .tau ∧ target = .zero := by
  constructor
  · exact mismatch_native_exact
  · rintro ⟨rfl, rfl⟩
    exact
      Late.NativeStep.mismatchGuard (by decide)
        Late.NativeStep.prefixTau

/-! ## Extra standard-late behaviour of the administrative handshakes -/

def reconnectOutputAction : Raw.Action :=
  (.output delegationChannel delegated : Action).erase

def reconnectOutputTarget : Raw.Proc :=
  .par .zero delegationReceiver.erase

/--
Before reconnect synchronises internally, its sender is also an ordinary
visible output prefix.  This is a second native transition, not a weak path.
-/
theorem reconnect_extra_native_output :
    Late.NativeStep reconnectOffering.erase
      reconnectOutputAction reconnectOutputTarget := by
  apply Late.NativeStep.parLeft
  · change
      Disjoint (∅ : Finset Name) delegationReceiver.erase.freeNames
    simp
  · exact Late.NativeStep.prefixOutput

theorem reconnect_extra_action_ne_designated :
    reconnectOutputAction ≠
      (piReferenceDerivation .instanceReconnect).label.erase := by
  decide

theorem reconnect_extra_target_ne_designated :
    reconnectOutputTarget ≠
      (piReferenceDerivation .instanceReconnect).target.erase := by
  decide

def quiescentDeleteOutputAction : Raw.Action :=
  (.output delegationChannel delegated : Action).erase

def quiescentDeleteOutputTarget : Raw.Proc :=
  .par .zero
    ((.recv delegationChannel delegatedBinder .zero : Proc).erase)

/--
The shutdown offer used for quiescent deletion likewise exposes its ordinary
output prefix to an environment before the internal acknowledgement.
-/
theorem quiescent_delete_extra_native_output :
    Late.NativeStep quiescentDeleteOffering.erase
      quiescentDeleteOutputAction quiescentDeleteOutputTarget := by
  apply Late.NativeStep.parLeft
  · change
      Disjoint (∅ : Finset Name)
        ((.recv delegationChannel delegatedBinder .zero : Proc).erase).freeNames
    simp
  · exact Late.NativeStep.prefixOutput

theorem quiescent_delete_extra_action_ne_designated :
    quiescentDeleteOutputAction ≠
      (piReferenceDerivation .instanceDeleteQuiescent).label.erase := by
  decide

theorem quiescent_delete_extra_target_ne_designated :
    quiescentDeleteOutputTarget ≠
      (piReferenceDerivation .instanceDeleteQuiescent).target.erase := by
  decide

/-! ## The complete native target and the reflection obstruction -/

namespace FullNativeTarget

/--
An event tag keeps the fifteen reference families disjoint, while `process`
is the actual raw pi state.  Unlike `PiTarget.State`, arbitrary native
derivatives are retained.
-/
structure State where
  event : SourceEvent
  process : Raw.Proc
  deriving DecidableEq, Repr

/-- Every standard native transition is admitted, preserving only the family tag. -/
inductive Step : State → Raw.Action → State → Prop where
  | native (event : SourceEvent)
      (step : Late.NativeStep process action target) :
      Step ⟨event, process⟩ action ⟨event, target⟩

def designatedSource (event : SourceEvent) : Raw.Proc :=
  (piReferenceDerivation event).source.erase

def designatedTarget (event : SourceEvent) : Raw.Proc :=
  (piReferenceDerivation event).target.erase

def mapState : SourceState → State
  | .ready event => ⟨event, designatedSource event⟩
  | .completed event => ⟨event, designatedTarget event⟩

def success (state : State) : Prop :=
  state.process = designatedTarget state.event

def version (state : State) : Nat :=
  if state.event = .dynamicPartnerAdmission ∧
      state.process = designatedTarget .dynamicPartnerAdmission
    then 1
    else 0

/--
The independently declared complete native LTS on each tagged reference
process.  It contains the designated transition and every environmental
transition of the same process.
-/
def lts : ObservableLTS where
  State := State
  Event := Raw.Action
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := version
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

def reconnectExtraState : State :=
  ⟨.instanceReconnect, reconnectOutputTarget⟩

def quiescentDeleteExtraState : State :=
  ⟨.instanceDeleteQuiescent, quiescentDeleteOutputTarget⟩

theorem reconnect_extra_observable :
    lts.ObservableStep
      (mapState (.ready .instanceReconnect))
      reconnectOutputAction
      reconnectExtraState := by
  exact ⟨Step.native _ reconnect_extra_native_output, trivial⟩

theorem quiescent_delete_extra_observable :
    lts.ObservableStep
      (mapState (.ready .instanceDeleteQuiescent))
      quiescentDeleteOutputAction
      quiescentDeleteExtraState := by
  exact ⟨Step.native _ quiescent_delete_extra_native_output, trivial⟩

theorem reconnect_extra_state_ne_mapped_completion :
    reconnectExtraState ≠
      mapState (.completed .instanceReconnect) := by
  intro equality
  exact reconnect_extra_target_ne_designated
    (congrArg State.process equality)

theorem quiescent_delete_extra_state_ne_mapped_completion :
    quiescentDeleteExtraState ≠
      mapState (.completed .instanceDeleteQuiescent) := by
  intro equality
  exact quiescent_delete_extra_target_ne_designated
    (congrArg State.process equality)

/--
Even if target labels are related to source labels by an arbitrary `Lift`,
endpoint reflection already fails for reconnect: the source audit LTS has
only its designated completed state, whereas the full late LTS also reaches
the exposed-output derivative.
-/
theorem no_projection_certificate_with_actual_process_map :
    ¬ ∃ certificate : ProjectionCertificate sourceLTS lts,
        ∀ state, certificate.mapState state = mapState state := by
  rintro ⟨certificate, mapAgreement⟩
  have targetStep :
      lts.ObservableStep
        (certificate.mapState (.ready .instanceReconnect))
        reconnectOutputAction reconnectExtraState := by
    rw [mapAgreement]
    exact reconnect_extra_observable
  obtain ⟨event, sourceTarget, sourceStep, _lift, endpoint⟩ :=
    certificate.reflect targetStep
  rcases sourceStep with ⟨step, _observable⟩
  cases step
  have endpoint' :
      reconnectExtraState =
        mapState (.completed .instanceReconnect) := by
    change
      reconnectExtraState =
        certificate.mapState (.completed .instanceReconnect)
      at endpoint
    rw [mapAgreement] at endpoint
    exact endpoint
  exact reconnect_extra_state_ne_mapped_completion endpoint'

end FullNativeTarget

end Cantilune.Pi.P1cLateExhaustiveness
