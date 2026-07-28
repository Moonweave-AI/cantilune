import Cantilune.Pi.OpenSMCLinearOneShotObstruction

/-!
# Linear one-shot named-category obstruction regression

The negative checks are restricted to the current atom certificate and
alpha/structural equality.  The final example retains a genuine native
two-step relay execution.
-/

namespace Cantilune.Tests.OpenSMCLinearOneShotObstruction

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary
open Cantilune.Pi.OpenSMCLinearOneShotObstruction

#check no_nonempty_same_boundary_atom_certificate
#check typedOneChannelEcho_certificate
#check exact_support_allows_repeated_subject_use
#check rawPlug_prefixCount
#check no_left_structural_unit_of_positive_prefix
#check no_right_structural_unit_of_positive_prefix
#check oneShotRelay_not_left_structural_unit
#check oneShotRelay_not_right_structural_unit
#check oneShotRelay_initial_action
#check oneShotRelay_no_initial_output
#check producer_relay_native_sync
#check deliveredRelayTarget_native_output
#check producer_relay_native_trace

example :
    ¬ ∃ process : Proc,
      AtomBoundaryCertificate
        OpenSMCBoundaryObstruction.environment
        namedInput namedInput process :=
  no_nonempty_same_boundary_atom_certificate
    namedInput (by simp)

example :
    1 <
      freeSubjectOccurrenceCount 0
        typedOneChannelEcho.erase := by
  simp

example :
    NativeTrace 2
      (.par relayProducer oneShotRelay)
      (.par .zero .zero) :=
  producer_relay_native_trace

end Cantilune.Tests.OpenSMCLinearOneShotObstruction
