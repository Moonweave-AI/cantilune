import Cantilune.Pi.P1cFullNativeRefinement

/-!
# Complete fifteen-family native P1c refinement regressions
-/

namespace Cantilune.Tests.P1cFullNativeRefinement

open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement

#check first_native
#check ready_native_exact
#check terminal_no_native
#check native_sound
#check native_reflect
#check certificate

example :=
  first_native SourceEvent.mismatchGuard

example :=
  first_native SourceEvent.instanceReconnect

example :=
  first_native SourceEvent.instanceDeleteQuiescent

example :=
  native_sound Step.openClosePayload

example :=
  native_sound Step.restrictionPayload

end Cantilune.Tests.P1cFullNativeRefinement
