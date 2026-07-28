import Cantilune.Pi.FMSCpoConcreteInitialAlgebra
import Cantilune.Pi.FMSCpoConcreteTerminalCoalgebra

/-!
# Algebraic compactness of the concrete unseparated FMS endofunctor

The concrete finite-approximation tower supplies both universal halves:

* `concreteActualInitialAlgebra` is initial among every algebra of
  `ActualAgentFunctor`; and
* `concreteActualTerminalCoalgebra` is terminal among every coalgebra of the
  same functor.

This module packages those independently proved universal properties with
the existing continuous-natural fixed-point isomorphism.

The result concerns the implemented **unseparated lower omega-Scott**
endofunctor.  It does not identify that endofunctor with a separated
Abramsky/FMS powerdomain, nor does it prove general algebraic compactness of
all locally continuous endofunctors on all omega-CPOs.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary

/--
The actual algebraic-compactness witness for the concretely implemented
unseparated recursive endofunctor.
-/
def concreteActualAlgebraicCompactnessWitness :
    ActualAlgebraicCompactnessWitness where
  fixed := concreteActualFixedPointWitness
  initialAlgebra := InitialAlgebra.concreteActualInitialAlgebra
  terminalCoalgebra := concreteActualTerminalCoalgebra

/-- The concrete fold structure map is an isomorphism by initiality. -/
theorem concreteActual_initial_fold_isIso :
    IsIso concreteActualAlgebraicCompactnessWitness.fixed.algebra.str :=
  concreteActualAlgebraicCompactnessWitness.initial_fold_isIso

/-- The concrete unfold structure map is an isomorphism by terminality. -/
theorem concreteActual_terminal_unfold_isIso :
    IsIso concreteActualAlgebraicCompactnessWitness.fixed.coalgebra.str :=
  concreteActualAlgebraicCompactnessWitness.terminal_unfold_isIso

end Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
