import Cantilune.Core.PositionalPushoutClosure

namespace Cantilune.Tests.PositionalPushoutClosure

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PositionalComplementClosure
open Cantilune.Core.PositionalPushoutClosure
open Cantilune.Core.PositionalPushoutClosure.CanonicalPositionalDPO

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

abbrev Graph :=
  PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes

variable {K L R G : Graph}
variable (left : K ⟶ L) (right : K ⟶ R) (occurrence : L ⟶ G)
variable
  [Mono ((encodingFunctor σ inputTypes outputTypes).map left)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map right)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map occurrence)]

example
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    (encodingFunctor σ inputTypes outputTypes).essImage
      (canonicalDerivation left right occurrence legal).result :=
  canonicalResult_mem_positionalImage
    left right occurrence legal boundary

example
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    Nonempty
      (Cantilune.Core.PositionalDPOIBridge.FiniteWitnessType
        (canonicalWitness left right occurrence legal)
        (canonicalWitness_in_positionalImage
          left right occurrence legal boundary)) :=
  canonical_finite_bridge_exists
    left right occurrence legal boundary

end Cantilune.Tests.PositionalPushoutClosure
