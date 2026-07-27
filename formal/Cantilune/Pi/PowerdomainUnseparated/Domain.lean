import Cantilune.Pi.PowerdomainUnseparated.Fubini
import Cantilune.Pi.FMSCpoConcreteAlgebraicCompactness

/-!
# Concrete recursive domain solution for the unseparated route

The recursive endofunctor is the actual action functor followed by the
pointwise omega-Scott power functor.  The concrete embedding-projection
construction already supplies:

* a continuous natural isomorphism `A ≅ P(H A)`;
* an initial algebra;
* a terminal coalgebra.

This module exposes that inhabitant.  It does not postulate uniqueness of
arbitrary fixed-point witnesses, which does not follow from local continuity
alone.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

/-- The actual recursive functor `P ∘ H` used by the implementation. -/
abbrev DomainEquationFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  ActualAgentFunctor

abbrev DomainEquationSolution :=
  ActualFixedPointWitness

/-- Constructed, not postulated, solution of `A ≅ P(H A)`. -/
def concreteDomainEquationSolution :
    DomainEquationSolution :=
  concreteActualAlgebraicCompactnessWitness.fixed

/-- The continuous world-natural unfold direction. -/
def domainUnfoldIso :
    concreteDomainEquationSolution.agent ≅
      DomainEquationFunctor.obj
        concreteDomainEquationSolution.agent :=
  concreteDomainEquationSolution.unfoldIso

/-- The continuous world-natural fold direction. -/
def domainFoldIso :
    DomainEquationFunctor.obj
        concreteDomainEquationSolution.agent ≅
      concreteDomainEquationSolution.agent :=
  domainUnfoldIso.symm

theorem domain_unfold_fold
    (world : World)
    (value : concreteDomainEquationSolution.agent.obj world) :
    (domainFoldIso.app world).hom
        ((domainUnfoldIso.app world).hom value) =
      value :=
  concreteDomainEquationSolution.unfold_fold world value

theorem domain_fold_unfold
    (world : World)
    (value :
      (DomainEquationFunctor.obj
        concreteDomainEquationSolution.agent).obj world) :
    (domainUnfoldIso.app world).hom
        ((domainFoldIso.app world).hom value) =
      value :=
  concreteDomainEquationSolution.fold_unfold world value

theorem domain_unfold_natural
    {source target : World}
    (injection : source ⟶ target) :
    concreteDomainEquationSolution.agent.map injection ≫
        (domainUnfoldIso.app target).hom =
      (domainUnfoldIso.app source).hom ≫
        (DomainEquationFunctor.obj
          concreteDomainEquationSolution.agent).map injection :=
  concreteDomainEquationSolution.unfold_world_natural injection

theorem domain_fold_natural
    {source target : World}
    (injection : source ⟶ target) :
    (DomainEquationFunctor.obj
        concreteDomainEquationSolution.agent).map injection ≫
        (domainFoldIso.app target).hom =
      (domainFoldIso.app source).hom ≫
        concreteDomainEquationSolution.agent.map injection :=
  concreteDomainEquationSolution.fold_world_natural injection

theorem domain_functor_locally_continuous :
    EndofunctorLocallyContinuous DomainEquationFunctor :=
  actualAgentFunctor_locallyContinuous

/-- Full concrete initial-algebra/terminal-coalgebra witness. -/
def concreteDomainAlgebraicCompactness :
    ActualAlgebraicCompactnessWitness :=
  concreteActualAlgebraicCompactnessWitness

def domain_initial_algebra :
    IsInitial concreteDomainEquationSolution.algebra :=
  concreteDomainAlgebraicCompactness.initialAlgebra

def domain_terminal_coalgebra :
    IsTerminal concreteDomainEquationSolution.coalgebra :=
  concreteDomainAlgebraicCompactness.terminalCoalgebra

theorem domain_initial_fold_isIso :
    IsIso concreteDomainEquationSolution.algebra.str :=
  concreteActual_initial_fold_isIso

theorem domain_terminal_unfold_isIso :
    IsIso concreteDomainEquationSolution.coalgebra.str :=
  concreteActual_terminal_unfold_isIso

/--
The implemented `ActualAgentFunctor` has the concrete fixed point and both
universal properties. No general or source-FMS completeness is claimed.
-/
theorem concrete_actual_agent_equation_inhabited :
    Nonempty ActualAlgebraicCompactnessWitness :=
  ⟨concreteDomainAlgebraicCompactness⟩

end Cantilune.Pi.PowerdomainUnseparated
