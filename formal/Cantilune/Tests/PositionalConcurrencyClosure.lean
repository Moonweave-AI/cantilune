import Cantilune.Core.PositionalConcurrencyClosure

namespace Cantilune.Tests.PositionalConcurrencyClosure

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PositionalComplementClosure
open Cantilune.Core.PositionalPushoutClosure.CanonicalPositionalDPO
open Cantilune.Core.PositionalConcurrencyClosure
open Cantilune.Core.PositionalConcurrencyClosure.CanonicalConcurrency

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}

abbrev Graph :=
  PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes

variable {K₁ L₁ R₁ K₂ L₂ R₂ G : Graph}
variable
  (left₁ : K₁ ⟶ L₁) (right₁ : K₁ ⟶ R₁)
  (occurrence₁ : L₁ ⟶ G)
  (left₂ : K₂ ⟶ L₂) (right₂ : K₂ ⟶ R₂)
  (occurrence₂ : L₂ ⟶ G)
variable
  [Mono ((encodingFunctor σ inputTypes outputTypes).map left₁)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map right₁)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map occurrence₁)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map left₂)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map right₂)]
  [Mono ((encodingFunctor σ inputTypes outputTypes).map occurrence₂)]

example
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    Nonempty
        (PositionalDPOIBridge.FiniteWitnessType
          (toWitness independent.firstAfterSecond)
          (firstAfterSecondWitness_in_positionalImage
            left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
            legal₁ boundary₁ legal₂ boundary₂ independent)) ∧
      Nonempty
        (PositionalDPOIBridge.FiniteWitnessType
          (toWitness independent.secondAfterFirst)
          (secondAfterFirstWitness_in_positionalImage
            left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
            legal₁ boundary₁ legal₂ boundary₂ independent)) :=
  residual_finite_bridges_exist
    left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
    legal₁ boundary₁ legal₂ boundary₂ independent

end Cantilune.Tests.PositionalConcurrencyClosure
