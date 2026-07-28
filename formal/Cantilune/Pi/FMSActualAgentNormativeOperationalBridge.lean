import Cantilune.Pi.FMSNormativeSupportedCompileBoundary
import Cantilune.Pi.FMSCpoSupportedParallelRestriction
import Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra

/-!
# Compiled normative operational bridge

This module gives every normative `SourceEvent` a typed finite-control
`SupportedProc` realization.  The realization is intentionally nominally
fresh: input and bound-output binders are allocated at
`normativeBaseWorld`, rather than copying the fixed binders of the reference
raw processes.

The operational comparison is therefore not literal raw-syntax equality.
It consists of:

* one genuine strong late-pi step of the reified supported source;
* exhaustive classification of that first step;
* the same one-step/two-step pointed protocol shape as the canonical P1c
  source, using `ready_native_exact` and `rawFirstTarget_classification`;
* joint derivative alpha for every input or bound-output label whose binder
  is freshly realized.

No weak closure and no process-bisimulation quotient is used.
-/

noncomputable section

namespace Cantilune.Pi.FMSActualAgentNormativeOperationalBridge

open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSOperationalSyntaxBridge
open Cantilune.Pi.FMSCpoSupportedActualAgent
open Cantilune.Pi.FMSCpoSupportedParallelRestriction
open Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cClosedNativeCertificate
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.OpenSMCActionAlpha
open Cantilune.Pi.FMSActualAgentNormativeCommutation

/-! ## Typed realizations -/

/-- The actual fresh nominal binder allocated by canonical reification. -/
def compiledFresh : Name := normativeBaseWorld

/-- Every compiled protocol ends in the inactive supported process. -/
def compiledTerminal (_event : SourceEvent) :
    SupportedProc normativeBaseWorld 0 :=
  .zero

/--
The genuine intermediate states are those of `openClose`, `restriction`,
and `dynamicPartnerAdmission`.  They each expose exactly one further tau
step; the admission target is reconnect-ready.
-/
def compiledFirstTarget : SourceEvent →
    SupportedProc normativeBaseWorld 0
  | .openClose
  | .restriction
  | .dynamicPartnerAdmission => .tau .zero
  | _ => .zero

/--
Typed finite-control source for every normative family.

Visible prefixes and guards retain their native constructors.  Closed
administrative and communication families use a genuine tau prefix; the two
payload protocols and phased admission use two successive native prefixes.
This is a fresh nominal
realization of the observable pointed protocol, not a claim of literal
equality with the canonical closed raw source.
-/
def compiledSource : SourceEvent →
    SupportedProc normativeBaseWorld 0
  | .freeOutput =>
      .output (.free (1 : Fin normativeBaseWorld))
        (.free (3 : Fin normativeBaseWorld)) .zero
  | .boundOutput =>
      .restrict
        (.output
          (.free (5 : Fin normativeBaseWorld))
          (.bound (Fin.last 0))
          .zero)
  | .lateInput =>
      .input (.free (1 : Fin normativeBaseWorld)) .zero
  | .communication => .tau .zero
  | .openClose => .tau (.tau .zero)
  | .restriction => .tau (.tau .zero)
  | .scopeExtrusion =>
      .restrict
        (.output
          (.free (0 : Fin normativeBaseWorld))
          (.bound (Fin.last 0))
          .zero)
  | .delegation => .tau .zero
  | .choiceLeft => .choice (.tau .zero) .zero
  | .choiceRight => .choice .zero (.tau .zero)
  | .matchSuccess =>
      .matchEq
        (.free (3 : Fin normativeBaseWorld))
        (.free (3 : Fin normativeBaseWorld))
        (.tau .zero)
  | .mismatchGuard =>
      .matchNe
        (.free (3 : Fin normativeBaseWorld))
        (.free (4 : Fin normativeBaseWorld))
        (.tau .zero)
  | .dynamicPartnerAdmission =>
      .input (.free (5 : Fin normativeBaseWorld)) (.tau .zero)
  | .instanceReconnect => .tau .zero
  | .instanceDeleteQuiescent => .tau .zero

/-- The concrete raw label emitted by the fresh nominal realization. -/
def compiledFirstAction : SourceEvent → Raw.Action
  | .freeOutput => .output session payload
  | .boundOutput => .boundOutput delegationBus compiledFresh
  | .lateInput => .input session compiledFresh
  | .communication
  | .openClose
  | .restriction => .tau
  | .scopeExtrusion => .boundOutput publicName compiledFresh
  | .delegation
  | .choiceLeft
  | .choiceRight
  | .matchSuccess
  | .mismatchGuard => .tau
  | .dynamicPartnerAdmission =>
      .input delegationBus compiledFresh
  | .instanceReconnect
  | .instanceDeleteQuiescent => .tau

def compiledRawSource (event : SourceEvent) : Raw.Proc :=
  match event with
  | .dynamicPartnerAdmission =>
      .recv delegationBus compiledFresh
        (firstTarget .dynamicPartnerAdmission)
  | other =>
      FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (compiledSource other)

def compiledRawFirstTarget (event : SourceEvent) : Raw.Proc :=
  match event with
  | .dynamicPartnerAdmission =>
      firstTarget .dynamicPartnerAdmission
  | other =>
      FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (compiledFirstTarget other)

def compiledRawTerminal (event : SourceEvent) : Raw.Proc :=
  match event with
  | .dynamicPartnerAdmission =>
      terminalProcess .dynamicPartnerAdmission
  | other =>
      FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (compiledTerminal other)

@[simp]
theorem compiledRawTerminal_eq_zero (event : SourceEvent) :
    event ≠ .dynamicPartnerAdmission →
      compiledRawTerminal event = .zero := by
  intro notAdmission
  cases event <;>
    simp_all [compiledRawTerminal, compiledTerminal,
      FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld,
      FMSOperationalSyntaxBridge.SupportedProc.reify]

@[simp]
theorem compiledRawFirstTarget_eq
    (event : SourceEvent) :
    compiledRawFirstTarget event =
      if event = .dynamicPartnerAdmission then
        firstTarget .dynamicPartnerAdmission
      else if event = .openClose ∨ event = .restriction then
        .tau .zero
      else
        .zero := by
  cases event <;> rfl

/-! ## Exact native operational classification -/

private theorem raw_zero_no_native
    {action : Raw.Action} {target : Raw.Proc} :
    ¬ Late.NativeStep .zero action target := by
  intro step
  cases step

private theorem raw_tau_native_exact
    {next : Raw.Proc}
    {action : Raw.Action} {target : Raw.Proc}
    (step : Late.NativeStep (.tau next) action target) :
    action = .tau ∧ target = next := by
  cases step
  exact ⟨rfl, rfl⟩

private theorem raw_send_native_exact
    {channel value : Name} {next : Raw.Proc}
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep (.send channel value next) action target) :
    action = .output channel value ∧ target = next := by
  cases step
  exact ⟨rfl, rfl⟩

private theorem raw_recv_native_exact
    {channel binder : Name} {next : Raw.Proc}
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep (.recv channel binder next) action target) :
    action = .input channel binder ∧ target = next := by
  cases step
  exact ⟨rfl, rfl⟩

private theorem raw_fresh_send_native_exact
    {fresh channel : Name}
    (_distinct : fresh ≠ channel)
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep
        (.new fresh (.send channel fresh .zero))
        action target) :
    action = .boundOutput channel fresh ∧ target = .zero := by
  cases step with
  | restrict freshness bodyStep =>
      cases bodyStep
      exact False.elim (freshness (by simp [Raw.Action.names]))
  | «open» channelDistinct bodyStep =>
      cases bodyStep
      exact ⟨rfl, rfl⟩

private theorem raw_choice_left_native_exact
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep
        (.choice (.tau .zero) .zero) action target) :
    action = .tau ∧ target = .zero := by
  cases step with
  | choiceLeft inner =>
      exact raw_tau_native_exact inner
  | choiceRight inner =>
      exact False.elim (raw_zero_no_native inner)

private theorem raw_choice_right_native_exact
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep
        (.choice .zero (.tau .zero)) action target) :
    action = .tau ∧ target = .zero := by
  cases step with
  | choiceLeft inner =>
      exact False.elim (raw_zero_no_native inner)
  | choiceRight inner =>
      exact raw_tau_native_exact inner

private theorem raw_match_native_exact
    {name : Name}
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep
        (.matchEq name name (.tau .zero)) action target) :
    action = .tau ∧ target = .zero := by
  cases step with
  | matchGuard inner =>
      exact raw_tau_native_exact inner

private theorem raw_mismatch_native_exact
    {left right : Name}
    (_distinct : left ≠ right)
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep
        (.matchNe left right (.tau .zero)) action target) :
    action = .tau ∧ target = .zero := by
  cases step with
  | mismatchGuard _ inner =>
      exact raw_tau_native_exact inner

/-- Every compiled event has its designated genuine strong late-pi step. -/
theorem compiled_first_native (event : SourceEvent) :
    Late.NativeStep
      (compiledRawSource event)
      (compiledFirstAction event)
      (compiledRawFirstTarget event) := by
  cases event with
  | freeOutput =>
      exact output_reification_native _ _ _ _
  | boundOutput =>
      exact boundOutput_reification_native _ (5 : Fin normativeBaseWorld) .zero
  | lateInput =>
      exact input_reification_native _ _ _
  | communication =>
      exact tau_reification_native _ _
  | openClose =>
      exact tau_reification_native _ _
  | restriction =>
      exact tau_reification_native _ _
  | scopeExtrusion =>
      exact boundOutput_reification_native _ (0 : Fin normativeBaseWorld) .zero
  | delegation =>
      exact tau_reification_native _ _
  | choiceLeft =>
      exact choice_left_reification_native _ _ _ _ _
        (tau_reification_native _ _)
  | choiceRight =>
      exact choice_right_reification_native _ _ _ _ _
        (tau_reification_native _ _)
  | matchSuccess =>
      exact matchEq_reification_native _ _ _ _ _
        (tau_reification_native _ _)
  | mismatchGuard =>
      exact Late.NativeStep.mismatchGuard (by decide)
        Late.NativeStep.prefixTau
  | dynamicPartnerAdmission =>
      exact Late.NativeStep.prefixInput
  | instanceReconnect =>
      exact tau_reification_native _ _
  | instanceDeleteQuiescent =>
      exact tau_reification_native _ _

/-- No environmental or administrative derivative is silently added. -/
theorem compiled_first_native_exact
    (event : SourceEvent)
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep (compiledRawSource event) action target) :
    action = compiledFirstAction event ∧
      target = compiledRawFirstTarget event := by
  cases event with
  | freeOutput =>
      exact raw_send_native_exact step
  | boundOutput =>
      exact raw_fresh_send_native_exact (by decide) step
  | lateInput =>
      exact raw_recv_native_exact step
  | communication =>
      exact raw_tau_native_exact step
  | openClose =>
      exact raw_tau_native_exact step
  | restriction =>
      exact raw_tau_native_exact step
  | scopeExtrusion =>
      exact raw_fresh_send_native_exact (by decide) step
  | delegation =>
      exact raw_tau_native_exact step
  | choiceLeft =>
      exact raw_choice_left_native_exact step
  | choiceRight =>
      exact raw_choice_right_native_exact step
  | matchSuccess =>
      exact raw_match_native_exact step
  | mismatchGuard =>
      exact raw_mismatch_native_exact (by decide) step
  | dynamicPartnerAdmission =>
      exact raw_recv_native_exact step
  | instanceReconnect =>
      exact raw_tau_native_exact step
  | instanceDeleteQuiescent =>
      exact raw_tau_native_exact step

/-- Compiled terminal states have no native successor. -/
theorem compiled_terminal_no_native
    (event : SourceEvent)
    {action : Raw.Action} {target : Raw.Proc} :
    ¬ Late.NativeStep (compiledRawTerminal event) action target := by
  cases event with
  | dynamicPartnerAdmission =>
      exact terminal_no_native .dynamicPartnerAdmission
  | freeOutput | boundOutput | lateInput | communication | openClose |
      restriction | scopeExtrusion | delegation | choiceLeft | choiceRight |
      matchSuccess | mismatchGuard | instanceReconnect |
      instanceDeleteQuiescent =>
      simpa [compiledRawTerminal, compiledTerminal,
          FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld,
          FMSOperationalSyntaxBridge.SupportedProc.reify] using
        (raw_zero_no_native (action := action) (target := target))

/--
The compiled first target has exactly the same payload/no-payload shape as
the canonical first target.
-/
theorem compiled_target_classification
    (event : SourceEvent) :
    RawFirstTargetClassification event
      (compiledRawFirstTarget event)
      (compiledRawTerminal event) := by
  cases event with
  | openClose | restriction =>
      constructor
      · exact Late.NativeStep.prefixTau
      · intro action next step
        exact raw_tau_native_exact step
  | dynamicPartnerAdmission =>
      exact
        ⟨admission_established_native,
          fun step => admission_established_native_exact step⟩
  | freeOutput | boundOutput | lateInput | communication |
      scopeExtrusion | delegation | choiceLeft | choiceRight |
      matchSuccess | mismatchGuard |
      instanceReconnect | instanceDeleteQuiescent =>
      intro action next step
      exact raw_zero_no_native step

/-! ## Label and derivative alpha -/

/-- Fresh compiled labels and fixed canonical labels have the same action. -/
theorem compiled_action_alpha (event : SourceEvent) :
    ActionAlpha
      (compiledFirstAction event)
      (firstAction event) := by
  cases event with
  | boundOutput =>
      exact ActionAlpha.boundOutput (by decide) (by decide)
  | lateInput =>
      exact ActionAlpha.input _ _ _
  | scopeExtrusion =>
      exact ActionAlpha.boundOutput (by decide) (by decide)
  | dynamicPartnerAdmission =>
      exact ActionAlpha.input _ _ _
  | freeOutput | communication | openClose | restriction |
      delegation | choiceLeft | choiceRight | matchSuccess |
      mismatchGuard | instanceReconnect | instanceDeleteQuiescent =>
      exact ActionAlpha.refl _

/--
For every binder-bearing event, action and derivative are alpha-converted
together.  Other events do not need this stronger relation because their
canonical terminal representatives may differ structurally while having the
same pointed behavior.
-/
def BinderDerivativeAlpha (event : SourceEvent) : Prop :=
  match event with
  | .boundOutput
  | .lateInput
  | .scopeExtrusion
  | .dynamicPartnerAdmission =>
      DerivativeAlpha
        ⟨compiledFirstAction event, compiledRawFirstTarget event⟩
        ⟨firstAction event, firstTarget event⟩
  | _ => True

/-- A fresh spelling for the reconnect receiver nested under admission. -/
def admissionPhaseBinder : Name := normativeBaseWorld + 3

/--
The canonical reconnect-ready target with only its internal receive binder
freshened.  The binder of the *outer* admission label is therefore free to
be renamed jointly with the derivative.
-/
def admissionAlphaTarget : Raw.Proc :=
  .new delegationBus
    (.new delegated
      (.par
        (.send delegationBus delegated .zero)
        (.recv delegationBus admissionPhaseBinder
          (.send admissionPhaseBinder payload .zero))))

/-- Freshening the nested receiver is ordinary process alpha-equivalence. -/
theorem admission_target_alpha_fresh :
    Late.Alpha
      (firstTarget .dynamicPartnerAdmission)
      admissionAlphaTarget := by
  have receiver :
      Late.Alpha
        (.recv delegationBus delegatedBinder
          (.send delegatedBinder payload .zero))
        (.recv delegationBus admissionPhaseBinder
          (.send admissionPhaseBinder payload .zero)) := by
    simpa [admissionPhaseBinder, normativeBaseWorld, payload,
      delegatedBinder, Raw.Proc.renameBound, Raw.Proc.substRaw] using
      (Late.Alpha.recvBinder
        (ch := delegationBus)
        (binder := delegatedBinder)
        (body := (.send delegatedBinder payload .zero : Raw.Proc))
        (replacement := admissionPhaseBinder)
        (by decide))
  simpa [firstTarget, closedReconnectSource, closedDelegationOffering,
    Proc.erase, admissionAlphaTarget, delegationChannel,
    delegatedChannel, boundDelegatedChannel, delegationSender,
    delegationReceiver, delegationReceiverContinuation] using
    (Late.Alpha.new
      (Late.Alpha.new
        (Late.Alpha.par
          (Late.Alpha.refl
            (.send delegationBus delegated .zero))
          receiver)))

theorem compiled_binder_derivative_alpha
    (event : SourceEvent) :
    BinderDerivativeAlpha event := by
  cases event with
  | boundOutput =>
      change
        DerivativeAlpha
          ⟨.boundOutput delegationBus compiledFresh, .zero⟩
          ⟨.boundOutput delegationBus delegated, .zero⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw] using
        (DerivativeAlpha.boundOutputBinder
          (channel := delegationBus)
          (binder := compiledFresh)
          (replacement := delegated)
          (target := Raw.Proc.zero)
          (by decide) (by decide) (by decide))
  | lateInput =>
      change
        DerivativeAlpha
          ⟨.input session compiledFresh, .zero⟩
          ⟨.input session payloadBinder, .zero⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw] using
        (DerivativeAlpha.inputBinder
          (channel := session)
          (binder := compiledFresh)
          (replacement := payloadBinder)
          (target := Raw.Proc.zero)
          (by decide) (by decide))
  | scopeExtrusion =>
      change
        DerivativeAlpha
          ⟨.boundOutput publicName compiledFresh, .zero⟩
          ⟨.boundOutput publicName session, .zero⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw] using
        (DerivativeAlpha.boundOutputBinder
          (channel := publicName)
          (binder := compiledFresh)
          (replacement := session)
          (target := Raw.Proc.zero)
          (by decide) (by decide) (by decide))
  | dynamicPartnerAdmission =>
      have first :
          DerivativeAlpha
            ⟨.input delegationBus compiledFresh,
              firstTarget .dynamicPartnerAdmission⟩
            ⟨.input delegationBus compiledFresh,
              admissionAlphaTarget⟩ :=
        DerivativeAlpha.targetAlpha admission_target_alpha_fresh
      have binder :
          DerivativeAlpha
            ⟨.input delegationBus compiledFresh,
              admissionAlphaTarget⟩
            ⟨.input delegationBus delegatedBinder,
              admissionAlphaTarget⟩ := by
        simpa [admissionAlphaTarget, admissionPhaseBinder,
          compiledFresh, normativeBaseWorld, delegationBus, delegated,
          delegatedBinder, payload, Raw.Proc.renameBound,
          Raw.Proc.substRaw] using
          (DerivativeAlpha.inputBinder
            (channel := delegationBus)
            (binder := compiledFresh)
            (replacement := delegatedBinder)
            (target := admissionAlphaTarget)
            (by decide) (by decide))
      have last :
          DerivativeAlpha
            ⟨.input delegationBus delegatedBinder,
              admissionAlphaTarget⟩
            ⟨.input delegationBus delegatedBinder,
              firstTarget .dynamicPartnerAdmission⟩ :=
        DerivativeAlpha.targetAlpha admission_target_alpha_fresh.symm
      exact first.trans (binder.trans last)
  | freeOutput | communication | openClose | restriction |
      delegation | choiceLeft | choiceRight | matchSuccess |
      mismatchGuard | instanceReconnect | instanceDeleteQuiescent =>
      trivial

/-! ## Pointed strong-LTS correspondence -/

/--
Kernel data for the two pointed native LTSs.  Exactness on both source nodes
and exhaustive classification of both target nodes make this stronger than
mere existence of matching traces.
-/
structure PointedStrongCorrespondence (event : SourceEvent) where
  compiledFirst :
    Late.NativeStep
      (compiledRawSource event)
      (compiledFirstAction event)
      (compiledRawFirstTarget event)
  canonicalFirst :
    Late.NativeStep
      (readyProcess event)
      (firstAction event)
      (firstTarget event)
  compiledFirstExact :
    ∀ {action next},
      Late.NativeStep (compiledRawSource event) action next →
        action = compiledFirstAction event ∧
          next = compiledRawFirstTarget event
  canonicalFirstExact :
    ∀ {action next},
      Late.NativeStep (readyProcess event) action next →
        action = firstAction event ∧ next = firstTarget event
  firstActionAlpha :
    ActionAlpha
      (compiledFirstAction event)
      (firstAction event)
  binderDerivativeAlpha : BinderDerivativeAlpha event
  compiledTarget :
    RawFirstTargetClassification event
      (compiledRawFirstTarget event)
      (compiledRawTerminal event)
  canonicalTarget :
    RawFirstTargetClassification event
      (firstTarget event)
      (terminalProcess event)
  compiledTerminal :
    ∀ {action next},
      ¬ Late.NativeStep (compiledRawTerminal event) action next
  canonicalTerminal :
    ∀ {action next},
      ¬ Late.NativeStep (terminalProcess event) action next

/-- All fifteen event families receive the exact pointed correspondence. -/
theorem compiledCanonicalPointed
    (event : SourceEvent) :
    PointedStrongCorrespondence event where
  compiledFirst := compiled_first_native event
  canonicalFirst := first_native event
  compiledFirstExact := compiled_first_native_exact event
  canonicalFirstExact := ready_native_exact event
  firstActionAlpha := compiled_action_alpha event
  binderDerivativeAlpha := compiled_binder_derivative_alpha event
  compiledTarget := compiled_target_classification event
  canonicalTarget := rawFirstTarget_classification event
  compiledTerminal := compiled_terminal_no_native event
  canonicalTerminal := terminal_no_native event

/--
Every compiled first step has a canonical strong mate, uniquely at the
canonical source, and the two labels are action-alpha related.
-/
theorem compiled_first_step_maps_to_canonical
    (event : SourceEvent)
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep (compiledRawSource event) action next) :
    ∃ canonicalNext,
      Late.NativeStep
        (readyProcess event) (firstAction event) canonicalNext ∧
      ActionAlpha action (firstAction event) ∧
      next = compiledRawFirstTarget event ∧
      canonicalNext = firstTarget event := by
  rcases compiled_first_native_exact event step with
    ⟨rfl, rfl⟩
  exact
    ⟨firstTarget event, first_native event,
      compiled_action_alpha event, rfl, rfl⟩

/--
Every canonical first step has a compiled strong mate, uniquely at the
compiled source, and the two labels are action-alpha related.
-/
theorem canonical_first_step_maps_to_compiled
    (event : SourceEvent)
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep (readyProcess event) action next) :
    ∃ compiledNext,
      Late.NativeStep
        (compiledRawSource event)
        (compiledFirstAction event) compiledNext ∧
      ActionAlpha (compiledFirstAction event) action ∧
      compiledNext = compiledRawFirstTarget event ∧
      next = firstTarget event := by
  rcases ready_native_exact event step with ⟨rfl, rfl⟩
  exact
    ⟨compiledRawFirstTarget event, compiled_first_native event,
      compiled_action_alpha event, rfl, rfl⟩

/--
Explicit successors match in both directions.  For terminal first targets
both premises are impossible; for `openClose`, `restriction`, and phased
admission the unique mate is the terminal tau step.
-/
theorem compiled_target_step_maps_to_canonical
    (event : SourceEvent)
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep
        (compiledRawFirstTarget event) action next) :
    ∃ canonicalNext,
      Late.NativeStep (firstTarget event) action canonicalNext ∧
      next = compiledRawTerminal event ∧
      canonicalNext = terminalProcess event := by
  cases event with
  | openClose =>
      rcases raw_tau_native_exact step with ⟨rfl, rfl⟩
      exact ⟨_, established_native, rfl, rfl⟩
  | restriction =>
      rcases raw_tau_native_exact step with ⟨rfl, rfl⟩
      have canonical :
          Late.NativeStep
            (firstTarget .restriction) .tau
            (terminalProcess .restriction) :=
        (rawFirstTarget_classification .restriction).1
      exact ⟨_, canonical, rfl, rfl⟩
  | dynamicPartnerAdmission =>
      rcases admission_established_native_exact step with ⟨rfl, rfl⟩
      exact ⟨_, admission_established_native, rfl, rfl⟩
  | freeOutput | boundOutput | lateInput | communication |
      scopeExtrusion | delegation | choiceLeft | choiceRight |
      matchSuccess | mismatchGuard |
      instanceReconnect | instanceDeleteQuiescent =>
      exact False.elim
        (raw_zero_no_native step)

theorem canonical_target_step_maps_to_compiled
    (event : SourceEvent)
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep (firstTarget event) action next) :
    ∃ compiledNext,
      Late.NativeStep
        (compiledRawFirstTarget event) action compiledNext ∧
      compiledNext = compiledRawTerminal event ∧
      next = terminalProcess event := by
  cases event with
  | openClose =>
      rcases established_native_exact step with ⟨rfl, rfl⟩
      exact ⟨_, Late.NativeStep.prefixTau, rfl, rfl⟩
  | restriction =>
      rcases
          (rawFirstTarget_classification .restriction).2 step with
        ⟨rfl, rfl⟩
      exact ⟨_, Late.NativeStep.prefixTau, rfl, rfl⟩
  | dynamicPartnerAdmission =>
      rcases admission_established_native_exact step with ⟨rfl, rfl⟩
      exact ⟨_, admission_established_native, rfl, rfl⟩
  | freeOutput =>
      exact False.elim (terminal_no_native .freeOutput step)
  | boundOutput =>
      exact False.elim (terminal_no_native .boundOutput step)
  | lateInput =>
      exact False.elim (terminal_no_native .lateInput step)
  | communication =>
      exact False.elim (terminal_no_native .communication step)
  | scopeExtrusion =>
      exact False.elim (terminal_no_native .scopeExtrusion step)
  | delegation =>
      exact False.elim (terminal_no_native .delegation step)
  | choiceLeft =>
      exact False.elim (terminal_no_native .choiceLeft step)
  | choiceRight =>
      exact False.elim (terminal_no_native .choiceRight step)
  | matchSuccess =>
      exact False.elim (terminal_no_native .matchSuccess step)
  | mismatchGuard =>
      exact False.elim (terminal_no_native .mismatchGuard step)
  | instanceReconnect =>
      exact False.elim (terminal_no_native .instanceReconnect step)
  | instanceDeleteQuiescent =>
      exact False.elim
        (terminal_no_native .instanceDeleteQuiescent step)

/-! ## Actual Agent fold generated from the compiled syntax -/

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoContext
open Cantilune.Pi.FMSBinderInstantiation
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoAgentOperationalBridge
open Cantilune.Pi.FMSCpoOmegaScottPower

/--
The operational layer needed by the normative fragment.

Restriction is interpreted by the genuine Table-4 layer; every other
constructor in `compiledSource`, `compiledFirstTarget`, and
`compiledTerminal` is covered by the supported finite-control head layer.
The definition inspects syntax, not the event index.
-/
def normativeFragmentLayer
    (world : World)
    (process : SupportedProc world 0) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  match process with
  | .restrict body => supportedRestrictionLayer world body
  | other => supportedHeadLayer world other

/-- Fold the syntax-generated one-step computation into the actual Agent. -/
def normativeFragmentAgent
    (world : World)
    (process : SupportedProc world 0) :
    Agent.obj world :=
  agentFold.app world
    (mapSupportedLayerToAgent world
      (normativeFragmentLayer world process))

@[simp]
theorem normativeFragmentAgent_unfold
    (world : World)
    (process : SupportedProc world 0) :
    agentUnfold.app world
        (normativeFragmentAgent world process) =
      mapSupportedLayerToAgent world
        (normativeFragmentLayer world process) := by
  exact
    concreteActualAlgebraicCompactnessWitness.fixed.fold_unfold
      world
      (mapSupportedLayerToAgent world
        (normativeFragmentLayer world process))

/-- Exact syntax action selected before mapping continuations to `Agent`. -/
def compiledSyntaxAction :
    (event : SourceEvent) →
      ActionRepresentation processCpoModel normativeBaseWorld
  | .freeOutput =>
      syntaxFreeOutputAction normativeBaseWorld
        (1 : Fin normativeBaseWorld)
        (3 : Fin normativeBaseWorld)
        .zero
  | .boundOutput =>
      syntaxBoundOutputAction normativeBaseWorld
        (5 : Fin normativeBaseWorld)
        (FMSBinderInstantiation.SupportedProc.freshenOuter
          (.zero : SupportedProc normativeBaseWorld 1))
  | .lateInput =>
      syntaxInputAction normativeBaseWorld
        (1 : Fin normativeBaseWorld) .zero
  | .communication =>
      syntaxTauAction normativeBaseWorld .zero
  | .openClose =>
      syntaxTauAction normativeBaseWorld (.tau .zero)
  | .restriction =>
      syntaxTauAction normativeBaseWorld (.tau .zero)
  | .scopeExtrusion =>
      syntaxBoundOutputAction normativeBaseWorld
        (0 : Fin normativeBaseWorld)
        (FMSBinderInstantiation.SupportedProc.freshenOuter
          (.zero : SupportedProc normativeBaseWorld 1))
  | .delegation =>
      syntaxTauAction normativeBaseWorld .zero
  | .choiceLeft
  | .choiceRight
  | .matchSuccess
  | .mismatchGuard =>
      syntaxTauAction normativeBaseWorld .zero
  | .dynamicPartnerAdmission =>
      syntaxInputAction normativeBaseWorld
        (5 : Fin normativeBaseWorld) (.tau .zero)
  | .instanceReconnect
  | .instanceDeleteQuiescent =>
      syntaxTauAction normativeBaseWorld .zero

/-- The actual Agent action obtained by mapping the syntax continuation. -/
def compiledActualAction (event : SourceEvent) :
    ActionRepresentation Agent normativeBaseWorld :=
  actionModelMapComponent supportedDenote normativeBaseWorld
    (compiledSyntaxAction event)

def compiledSourceAgent (event : SourceEvent) :
    Agent.obj normativeBaseWorld :=
  normativeFragmentAgent normativeBaseWorld
    (compiledSource event)

def compiledTargetAgent (event : SourceEvent) :
    Agent.obj normativeBaseWorld :=
  normativeFragmentAgent normativeBaseWorld
    (compiledFirstTarget event)

def compiledTerminalAgent (event : SourceEvent) :
    Agent.obj normativeBaseWorld :=
  normativeFragmentAgent normativeBaseWorld
    (compiledTerminal event)

/-- The source syntax layer is exactly one principal compiled action. -/
theorem compiled_source_layer
    (event : SourceEvent) :
    normativeFragmentLayer normativeBaseWorld
        (compiledSource event) =
      principalRaw (compiledSyntaxAction event) := by
  cases event with
  | boundOutput =>
      exact canonical_restriction_extrusion_layer
        normativeBaseWorld (5 : Fin normativeBaseWorld)
        (.zero : SupportedProc normativeBaseWorld 1)
  | scopeExtrusion =>
      exact canonical_restriction_extrusion_layer
        normativeBaseWorld (0 : Fin normativeBaseWorld)
        (.zero : SupportedProc normativeBaseWorld 1)
  | freeOutput | lateInput | communication | openClose | restriction |
      delegation | choiceLeft | choiceRight | matchSuccess |
      mismatchGuard | dynamicPartnerAdmission | instanceReconnect |
      instanceDeleteQuiescent =>
      simp [normativeFragmentLayer, compiledSource,
        compiledSyntaxAction, supportedHeadLayer,
        closedName]

/--
The actual Agent source unfolds from the compiled syntax itself.  No
event-indexed semantic action field occurs in this equation.
-/
@[simp]
theorem compiledSourceAgent_unfold
    (event : SourceEvent) :
    agentUnfold.app normativeBaseWorld
        (compiledSourceAgent event) =
      principalRaw (compiledActualAction event) := by
  rw [compiledSourceAgent, normativeFragmentAgent_unfold,
    compiled_source_layer]
  exact mapRaw_principal
    (actionModelMapComponent supportedDenote normativeBaseWorld)
    (compiledSyntaxAction event)

/-- The syntax-generated target layer has exactly the designated shape. -/
theorem compiled_target_layer
    (event : SourceEvent) :
    normativeFragmentLayer normativeBaseWorld
        (compiledFirstTarget event) =
      if event = .openClose ∨ event = .restriction ∨
          event = .dynamicPartnerAdmission then
        principalRaw
          (syntaxTauAction normativeBaseWorld
            (compiledTerminal event))
      else
        (⊥ :
          OmegaScottPower
            (ActionRepresentation processCpoModel
              normativeBaseWorld)) := by
  cases event <;>
    simp [normativeFragmentLayer, compiledFirstTarget,
      compiledTerminal, supportedHeadLayer]

@[simp]
theorem compiledTargetAgent_unfold
    (event : SourceEvent) :
    agentUnfold.app normativeBaseWorld
        (compiledTargetAgent event) =
      if event = .openClose ∨ event = .restriction ∨
          event = .dynamicPartnerAdmission then
        principalRaw
          (tauAction normativeBaseWorld
            (supportedDenote.app normativeBaseWorld
              (compiledTerminal event)))
      else
        (⊥ :
          OmegaScottPower
            (ActionRepresentation Agent normativeBaseWorld)) := by
  rw [compiledTargetAgent, normativeFragmentAgent_unfold,
    compiled_target_layer]
  split_ifs
  · unfold mapSupportedLayerToAgent
    rw [mapRaw_principal]
    rfl
  · unfold mapSupportedLayerToAgent
    exact mapRaw_bot _

@[simp]
theorem compiledTerminalAgent_unfold
    (event : SourceEvent) :
    agentUnfold.app normativeBaseWorld
        (compiledTerminalAgent event) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation Agent normativeBaseWorld)) := by
  rw [compiledTerminalAgent, normativeFragmentAgent_unfold]
  rw [show compiledTerminal event =
      (.zero : SupportedProc normativeBaseWorld 0) by rfl]
  rw [show
    normativeFragmentLayer normativeBaseWorld
        (.zero : SupportedProc normativeBaseWorld 0) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation processCpoModel
            normativeBaseWorld)) by
      simp [normativeFragmentLayer, supportedHeadLayer]]
  unfold mapSupportedLayerToAgent
  exact mapRaw_bot _

/--
The two payload targets remain distinct from their terminal endpoint in the
actual recursive Agent.  Thus the second tau is not erased by denotation.
-/
theorem compiled_payload_target_ne_terminal
    (event : SourceEvent)
    (payloadEvent :
      event = .openClose ∨ event = .restriction ∨
        event = .dynamicPartnerAdmission) :
    compiledTargetAgent event ≠ compiledTerminalAgent event := by
  intro collapsed
  have unfolded :=
    congrArg (agentUnfold.app normativeBaseWorld) collapsed
  rw [compiledTargetAgent_unfold,
    compiledTerminalAgent_unfold] at unfolded
  simp only [payloadEvent, if_pos] at unfolded
  exact
    principalAction_ne_effectBottom normativeBaseWorld
      (tauAction normativeBaseWorld
        (supportedDenote.app normativeBaseWorld
          (compiledTerminal event)))
      unfolded

/-- Actual-Agent commutation data generated by the compiled syntax. -/
structure CompiledActualAgentCommutation
    (event : SourceEvent) where
  pointed : PointedStrongCorrespondence event
  sourceUnfold :
    agentUnfold.app normativeBaseWorld
        (compiledSourceAgent event) =
      principalRaw (compiledActualAction event)
  targetUnfold :
    agentUnfold.app normativeBaseWorld
        (compiledTargetAgent event) =
      if event = .openClose ∨ event = .restriction ∨
          event = .dynamicPartnerAdmission then
        principalRaw
          (tauAction normativeBaseWorld
            (supportedDenote.app normativeBaseWorld
              (compiledTerminal event)))
      else
        (⊥ :
          OmegaScottPower
            (ActionRepresentation Agent normativeBaseWorld))
  terminalUnfold :
    agentUnfold.app normativeBaseWorld
        (compiledTerminalAgent event) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation Agent normativeBaseWorld))

theorem compiledActualAgentCommutation
    (event : SourceEvent) :
    CompiledActualAgentCommutation event where
  pointed := compiledCanonicalPointed event
  sourceUnfold := compiledSourceAgent_unfold event
  targetUnfold := compiledTargetAgent_unfold event
  terminalUnfold := compiledTerminalAgent_unfold event

/-! ## Equality with the total supported terminal denotation -/

/-- Total finite-control zero is the actual inactive Agent at every world. -/
@[simp]
theorem totalSupportedDenote_zero
    (world : World) :
    totalSupportedDenote.app world
        (SupportedProc.zero : SupportedProc world 0) =
      fixedInactive world := by
  apply agentUnfold_injective world
  rw [totalSupportedDenote_unroll_at, fixedInactive_unfold]
  rw [show
    totalSupportedLayer world
        (SupportedProc.zero : SupportedProc world 0) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation processCpoModel world)) by rfl]
  exact mapRaw_bot _

/-- Total finite-control tau is the actual Agent tau constructor. -/
@[simp]
theorem totalSupportedDenote_tau
    (world : World)
    (next : SupportedProc world 0) :
    totalSupportedDenote.app world (.tau next) =
      fixedTauAgent world
        (totalSupportedDenote.app world next) := by
  apply agentUnfold_injective world
  rw [totalSupportedDenote_tau_unfold, fixedTauAgent_unfold]
  rfl

/-- Total compiled terminal is exactly the canonical normative terminal. -/
theorem total_compiled_terminal_eq_normative
    (event : SourceEvent) :
    totalSupportedDenote.app normativeBaseWorld
        (compiledTerminal event) =
      normativeTerminalAgent event := by
  simp [compiledTerminal, normativeTerminalAgent,
    normativeTerminalTree, totalSupportedDenote_zero]

/-- Total compiled first target is exactly the canonical normative target. -/
theorem total_compiled_target_eq_normative
    (event : SourceEvent) :
    totalSupportedDenote.app normativeBaseWorld
        (compiledFirstTarget event) =
      normativeTargetAgent event := by
  cases event <;>
    simp [compiledFirstTarget, normativeTargetAgent,
      normativeTargetTree, normativeTerminalTree,
      totalSupportedDenote_zero, totalSupportedDenote_tau]

/-- Total one-step semantics of every compiled source is its exact action. -/
theorem total_compiled_source_layer
    (event : SourceEvent) :
    totalSupportedLayer normativeBaseWorld
        (compiledSource event) =
      principalRaw (compiledSyntaxAction event) := by
  cases event with
  | boundOutput =>
      simpa [compiledSource, compiledSyntaxAction] using
        totalSupportedLayer_restriction_extrusion
          normativeBaseWorld
          (5 : Fin normativeBaseWorld)
          (.zero : SupportedProc normativeBaseWorld 1)
  | scopeExtrusion =>
      simpa [compiledSource, compiledSyntaxAction] using
        totalSupportedLayer_restriction_extrusion
          normativeBaseWorld
          (0 : Fin normativeBaseWorld)
          (.zero : SupportedProc normativeBaseWorld 1)
  | freeOutput | lateInput | communication | openClose | restriction |
      delegation | choiceLeft | choiceRight | matchSuccess |
      mismatchGuard | dynamicPartnerAdmission | instanceReconnect |
      instanceDeleteQuiescent =>
      simp [compiledSource, compiledSyntaxAction,
        totalSupportedLayer, totalSupportedLayerFuel,
        processHeight, closedName]

/--
Mapping the compiled syntax action along the total terminal mediator yields
the independently declared normative actual action.
-/
theorem total_compiled_action_eq_normative
    (event : SourceEvent) :
    actionModelMapComponent totalSupportedDenote
        normativeBaseWorld (compiledSyntaxAction event) =
      normativeAgentAction event := by
  cases event <;>
    simp [compiledSyntaxAction, normativeAgentAction,
      endpointInputAction, syntaxTauAction,
      syntaxFreeOutputAction, syntaxInputAction,
      syntaxBoundOutputAction, actualInputAction,
      actualFreeOutputAction, actualBoundOutputAction,
      tauAction,
      actionModelMap_tau, actionModelMap_freeOutput,
      actionModelMap_input, actionModelMap_boundOutput,
      totalSupportedDenote_zero, normativeTargetAgent,
      normativeTargetTree, normativeTerminalTree,
      SupportedProc.instantiateOuter,
      SupportedProc.freshenOuter,
      SupportedProc.substituteBinderWith,
      SupportedProc.renameFree]

/--
The total terminal-coalgebra denotation of each typed compiled source is
exactly the independently defined normative source Agent.
-/
theorem total_compiled_source_eq_normative
    (event : SourceEvent) :
    totalSupportedDenote.app normativeBaseWorld
        (compiledSource event) =
      normativeSourceAgent event := by
  apply agentUnfold_injective normativeBaseWorld
  rw [totalSupportedDenote_unroll_at,
    normativeSourceAgent_unfold,
    total_compiled_source_layer,
    mapRaw_principal,
    total_compiled_action_eq_normative]

/--
All three actual-Agent endpoints and the strong operational correspondence
are carried by one package.
-/
structure TotalCompiledNormativeCommutation
    (event : SourceEvent) where
  pointed : PointedStrongCorrespondence event
  source :
    totalSupportedDenote.app normativeBaseWorld
        (compiledSource event) =
      normativeSourceAgent event
  target :
    totalSupportedDenote.app normativeBaseWorld
        (compiledFirstTarget event) =
      normativeTargetAgent event
  terminal :
    totalSupportedDenote.app normativeBaseWorld
        (compiledTerminal event) =
      normativeTerminalAgent event

theorem totalCompiledNormativeCommutation
    (event : SourceEvent) :
    TotalCompiledNormativeCommutation event where
  pointed := compiledCanonicalPointed event
  source := total_compiled_source_eq_normative event
  target := total_compiled_target_eq_normative event
  terminal := total_compiled_terminal_eq_normative event

/-- The finite registry is exhaustive rather than a filtered subset. -/
theorem compiled_normative_event_count :
    Fintype.card SourceEvent = 15 := by
  decide

def all_fifteen_total_compiled_commute :
    PSigma (fun _ :
      (∀ event : SourceEvent,
        TotalCompiledNormativeCommutation event) =>
      Fintype.card SourceEvent = 15) :=
  ⟨totalCompiledNormativeCommutation,
    compiled_normative_event_count⟩

def all_fifteen_compiled_pointed :
    PSigma (fun _ :
      (∀ event : SourceEvent,
        PointedStrongCorrespondence event) =>
      Fintype.card SourceEvent = 15) :=
  ⟨compiledCanonicalPointed, compiled_normative_event_count⟩

end Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
