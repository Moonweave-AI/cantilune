import Cantilune.Pi.P1cAdmittedKernelExpectation
import Cantilune.Tests.P1cAdmittedOperations

namespace Cantilune.Tests.P1cAdmittedKernelExpectation

open Cantilune.Pi.P1cAdmittedKernelExpectation
open Cantilune.Tests.P1cAdmittedOperations

example :
    (onePhaseProgress reconnectOccurrence).expectedKernelEpochCount ≤ 1 :=
  expected_opportunities_le_one reconnectOccurrence

end Cantilune.Tests.P1cAdmittedKernelExpectation
