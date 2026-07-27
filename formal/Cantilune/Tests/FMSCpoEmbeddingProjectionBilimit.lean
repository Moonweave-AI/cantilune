import Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

/-!
Regression checks for the constructive embedding--projection and inverse-limit
foundation.  The test deliberately supplies no fixed-point witness.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

example (object : ωCPO) :
    CpoEmbeddingProjection object object :=
  CpoEmbeddingProjection.identity object

example
    (model : Cantilune.Pi.FMSModel.World ⥤ ωCPO) :
    ModelEmbeddingProjection model model :=
  ModelEmbeddingProjection.identity model

example :
    ModelEmbeddingProjection
      singletonWorldModel
      (Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualAgentFunctor.obj
        singletonWorldModel) :=
  singletonSeedPair

example (n : Nat) :
    ModelEmbeddingProjection
      (ConcreteActualIteration n)
      (ConcreteActualIteration (n + 1)) :=
  concreteActualIterationPair n

example (n : Nat) :
    concreteIterationLimitProjection (n + 1) ≫
        (concreteActualIterationPair n).projection =
      concreteIterationLimitProjection n :=
  concreteIterationLimitProjection_compatible n

example (n : Nat) :
    concreteIterationFold ≫
        concreteIterationLimitProjection n =
      concreteFoldConeLeg n :=
  concreteIterationFold_projection n

example (n : Nat) :
    concreteIterationLimitEmbedding n ≫
        concreteIterationLimitProjection n =
      𝟙 (ConcreteActualIteration n) :=
  concreteIterationLimitEmbedding_projection n

example
    (exhaustive : ConcreteBilimitExhaustivity) :
    ConcreteIterationFoldInverse :=
  exhaustive.toFoldInverse

example
    (exhaustive : ConcreteBilimitExhaustivity) :
    exhaustive.unfold ≫ concreteIterationFold =
      𝟙 concreteIterationLimit :=
  exhaustive.unfold_fold

example
    (exhaustive : ConcreteBilimitExhaustivity) :
    concreteIterationFold ≫ exhaustive.unfold =
      𝟙
        (Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualAgentFunctor.obj
          concreteIterationLimit) :=
  exhaustive.fold_unfold

example
    (exhaustive : ConcreteBilimitExhaustivity) :
    ConcreteFoldConeIsProjectionLimit :=
  exhaustive.foldConeIsProjectionLimit

example
    (exhaustive : ConcreteBilimitExhaustivity) :
    Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualFixedPointWitness :=
  concreteActualFixedPointWitnessOfExhaustivity exhaustive

example
    (preserved : ConcreteFoldConeIsProjectionLimit) :
    Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualFixedPointWitness :=
  concreteActualFixedPointWitnessOfProjectionLimit preserved

example :
    Nonempty ConcreteFoldConeIsProjectionLimit ↔
      IsIso concreteIterationFold :=
  concreteFoldConeProjectionLimit_iff_isIso

example
    (chain : CpoProjectionChain)
    (n : Nat) :
    chain.limitProjection (n + 1) ≫ chain.projection n =
      chain.limitProjection n :=
  chain.limitProjection_compatible n

example
    (chain : CpoProjectionChain)
    (source : ωCPO)
    (cone : chain.ContinuousCone source)
    (n : Nat) :
    cone.lift ≫ chain.limitProjection n = cone.leg n :=
  cone.lift_projection n

end Cantilune.Tests.FMSCpoEmbeddingProjectionBilimit
