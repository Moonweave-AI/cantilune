import Cantilune.Pi.FMSCpoConcreteTerminalCoalgebra

noncomputable section

namespace Cantilune.Tests.FMSCpoConcreteTerminalCoalgebra

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

example :
    IsTerminal concreteActualFixedPointWitness.coalgebra :=
  concreteActualTerminalCoalgebra

example
    (source : Coalgebra ActualAgentFunctor) :
    source ⟶ concreteActualFixedPointWitness.coalgebra := by
  rw [← concreteActualCoalgebra_eq_fixedPoint]
  exact concreteCoalgebraToTerminal source

example
    (source : Coalgebra ActualAgentFunctor)
    (candidate :
      source ⟶ concreteActualCoalgebra) :
    candidate = concreteCoalgebraToTerminal source :=
  concreteCoalgebraToTerminal_unique source candidate

#print axioms concreteCoalgebraToTerminal
#print axioms concreteActualTerminalCoalgebra

end Cantilune.Tests.FMSCpoConcreteTerminalCoalgebra
