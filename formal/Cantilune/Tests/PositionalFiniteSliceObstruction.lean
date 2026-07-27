import Cantilune.Core.PositionalFiniteSliceObstruction

namespace Cantilune.Tests.PositionalFiniteSliceObstruction

open Cantilune.Core.PositionalFiniteSliceObstruction

example :
    ¬ (Cantilune.Core.PositionalDPOI.encodingFunctor
        oneInputSignature [] []).EssSurj :=
  encodingFunctor_not_essSurj_from_finite_witness

end Cantilune.Tests.PositionalFiniteSliceObstruction
