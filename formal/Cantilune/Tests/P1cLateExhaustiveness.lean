import Cantilune.Pi.P1cLateExhaustiveness

namespace Cantilune.Tests.P1cLateExhaustiveness

open Cantilune.Pi.P1cLateExhaustiveness

example :
    ¬ ∃ certificate :
        Cantilune.Core.ProjectionCertificate
          Cantilune.Pi.P1cMatrix.sourceLTS
          FullNativeTarget.lts,
      ∀ state, certificate.mapState state = FullNativeTarget.mapState state :=
  FullNativeTarget.no_projection_certificate_with_actual_process_map

end Cantilune.Tests.P1cLateExhaustiveness
