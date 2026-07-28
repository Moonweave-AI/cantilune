import Cantilune.Pi.P1cStructuralLateBridge

/-!
# Regression checks for the P1c structural-late bridge and its obstructions
-/

namespace Cantilune.Tests.P1cStructuralLateBridge

open Cantilune.Pi
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.P1cStructuralLateBridge.Refined

#check source_step_sound
#check all_fifteen_initial_steps_sound
#check openClose_payload_sound
#check restriction_payload_sound
#check canonical_state_map_respects_equiv
#check canonical_state_map_not_injective
#check canonical_event_map_not_injective
#check delegation_reconnect_transition_collision
#check no_source_event_recovery_from_raw_transition
#check no_projection_certificate_with_canonical_state_map

example (family : SourceEvent) :
    Late.structuralLateLTS.ObservableStep
      (stateProcess (.ready family))
      (mapEvent (.execute family))
      (stateProcess (afterFirst family)) :=
  all_fifteen_initial_steps_sound family

example :
    ¬ ∃ recover : Raw.Proc → Raw.Action → Raw.Proc → SourceEvent,
      ∀ family,
        recover (readyProcess family) (firstAction family)
            (firstTarget family) =
          family :=
  no_source_event_recovery_from_raw_transition

end Cantilune.Tests.P1cStructuralLateBridge
