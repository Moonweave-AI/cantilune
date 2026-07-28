import Cantilune.Core.AdhesiveDPOI

/-!
# Kernel checks for the typed-presheaf adhesive ambient
-/

namespace Cantilune.Tests.AdhesiveDPOI

open CategoryTheory
open Cantilune.Core.AdhesiveDPOI

universe u

variable (Shape : Type u) [SmallCategory Shape]

example :
    Adhesive (HypergraphPresheaf Shape) :=
  presheaf_isAdhesive

example (typeGraph : HypergraphPresheaf Shape) :
    Adhesive (TypedHypergraph typeGraph) :=
  typedHypergraph_isAdhesive typeGraph

end Cantilune.Tests.AdhesiveDPOI
