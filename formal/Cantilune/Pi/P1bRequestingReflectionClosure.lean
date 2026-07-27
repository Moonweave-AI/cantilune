import Cantilune.Pi.P1bStructuralLateBridge
import Cantilune.Pi.P1bRequestingNominalOrbit
import Cantilune.Pi.P1bRequestingPolarityOrbit
import Cantilune.Pi.P1bTwoThreadNativeInversion
import Cantilune.Pi.P1bNativeSplitContext
import Cantilune.Pi.P1bLinkedEndpointNormalization
import Cantilune.Pi.P1bResidualTargetBoundary

/-!
# Exact closure boundary for P1b requesting reflection

This module reduces the remaining `StandardLateReflection` obligation to one
source-specific native residual theorem.  The reduction is an equivalence:
there is no hidden weak transition, observation filter, or exact-syntax target
requirement.

The target of the missing native theorem is deliberately stated up to
`Late.Struct`.  `P1bResidualTargetBoundary` proves that exact membership in the
finite `LinkedEndpointForm` syntax is too strong.
-/

namespace Cantilune.Pi.P1bRequestingReflectionClosure

open Cantilune.Core
open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bRequestingNominalOrbit
open Cantilune.Pi.P1bRequestingPolarityOrbit
open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bTwoThreadNativeInversion
open Cantilune.Pi.P1bNativeSplitContext
open Cantilune.Pi.P1bLinkedEndpointNormalization
open Cantilune.Pi.P1bStructuralLateBridge

/--
The exact source-specific native residual still needed for the requesting
case.  It quantifies over the representative at which the genuine native rule
fires and classifies only the target structural class.
-/
def RequestingNativeResidual : Prop :=
  ∀ {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc},
    Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source →
      Late.NativeStep source action target →
        action = .tau ∧
          Late.Struct target
            (mapState Certificates.RequestAccept.State.established)

/--
A finite linked-endpoint classifier may choose a representative of the target
structural class.  Requiring the exact native target itself to inhabit
`LinkedEndpointForm` would contradict the zero-padded native regression.
-/
def RequestingUpToLinkedEndpointResidual : Prop :=
  ∀ {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc},
    Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source →
      Late.NativeStep source action target →
        ∃ incidence endpoint,
          Late.Struct target endpoint ∧
            LinkedEndpointForm incidence endpoint

/--
The tempting exact-target formulation, recorded only so that it can be
refuted below.  Structural closure permits native targets carrying inert
syntax, so this is not the reflection theorem that P1b needs.
-/
def RequestingExactLinkedEndpointResidual : Prop :=
  ∀ {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc},
    Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source →
      Late.NativeStep source action target →
        ∃ incidence, LinkedEndpointForm incidence target

/--
Exact linked-endpoint membership is false for the real structural late
semantics.  The counterexample is a single native transition from a
parallel-zero representative, not a weak execution.
-/
theorem not_requestingExactLinkedEndpointResidual :
    ¬ RequestingExactLinkedEndpointResidual := by
  intro classify
  have sourceCongruence :
      Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        P1bResidualTargetBoundary.zeroPaddedRequesting := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using
      P1bResidualTargetBoundary.canonical_struct_zeroPaddedRequesting
  rcases classify sourceCongruence
      P1bResidualTargetBoundary.zeroPaddedRequesting_native_tau with
    ⟨incidence, endpointForm⟩
  exact
    P1bResidualTargetBoundary.zeroPaddedEstablished_not_exact_linkedEndpoint
      incidence endpointForm

/--
The finite linked endpoint classifier is sufficient for the exact native
residual.  Silence comes from the requesting nominal orbit; endpoint
normalization is supplied by `LinkedEndpointForm.struct_canonical`.
-/
theorem requestingNativeResidual_of_upToLinkedEndpoint
    (classify : RequestingUpToLinkedEndpointResidual) :
    RequestingNativeResidual := by
  intro source action target sourceCongruence nativeStep
  have canonicalCongruence :
      Late.Struct canonicalRequesting source := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using
      sourceCongruence
  have constraints :=
    native_step_orbit_constraints canonicalCongruence nativeStep
  rcases classify sourceCongruence nativeStep with
    ⟨incidence, endpoint, targetEndpoint, endpointForm⟩
  refine ⟨constraints.1, ?_⟩
  have endpointCanonical :
      Late.Struct endpoint closedHandshakeResult.erase :=
    endpointForm.struct_canonical
  simpa [mapState, Certificates.RequestAccept.mapState] using
    Late.Struct.trans targetEndpoint endpointCanonical

/--
The exact native residual can always be re-expressed as an up-to-structure
linked-endpoint classifier by choosing the canonical endpoint representative.
Together with the preceding implication, the two gap interfaces are
equivalent.
-/
theorem upToLinkedEndpoint_of_requestingNativeResidual
    (residual : RequestingNativeResidual) :
    RequestingUpToLinkedEndpointResidual := by
  intro source action target sourceCongruence nativeStep
  rcases residual sourceCongruence nativeStep with
    ⟨_actionEq, targetCanonical⟩
  let endpoint :=
    wrapNews [publicName, session] (linkedPair canonicalIncidence)
  have endpointEq :
      endpoint =
        mapState Certificates.RequestAccept.State.established := by
    simpa [endpoint, mapState, Certificates.RequestAccept.mapState,
      linkedPair, linkedInput, linkedOutput, canonicalIncidence,
      pairProcess] using
      canonical_wrapped_pair_eq
  refine ⟨canonicalIncidence, endpoint, ?_, ?_⟩
  · rw [endpointEq]
    exact targetCanonical
  · exact LinkedEndpointForm.syncLeft
      [publicName, session] (List.Perm.refl _)

/-- The linked-endpoint and canonical-class formulations have equal strength. -/
theorem requestingUpToLinkedEndpoint_iff_nativeResidual :
    RequestingUpToLinkedEndpointResidual ↔ RequestingNativeResidual :=
  ⟨requestingNativeResidual_of_upToLinkedEndpoint,
    upToLinkedEndpoint_of_requestingNativeResidual⟩

/--
The requesting case of reflection follows from exactly one native residual
classification.  `step_decompose` retains the real native derivation and the
final target congruence is composed in the correct direction.
-/
theorem requesting_reflect_of_nativeResidual
    (residual : RequestingNativeResidual)
    {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.structuralLateLTS.ObservableStep
        (mapState Certificates.RequestAccept.State.requesting)
        action target) :
    ∃ event sourceTarget,
      Certificates.RequestAccept.sourceLTS.ObservableStep
        Certificates.RequestAccept.State.requesting event sourceTarget ∧
      mapEvent event = action ∧
      Late.Struct target (mapState sourceTarget) := by
  obtain ⟨nativeSource, nativeTarget, sourceCongruence,
      nativeStep, targetCongruence⟩ :=
    step_decompose step
  rcases residual sourceCongruence nativeStep with
    ⟨actionEq, nativeEndpoint⟩
  refine
    ⟨Certificates.RequestAccept.Event.establishSession,
      Certificates.RequestAccept.State.established,
      ⟨Certificates.RequestAccept.Step.establishSession, trivial⟩,
      ?_,
      Late.Struct.trans (Late.Struct.symm targetCongruence)
        nativeEndpoint⟩
  simpa [mapEvent, Certificates.RequestAccept.mapEvent,
    Cantilune.Pi.Action.erase] using actionEq.symm

/--
All three source-state cases compose once the requesting native residual is
available.  The established and complete cases use the already verified
strong-late inversions.
-/
theorem standardLateReflection_of_requestingNativeResidual
    (residual : RequestingNativeResidual) :
    StandardLateReflection := by
  intro source action target step
  cases source with
  | requesting =>
      exact requesting_reflect_of_nativeResidual residual step
  | established =>
      exact established_reflect step
  | complete =>
      exact (complete_reflect step).elim

/--
Conversely, complete standard-late reflection implies the source-specific
native residual.  The arbitrary representative is selected directly by the
`Step.congr` constructor, so this direction also uses one genuine native
transition rather than a closure.
-/
theorem requestingNativeResidual_of_standardLateReflection
    (reflection : StandardLateReflection) :
    RequestingNativeResidual := by
  intro source action target sourceCongruence nativeStep
  have structuralStep :
      Late.structuralLateLTS.ObservableStep
        (mapState Certificates.RequestAccept.State.requesting)
        action target :=
    ⟨Late.Step.congr sourceCongruence nativeStep (Late.Struct.refl target),
      trivial⟩
  rcases reflection structuralStep with
    ⟨event, sourceTarget, sourceStep, actionEq, endpoint⟩
  rcases sourceStep with ⟨sourceStep, _observed⟩
  cases sourceStep
  refine ⟨?_, endpoint⟩
  simpa [mapEvent, Certificates.RequestAccept.mapEvent,
    Cantilune.Pi.Action.erase] using actionEq.symm

/--
The remaining requesting native residual is logically equivalent to the full
`StandardLateReflection` obligation.  This is the minimal non-circular gap
interface: neither side asks for exact target syntax or a weak step.
-/
theorem standardLateReflection_iff_requestingNativeResidual :
    StandardLateReflection ↔ RequestingNativeResidual :=
  ⟨requestingNativeResidual_of_standardLateReflection,
    standardLateReflection_of_requestingNativeResidual⟩

/--
Equivalently, the whole reflection theorem is exactly the target-up-to-
structure linked-endpoint classification.  This is the form consumed by the
labelled-thread and restriction-envelope developments.
-/
theorem standardLateReflection_iff_requestingUpToLinkedEndpoint :
    StandardLateReflection ↔ RequestingUpToLinkedEndpointResidual := by
  constructor
  · intro reflection
    exact upToLinkedEndpoint_of_requestingNativeResidual
      (requestingNativeResidual_of_standardLateReflection reflection)
  · intro classify
    exact standardLateReflection_of_requestingNativeResidual
      (requestingNativeResidual_of_upToLinkedEndpoint classify)

/--
Once the linked-endpoint classifier is supplied, the complete projection
certificate is obtained without any further operational premise.
-/
def certificateOfUpToLinkedEndpoint
    (classify : RequestingUpToLinkedEndpointResidual) :
    ProjectionCertificate
      Certificates.RequestAccept.sourceLTS
      Late.structuralLateLTS :=
  certificateOfReflection
    ((standardLateReflection_iff_requestingUpToLinkedEndpoint).2 classify)

/--
Kernel-checked progress below the final incidence boundary.  Every native
requesting representative is silent, has the exact `4 → 2` polarity residual,
and is structurally a restriction context around two one-prefix threads.
-/
theorem requesting_native_partial_residual
    {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc}
    (sourceCongruence :
      Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source)
    (nativeStep : Late.NativeStep source action target) :
    action = .tau ∧
      target.prefixCount = 2 ∧
      target.sendPrefixCount = 1 ∧
      target.recvPrefixCount = 1 ∧
      ∃ binders left right,
        OneCommThread left ∧
        OneCommThread right ∧
        Late.Struct target
          (wrapNews binders (.par left right)) := by
  have canonicalCongruence :
      Late.Struct canonicalRequesting source := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using
      sourceCongruence
  exact
    requesting_representative_native_residual_shape
      canonicalCongruence nativeStep

/--
The actual native source also retains the two canonical same-polarity guarded
pairs.  This excludes the crossed-polarity aggregate-fingerprint
counterexample from the structural orbit.
-/
theorem requesting_native_source_guardedPairCounts
    {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc}
    (sourceCongruence :
      Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source)
    (_nativeStep : Late.NativeStep source action target) :
    source.guardedSendPairCount = 1 ∧
      source.guardedRecvPairCount = 1 := by
  have canonicalCongruence :
      Late.Struct canonicalRequesting source := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using sourceCongruence
  exact guardedPairCounts_of_struct_canonicalRequesting canonicalCongruence

/--
The actual native derivation reaches an explicitly labelled split, and its
source and exact target normalize through the same restriction list.  This is
the derivation-preserving bridge required by the remaining nominal-incidence
proof.
-/
theorem requesting_native_shared_split_context
    {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc}
    (sourceCongruence :
      Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source)
    (nativeStep : Late.NativeStep source action target) :
    action = .tau ∧ NativeSplitNormalForm source target := by
  have canonicalCongruence :
      Late.Struct canonicalRequesting source := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using sourceCongruence
  have actionEq :=
    (native_step_orbit_constraints canonicalCongruence nativeStep).1
  subst action
  exact ⟨rfl,
    requesting_native_split_normal_form canonicalCongruence nativeStep⟩

/--
The shared split additionally has exactly one send/send and one receive/
receive thread.  Thus the unresolved part is now strictly nominal incidence,
not native-rule selection, context alignment, or polarity order.
-/
theorem requesting_native_shared_polarized_split_context
    {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc}
    (sourceCongruence :
      Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source)
    (nativeStep : Late.NativeStep source action target) :
    action = .tau ∧ NativePolarizedSplitNormalForm source target := by
  have canonicalCongruence :
      Late.Struct canonicalRequesting source := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using sourceCongruence
  have actionEq :=
    (native_step_orbit_constraints canonicalCongruence nativeStep).1
  subst action
  exact ⟨rfl,
    requesting_native_polarized_split_normal_form
      canonicalCongruence nativeStep⟩

/--
The exact quantitative/thread-shaped conclusion, named independently so its
logical strength can be audited.
-/
def PartialResidualShape (target : Raw.Proc) : Prop :=
  target.prefixCount = 2 ∧
    target.sendPrefixCount = 1 ∧
    target.recvPrefixCount = 1 ∧
    ∃ binders left right,
      OneCommThread left ∧
      OneCommThread right ∧
      Late.Struct target
        (wrapNews binders (.par left right))

/-- Every real requesting native transition has the named partial shape. -/
theorem requesting_native_has_partialResidualShape
    {source : Raw.Proc} {action : Raw.Action} {target : Raw.Proc}
    (sourceCongruence :
      Late.Struct
        (mapState Certificates.RequestAccept.State.requesting)
        source)
    (nativeStep : Late.NativeStep source action target) :
    action = .tau ∧ PartialResidualShape target := by
  rcases requesting_native_partial_residual
      sourceCongruence nativeStep with
    ⟨actionEq, prefixes, sends, receives, residual⟩
  exact ⟨actionEq, prefixes, sends, receives, residual⟩

/--
A two-prefix, one-output/one-input residual with the wrong output value.  It
has exactly the aggregate/thread shape above but not the established nominal
interface.
-/
def wrongPayloadResidual : Raw.Proc :=
  wrapNews [publicName, session]
    (.par
      (.send session publicName .zero)
      (.recv session payloadBinder .zero))

/-- Aggregate residual shape alone does not recover the target class. -/
theorem wrongPayloadResidual_partialResidualShape :
    PartialResidualShape wrongPayloadResidual := by
  refine ⟨by decide, by decide, by decide,
    [publicName, session],
    (.send session publicName .zero),
    (.recv session payloadBinder .zero),
    ?_, ?_, Late.Struct.refl _⟩
  · exact OneCommThread.send (by decide)
  · exact OneCommThread.recv (by decide)

/--
The wrong-payload residual is not structurally established: its free-name
interface is empty, whereas the real established state retains `payload`.
This makes the remaining nominal-incidence step semantically necessary.
-/
theorem wrongPayloadResidual_not_established :
    ¬ Late.Struct wrongPayloadResidual
      (mapState Certificates.RequestAccept.State.established) := by
  intro relation
  have payloadMembership :=
    congrArg (fun names => payload ∈ names)
      (Late.Struct.freeNames_eq relation)
  norm_num [wrongPayloadResidual, wrapNews, mapState,
    Certificates.RequestAccept.mapState, closedHandshakeResult,
    handshakeResult, requestContinuation, sessionChannel, Proc.erase,
    Raw.Proc.freeNames, publicName, session, payload,
    payloadBinder] at payloadMembership

end Cantilune.Pi.P1bRequestingReflectionClosure
