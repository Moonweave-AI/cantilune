import Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary

/-!
# Finite-control identity-boundary regression

These checks cover exact finite-run bounds, absence of unbounded/infinite
native behavior, and the surviving two-step linear relay.  They do not claim
that one-shot wiring already forms a named category.
-/

namespace Cantilune.Tests.OpenSMCFiniteControlIdentityBoundary

open Cantilune.Pi
open Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary

#check StrongLateTrace.target_prefixCount_add_length_le
#check StrongLateTrace.length_le_source_prefixCount
#check NativeTrace.toStrongLate
#check NativeTrace.target_prefixCount_add_length_le
#check NativeTrace.length_le_source_prefixCount
#check no_arbitrarily_long_strong_late_runs
#check no_unbounded_native_forwarder
#check no_infinite_strong_late_run
#check no_infinite_native_run
#check oneShotRelay_support
#check oneShotRelay_native_trace
#check oneShotRelay_not_unbounded

example :
    NativeTrace 2 oneShotRelay .zero :=
  oneShotRelay_native_trace

example :
    oneShotRelay.prefixCount = 2 :=
  oneShotRelay_prefixCount

example :
    oneShotRelay.freeNames = {0, 1} :=
  oneShotRelay_support

example :
    ¬ HasArbitrarilyLongNativeRuns oneShotRelay :=
  oneShotRelay_not_unbounded

end Cantilune.Tests.OpenSMCFiniteControlIdentityBoundary
