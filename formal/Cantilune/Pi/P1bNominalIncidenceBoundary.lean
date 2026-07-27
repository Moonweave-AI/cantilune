import Cantilune.Pi.P1bRequestingReflectionClosure
import Cantilune.Pi.P1bRestrictionEnvelope

/-!
# The final nominal-incidence boundary for P1b requesting reflection

The native inversion already exposes one actual `SplitCommunication`, two
pure-polarity two-prefix threads, and a common restriction context for source
and target.  What it does not recover is the incidence of the bound session
name and the surviving free payload.

This module states that missing fact without assuming the desired endpoint.
`PolarizedNominalIncidence` is indexed by the genuine split derivation and
only says that its wrapped residual alpha/structurally normalizes to:

* one restriction, whose binder is some `residualChannel`; and
* one output/input pair on that channel, carrying the fixed free `payload`.

The residual channel and input binder remain arbitrary.  In particular the
interface contains neither `closedHandshakeResult.erase` nor
`LinkedEndpointForm`.  The theorem below performs the remaining binder alpha
normalization, inserts the fresh public restriction, and then derives the
up-to-structure linked-endpoint classifier.
-/

namespace Cantilune.Pi.P1bNominalIncidenceBoundary

open Cantilune.Core
open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bRequestingNominalOrbit
open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bLabelledThreadInversion
open Cantilune.Pi.P1bNativeSplitContext
open Cantilune.Pi.P1bLinkedEndpointNormalization
open Cantilune.Pi.P1bRequestingReflectionClosure
open Cantilune.Pi.P1bStructuralLateBridge

/--
The source-local nominal incidence still missing after exact native split
inversion.

The `communication` index ensures that this package is about the actual
native constructor selected at the live split.  `wrappedResidual` is only an
unknown-name residual normal form; it does not mention the canonical endpoint
or the finite linked-endpoint classifier.
-/
def PolarizedNominalIncidence
    (binders : List Name)
    (left right splitTarget : Raw.Proc)
    (_communication : SplitCommunication left right splitTarget) : Prop :=
  ∃ residualChannel residualBinder,
    residualChannel ≠ payload ∧
    Late.Struct
      (wrapNews binders splitTarget)
      (.new residualChannel
        (pairProcess residualChannel payload residualBinder))

/--
The precise remaining source-orbit interface.  It quantifies over the shared
polarized split already produced by native inversion and asks only for its
unknown-name nominal residual.
-/
def RequestingPolarizedNominalIncidence : Prop :=
  ∀ {binders : List Name} {left right splitTarget : Raw.Proc}
      (_leftThread : TwoCommThread left)
      (_rightThread : TwoCommThread right)
      (_polarities :
        (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
        (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
      (communication : SplitCommunication left right splitTarget),
    Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)) →
      PolarizedNominalIncidence
        binders left right splitTarget communication

/-- Alpha-normalize the residual input binder while retaining its channel. -/
theorem pairProcess_struct_normalizeBinder
    (channel binder : Name) :
    Late.Struct
      (pairProcess channel payload binder)
      (pairProcess channel payload payloadBinder) := by
  apply Late.Struct.par
    (Late.Struct.refl (.send channel payload .zero))
  apply Late.Struct.alpha
  simpa [pairProcess, Raw.Proc.renameBound, Raw.Proc.substRaw] using
    (Late.Alpha.recvBinder
      (ch := channel)
      (binder := binder)
      (body := Raw.Proc.zero)
      (replacement := payloadBinder)
      (by simp [Raw.Proc.allNames]))

/--
Any one-restriction residual pair carrying the fixed free payload is
structurally the established P1b state.  The bound channel may be any name:
it is alpha-normalized to `session`, after first normalizing the inner input
binder so that the alpha step is capture-free.
-/
theorem restrictedPair_struct_established
    (channel binder : Name)
    (channel_ne_payload : channel ≠ payload) :
    Late.Struct
      (.new channel (pairProcess channel payload binder))
      (mapState Certificates.RequestAccept.State.established) := by
  have binderNormalized :
      Late.Struct
        (.new channel (pairProcess channel payload binder))
        (.new channel
          (pairProcess channel payload payloadBinder)) :=
    Late.Struct.new (pairProcess_struct_normalizeBinder channel binder)
  have channelNormalized :
      Late.Struct
        (.new channel
          (pairProcess channel payload payloadBinder))
        (.new session
          (pairProcess session payload payloadBinder)) := by
    by_cases channelEq : channel = session
    · subst channel
      exact Late.Struct.refl _
    · apply Late.Struct.alpha
      have payload_ne_channel : payload ≠ channel :=
        Ne.symm channel_ne_payload
      have payloadCode_ne_channel : (3 : Name) ≠ channel := by
        simpa [payload] using payload_ne_channel
      simpa [pairProcess, Raw.Proc.renameBound, Raw.Proc.substRaw,
        channelEq, payloadCode_ne_channel,
        session, payload, payloadBinder] using
        (Late.Alpha.newBinder
          (binder := channel)
          (body := pairProcess channel payload payloadBinder)
          (replacement := session)
          (by
            have session_ne_channel : session ≠ channel :=
              Ne.symm channelEq
            simpa [pairProcess, Raw.Proc.allNames,
              session, payload, payloadBinder] using session_ne_channel))
  have publicFresh :
      publicName ∉
        (Raw.Proc.new session
          (pairProcess session payload payloadBinder)).freeNames := by
    simp [pairProcess, Raw.Proc.freeNames, publicName, session, payload,
      payloadBinder]
  have insertPublic :
      Late.Struct
        (.new session
          (pairProcess session payload payloadBinder))
        (mapState Certificates.RequestAccept.State.established) := by
    have inserted :=
      Late.Struct.symm
        (Late.Struct.new_fresh publicFresh)
    simpa [mapState, Certificates.RequestAccept.mapState,
      closedHandshakeResult, handshakeResult, requestContinuation,
      sessionChannel, Proc.erase, pairProcess] using inserted
  exact Late.Struct.trans binderNormalized
    (Late.Struct.trans channelNormalized insertPublic)

/--
The non-circular nominal-incidence interface is sufficient for the exact
up-to-structure linked-endpoint residual.  The proof follows one genuine
`NativeStep`; there is no structural transport of a transition and no weak
closure.
-/
theorem requestingUpToLinkedEndpoint_of_polarizedNominalIncidence
    (incidenceClassifies : RequestingPolarizedNominalIncidence) :
    RequestingUpToLinkedEndpointResidual := by
  intro source action target sourceCongruence nativeStep
  have canonicalCongruence :
      Late.Struct canonicalRequesting source := by
    simpa [mapState, Certificates.RequestAccept.mapState,
      canonicalRequesting] using sourceCongruence
  have actionEq :=
    (native_step_orbit_constraints canonicalCongruence nativeStep).1
  subst action
  rcases requesting_native_polarized_split_normal_form
      canonicalCongruence nativeStep with
    ⟨binders, left, right, splitTarget,
      leftThread, rightThread, polarities, communication,
      sourceNormal, targetNormal⟩
  have canonicalSplit :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)) :=
    Late.Struct.trans canonicalCongruence sourceNormal
  have nominal :=
    incidenceClassifies leftThread rightThread polarities communication
      canonicalSplit
  rcases nominal with
    ⟨residualChannel, residualBinder,
      channel_ne_payload, wrappedResidual⟩
  have targetEstablished :
      Late.Struct target
        (mapState Certificates.RequestAccept.State.established) :=
    Late.Struct.trans targetNormal
      (Late.Struct.trans wrappedResidual
        (restrictedPair_struct_established
          residualChannel residualBinder channel_ne_payload))
  let endpoint :=
    wrapNews [publicName, session] (linkedPair canonicalIncidence)
  have endpointEq :
      endpoint =
        mapState Certificates.RequestAccept.State.established := by
    simpa [endpoint, mapState, Certificates.RequestAccept.mapState,
      linkedPair, linkedInput, linkedOutput, canonicalIncidence,
      pairProcess] using canonical_wrapped_pair_eq
  refine ⟨canonicalIncidence, endpoint, ?_, ?_⟩
  · rw [endpointEq]
    exact targetEstablished
  · exact LinkedEndpointForm.syncLeft
      [publicName, session] (List.Perm.refl _)

/-- The same interface closes the exact native residual theorem. -/
theorem requestingNativeResidual_of_polarizedNominalIncidence
    (incidenceClassifies : RequestingPolarizedNominalIncidence) :
    RequestingNativeResidual :=
  requestingNativeResidual_of_upToLinkedEndpoint
    (requestingUpToLinkedEndpoint_of_polarizedNominalIncidence
      incidenceClassifies)

/-! ## Sharpness checks -/

/--
Prefix counts, pure residual polarity, and two one-prefix threads are not
enough: the wrong-payload residual has all those facts but is not established.
-/
theorem aggregateResidualShape_is_insufficient :
    ∃ target : Raw.Proc,
      PartialResidualShape target ∧
      ¬ Late.Struct target
        (mapState Certificates.RequestAccept.State.established) :=
  ⟨wrongPayloadResidual,
    wrongPayloadResidual_partialResidualShape,
    wrongPayloadResidual_not_established⟩

/--
Requiring both essential binders to occur in the *outer* split list is too
strong.  A genuine one-step `closeLeft` representative has only the public
binder outside; the session binder is created by the native close rule.
-/
theorem outerTwoBinder_incidence_is_too_strong :
    ¬ ∃ garbage : List Name,
      ([publicName] : List Name).Perm
        (garbage ++ [publicName, session]) :=
  P1bRestrictionEnvelope.closeLeft_outer_list_has_no_two_binder_decomposition

end Cantilune.Pi.P1bNominalIncidenceBoundary
