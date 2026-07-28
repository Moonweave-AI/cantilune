import Cantilune.Pi.FMSCpoSupportedActualAgent
import Cantilune.Pi.OpenSMCPolarisedAdequacy

/-!
# All fifteen normative events in the actual FMS Agent

The earlier representative theorem placed every normative event in a Hoare
trace effect.  This module additionally maps every one of the fifteen
`SourceEvent` values into the *actual* recursive carrier

`Agent ≅ PωScott (H Agent)`.

Names used by the reference protocol are exactly `0 .. 7`, so world eight is
the faithful finite-name base.  Each event is mapped to an actual operational
tree.  Its source unfolds to one principal action whose continuation is the
event's designated target Agent.  The `openClose`, `restriction`, and
`dynamicPartnerAdmission` targets in turn unfold to a genuine tau successor;
every other target is native-normal.  The admission target is exactly the
canonical reconnect-ready Agent.  Input and bound-output continuations use the same target tree
in the successor world and commute with arbitrary world injections.

The original raw action is retained as enriched metadata; `LayerRepresents`
checks the channel/value portion that the FMS action functor can observe.  For
bound actions the nominal fresh binder remains in that metadata because the
FMS bound-output summand intentionally abstracts over its concrete name.

Every package contains:

* the genuine raw and guarded-recursive native step;
* raw source, first-target, and terminal endpoints;
* exact source derivatives and exact/no-native target classification;
* source, target, and terminal unfold equations in the recursive domain;
* equality of every principal continuation with its semantic target; and
* source/target/terminal and binder-extension world naturality.

No trace-membership proxy or proof-carrying semantic interface is used.
-/

noncomputable section

namespace Cantilune.Pi.FMSActualAgentNormativeCommutation

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.FMSCpoInputTransport
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoAgentOperationalBridge
open Cantilune.Pi.FMSCpoSupportedActualAgent
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cClosedNativeCertificate
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.OpenSMCPolarisedAdequacy

/-- The reference protocol uses precisely the nominal constants `0 .. 7`. -/
abbrev normativeBaseWorld : World := 8

/-- Every declared first action uses only names represented in world eight. -/
theorem firstAction_names_below_base (event : SourceEvent) :
    ∀ name ∈ (firstAction event).names,
      name < normativeBaseWorld := by
  cases event <;> decide

/-! ## The actual target and terminal endpoint trees -/

/-- Every completed normative endpoint is native-normal in the actual agent. -/
def normativeTerminalTree (world : World) : Agent.obj world :=
  fixedInactive world

/--
The actual denotation of the first raw target.

`openClose`, `restriction`, and `dynamicPartnerAdmission` retain their
genuine follow-up tau successor.  Every other first target is native-normal
by the exact P1c classification.
-/
def normativeTargetTree
    (event : SourceEvent) (world : World) : Agent.obj world :=
  match event with
  | .openClose
  | .restriction
  | .dynamicPartnerAdmission =>
      fixedTauAgent world (normativeTerminalTree world)
  | _ => normativeTerminalTree world

/-- The actual recursive terminal endpoint for an event. -/
def normativeTerminalAgent (_event : SourceEvent) :
    Agent.obj normativeBaseWorld :=
  normativeTerminalTree normativeBaseWorld

/-- The actual recursive target endpoint for an event. -/
def normativeTargetAgent (event : SourceEvent) :
    Agent.obj normativeBaseWorld :=
  normativeTargetTree event normativeBaseWorld

@[simp]
theorem normativeTerminalTree_world_natural
    {source target : World}
    (injection : source ⟶ target) :
    Agent.map injection (normativeTerminalTree source) =
      normativeTerminalTree target := by
  exact fixedInactive_world_natural injection

@[simp]
theorem normativeTargetTree_world_natural
    (event : SourceEvent)
    {source target : World}
    (injection : source ⟶ target) :
    Agent.map injection (normativeTargetTree event source) =
      normativeTargetTree event target := by
  cases event <;>
    simp [normativeTargetTree, normativeTerminalTree]

/--
The continuation in a binder world is the canonical allocation of the
same target endpoint, not a separately chosen inactive element.
-/
theorem normativeTargetTree_world_extension
    (event : SourceEvent) (world : World) :
    Agent.map (worldUp.app world) (normativeTargetTree event world) =
      normativeTargetTree event (world + 1) :=
  normativeTargetTree_world_natural event (worldUp.app world)

/--
Transporting the constant input continuation along any finite injection
still yields the corresponding target endpoint at the larger world.
-/
theorem inputTargetTree_transport
    (event : SourceEvent)
    {source target : World}
    (injection : source ⟶ target) :
    inputKnownTransport Agent injection
        (fun _ => normativeTargetTree event source)
        (normativeTargetTree event (source + 1)) =
      fun _ => normativeTargetTree event target := by
  funext received
  rw [inputKnownTransport]
  split
  · exact normativeTargetTree_world_natural event injection
  · exact
      normativeTargetTree_world_natural event
        (extendByName injection received ‹_›)

/-- The input abstraction used by the normative input representatives. -/
def endpointInputAction
    (event : SourceEvent)
    (channel : Fin normativeBaseWorld) :
    ActionRepresentation Agent normativeBaseWorld :=
  actualInputAction normativeBaseWorld channel
    (fun _ => normativeTargetAgent event)
    (normativeTargetTree event (normativeBaseWorld + 1))

/--
Actual action layer for every normative event.

The cases are intentionally exhaustive rather than filtered through a
partial operation registry.
-/
def normativeAgentAction :
    SourceEvent →
      ActionRepresentation Agent normativeBaseWorld
  | .freeOutput =>
      actualFreeOutputAction normativeBaseWorld
        (1 : Fin normativeBaseWorld)
        (3 : Fin normativeBaseWorld)
        (normativeTargetAgent .freeOutput)
  | .boundOutput =>
      actualBoundOutputAction normativeBaseWorld
        (5 : Fin normativeBaseWorld)
        (normativeTargetTree .boundOutput (normativeBaseWorld + 1))
  | .lateInput =>
      endpointInputAction .lateInput (1 : Fin normativeBaseWorld)
  | .communication =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .communication)
  | .openClose =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .openClose)
  | .restriction =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .restriction)
  | .scopeExtrusion =>
      actualBoundOutputAction normativeBaseWorld
        (0 : Fin normativeBaseWorld)
        (normativeTargetTree .scopeExtrusion (normativeBaseWorld + 1))
  | .delegation =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .delegation)
  | .choiceLeft =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .choiceLeft)
  | .choiceRight =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .choiceRight)
  | .matchSuccess =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .matchSuccess)
  | .mismatchGuard =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .mismatchGuard)
  | .dynamicPartnerAdmission =>
      endpointInputAction .dynamicPartnerAdmission
        (5 : Fin normativeBaseWorld)
  | .instanceReconnect =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .instanceReconnect)
  | .instanceDeleteQuiescent =>
      tauAction normativeBaseWorld
        (normativeTargetAgent .instanceDeleteQuiescent)

/--
What the FMS action layer preserves from a nominal late action.

Input and bound-output binder names are deliberately not fabricated inside
the action carrier: they are carried by the enriched raw label.
-/
def LayerRepresents
    (raw : Raw.Action)
    (layer : ActionRepresentation Agent normativeBaseWorld) : Prop :=
  match raw, actionEquiv Agent normativeBaseWorld layer with
  | .tau, .tau _ => True
  | .output channel value, .freeOutput semanticChannel semanticValue _ =>
      semanticChannel.val = channel ∧ semanticValue.val = value
  | .input channel _, .input semanticChannel _ _ =>
      semanticChannel.val = channel
  | .boundOutput channel _, .boundOutput semanticChannel _ =>
      semanticChannel.val = channel
  | _, _ => False

/--
Exact semantic endpoint carried by an FMS action.

The binder summands point to the same event target in the successor world;
they do not discard the endpoint in favour of an unrelated inactive agent.
-/
def LayerContinuesToEndpoint
    (event : SourceEvent)
    (world : World)
    (layer : ActionRepresentation Agent world) : Prop :=
  match actionEquiv Agent world layer with
  | .input _ known fresh =>
      (∀ received, known received = normativeTargetTree event world) ∧
        fresh = normativeTargetTree event (world + 1)
  | .freeOutput _ _ continuation =>
      continuation = normativeTargetTree event world
  | .boundOutput _ continuation =>
      continuation = normativeTargetTree event (world + 1)
  | .tau continuation =>
      continuation = normativeTargetTree event world

/-- The exact raw label plus the actual FMS action it enriches. -/
structure EnrichedNormativeAction (event : SourceEvent) where
  raw : Raw.Action
  layer : ActionRepresentation Agent normativeBaseWorld
  raw_eq : raw = firstAction event
  represents : LayerRepresents raw layer

/-- Every one of the fifteen cases is represented by its actual action layer. -/
theorem normativeAgentAction_represents (event : SourceEvent) :
    LayerRepresents (firstAction event) (normativeAgentAction event) := by
  cases event <;>
    simp [LayerRepresents, normativeAgentAction, endpointInputAction,
      actualInputAction, actualFreeOutputAction, actualBoundOutputAction,
      tauAction, actionEquiv, toAction, firstAction,
      publicName, session, payload, payloadBinder,
      delegationBus, delegated, delegatedBinder]

/--
The principal action in every source tree carries its designated semantic
target as its actual continuation.
-/
theorem normativeAgentAction_continues (event : SourceEvent) :
    LayerContinuesToEndpoint event normativeBaseWorld
      (normativeAgentAction event) := by
  cases event <;>
    simp [LayerContinuesToEndpoint, normativeAgentAction,
      endpointInputAction, actualInputAction, actualFreeOutputAction,
      actualBoundOutputAction, tauAction, actionEquiv, toAction,
      normativeTargetAgent]

/-- Total enriched action metadata for every normative family. -/
def enrichedNormativeAction
    (event : SourceEvent) : EnrichedNormativeAction event where
  raw := firstAction event
  layer := normativeAgentAction event
  raw_eq := rfl
  represents := normativeAgentAction_represents event

/-- The actual recursive source endpoint for an event. -/
def normativeSourceAgent (event : SourceEvent) :
    Agent.obj normativeBaseWorld :=
  fixedPrefixAgent normativeBaseWorld
    (normativeAgentAction event)

/-- The one-step actual layer of a designated target endpoint. -/
def normativeTargetLayer
    (event : SourceEvent) (world : World) :
    OmegaScottPower (ActionRepresentation Agent world) :=
  match event with
  | .openClose
  | .restriction
  | .dynamicPartnerAdmission =>
      principalRaw
        (tauAction world (normativeTerminalTree world))
  | _ => ⊥

@[simp]
theorem normativeSourceAgent_unfold (event : SourceEvent) :
    agentUnfold.app normativeBaseWorld
        (normativeSourceAgent event) =
      principalRaw (normativeAgentAction event) := by
  exact fixedPrefixAgent_unfold _ _

@[simp]
theorem normativeTargetAgent_unfold (event : SourceEvent) :
    agentUnfold.app normativeBaseWorld
        (normativeTargetAgent event) =
      normativeTargetLayer event normativeBaseWorld := by
  cases event <;>
    simp [normativeTargetAgent, normativeTargetTree,
      normativeTargetLayer, normativeTerminalTree,
      fixedBottomLayer, fixedTauLayer] <;> rfl

@[simp]
theorem normativeTerminalAgent_unfold (event : SourceEvent) :
    agentUnfold.app normativeBaseWorld
        (normativeTerminalAgent event) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation Agent normativeBaseWorld)) := by
  exact fixedInactive_unfold normativeBaseWorld

/--
The visible admission input lands literally at the canonical reconnect-ready
Agent.  This is the exact cross-epoch phase seam; it is not a weak or
observational equality.
-/
theorem dynamic_admission_target_eq_reconnect_source :
    normativeTargetAgent .dynamicPartnerAdmission =
      normativeSourceAgent .instanceReconnect := by
  apply agentUnfold_injective normativeBaseWorld
  rw [normativeTargetAgent_unfold, normativeSourceAgent_unfold]
  rfl

/--
A principal action computation is not the effect bottom.  This makes the
two payload targets below observably non-vacuous at the actual FMS layer:
their tau layer cannot collapse to the inactive endpoint.
-/
theorem principalAction_ne_effectBottom
    (world : World)
    (action : ActionRepresentation Agent world) :
    principalRaw action ≠
      (⊥ : OmegaScottPower (ActionRepresentation Agent world)) := by
  intro collapsed
  have member :
      WithOmegaScott.toOmegaScott action ∈
        carrier (principalRaw action) :=
    (mem_principalRaw_iff action action).2 le_rfl
  rw [collapsed] at member
  exact member

/--
The `openClose` and `restriction` first targets are genuine tau-prefixed
Agents, not merely another spelling of their inactive terminal.
-/
theorem normative_payload_target_ne_terminal
    (event : SourceEvent)
    (payload :
      event = .openClose ∨ event = .restriction) :
    normativeTargetAgent event ≠ normativeTerminalAgent event := by
  rcases payload with rfl | rfl <;>
    intro collapsed <;>
    have unfolded :=
      congrArg (agentUnfold.app normativeBaseWorld) collapsed <;>
    rw [normativeTargetAgent_unfold,
      normativeTerminalAgent_unfold] at unfolded <;>
    exact
      principalAction_ne_effectBottom normativeBaseWorld
        (tauAction normativeBaseWorld
          (normativeTerminalTree normativeBaseWorld))
        unfolded

/-! ## World naturality -/

/-- Folding a principal action commutes with every finite-world injection. -/
theorem fixedPrefixAgent_world_natural
    {source target : World}
    (injection : source ⟶ target)
    (action : ActionRepresentation Agent source) :
    Agent.map injection (fixedPrefixAgent source action) =
      fixedPrefixAgent target
        (actionWorldMap Agent injection action) := by
  have mapped :
      (ActualAgentFunctor.obj Agent).map injection
          (principalRaw action) =
        principalRaw (actionWorldMap Agent injection action) := by
    change
      mapRaw (actionWorldMap Agent injection)
          (principalRaw action) =
        principalRaw (actionWorldMap Agent injection action)
    exact mapRaw_principal
      (actionWorldMap Agent injection) action
  calc
    Agent.map injection (fixedPrefixAgent source action) =
        agentFold.app target
          ((ActualAgentFunctor.obj Agent).map injection
            (principalRaw action)) := by
      exact
        (ContinuousHom.congr_fun
          (agentFold.naturality injection)
          (principalRaw action)).symm
    _ =
        fixedPrefixAgent target
          (actionWorldMap Agent injection action) := by
      exact congrArg (agentFold.app target) mapped

/-- Reindexed action of a normative family. -/
def normativeActionAt
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    ActionRepresentation Agent target :=
  actionWorldMap Agent injection (normativeAgentAction event)

/--
After arbitrary world reindexing, every action continuation still lands at
the corresponding target tree, including input and bound-output extensions.
-/
theorem normativeActionAt_continues
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    LayerContinuesToEndpoint event target
      (normativeActionAt event injection) := by
  cases event <;>
    simp [LayerContinuesToEndpoint, normativeActionAt,
      normativeAgentAction, endpointInputAction,
      actualInputAction, actualFreeOutputAction,
      actualBoundOutputAction, tauAction, actionEquiv, toAction,
      actionWorldMap_input, actionWorldMap_freeOutput,
      actionWorldMap_boundOutput, actionWorldMap_tau,
      inputTargetTree_transport,
      normativeTargetTree_world_natural,
      normativeTargetAgent]

/-- Reindexed source endpoint, still folded from one actual action. -/
def normativeSourceAt
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    Agent.obj target :=
  fixedPrefixAgent target (normativeActionAt event injection)

/-- Reindexed target endpoint. -/
def normativeTargetAt
    (event : SourceEvent)
    {target : World}
    (_injection : normativeBaseWorld ⟶ target) :
    Agent.obj target :=
  normativeTargetTree event target

/-- Reindexed terminal endpoint. -/
def normativeTerminalAt
    (_event : SourceEvent)
    {target : World}
    (_injection : normativeBaseWorld ⟶ target) :
    Agent.obj target :=
  normativeTerminalTree target

theorem normativeSource_world_natural
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    Agent.map injection (normativeSourceAgent event) =
      normativeSourceAt event injection := by
  exact
    fixedPrefixAgent_world_natural injection
      (normativeAgentAction event)

theorem normativeTarget_world_natural
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    Agent.map injection (normativeTargetAgent event) =
      normativeTargetAt event injection := by
  exact normativeTargetTree_world_natural event injection

theorem normativeTerminal_world_natural
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    Agent.map injection (normativeTerminalAgent event) =
      normativeTerminalAt event injection := by
  exact normativeTerminalTree_world_natural injection

@[simp]
theorem normativeSourceAt_unfold
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    agentUnfold.app target
        (normativeSourceAt event injection) =
      principalRaw (normativeActionAt event injection) := by
  exact fixedPrefixAgent_unfold _ _

@[simp]
theorem normativeTargetAt_unfold
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    agentUnfold.app target
        (normativeTargetAt event injection) =
      normativeTargetLayer event target := by
  cases event <;>
    simp [normativeTargetAt, normativeTargetTree,
      normativeTargetLayer, normativeTerminalTree,
      fixedBottomLayer, fixedTauLayer] <;> rfl

@[simp]
theorem normativeTerminalAt_unfold
    (event : SourceEvent)
    {target : World}
    (injection : normativeBaseWorld ⟶ target) :
    agentUnfold.app target
        (normativeTerminalAt event injection) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation Agent target)) := by
  exact fixedInactive_unfold target

/-- Naturality is coherent under a second world injection. -/
theorem normativeSource_world_comp
    (event : SourceEvent)
    {middle target : World}
    (first : normativeBaseWorld ⟶ middle)
    (second : middle ⟶ target) :
    Agent.map second (normativeSourceAt event first) =
      normativeSourceAt event (first ≫ second) := by
  calc
    Agent.map second (normativeSourceAt event first) =
        Agent.map second
          (Agent.map first (normativeSourceAgent event)) := by
      exact congrArg (Agent.map second)
        (normativeSource_world_natural event first).symm
    _ =
        Agent.map (first ≫ second)
          (normativeSourceAgent event) := by
      exact
        (ContinuousHom.congr_fun
          (Agent.map_comp first second)
          (normativeSourceAgent event)).symm
    _ = normativeSourceAt event (first ≫ second) :=
      normativeSource_world_natural event (first ≫ second)

/-! ## Exact raw endpoint classification -/

/--
The native behavior of the designated first target.

`openClose`, `restriction`, and `dynamicPartnerAdmission` have a successor,
and in each case it is exactly the explicit tau follow-up leading to the
family terminal.
-/
def RawFirstTargetClassification
    (event : SourceEvent)
    (rawTarget rawTerminal : Raw.Proc) : Prop :=
  match event with
  | .openClose
  | .restriction
  | .dynamicPartnerAdmission =>
      Late.NativeStep rawTarget .tau rawTerminal ∧
        ∀ {action next},
          Late.NativeStep rawTarget action next →
            action = .tau ∧ next = rawTerminal
  | _ =>
      ∀ {action next},
        ¬ Late.NativeStep rawTarget action next

/-- Exact/no-native classification for every canonical first target. -/
theorem rawFirstTarget_classification (event : SourceEvent) :
    RawFirstTargetClassification event
      (firstTarget event) (terminalProcess event) := by
  cases event with
  | openClose =>
      exact ⟨established_native, fun step =>
        established_native_exact step⟩
  | restriction =>
      constructor
      · simpa [firstTarget, terminalProcess, closedOpenCloseTarget,
          closedHandshakeResult] using established_native
      · intro action next step
        have normalized :
            Late.NativeStep closedOpenCloseTarget.erase action next := by
          simpa [firstTarget, closedOpenCloseTarget,
            closedHandshakeResult] using step
        rcases established_native_exact normalized with
          ⟨actionEq, targetEq⟩
        exact ⟨actionEq, by
          simpa [terminalProcess] using targetEq⟩
  | dynamicPartnerAdmission =>
      exact
        ⟨admission_established_native,
          fun step => admission_established_native_exact step⟩
  | freeOutput =>
      exact terminal_no_native .freeOutput
  | boundOutput =>
      exact terminal_no_native .boundOutput
  | lateInput =>
      exact terminal_no_native .lateInput
  | communication =>
      exact terminal_no_native .communication
  | scopeExtrusion =>
      exact terminal_no_native .scopeExtrusion
  | delegation =>
      exact terminal_no_native .delegation
  | choiceLeft =>
      exact terminal_no_native .choiceLeft
  | choiceRight =>
      exact terminal_no_native .choiceRight
  | matchSuccess =>
      exact terminal_no_native .matchSuccess
  | mismatchGuard =>
      exact terminal_no_native .mismatchGuard
  | instanceReconnect =>
      exact terminal_no_native .instanceReconnect
  | instanceDeleteQuiescent =>
      exact terminal_no_native .instanceDeleteQuiescent

/-! ## One exhaustive commutation package for all fifteen events -/

structure ActualNormativeCommutation (event : SourceEvent) where
  /-- The actual raw source endpoint represented by the semantic source. -/
  sourceRaw : Raw.Proc
  /-- The actual raw first target represented by the action continuation. -/
  targetRaw : Raw.Proc
  /-- The actual raw terminal represented by the completed semantic tree. -/
  terminalRaw : Raw.Proc
  sourceRaw_eq : sourceRaw = readyProcess event
  targetRaw_eq : targetRaw = firstTarget event
  terminalRaw_eq : terminalRaw = terminalProcess event
  rawNative :
    Late.NativeStep
      sourceRaw
      (firstAction event)
      targetRaw
  rawDerivativeExact :
    ∀ {action next},
      Late.NativeStep sourceRaw action next →
        action = firstAction event ∧ next = targetRaw
  targetDerivativeClassification :
    RawFirstTargetClassification event targetRaw terminalRaw
  terminalNoNative :
    ∀ {action next},
      ¬ Late.NativeStep terminalRaw action next
  recursiveNative :
    RecursiveLate.NativeStep
      (normativeRepresentative event).source
      (normativeRepresentative event).action
      (normativeRepresentative event).target
  representativeAction :
    (normativeRepresentative event).action = firstAction event
  layerRepresents :
    LayerRepresents
      (normativeRepresentative event).action
      (normativeAgentAction event)
  sourceUnfold :
    agentUnfold.app normativeBaseWorld
        (normativeSourceAgent event) =
      principalRaw (normativeAgentAction event)
  sourceToTargetSemanticContinuation :
    LayerContinuesToEndpoint event normativeBaseWorld
      (normativeAgentAction event)
  targetUnfold :
    agentUnfold.app normativeBaseWorld
        (normativeTargetAgent event) =
      normativeTargetLayer event normativeBaseWorld
  terminalUnfold :
    agentUnfold.app normativeBaseWorld
        (normativeTerminalAgent event) =
      (⊥ :
        OmegaScottPower
          (ActionRepresentation Agent normativeBaseWorld))
  sourceWorldNatural :
    ∀ {target : World}
      (injection : normativeBaseWorld ⟶ target),
      Agent.map injection (normativeSourceAgent event) =
        normativeSourceAt event injection
  targetWorldNatural :
    ∀ {target : World}
      (injection : normativeBaseWorld ⟶ target),
      Agent.map injection (normativeTargetAgent event) =
        normativeTargetAt event injection
  terminalWorldNatural :
    ∀ {target : World}
      (injection : normativeBaseWorld ⟶ target),
      Agent.map injection (normativeTerminalAgent event) =
        normativeTerminalAt event injection
  mappedSourceUnfold :
    ∀ {target : World}
      (injection : normativeBaseWorld ⟶ target),
      agentUnfold.app target
          (normativeSourceAt event injection) =
        principalRaw (normativeActionAt event injection)
  mappedSourceToTargetSemanticContinuation :
    ∀ {target : World}
      (injection : normativeBaseWorld ⟶ target),
      LayerContinuesToEndpoint event target
        (normativeActionAt event injection)

/--
Finite exhaustive proof: no `SourceEvent` is filtered out and no event is
replaced by a weak or reflexive transition.
-/
def normativeActualCommutation
    (event : SourceEvent) :
    ActualNormativeCommutation event where
  sourceRaw := readyProcess event
  targetRaw := firstTarget event
  terminalRaw := terminalProcess event
  sourceRaw_eq := rfl
  targetRaw_eq := rfl
  terminalRaw_eq := rfl
  rawNative := first_native event
  rawDerivativeExact := ready_native_exact event
  targetDerivativeClassification := rawFirstTarget_classification event
  terminalNoNative := terminal_no_native event
  recursiveNative := (normativeRepresentative event).native
  representativeAction := rfl
  layerRepresents := by
    change
      LayerRepresents (firstAction event)
        (normativeAgentAction event)
    exact normativeAgentAction_represents event
  sourceUnfold := normativeSourceAgent_unfold event
  sourceToTargetSemanticContinuation :=
    normativeAgentAction_continues event
  targetUnfold := normativeTargetAgent_unfold event
  terminalUnfold := normativeTerminalAgent_unfold event
  sourceWorldNatural := normativeSource_world_natural event
  targetWorldNatural := normativeTarget_world_natural event
  terminalWorldNatural := normativeTerminal_world_natural event
  mappedSourceUnfold := normativeSourceAt_unfold event
  mappedSourceToTargetSemanticContinuation :=
    normativeActionAt_continues event

/-- Kernel reduction, rather than `native_decide`, establishes the count. -/
theorem normative_source_event_count :
    Fintype.card SourceEvent = 15 := by
  decide

/-- All and only the fifteen closed-core families receive the package. -/
def all_fifteen_actual_agent_commute :
    PSigma (fun _ :
      (∀ event : SourceEvent,
        ActualNormativeCommutation event) =>
      Fintype.card SourceEvent = 15) :=
  ⟨normativeActualCommutation, normative_source_event_count⟩

end Cantilune.Pi.FMSActualAgentNormativeCommutation
