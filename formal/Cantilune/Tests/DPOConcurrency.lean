import Cantilune.Core.DPOConcurrency
import Cantilune.Tests.PresheafComplementDPO

/-!
# Standard DPO concurrency regression checks

The identity instance is intentionally small, but it elaborates the complete
generic construction: factorisation-only parallel independence, both joint
context decompositions, both residual derivations, and the final canonical
isomorphism.
-/

namespace Cantilune.Tests.DPOConcurrency

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Core
open Cantilune.Core.AdhesiveDPOI
open Cantilune.Core.DPOConcurrency
open Cantilune.Tests.PresheafComplementDPO

def identityDerivation :
    Derivation identityRule identityMatch where
  complement := G
  result := G
  interfaceToComplement := 𝟙 G
  complementToHost := 𝟙 G
  rightToResult := 𝟙 G
  complementToResult := 𝟙 G
  complementSquare := IsPushout.of_id_snd
  resultSquare := IsPushout.of_id_snd

def identityIndependent :
    ParallelIndependent identityDerivation identityDerivation where
  firstThroughSecondContext := 𝟙 G
  secondThroughFirstContext := 𝟙 G
  first_factor := by
    change (𝟙 G) ≫ 𝟙 G = 𝟙 G
    simp
  second_factor := by
    change (𝟙 G) ≫ 𝟙 G = 𝟙 G
    simp

example :
    IsPushout
      identityRule.leftLeg
      identityIndependent.firstInterfaceToJoint
      identityIndependent.firstThroughSecondContext
      identityIndependent.jointToSecond :=
  identityIndependent.first_context_decomposition

example :
    IsPushout
      identityRule.leftLeg
      identityIndependent.secondInterfaceToJoint
      identityIndependent.secondThroughFirstContext
      identityIndependent.jointToFirst :=
  identityIndependent.second_context_decomposition

noncomputable example :
    Derivation identityRule identityIndependent.firstResidualMatch :=
  identityIndependent.firstAfterSecond

noncomputable example :
    Derivation identityRule identityIndependent.secondResidualMatch :=
  identityIndependent.secondAfterFirst

noncomputable example :
    identityIndependent.firstAfterSecond.result ≅
      identityIndependent.secondAfterFirst.result :=
  identityIndependent.concurrencyIso

end Cantilune.Tests.DPOConcurrency
