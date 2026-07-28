import Cantilune.Pi.LateStructuralQuotient
import Cantilune.Pi.P1cFullNativeRefinement

/-!
# P1c reference steps in the structural strong-late LTS

This module maps the full-native P1c reference protocol to the unfiltered
standard `Late.Step` relation with `Late.Struct` as its state setoid.  Target
states are plain `Raw.Proc`; no source-family tag is retained.

All fifteen initial event families and both required payload follow-ups have a
genuine structural strong-late step.  A complete `ProjectionCertificate` with
the canonical state map is intentionally not claimed:

* the standard target LTS has signature version zero, while the admitted source
  state has version one; and
* delegation and instance reconnect have definitionally the same raw source,
  label, and target, so their source-event identity cannot be recovered from a
  pure pi transition triple.

The latter is an event-recovery obstruction, not a fabricated failure of the
standard late relation.
-/

namespace Cantilune.Pi.P1cStructuralLateBridge

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1cMatrix

namespace Refined

open Cantilune.Pi.P1cFullNativeRefinement

/--
Every step of the refined P1c source protocol is a genuine observable step of
the unfiltered structural strong-late LTS.
-/
theorem source_step_sound
    {source : State} {event : Event} {target : State}
    (step :
      P1cFullNativeRefinement.Step source event target) :
    Late.structuralLateLTS.ObservableStep
      (stateProcess source) (mapEvent event) (stateProcess target) :=
  ⟨Late.Step.native
      (P1cFullNativeRefinement.native_sound step), trivial⟩

/-- All fifteen initial P1c event families satisfy structural-late soundness. -/
theorem all_fifteen_initial_steps_sound (family : SourceEvent) :
    Late.structuralLateLTS.ObservableStep
      (stateProcess (.ready family))
      (mapEvent (.execute family))
      (stateProcess (afterFirst family)) :=
  source_step_sound (.execute family)

/-- The open/close payload follow-up is structural-late native. -/
theorem openClose_payload_sound :
    Late.structuralLateLTS.ObservableStep
      (stateProcess .openCloseEstablished)
      (mapEvent .openClosePayload)
      (stateProcess (.completed .openClose)) :=
  source_step_sound .openClosePayload

/-- The restriction payload follow-up is structural-late native. -/
theorem restriction_payload_sound :
    Late.structuralLateLTS.ObservableStep
      (stateProcess .restrictionEstablished)
      (mapEvent .restrictionPayload)
      (stateProcess (.completed .restriction)) :=
  source_step_sound .restrictionPayload

/-- Equality of source states maps to structural congruence of raw processes. -/
theorem canonical_state_map_respects_equiv
    {source target : State}
    (equivalent :
      P1cFullNativeRefinement.sourceLTS.stateSetoid.r source target) :
    Late.Struct (stateProcess source) (stateProcess target) := by
  change source = target at equivalent
  subst target
  exact Late.Struct.refl _

/--
The canonical pure-pi state map is not injective: delegation and reconnect are
two distinct audit states carrying the same closed raw protocol.
-/
theorem canonical_state_map_not_injective :
    ¬ Function.Injective stateProcess := by
  intro injective
  have equality :
      (State.ready .delegation) =
        State.ready .instanceReconnect :=
    injective rfl
  have distinct :
      (State.ready .delegation) ≠
        State.ready .instanceReconnect := by
    decide
  exact distinct equality

/-- Their target action map collides as well. -/
theorem canonical_event_map_not_injective :
    ¬ Function.Injective mapEvent := by
  intro injective
  have equality :
      (Event.execute .delegation) =
        Event.execute .instanceReconnect :=
    injective rfl
  have distinct :
      (Event.execute .delegation) ≠
        Event.execute .instanceReconnect := by
    decide
  exact distinct equality

/--
The exact raw transition triples for delegation and instance reconnect are
definitionally equal although the source event families are distinct.
-/
theorem delegation_reconnect_transition_collision :
    SourceEvent.delegation ≠ SourceEvent.instanceReconnect ∧
      readyProcess .delegation = readyProcess .instanceReconnect ∧
      firstAction .delegation = firstAction .instanceReconnect ∧
      firstTarget .delegation = firstTarget .instanceReconnect :=
  ⟨by decide, rfl, rfl, rfl⟩

/--
Consequently no function of only a raw source, action, and raw target can
recover all fifteen source-event identities.
-/
theorem no_source_event_recovery_from_raw_transition :
    ¬ ∃ recover : Raw.Proc → Raw.Action → Raw.Proc → SourceEvent,
      ∀ family,
        recover (readyProcess family) (firstAction family)
            (firstTarget family) =
          family := by
  rintro ⟨recover, recovers⟩
  have delegation := recovers SourceEvent.delegation
  have reconnect := recovers SourceEvent.instanceReconnect
  have sameRecovery :
      recover (readyProcess .delegation) (firstAction .delegation)
          (firstTarget .delegation) =
        recover (readyProcess .instanceReconnect)
          (firstAction .instanceReconnect)
          (firstTarget .instanceReconnect) :=
    rfl
  have impossible :
      SourceEvent.delegation = SourceEvent.instanceReconnect :=
    delegation.symm.trans (sameRecovery.trans reconnect)
  have distinct :
      SourceEvent.delegation ≠
        SourceEvent.instanceReconnect := by
    decide
  exact distinct impossible

/-- A certificate uses the intended pure raw-process state projection. -/
def UsesCanonicalStateMap
    (certificate :
      ProjectionCertificate
        P1cFullNativeRefinement.sourceLTS
        Late.structuralLateLTS) : Prop :=
  ∀ state, certificate.mapState state = stateProcess state

/--
Even before structural-step exhaustiveness is considered, no complete
projection certificate with the canonical state map can exist: signature
admission changes the source version to one, whereas the standard late LTS is
version zero at every raw process.
-/
theorem no_projection_certificate_with_canonical_state_map :
    ¬ ∃ certificate :
        ProjectionCertificate
          P1cFullNativeRefinement.sourceLTS
          Late.structuralLateLTS,
      UsesCanonicalStateMap certificate := by
  rintro ⟨certificate, canonical⟩
  have version :=
    certificate.signatureVersion_preserved
      (State.completed .dynamicPartnerAdmission)
  rw [canonical] at version
  change 0 = 1 at version
  exact Nat.zero_ne_one version

end Refined

end Cantilune.Pi.P1cStructuralLateBridge
