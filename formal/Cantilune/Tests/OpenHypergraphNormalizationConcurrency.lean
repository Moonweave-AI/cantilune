import Cantilune.Core.OpenHypergraphNormalizationConcurrency

/-!
Kernel-checked type-level regression for the normalized-match concurrency
bridge. Concrete independence remains an explicit premise.
-/

namespace Cantilune.Tests.OpenHypergraphNormalizationConcurrency

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.OpenHypergraphNormalizationConcurrency

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {FirstNode FirstEdge SecondNode SecondEdge HostNode HostEdge : Type}
variable [DecidableEq FirstNode] [DecidableEq FirstEdge]
variable [DecidableEq SecondNode] [DecidableEq SecondEdge]
variable [DecidableEq HostNode] [DecidableEq HostEdge]
variable
  {firstGraph :
    TypedOpenHypergraph
      σ inputTypes outputTypes FirstNode FirstEdge}
  {secondGraph :
    TypedOpenHypergraph
      σ inputTypes outputTypes SecondNode SecondEdge}
  {hostGraph :
    TypedOpenHypergraph
      σ inputTypes outputTypes HostNode HostEdge}
  {firstRule secondRule :
    AdhesiveDPOI.Rule (typeGraph σ inputTypes outputTypes)}

example
    (firstLeft :
      firstRule.left =
        (OpenHypergraphNormalization.TypedOpenHypergraph.normalize
          firstGraph).encoded)
    (secondLeft :
      secondRule.left =
        (OpenHypergraphNormalization.TypedOpenHypergraph.normalize
          secondGraph).encoded)
    (firstMatching :
      TypedOpenHypergraph.Monomorphism firstGraph hostGraph)
    (secondMatching :
      TypedOpenHypergraph.Monomorphism secondGraph hostGraph)
    (firstLegal :
      PresheafComplementDPO.Presheaf.LegalMatch firstRule
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizedMatch
          firstLeft firstMatching))
    (secondLegal :
      PresheafComplementDPO.Presheaf.LegalMatch secondRule
        (OpenHypergraphNormalizationFunctor.TypedOpenHypergraph.normalizedMatch
          secondLeft secondMatching))
    (independent :
      DPOConcurrency.ParallelIndependent
        (normalizedCanonicalDerivation
          firstLeft firstMatching firstLegal)
        (normalizedCanonicalDerivation
          secondLeft secondMatching secondLegal)) :
    Nonempty
        (AdhesiveDPOI.Derivation firstRule
          independent.firstResidualMatch) ∧
      Nonempty
        (AdhesiveDPOI.Derivation secondRule
          independent.secondResidualMatch) ∧
      ∃ resultIso :
          independent.firstAfterSecond.result ≅
            independent.secondAfterFirst.result,
        (independent.secondRightToFirstResidualContext ≫
            independent.firstAfterSecond.complementToResult) ≫
              resultIso.hom =
            independent.secondAfterFirst.rightToResult ∧
          independent.firstAfterSecond.rightToResult ≫ resultIso.hom =
            independent.firstRightToSecondResidualContext ≫
              independent.secondAfterFirst.complementToResult :=
  normalized_parallel_independent_concurrency
    firstLeft secondLeft firstMatching secondMatching
    firstLegal secondLegal independent

end Cantilune.Tests.OpenHypergraphNormalizationConcurrency
