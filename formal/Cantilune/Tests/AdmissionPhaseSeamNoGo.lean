import Cantilune.Pi.FMSActualAgentNormativeOperationalBridge

/-!
# No-go for a terminal admission endpoint followed by a normative business row

This file records why the superseded one-phase shortcut could not support a
cross-epoch chain.  If admission had ended immediately at its terminal
inactive effect bottom, that endpoint could not literally be the source of
any following normative row.

The current construction avoids the obstruction by making the first
admission derivative reconnect-ready and retaining a separate genuine tau
follow-up.  The theorem below is an exact endpoint obstruction for the
terminal shortcut; it does not use weak transitions, bisimulation, or an
observational quotient.
-/

noncomputable section

namespace Cantilune.Tests.AdmissionPhaseSeamNoGo

open Cantilune.Pi
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.P1cMatrix

/--
An inactive admission terminal is not the source of any normative family.

The proof is by unfolding the recursive domain once.  Its left side is the
effect bottom, while its right side is a principal action, and the latter is
kernel-proved non-bottom.
-/
theorem terminal_admission_shortcut_ne_normative_source
    (next : SourceEvent) :
    normativeTerminalAgent .dynamicPartnerAdmission ≠
      normativeSourceAgent next := by
  intro endpointEquality
  have unfolded :=
    congrArg (agentUnfold.app normativeBaseWorld) endpointEquality
  rw [normativeTerminalAgent_unfold, normativeSourceAgent_unfold] at unfolded
  change
    (⊥ :
      OmegaScottPower
        (ActionRepresentation Agent normativeBaseWorld)) =
      principalRaw (normativeAgentAction next) at unfolded
  exact
    (principalAction_ne_effectBottom normativeBaseWorld
      (normativeAgentAction next)) unfolded.symm

/-- In particular, the terminal shortcut cannot start reconnect. -/
theorem terminal_admission_shortcut_ne_reconnect_source :
    normativeTerminalAgent .dynamicPartnerAdmission ≠
      normativeSourceAgent .instanceReconnect :=
  terminal_admission_shortcut_ne_normative_source .instanceReconnect

#print axioms terminal_admission_shortcut_ne_normative_source
#print axioms terminal_admission_shortcut_ne_reconnect_source

end Cantilune.Tests.AdmissionPhaseSeamNoGo
