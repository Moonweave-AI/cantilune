import Cantilune.Core.OpenHypergraphNormalization
import Cantilune.Tests.OpenHypergraphDPOI

namespace Cantilune.Tests.OpenHypergraphNormalization

open Cantilune.Core.OpenHypergraphNormalization
open Cantilune.Tests.OpenHypergraphDPOI

abbrev normalized :=
  Cantilune.Core.OpenHypergraphNormalization.TypedOpenHypergraph.normalize
    graph

example : Fintype.card (normalized.Node .wire) = 3 := by
  native_decide

example : Fintype.card (normalized.Edge .link) = 1 := by
  native_decide

end Cantilune.Tests.OpenHypergraphNormalization
