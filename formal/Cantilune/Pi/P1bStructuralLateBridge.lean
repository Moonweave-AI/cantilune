import Cantilune.Pi.Certificates
import Cantilune.Pi.LateAlphaSupport
import Cantilune.Pi.P1cFullNativeRefinement
import Cantilune.Pi.P1bRequestingNormalForm

/-!
# Request/accept bridge to the standard structural late-pi LTS

The original finite request/accept certificate targets the typed native
kernel with an equality state setoid.  This module moves every positive and
terminal obligation to `Late.structuralLateLTS`, whose states are raw
processes modulo alpha/structural congruence.

Exhaustive reflection for arbitrary structurally congruent source
representatives is named separately as `StandardLateReflection`.  The
constructor `certificateOfReflection` proves that this is the only remaining
operational field: it does not hide the obligation in an observation filter,
weak transition, or caller-supplied success predicate.
-/

namespace Cantilune.Pi.P1bStructuralLateBridge

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols

/-- Canonical erasure of the three request/accept states. -/
def mapState
    (state : Cantilune.Pi.Certificates.RequestAccept.State) : Raw.Proc :=
  (Cantilune.Pi.Certificates.RequestAccept.mapState state).erase

/-- Both protocol events are genuine strong `tau` actions. -/
def mapEvent
    (event : Cantilune.Pi.Certificates.RequestAccept.Event) : Raw.Action :=
  (Cantilune.Pi.Certificates.RequestAccept.mapEvent event).erase

/--
Every request/accept source step is one native standard-late step and hence
one structural-late step.  No reflexive/transitive closure is used.
-/
theorem standard_late_sound
    {source : Cantilune.Pi.Certificates.RequestAccept.State}
    {event : Cantilune.Pi.Certificates.RequestAccept.Event}
    {target : Cantilune.Pi.Certificates.RequestAccept.State}
    (step :
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.ObservableStep
        source event target) :
    Late.structuralLateLTS.ObservableStep
      (mapState source) (mapEvent event) (mapState target) := by
  rcases step with ⟨native, observed⟩
  refine ⟨?_, trivial⟩
  cases native with
  | establishSession =>
      exact Late.Step.native (by
        simpa [mapState, mapEvent,
          Cantilune.Pi.Certificates.RequestAccept.mapState,
          Cantilune.Pi.Certificates.RequestAccept.mapEvent,
          Cantilune.Pi.Action.erase,
          Cantilune.Pi.P1cFullNativeRefinement.readyProcess,
          Cantilune.Pi.P1cFullNativeRefinement.firstAction,
          Cantilune.Pi.P1cFullNativeRefinement.firstTarget] using
          Cantilune.Pi.P1cFullNativeRefinement.first_native
            Cantilune.Pi.P1cMatrix.SourceEvent.restriction)
  | transmitPayload =>
      exact Late.Step.native (by
        simpa [mapState, mapEvent,
          Cantilune.Pi.Certificates.RequestAccept.mapState,
          Cantilune.Pi.Certificates.RequestAccept.mapEvent,
          Cantilune.Pi.Certificates.RequestAccept.closedProcess,
          Cantilune.Pi.Action.erase,
          Cantilune.Pi.P1cClosedNativeCertificate.closedOpenCloseTarget,
          closedHandshakeResult] using
          Cantilune.Pi.P1cFullNativeRefinement.established_native)

/-- The standard structural target recognizes exactly the source success state. -/
theorem standard_late_success_iff
    (state : Cantilune.Pi.Certificates.RequestAccept.State) :
    Late.structuralLateLTS.success (mapState state) ↔
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.success state := by
  change
    Late.StructurallyZero (mapState state) ↔
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.success state
  rw [Late.Struct.structurallyZero_iff_prefixCount_zero]
  cases state with
  | requesting =>
      change
        (mapState
            Cantilune.Pi.Certificates.RequestAccept.State.requesting).prefixCount =
            0 ↔ False
      norm_num [mapState,
        Cantilune.Pi.Certificates.RequestAccept.mapState,
        Raw.Proc.prefixCount, Proc.erase, closedRestrictedHandshake,
        restrictedHandshake, request, accept, requestContinuation,
        acceptContinuation]
  | established =>
      change
        (mapState
            Cantilune.Pi.Certificates.RequestAccept.State.established).prefixCount =
            0 ↔ False
      norm_num [mapState,
        Cantilune.Pi.Certificates.RequestAccept.mapState,
        Raw.Proc.prefixCount, Proc.erase, closedHandshakeResult,
        handshakeResult, requestContinuation]
  | complete =>
      change
        (mapState
            Cantilune.Pi.Certificates.RequestAccept.State.complete).prefixCount =
            0 ↔ True
      norm_num [mapState,
        Cantilune.Pi.Certificates.RequestAccept.mapState,
        Cantilune.Pi.Certificates.RequestAccept.closedProcess,
        Raw.Proc.prefixCount, Proc.erase, closedCompletedProcess]

/-- Neither side classifies a labelled input state as an external wait here. -/
theorem standard_late_waiting_iff
    (state : Cantilune.Pi.Certificates.RequestAccept.State) :
    Late.structuralLateLTS.waiting (mapState state) ↔
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.waiting state := by
  rfl

/-- The finite request/accept fragment does not cross a signature epoch. -/
theorem standard_late_signature_version
    (state : Cantilune.Pi.Certificates.RequestAccept.State) :
    Late.structuralLateLTS.signatureVersion (mapState state) =
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.signatureVersion state := by
  rfl

/--
The remaining exact P1b obligation.  It quantifies over every structural-late
transition from a mapped state and requires both source-event recovery and a
structurally equivalent canonical endpoint.
-/
def StandardLateReflection : Prop :=
  ∀ {source : Cantilune.Pi.Certificates.RequestAccept.State}
      {action : Raw.Action} {target : Raw.Proc},
    Late.structuralLateLTS.ObservableStep (mapState source) action target →
      ∃ event sourceTarget,
        Cantilune.Pi.Certificates.RequestAccept.sourceLTS.ObservableStep
          source event sourceTarget ∧
        mapEvent event = action ∧
        Late.Struct target (mapState sourceTarget)

/--
The completed request/accept representative has no strong-late transition,
even after changing the native source representative by alpha/structural
congruence.  Prefix count is structural-invariant and every native source
contains a prefix, so `newZero`/`parZero` cannot manufacture a transition.
-/
theorem complete_no_structural_step
    {action : Raw.Action} {target : Raw.Proc} :
    ¬ Late.Step
        (mapState Cantilune.Pi.Certificates.RequestAccept.State.complete)
        action target :=
  Late.Step.not_of_prefixCount_zero (by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Cantilune.Pi.Certificates.RequestAccept.closedProcess,
      Raw.Proc.prefixCount, Proc.erase, closedCompletedProcess])

/--
Every structural-late step from the requesting representative is silent and
leaves at most the two payload prefixes.  The remaining P1b gap is not this
quantitative inversion, but proving that the two-prefix endpoint is in the
specific established structural class.
-/
theorem requesting_action_tau_and_target_prefixCount_le_two
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.Step
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.requesting)
        action target) :
    action = .tau ∧ target.prefixCount ≤ 2 := by
  have noFreeSubjects :
      Raw.Proc.freeSubjects
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.requesting) = ∅ := by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Raw.Proc.freeSubjects, Proc.erase, closedRestrictedHandshake,
      restrictedHandshake, request, accept, requestContinuation,
      acceptContinuation, publicChannel, sessionChannel,
      boundSessionChannel, publicName, session, sessionBinder]
  have silent :=
    step.action_eq_tau_of_source_freeSubjects_empty noFreeSubjects
  subst action
  have fourPrefixes :
      Raw.Proc.prefixCount
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.requesting) = 4 := by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Raw.Proc.prefixCount, Proc.erase, closedRestrictedHandshake,
      restrictedHandshake, request, accept, requestContinuation,
      acceptContinuation]
  have allCommunication :
      Raw.Proc.prefixCount
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.requesting) =
      Raw.Proc.communicationPrefixCount
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.requesting) := by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Raw.Proc.prefixCount, Raw.Proc.communicationPrefixCount,
      Proc.erase, closedRestrictedHandshake, restrictedHandshake,
      request, accept, requestContinuation, acceptContinuation]
  have decrease :=
    step.target_prefixCount_add_two_le_of_tau_all_communication
      allCommunication
  exact ⟨rfl, by omega⟩

/--
Every standard structural-late transition from the established
request/accept representative is the payload communication, and its endpoint
is structurally the canonical complete state.

The payload value remains free, so this uses the finer free-subject interface
to exclude visible actions.  The communication/unary prefix partition then
forces a silent transition to consume both remaining executable prefixes.
-/
theorem established_structural_residual
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.Step
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.established)
        action target) :
    action = .tau ∧
      Late.Struct target
        (mapState Cantilune.Pi.Certificates.RequestAccept.State.complete) := by
  have noFreeSubjects :
      Raw.Proc.freeSubjects
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.established) = ∅ := by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Raw.Proc.freeSubjects, Proc.erase, closedHandshakeResult,
      handshakeResult, requestContinuation, sessionChannel,
      publicName, session]
  have silent :=
    step.action_eq_tau_of_source_freeSubjects_empty noFreeSubjects
  subst action
  have twoPrefixes :
      Raw.Proc.prefixCount
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.established) = 2 := by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Raw.Proc.prefixCount, Proc.erase, closedHandshakeResult,
      handshakeResult, requestContinuation]
  have allCommunication :
      Raw.Proc.prefixCount
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.established) =
      Raw.Proc.communicationPrefixCount
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.established) := by
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Raw.Proc.prefixCount, Raw.Proc.communicationPrefixCount,
      Proc.erase, closedHandshakeResult, handshakeResult,
      requestContinuation]
  have targetPrefixFree :=
    step.target_prefixCount_zero_of_two_communication_tau
      twoPrefixes allCommunication
  have targetZero : Late.Struct target .zero :=
    (Late.Struct.structurallyZero_iff_prefixCount_zero target).mpr
      targetPrefixFree
  have canonicalZero :
      Late.Struct
        (mapState Cantilune.Pi.Certificates.RequestAccept.State.complete)
        .zero := by
    apply
      (Late.Struct.structurallyZero_iff_prefixCount_zero
        (mapState Cantilune.Pi.Certificates.RequestAccept.State.complete)).mpr
    norm_num [mapState,
      Cantilune.Pi.Certificates.RequestAccept.mapState,
      Cantilune.Pi.Certificates.RequestAccept.closedProcess,
      Raw.Proc.prefixCount, Proc.erase, closedCompletedProcess]
  exact ⟨rfl, Late.Struct.trans targetZero (Late.Struct.symm canonicalZero)⟩

/-- The complete reflection payload for the established source state. -/
theorem established_reflect
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.structuralLateLTS.ObservableStep
        (mapState
          Cantilune.Pi.Certificates.RequestAccept.State.established)
        action target) :
    ∃ event sourceTarget,
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.ObservableStep
        Cantilune.Pi.Certificates.RequestAccept.State.established
        event sourceTarget ∧
      mapEvent event = action ∧
      Late.Struct target (mapState sourceTarget) := by
  rcases established_structural_residual step.1 with
    ⟨actionEq, endpoint⟩
  refine
    ⟨Cantilune.Pi.Certificates.RequestAccept.Event.transmitPayload,
      Cantilune.Pi.Certificates.RequestAccept.State.complete,
      ⟨Cantilune.Pi.Certificates.RequestAccept.Step.transmitPayload,
        trivial⟩, ?_, endpoint⟩
  simpa [mapEvent,
    Cantilune.Pi.Certificates.RequestAccept.mapEvent,
    Cantilune.Pi.Action.erase] using actionEq.symm

/--
A `Late.Step` from a mapped state decomposes into a structural congruence on
the canonical source, a native step on the congruent representative, and a
structural congruence on its target.  This is the exact shape of the
`Step.congr` constructor; the `Step.native` case is the identity congruence.
-/
theorem step_decompose
    {state : Cantilune.Pi.Certificates.RequestAccept.State}
    {action : Raw.Action} {target : Raw.Proc}
    (step : Late.structuralLateLTS.ObservableStep (mapState state) action target) :
    ∃ source' target',
      Late.Struct (mapState state) source' ∧
      Late.NativeStep source' action target' ∧
      Late.Struct target' target := by
  rcases step with ⟨native, _⟩
  cases native with
  | native s =>
      exact ⟨_, _, Late.Struct.refl _, s, Late.Struct.refl _⟩
  | congr sourceCong s targetCong =>
      exact ⟨_, _, sourceCong, s, targetCong⟩

/-! ### Why a global native-`tau` transport theorem is false -/

private def residualCounterexampleLeft : Raw.Proc :=
  .send 0 1 (.send 2 1 .zero)

private def residualCounterexampleSource : Raw.Proc :=
  .par residualCounterexampleLeft (.recv 0 2 .zero)

private def residualCounterexampleAlphaSource : Raw.Proc :=
  .par residualCounterexampleLeft (.recv 0 3 .zero)

private def residualCounterexampleTarget : Raw.Proc :=
  .par (.send 2 1 .zero) .zero

/--
Alpha-renaming the input binder gives a structurally congruent source.  This
example prevents replacing the source-specific request/accept proof with a
false global exact native-step transport lemma.
-/
theorem residualCounterexample_struct :
    Late.Struct residualCounterexampleSource
      residualCounterexampleAlphaSource := by
  apply Late.Struct.par (Late.Struct.refl _)
  apply Late.Struct.alpha
  simpa [residualCounterexampleSource, residualCounterexampleAlphaSource,
    residualCounterexampleLeft, Raw.Proc.renameBound,
    Raw.Proc.substRaw] using
    (Late.Alpha.recvBinder
      (ch := 0) (binder := 2) (body := Raw.Proc.zero)
      (replacement := 3) (by simp [Raw.Proc.allNames]))

/-- The alpha-renamed representative has a genuine native `tau` step. -/
theorem residualCounterexample_alpha_native :
    Late.NativeStep residualCounterexampleAlphaSource .tau
      residualCounterexampleTarget := by
  unfold residualCounterexampleAlphaSource residualCounterexampleTarget
    residualCounterexampleLeft
  apply Late.NativeStep.syncLeft
      Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
  simp [Raw.Proc.freeNames]

/--
The original representative has no native `tau`: its input binder occurs
free in the output derivative, violating the standard late freshness
condition.  Structural closure can still use the alpha-renamed
representative, so only a source-specific residual theorem is valid.
-/
theorem residualCounterexample_no_original_native :
    ¬ Late.NativeStep residualCounterexampleSource .tau target := by
  intro step
  unfold residualCounterexampleSource residualCounterexampleLeft at step
  cases step with
  | parLeft fresh leftStep =>
      cases leftStep
  | parRight fresh rightStep =>
      cases rightStep
  | syncLeft outputStep inputStep binderFresh =>
      cases outputStep
      cases inputStep
      exact binderFresh (by simp [Raw.Proc.freeNames])
  | syncRight inputStep outputStep binderFresh =>
      cases inputStep
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      cases outputStep
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      cases inputStep

/--
Once `StandardLateReflection` is proved, all remaining fields of the complete
projection certificate are already discharged by concrete theorems above.
-/
def certificateOfReflection
    (reflection : StandardLateReflection) :
    ProjectionCertificate
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS
      Late.structuralLateLTS where
  mapState := mapState
  mapEvent := mapEvent
  Lift := fun sourceEvent targetAction =>
    mapEvent sourceEvent = targetAction
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target equality
    subst target
    exact Late.Struct.refl _
  sound := standard_late_sound
  reflect := by
    intro source action target step
    rcases reflection step with
      ⟨event, sourceTarget, sourceStep, actionEq, endpoint⟩
    exact ⟨event, sourceTarget, sourceStep, actionEq, endpoint⟩
  success_iff := standard_late_success_iff
  waiting_iff := standard_late_waiting_iff
  signatureVersion_preserved := standard_late_signature_version

/-- The constructor preserves the canonical state map definitionally. -/
theorem certificateOfReflection_mapState
    (reflection : StandardLateReflection)
    (state : Cantilune.Pi.Certificates.RequestAccept.State) :
    (certificateOfReflection reflection).mapState state = mapState state :=
  rfl

/-- The constructor preserves the canonical event map definitionally. -/
theorem certificateOfReflection_mapEvent
    (reflection : StandardLateReflection)
    (event : Cantilune.Pi.Certificates.RequestAccept.Event) :
    (certificateOfReflection reflection).mapEvent event = mapEvent event :=
  rfl

/-! ## Reflection decomposition and the complete-state inversion

These results are kernel-checked partial progress toward
`StandardLateReflection`.  The `established` and `complete` cases are now
closed by `established_structural_residual` and `complete_reflect`.
Only the `requesting` case remains: it must classify a `Late.NativeStep` from
an arbitrary `Struct`-congruent representative of the closed handshake and
prove that its endpoint is structurally the canonical established state (the
`res(com)` versus `open+close` boundary).  The negative regression above
shows why this must be source-specific rather than an invalid global native
`tau` transport principle.
-/

/-- Prefix count of the canonical complete state is zero. -/
theorem complete_mapState_prefixCount_zero :
    (mapState Cantilune.Pi.Certificates.RequestAccept.State.complete).prefixCount = 0 := by
  simp [mapState,
    Cantilune.Pi.Certificates.RequestAccept.mapState,
    Cantilune.Pi.Certificates.RequestAccept.closedProcess,
    Raw.Proc.prefixCount, Proc.erase, closedCompletedProcess]

/--
The complete request/accept state admits no `Late.Step` even after rewriting
the source by an arbitrary structural congruence.  This is the `complete` case
of `StandardLateReflection`, isolated as a verified lemma: any congruent
representative of `mapState .complete` has prefix count zero, and a native
strong-late step requires a positive prefix count.
-/
theorem complete_reflect
    {action : Raw.Action} {target : Raw.Proc}
    (step : Late.structuralLateLTS.ObservableStep
      (mapState Cantilune.Pi.Certificates.RequestAccept.State.complete) action target) :
    False := by
  obtain ⟨source', target', sourceCong, nativeStep, targetCong⟩ :=
    step_decompose step
  have pc : (mapState
    Cantilune.Pi.Certificates.RequestAccept.State.complete).prefixCount = 0 :=
    complete_mapState_prefixCount_zero
  have pc' : source'.prefixCount = 0 :=
    (Late.Struct.prefixCount_eq sourceCong).symm.trans pc
  have pos : 0 < source'.prefixCount :=
    Late.NativeStep.source_prefixCount_pos nativeStep
  omega

end Cantilune.Pi.P1bStructuralLateBridge
