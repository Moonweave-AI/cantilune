import Cantilune.Core.Projection
import Cantilune.Projection.All
import Cantilune.Pi.Certificates

/-!
# Four-projection composition

This module contains the projection-independent composition theorem.  It does
not manufacture any of the four certificates: each target must already have an
independently specified native transition relation and a complete
`ProjectionCertificate`.
-/

namespace Cantilune.Theorems

open Cantilune.Core

/--
The four projections share one source execution semantics, but retain distinct
native state spaces, event alphabets, transition relations, and terminal
predicates.
-/
structure FourProjectionCertificate (Source : ObservableLTS) where
  dagLTS : ObservableLTS
  petriLTS : ObservableLTS
  piLTS : ObservableLTS
  morphismLTS : ObservableLTS
  dag : ProjectionCertificate Source dagLTS
  petri : ProjectionCertificate Source petriLTS
  pi : ProjectionCertificate Source piLTS
  morphism : ProjectionCertificate Source morphismLTS

/-- Path soundness and native-event reflection for one certificate. -/
def PathConsistency {Source Target : ObservableLTS}
    (certificate : ProjectionCertificate Source Target) : Prop :=
  (∀ {source target : Source.State} {events : List Source.Event},
      Source.Path source events target →
        Target.Path
          (certificate.mapState source)
          (events.map certificate.mapEvent)
          (certificate.mapState target)) ∧
  (∀ {source : Source.State} {target : Target.State}
      {events : List Target.Event},
      Target.Path (certificate.mapState source) events target →
        ∃ sourceEvents sourceTarget,
          Source.Path source sourceEvents sourceTarget ∧
          List.Forall₂ certificate.Lift sourceEvents events ∧
          Target.stateSetoid.r target
            (certificate.mapState sourceTarget))

/-- The complete success/wait/deadlock classification at a mapped state. -/
def TerminalConsistency {Source Target : ObservableLTS}
    (certificate : ProjectionCertificate Source Target)
    (state : Source.State) : Prop :=
  (Target.SuccessfulTermination (certificate.mapState state) ↔
      Source.SuccessfulTermination state) ∧
  (Target.ExternalWait (certificate.mapState state) ↔
      Source.ExternalWait state) ∧
  (Target.Deadlocked (certificate.mapState state) ↔
      Source.Deadlocked state)

/-- Every complete projection certificate supplies all generic consequences. -/
theorem certificate_closed {Source Target : ObservableLTS}
    (certificate : ProjectionCertificate Source Target) :
    PathConsistency certificate ∧
      (∀ state, TerminalConsistency certificate state) ∧
      (∀ state,
        Target.signatureVersion (certificate.mapState state) =
          Source.signatureVersion state) := by
  refine ⟨?_, ?_, certificate.signatureVersion_preserved⟩
  · exact certificate.projection_paths_lift_and_reflect
  · intro state
    exact certificate.terminal_classification_preserved state

/--
The generic *operational* four-projection theorem.  The result is intentionally
conditional only on four complete operational certificates; a partial or
merely forward simulation cannot inhabit `FourProjectionCertificate`.

This is not the project's final `four_projection_consistency` theorem, which
must additionally package static SMC interpretations, signature-extension and
resource compatibility, and the feedback theorem.
-/
theorem four_projection_operational_consistency
    {Source : ObservableLTS}
    (certificates : FourProjectionCertificate Source) :
    (PathConsistency certificates.dag ∧
      (∀ state, TerminalConsistency certificates.dag state) ∧
      (∀ state,
        certificates.dagLTS.signatureVersion
            (certificates.dag.mapState state) =
          Source.signatureVersion state)) ∧
    (PathConsistency certificates.petri ∧
      (∀ state, TerminalConsistency certificates.petri state) ∧
      (∀ state,
        certificates.petriLTS.signatureVersion
            (certificates.petri.mapState state) =
          Source.signatureVersion state)) ∧
    (PathConsistency certificates.pi ∧
      (∀ state, TerminalConsistency certificates.pi state) ∧
      (∀ state,
        certificates.piLTS.signatureVersion
            (certificates.pi.mapState state) =
          Source.signatureVersion state)) ∧
    (PathConsistency certificates.morphism ∧
      (∀ state, TerminalConsistency certificates.morphism state) ∧
      (∀ state,
        certificates.morphismLTS.signatureVersion
            (certificates.morphism.mapState state) =
          Source.signatureVersion state)) := by
  exact
    ⟨certificate_closed certificates.dag,
      certificate_closed certificates.petri,
      certificate_closed certificates.pi,
      certificate_closed certificates.morphism⟩

namespace FiniteReference

open Cantilune.Projection
open Cantilune.Pi
open Cantilune.Pi.Certificates

/--
The independently defined typed π kernel, with the signature version selected
to match the finite reconfiguration source.
-/
def piLTS : ObservableLTS where
  State := Proc
  Event := Action
  stateSetoid := ObservableLTS.equalitySetoid Proc
  step := Cantilune.Pi.Step
  observable := fun _ => True
  success := RequestAccept.targetSuccess
  waiting := fun _ => False
  signatureVersion := fun process =>
    if process = Cantilune.Pi.Protocols.closedRestrictedHandshake then 0 else 1
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

def piMapState : Reference.State → Proc
  | .empty => Cantilune.Pi.Protocols.closedRestrictedHandshake
  | .installed => Cantilune.Pi.Protocols.closedHandshakeResult
  | .finished => RequestAccept.closedProcess

def piMapEvent (_ : Reference.Event) : Action :=
  .tau

/--
The finite source's two events map to the two native strong communications of
the request/accept reference process.
-/
def piCertificate : ProjectionCertificate Reference.lts piLTS where
  mapState := piMapState
  mapEvent := piMapEvent
  Lift := fun sourceEvent targetEvent =>
    piMapEvent sourceEvent = targetEvent
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
    | install =>
        exact
          ⟨Cantilune.Pi.Protocols.closed_request_accept_handshake, trivial⟩
    | execute =>
        exact
          ⟨Cantilune.Pi.Protocols.closed_payload_after_session, trivial⟩
  reflect := by
    intro source action target transition
    rcases transition with ⟨step, _⟩
    cases source with
    | empty =>
        rcases RequestAccept.requesting_native_unique step with
          ⟨isTau, endpoint⟩
        subst action
        subst target
        exact
          ⟨.install, .installed, Reference.install_observable, rfl, rfl⟩
    | installed =>
        rcases RequestAccept.established_native_unique step with
          ⟨isTau, endpoint⟩
        subst action
        subst target
        exact
          ⟨.execute, .finished, Reference.execute_observable, rfl, rfl⟩
    | finished =>
        exact False.elim (RequestAccept.complete_no_native_step step)
  success_iff := by
    intro state
    cases state <;>
      simp [piLTS, piMapState, RequestAccept.targetSuccess,
        RequestAccept.closedProcess,
        Reference.lts, Reference.success,
        Cantilune.Pi.Protocols.closedCompletedProcess,
        Cantilune.Pi.Protocols.closedRestrictedHandshake,
        Cantilune.Pi.Protocols.closedHandshakeResult,
        Cantilune.Pi.Protocols.restrictedHandshake,
        Cantilune.Pi.Protocols.handshakeResult,
        Cantilune.Pi.Protocols.request, Cantilune.Pi.Protocols.accept,
        Cantilune.Pi.Protocols.requestContinuation,
        Cantilune.Pi.Protocols.acceptContinuation]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    cases state <;>
      simp [piLTS, piMapState, Reference.lts, Reference.signatureVersion,
        Cantilune.Pi.Protocols.restrictedHandshake,
        Cantilune.Pi.Protocols.handshakeResult,
        Cantilune.Pi.Protocols.closedRestrictedHandshake,
        Cantilune.Pi.Protocols.closedHandshakeResult,
        Cantilune.Pi.Protocols.closedCompletedProcess,
        RequestAccept.closedProcess,
        Cantilune.Pi.Protocols.request,
        Cantilune.Pi.Protocols.accept,
        Cantilune.Pi.Protocols.requestContinuation,
        Cantilune.Pi.Protocols.acceptContinuation]

/-- A concrete shared-source four-projection operational package. -/
def certificates : FourProjectionCertificate Reference.lts where
  dagLTS := DAG.lts
  petriLTS := PreNet.lts
  piLTS := piLTS
  morphismLTS := Morphism.lts
  dag := DAG.dag_certificate
  petri := PreNet.reconfigurable_petri_certificate
  pi := piCertificate
  morphism := Morphism.certificate

/--
Nonempty finite witness of native path/terminal consistency in all four
targets.  This is deliberately not the full project theorem: it has no
general typed-open DPO rules, full P1c, external FMS instance, or feedback
execution bridge.
-/
theorem reference_four_projection_operational_consistency :
    (PathConsistency certificates.dag ∧
      (∀ state, TerminalConsistency certificates.dag state) ∧
      (∀ state,
        certificates.dagLTS.signatureVersion
            (certificates.dag.mapState state) =
          Reference.lts.signatureVersion state)) ∧
    (PathConsistency certificates.petri ∧
      (∀ state, TerminalConsistency certificates.petri state) ∧
      (∀ state,
        certificates.petriLTS.signatureVersion
            (certificates.petri.mapState state) =
          Reference.lts.signatureVersion state)) ∧
    (PathConsistency certificates.pi ∧
      (∀ state, TerminalConsistency certificates.pi state) ∧
      (∀ state,
        certificates.piLTS.signatureVersion
            (certificates.pi.mapState state) =
          Reference.lts.signatureVersion state)) ∧
    (PathConsistency certificates.morphism ∧
      (∀ state, TerminalConsistency certificates.morphism state) ∧
      (∀ state,
        certificates.morphismLTS.signatureVersion
            (certificates.morphism.mapState state) =
          Reference.lts.signatureVersion state)) :=
  four_projection_operational_consistency certificates

end FiniteReference

end Cantilune.Theorems
