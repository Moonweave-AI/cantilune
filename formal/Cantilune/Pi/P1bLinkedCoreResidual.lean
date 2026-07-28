import Cantilune.Pi.P1bRequestingNormalForm

/-!
# Exact linked-core residuals for the first P1b handshake

This file proves the small positive theorem that is available without a
classification of the entire structural-congruence orbit of the requesting
state.  A linked two-stage output thread and input thread communicate by one
native strong-late `tau` step.  The derivative is the exact pair of remaining
prefixes, provided the standard late freshness premise and the
capture-avoidance premise are supplied explicitly.

Both syntactic parallel orders are covered.  Restrictions are propagated
only by `Late.NativeStep.restrict`.  A now-unused public restriction may then
be removed by structural congruence.  Nothing below transports a native step
across an arbitrary `Late.Struct` representative.  The declarations are
kernel-checked and imported through the linked-endpoint normalization module;
the representative-classification boundary remains explicit.
-/

namespace Cantilune.Pi.P1bLinkedCoreResidual

open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.Protocols

/-- A two-stage requester: offer a session, then send a payload on it. -/
def outputThread
    (publicSubject offered payload : Name) : Raw.Proc :=
  .send publicSubject offered
    (.send offered payload .zero)

/--
A two-stage accepter: receive a session name, then receive a payload on the
received subject.
-/
def inputThread
    (publicSubject sessionBinder payloadBinder : Name) : Raw.Proc :=
  .recv publicSubject sessionBinder
    (.recv sessionBinder payloadBinder .zero)

/-- Output-left/input-right presentation of the linked communication core. -/
def directCore
    (publicSubject offered sessionBinder payload payloadBinder : Name) :
    Raw.Proc :=
  .par
    (outputThread publicSubject offered payload)
    (inputThread publicSubject sessionBinder payloadBinder)

/-- Input-left/output-right presentation of the same linked core. -/
def crossedCore
    (publicSubject offered sessionBinder payload payloadBinder : Name) :
    Raw.Proc :=
  .par
    (inputThread publicSubject sessionBinder payloadBinder)
    (outputThread publicSubject offered payload)

/-- The exact receiver-first derivative of `crossedCore`. -/
def crossedResidual
    (offered payload payloadBinder : Name) : Raw.Proc :=
  .par
    (.recv offered payloadBinder .zero)
    (.send offered payload .zero)

/--
On the capture-safe branch, substituting the offered session for the outer
input binder changes precisely the subject of the residual receive prefix.
-/
theorem inputContinuation_substitution
    (sessionBinder offered payloadBinder : Name)
    (captureSafe :
      (Raw.Proc.recv sessionBinder payloadBinder .zero).captureRisk
        sessionBinder offered = false) :
    Raw.Proc.substituteCaptureAvoiding
        (Raw.Proc.recv sessionBinder payloadBinder .zero)
        sessionBinder offered =
      .recv offered payloadBinder .zero := by
  rw [Raw.Proc.substituteCaptureAvoiding_eq_substRaw
    (.recv sessionBinder payloadBinder .zero)
    sessionBinder offered captureSafe]
  simp [Raw.Proc.substRaw]

/--
The direct linked core performs exactly one native strong-late `tau` step and
lands on the two residual payload prefixes.  The premises are exactly the
freshness premise of `syncLeft` and the premise selecting the non-renaming
capture-avoiding substitution branch.
-/
theorem direct_native_tau
    (publicSubject offered sessionBinder payload payloadBinder : Name)
    (binderFresh :
      sessionBinder ∉
        (Raw.Proc.send offered payload .zero).freeNames)
    (captureSafe :
      (Raw.Proc.recv sessionBinder payloadBinder .zero).captureRisk
        sessionBinder offered = false) :
    Late.NativeStep
      (directCore publicSubject offered sessionBinder payload payloadBinder)
      .tau
      (pairProcess offered payload payloadBinder) := by
  have communication :
      Late.NativeStep
        (.par
          (.send publicSubject offered
            (.send offered payload .zero))
          (.recv publicSubject sessionBinder
            (.recv sessionBinder payloadBinder .zero)))
        .tau
        (.par
          (.send offered payload .zero)
          ((.recv sessionBinder payloadBinder .zero :
              Raw.Proc).substituteCaptureAvoiding
            sessionBinder offered)) :=
    Late.NativeStep.syncLeft
      Late.NativeStep.prefixOutput
      Late.NativeStep.prefixInput
      binderFresh
  rw [inputContinuation_substitution
    sessionBinder offered payloadBinder captureSafe] at communication
  simpa [directCore, outputThread, inputThread, pairProcess] using
    communication

/--
The crossed syntactic presentation uses `syncRight` and lands on the exact
receiver-first residual.  No use of parallel commutativity is hidden inside
the native transition.
-/
theorem crossed_native_tau
    (publicSubject offered sessionBinder payload payloadBinder : Name)
    (binderFresh :
      sessionBinder ∉
        (Raw.Proc.send offered payload .zero).freeNames)
    (captureSafe :
      (Raw.Proc.recv sessionBinder payloadBinder .zero).captureRisk
        sessionBinder offered = false) :
    Late.NativeStep
      (crossedCore publicSubject offered sessionBinder payload payloadBinder)
      .tau
      (crossedResidual offered payload payloadBinder) := by
  have communication :
      Late.NativeStep
        (.par
          (.recv publicSubject sessionBinder
            (.recv sessionBinder payloadBinder .zero))
          (.send publicSubject offered
            (.send offered payload .zero)))
        .tau
        (.par
          ((.recv sessionBinder payloadBinder .zero :
              Raw.Proc).substituteCaptureAvoiding
            sessionBinder offered)
          (.send offered payload .zero)) :=
    Late.NativeStep.syncRight
      Late.NativeStep.prefixInput
      Late.NativeStep.prefixOutput
      binderFresh
  rw [inputContinuation_substitution
    sessionBinder offered payloadBinder captureSafe] at communication
  simpa [crossedCore, crossedResidual, outputThread, inputThread] using
    communication

/--
The crossed residual is structurally the canonical output-first pair.  This
is a post-step normalization, not native-step transport through `Struct`.
-/
theorem crossedResidual_struct_pairProcess
    (offered payload payloadBinder : Name) :
    Late.Struct
      (crossedResidual offered payload payloadBinder)
      (pairProcess offered payload payloadBinder) := by
  simpa [crossedResidual, pairProcess] using
    (Late.Struct.parComm :
      Late.Struct
        (.par
          (.recv offered payloadBinder .zero)
          (.send offered payload .zero))
        (.par
          (.send offered payload .zero)
          (.recv offered payloadBinder .zero)))

/--
A convenient sufficient form of the standard late freshness premise for the
sender derivative.
-/
theorem outputResidual_binderFresh
    (offered sessionBinder payload : Name)
    (binderNeOffered : sessionBinder ≠ offered)
    (binderNePayload : sessionBinder ≠ payload) :
    sessionBinder ∉
      (Raw.Proc.send offered payload .zero).freeNames := by
  simp [Raw.Proc.freeNames, binderNeOffered, binderNePayload]

/--
Keeping the inner payload binder distinct from the offered session is a
simple sufficient condition for the exact, non-alpha-renaming substitution
branch.
-/
theorem inputContinuation_captureSafe
    (sessionBinder offered payloadBinder : Name)
    (payloadBinderNeOffered : payloadBinder ≠ offered) :
    (Raw.Proc.recv sessionBinder payloadBinder .zero).captureRisk
      sessionBinder offered = false := by
  simp [Raw.Proc.captureRisk, payloadBinderNeOffered]

/-- Direct exact residual under elementary name-distinctness premises. -/
theorem direct_native_tau_of_distinct
    (publicSubject offered sessionBinder payload payloadBinder : Name)
    (binderNeOffered : sessionBinder ≠ offered)
    (binderNePayload : sessionBinder ≠ payload)
    (payloadBinderNeOffered : payloadBinder ≠ offered) :
    Late.NativeStep
      (directCore publicSubject offered sessionBinder payload payloadBinder)
      .tau
      (pairProcess offered payload payloadBinder) :=
  direct_native_tau
    publicSubject offered sessionBinder payload payloadBinder
    (outputResidual_binderFresh
      offered sessionBinder payload binderNeOffered binderNePayload)
    (inputContinuation_captureSafe
      sessionBinder offered payloadBinder payloadBinderNeOffered)

/-- Crossed exact residual under elementary name-distinctness premises. -/
theorem crossed_native_tau_of_distinct
    (publicSubject offered sessionBinder payload payloadBinder : Name)
    (binderNeOffered : sessionBinder ≠ offered)
    (binderNePayload : sessionBinder ≠ payload)
    (payloadBinderNeOffered : payloadBinder ≠ offered) :
    Late.NativeStep
      (crossedCore publicSubject offered sessionBinder payload payloadBinder)
      .tau
      (crossedResidual offered payload payloadBinder) :=
  crossed_native_tau
    publicSubject offered sessionBinder payload payloadBinder
    (outputResidual_binderFresh
      offered sessionBinder payload binderNeOffered binderNePayload)
    (inputContinuation_captureSafe
      sessionBinder offered payloadBinder payloadBinderNeOffered)

/--
Native `tau` propagation through an arbitrary finite outer restriction list.
There is no nominal side condition because `tau` has no names.
-/
theorem wrapNews_native_tau
    (binders : List Name)
    (step : Late.NativeStep source .tau target) :
    Late.NativeStep
      (wrapNews binders source)
      .tau
      (wrapNews binders target) := by
  induction binders with
  | nil =>
      exact step
  | cons binder rest inductionHypothesis =>
      simp only [wrapNews]
      exact Late.NativeStep.restrict
        (by simp [Raw.Action.names])
        inductionHypothesis

/-- The direct linked-core step remains native under any outer restrictions. -/
theorem wrapNews_direct_native_tau
    (binders : List Name)
    (publicSubject offered sessionBinder payload payloadBinder : Name)
    (binderFresh :
      sessionBinder ∉
        (Raw.Proc.send offered payload .zero).freeNames)
    (captureSafe :
      (Raw.Proc.recv sessionBinder payloadBinder .zero).captureRisk
        sessionBinder offered = false) :
    Late.NativeStep
      (wrapNews binders
        (directCore publicSubject offered sessionBinder payload payloadBinder))
      .tau
      (wrapNews binders
        (pairProcess offered payload payloadBinder)) :=
  wrapNews_native_tau binders
    (direct_native_tau
      publicSubject offered sessionBinder payload payloadBinder
      binderFresh captureSafe)

/--
The crossed linked-core step also remains native under any outer
restrictions.
-/
theorem wrapNews_crossed_native_tau
    (binders : List Name)
    (publicSubject offered sessionBinder payload payloadBinder : Name)
    (binderFresh :
      sessionBinder ∉
        (Raw.Proc.send offered payload .zero).freeNames)
    (captureSafe :
      (Raw.Proc.recv sessionBinder payloadBinder .zero).captureRisk
        sessionBinder offered = false) :
    Late.NativeStep
      (wrapNews binders
        (crossedCore publicSubject offered sessionBinder payload payloadBinder))
      .tau
      (wrapNews binders
        (crossedResidual offered payload payloadBinder)) :=
  wrapNews_native_tau binders
    (crossed_native_tau
      publicSubject offered sessionBinder payload payloadBinder
      binderFresh captureSafe)

/--
Wrapping more restrictions cannot make a name free if it was not free before
the wrapping.
-/
theorem not_mem_freeNames_wrapNews
    (binders : List Name)
    (fresh : name ∉ process.freeNames) :
    name ∉ (wrapNews binders process).freeNames := by
  induction binders with
  | nil =>
      exact fresh
  | cons binder rest inductionHypothesis =>
      simp only [wrapNews, Raw.Proc.freeNames]
      intro member
      exact inductionHypothesis (Finset.mem_of_mem_erase member)

/--
An outer restriction whose name is no longer free in its already-restricted
body is structural garbage.  This is the precise normalization used for a
public channel after the first handshake.
-/
theorem wrapNews_bound_name_normalizes
    (binder : Name)
    (rest : List Name)
    (process : Raw.Proc)
    (fresh : binder ∉ (wrapNews rest process).freeNames) :
    Late.Struct
      (wrapNews (binder :: rest) process)
      (wrapNews rest process) := by
  simpa [wrapNews] using
    (Late.Struct.new_fresh fresh)

/-- Distinct public/session/payload names make the public name residual-free. -/
theorem public_not_free_in_pairProcess
    (publicSubject offered payload payloadBinder : Name)
    (publicNeOffered : publicSubject ≠ offered)
    (publicNePayload : publicSubject ≠ payload) :
    publicSubject ∉ (pairProcess offered payload payloadBinder).freeNames := by
  simp [publicNeOffered, publicNePayload]

/--
After any inner restrictions, a bound public name absent from the payload pair
can be deleted structurally from the direct residual.
-/
theorem boundPublic_pairProcess_normalizes
    (rest : List Name)
    (publicSubject offered payload payloadBinder : Name)
    (publicNeOffered : publicSubject ≠ offered)
    (publicNePayload : publicSubject ≠ payload) :
    Late.Struct
      (wrapNews (publicSubject :: rest)
        (pairProcess offered payload payloadBinder))
      (wrapNews rest
        (pairProcess offered payload payloadBinder)) := by
  apply wrapNews_bound_name_normalizes
  exact not_mem_freeNames_wrapNews rest
    (public_not_free_in_pairProcess
      publicSubject offered payload payloadBinder
      publicNeOffered publicNePayload)

/-!
## Canonical request/accept instance

This corollary only unfolds the fixed protocol constants into the linked core.
It does not accept an arbitrary `Late.Struct` representative of the canonical
source and therefore does not constitute the pending full P1b reflection
theorem.
-/

/--
The fixed closed request/accept source is precisely the direct linked core
under the public and session restrictions, so its first transition is the
same native strong-late `tau` proved above.
-/
theorem canonical_closed_requesting_native_tau :
    Late.NativeStep
      closedRestrictedHandshake.erase
      .tau
      closedHandshakeResult.erase := by
  have linked :=
    wrapNews_direct_native_tau
      [publicName, session]
      publicName session sessionBinder payload payloadBinder
      (by decide)
      (by decide)
  simpa [closedRestrictedHandshake, restrictedHandshake,
    closedHandshakeResult, handshakeResult, request, accept,
    requestContinuation, acceptContinuation, publicChannel, sessionChannel,
    boundSessionChannel, Proc.erase, wrapNews, directCore, outputThread,
    inputThread, pairProcess] using linked

/--
After that canonical transition, the public restriction is structurally
unused; the session restriction is retained around the payload pair.
-/
theorem canonical_closed_residual_public_normalizes :
    Late.Struct
      closedHandshakeResult.erase
      (wrapNews [session]
        (pairProcess session payload payloadBinder)) := by
  have normalized :=
    boundPublic_pairProcess_normalizes
      [session]
      publicName session payload payloadBinder
      (by decide)
      (by decide)
  simpa [closedHandshakeResult, handshakeResult, requestContinuation,
    sessionChannel, Proc.erase, wrapNews, pairProcess] using normalized

end Cantilune.Pi.P1bLinkedCoreResidual
