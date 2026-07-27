import Cantilune.Pi.FMSPowerdomainBoundary

namespace Cantilune.Tests.FMSPowerdomainBoundary

open Cantilune.Pi.FMSPowerdomainBoundary

example :
    ¬ ∀ value : meetSemilattice.carrier,
        meetSemilattice.bottom ≤ value :=
  continuous_semilattice_identity_need_not_be_least

end Cantilune.Tests.FMSPowerdomainBoundary
