import Cantilune.Pi.P1cAdmittedFourOccurrence

/-!
# Fixed-epoch four-view P1c occurrence regression

The checks below expose the concrete product inhabitant, the independently
native target derivations, and replay evidence assembled for every admitted
mismatch, reconnect, or quiescent-delete occurrence.
-/

namespace Cantilune.Tests.P1cAdmittedFourOccurrence

open Cantilune.Pi.P1cAdmittedFourOccurrence

#check fixedOccurrence
#check fixedOccurrence_nonempty
#check fixedOccurrence_pi_native
#check fixedOccurrence_native_all
#check fixedOccurrence_replays
#check fixedOccurrence_target_records_replay

end Cantilune.Tests.P1cAdmittedFourOccurrence
