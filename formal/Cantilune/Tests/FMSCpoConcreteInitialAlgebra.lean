import Cantilune.Pi.FMSCpoConcreteInitialAlgebra

noncomputable section

namespace Cantilune.Tests.FMSCpoConcreteInitialAlgebra

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit.InitialAlgebra

#check emptyWorldModelIsInitial
#check actualEmptyTailIso
#check actualEmptyTailIso_inv_map_emptyTo_singleton
#check algebraEmbeddingCocone
#check algebraMediator_hom
#check concreteInitialAlgebraTo
#check concreteInitialAlgebraTo_unique
#check concreteActualInitialAlgebra

example
    (target : Algebra ActualAgentFunctor) :
    concreteFoldAlgebra.Hom target :=
  concreteInitialAlgebraTo target

example
    (target : Algebra ActualAgentFunctor)
    (hom :
      concreteFoldAlgebra.Hom target) :
    hom = concreteInitialAlgebraTo target :=
  concreteInitialAlgebraTo_unique target hom

#print axioms actualEmptyTailIso
#print axioms algebraMediator_hom
#print axioms concreteActualInitialAlgebra

end Cantilune.Tests.FMSCpoConcreteInitialAlgebra
