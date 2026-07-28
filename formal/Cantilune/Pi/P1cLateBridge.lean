import Cantilune.Pi.P1cMatrix
import Cantilune.Pi.OperationalBridge

/-!
# P1c typed-kernel to standard late-pi bridge

Every event-adequate witness in the P1c pi column erases to one derivation of
the independently defined, structurally closed standard late semantics.  The
proof is by the event-indexed endpoint specification, not by declaring the
late relation to be the image of the typed kernel.
-/

namespace Cantilune.Pi.P1cMatrix

open Cantilune.Pi
open Cantilune.Pi.Protocols

private theorem message_late_native :
    Late.NativeStep
      (Proc.par messageSender messageReceiver).erase
      .tau
      (Proc.par .zero .zero).erase := by
  apply Late.NativeStep.syncLeft
    Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
  decide

private theorem open_close_late_native :
    Late.NativeStep extrudedHandshake.erase .tau handshakeResult.erase := by
  apply Late.NativeStep.closeLeft
    (Late.NativeStep.open (by decide) Late.NativeStep.prefixOutput)
    Late.NativeStep.prefixInput
  · decide
  · decide

private theorem restricted_handshake_late_native :
    Late.NativeStep
      closedRestrictedHandshake.erase .tau closedHandshakeResult.erase := by
  apply Late.NativeStep.restrict
  · simp [Raw.Action.names]
  · apply Late.NativeStep.restrict
    · simp [Raw.Action.names]
    · apply Late.NativeStep.syncLeft
        Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
      decide

private theorem delegation_late_native :
    Late.NativeStep
      closedDelegationOffering.erase .tau closedDelegationResult.erase := by
  apply Late.NativeStep.restrict
  · simp [Raw.Action.names]
  · apply Late.NativeStep.restrict
    · simp [Raw.Action.names]
    · apply Late.NativeStep.syncLeft
        Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
      decide

private theorem reconnect_late_native :
    Late.NativeStep reconnectOffering.erase .tau reconnectResult.erase := by
  apply Late.NativeStep.syncLeft
    Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
  decide

private theorem quiescent_delete_late_native :
    Late.NativeStep
      quiescentDeleteOffering.erase .tau quiescentDeleteResult.erase := by
  apply Late.NativeStep.syncLeft
    Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
  decide

/--
The exact P1c pi endpoint specification is sound for one constructor tree of
the native standard strong-late semantics after erasing channel sort
annotations.  This theorem deliberately concludes `Late.NativeStep`, not a
structural or reflexive-transitive closure.
-/
theorem piAdequate_erases_to_standard_late_native
    {event : SourceEvent} {process target : Proc} {action : Action}
    (adequate : PiAdequate event process action target) :
    Late.NativeStep process.erase action.erase target.erase := by
  cases adequate with
  | freeOutput =>
      exact Late.NativeStep.prefixOutput
  | boundOutput =>
      exact Late.NativeStep.open (by decide) Late.NativeStep.prefixOutput
  | lateInput =>
      exact Late.NativeStep.prefixInput
  | communication =>
      exact message_late_native
  | openClose =>
      exact open_close_late_native
  | restriction =>
      exact restricted_handshake_late_native
  | scopeExtrusion =>
      exact Late.NativeStep.open (by decide) Late.NativeStep.prefixOutput
  | delegation =>
      exact delegation_late_native
  | choiceLeft =>
      exact Late.NativeStep.choiceLeft Late.NativeStep.prefixTau
  | choiceRight =>
      exact Late.NativeStep.choiceRight Late.NativeStep.prefixTau
  | matchSuccess =>
      exact Late.NativeStep.matchGuard Late.NativeStep.prefixTau
  | mismatchGuard =>
      exact Late.NativeStep.mismatchGuard (by decide)
        Late.NativeStep.prefixTau
  | dynamicPartnerAdmission =>
      exact Late.NativeStep.prefixInput
  | instanceReconnect =>
      exact reconnect_late_native
  | instanceDeleteQuiescent =>
      exact quiescent_delete_late_native

/--
Embedding the native derivation above into the structurally closed strong-late
LTS preserves exactly one step.  No weak-step or transitive closure is used.
-/
theorem piAdequate_erases_to_standard_late
    {event : SourceEvent} {process target : Proc} {action : Action}
    (adequate : PiAdequate event process action target) :
    Late.Step process.erase action.erase target.erase :=
  Late.Step.native (piAdequate_erases_to_standard_late_native adequate)

/-- Both endpoints of every P1c pi witness satisfy the pinned protocol type environment. -/
theorem piAdequate_wellTyped
    {event : SourceEvent} {process target : Proc} {action : Action}
    (adequate : PiAdequate event process action target) :
    process.WellTyped protocolEnv ∧ target.WellTyped protocolEnv := by
  cases adequate <;>
    norm_num [Proc.WellTyped, protocolEnv, messageSender, messageReceiver,
      mismatchDecision, reconnectOffering, reconnectResult,
      quiescentDeleteOffering, quiescentDeleteResult, request,
      accept, requestContinuation, acceptContinuation, restrictedHandshake,
      extrudedHandshake, handshakeResult, closedRestrictedHandshake,
      closedHandshakeResult, delegationSender, delegationReceiver,
      delegationReceiverContinuation, closedDelegationOffering,
      closedDelegationResult,
      Cantilune.Pi.AdmissionCertificate.certifiedAdmissionWait,
      publicChannel, sessionChannel, boundSessionChannel,
      delegationChannel, delegatedChannel, boundDelegatedChannel,
      publicName, session, sessionBinder, payload, payloadBinder,
      delegationBus, delegated, delegatedBinder]

/--
Every one of the fifteen typed P1c witnesses belongs to the normative typed
strong-late relation: all parallel, communication, close, and restriction
freshness obligations are supplied at construction time.
-/
theorem piAdequate_standard_typed
    {event : SourceEvent} {process target : Proc} {action : Action}
    (adequate : PiAdequate event process action target) :
    Step.StandardNativeStep process action target := by
  cases adequate with
  | freeOutput =>
      exact ⟨Step.prefixOutput, Step.StandardCompatible.prefixOutput⟩
  | boundOutput =>
      exact
        ⟨Step.scopeOpen (by decide),
          Step.StandardCompatible.scopeOpen (by decide)⟩
  | lateInput =>
      exact ⟨Step.prefixInput, Step.StandardCompatible.prefixInput⟩
  | communication =>
      refine ⟨message_one_step, ?_⟩
      exact
        Step.StandardCompatible.syncLeft (by decide)
          Step.StandardCompatible.prefixOutput
          Step.StandardCompatible.prefixInput
          (by decide)
  | openClose =>
      refine ⟨request_accept_scope_extrusion, ?_⟩
      exact
        Step.StandardCompatible.scopeCloseLeft accept_substitution
          (Step.StandardCompatible.scopeOpen (by decide))
          Step.StandardCompatible.prefixInput
          (by decide) (by decide)
  | restriction =>
      refine ⟨requestAccept_from_certificate, ?_⟩
      exact
        Step.StandardCompatible.restrict (by simp [Action.names])
          (Step.StandardCompatible.restrict (by simp [Action.names])
            (Step.StandardCompatible.syncLeft accept_substitution
              Step.StandardCompatible.prefixOutput
              Step.StandardCompatible.prefixInput
              (by decide)))
  | scopeExtrusion =>
      exact
        ⟨Step.scopeOpen (by decide),
          Step.StandardCompatible.scopeOpen (by decide)⟩
  | delegation =>
      refine ⟨delegation_from_certificate, ?_⟩
      exact
        Step.StandardCompatible.restrict (by simp [Action.names])
          (Step.StandardCompatible.restrict (by simp [Action.names])
            (Step.StandardCompatible.syncLeft delegation_substitution
              Step.StandardCompatible.prefixOutput
              Step.StandardCompatible.prefixInput
              (by decide)))
  | choiceLeft =>
      exact
        ⟨Step.choiceLeft Step.prefixTau,
          Step.StandardCompatible.choiceLeft
            Step.StandardCompatible.prefixTau⟩
  | choiceRight =>
      exact
        ⟨Step.choiceRight Step.prefixTau,
          Step.StandardCompatible.choiceRight
            Step.StandardCompatible.prefixTau⟩
  | matchSuccess =>
      exact
        ⟨Step.matchGuard Step.prefixTau,
          Step.StandardCompatible.matchGuard
            Step.StandardCompatible.prefixTau⟩
  | mismatchGuard =>
      exact
        ⟨mismatch_decision_one_step,
          Step.StandardCompatible.mismatchGuard (by decide)
            Step.StandardCompatible.prefixTau⟩
  | dynamicPartnerAdmission =>
      exact ⟨admission_from_certificate,
        Step.StandardCompatible.prefixInput⟩
  | instanceReconnect =>
      refine ⟨reconnect_one_step, ?_⟩
      exact
        Step.StandardCompatible.syncLeft delegation_substitution
          Step.StandardCompatible.prefixOutput
          Step.StandardCompatible.prefixInput
          (by decide)
  | instanceDeleteQuiescent =>
      refine ⟨quiescent_delete_one_step, ?_⟩
      exact
        Step.StandardCompatible.syncLeft (by decide)
          Step.StandardCompatible.prefixOutput
          Step.StandardCompatible.prefixInput
          (by decide)

/--
The normative typed relation, rather than a separately supplied late proof,
now yields the native untyped standard-late derivation for every matrix cell.
-/
theorem piAdequate_standard_typed_erases_native
    {event : SourceEvent} {process target : Proc} {action : Action}
    (adequate : PiAdequate event process action target) :
    Late.NativeStep process.erase action.erase target.erase :=
  Step.standard_typed_pi_erasure_operational
    (piAdequate_standard_typed adequate)

/-- Every concrete native pi-column cell therefore has a standard late step. -/
theorem piCell_erases_to_standard_late (event : SourceEvent) :
    ∃ process : Proc, ∃ action : Action, ∃ target : Proc,
      Cantilune.Pi.Step process action target ∧
        PiAdequate event process action target ∧
        Late.Step process.erase action.erase target.erase := by
  cases event
  all_goals
    first
    | exact ⟨_, _, _, message_one_step, .communication,
        piAdequate_erases_to_standard_late .communication⟩
    | exact ⟨_, _, _, request_accept_scope_extrusion, .openClose,
        piAdequate_erases_to_standard_late .openClose⟩
    | exact ⟨_, _, _, requestAccept_from_certificate, .restriction,
        piAdequate_erases_to_standard_late .restriction⟩
    | exact ⟨_, _, _, delegation_from_certificate, .delegation,
        piAdequate_erases_to_standard_late .delegation⟩
    | exact ⟨_, _, _, admission_from_certificate, .dynamicPartnerAdmission,
        piAdequate_erases_to_standard_late .dynamicPartnerAdmission⟩
    | exact ⟨_, _, _, mismatch_decision_one_step, .mismatchGuard,
        piAdequate_erases_to_standard_late .mismatchGuard⟩
    | exact ⟨_, _, _, reconnect_one_step, .instanceReconnect,
        piAdequate_erases_to_standard_late .instanceReconnect⟩
    | exact ⟨_, _, _, quiescent_delete_one_step,
        .instanceDeleteQuiescent,
        piAdequate_erases_to_standard_late .instanceDeleteQuiescent⟩
    | exact ⟨_, _, _, Cantilune.Pi.Step.prefixOutput, .freeOutput,
        piAdequate_erases_to_standard_late .freeOutput⟩
    | exact ⟨_, _, _, Cantilune.Pi.Step.scopeOpen (by decide), .boundOutput,
        piAdequate_erases_to_standard_late .boundOutput⟩
    | exact ⟨_, _, _, Cantilune.Pi.Step.prefixInput, .lateInput,
        piAdequate_erases_to_standard_late .lateInput⟩
    | exact ⟨_, _, _, Cantilune.Pi.Step.scopeOpen (by decide),
        .scopeExtrusion,
        piAdequate_erases_to_standard_late .scopeExtrusion⟩
    | exact ⟨_, _, _,
        Cantilune.Pi.Step.choiceLeft Cantilune.Pi.Step.prefixTau,
        .choiceLeft, piAdequate_erases_to_standard_late .choiceLeft⟩
    | exact ⟨_, _, _,
        Cantilune.Pi.Step.choiceRight Cantilune.Pi.Step.prefixTau,
        .choiceRight, piAdequate_erases_to_standard_late .choiceRight⟩
    | exact ⟨_, _, _,
        Cantilune.Pi.Step.matchGuard Cantilune.Pi.Step.prefixTau,
        .matchSuccess, piAdequate_erases_to_standard_late .matchSuccess⟩

end Cantilune.Pi.P1cMatrix
