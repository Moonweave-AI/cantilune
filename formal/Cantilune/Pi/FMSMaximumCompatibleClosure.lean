import Cantilune.Pi.FMSCpoNondeterministicGlobalConsequences
import Cantilune.Pi.FMSConcreteD1AAcceptance

/-!
# Kernel boundary of the two FMS powerdomain branches

The formal development contains two independently constructed branches.

* The separated pointed-continuous-semilattice branch has an all-source
  `SolutionSetCondition`, an ordinary free/forgetful adjunction, and the
  CPO-enriched hom equivalence.  Its canonical sequential Fubini map is not
  symmetric; more strongly, a symmetric pairing cannot be strict for both
  separated nullary constants.
* The ratified D1-A branch identifies the two nullary effects.  Its concrete
  lower omega-Scott monad has the symmetric Fubini/monad coherence, the
  continuous-natural recursive-domain solution, recursive hiding, and the
  finite/guarded Hoare theorem layer.

The no-argument package below is a branch ledger, not a single semantic
model.  It records both positive constructions and the kernel no-go between
them.  It prevents a final aggregation from silently combining separation
from the first branch with symmetric strict Fubini from the second branch.
-/

noncomputable section

namespace Cantilune.Pi.FMSMaximumCompatibleClosure

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicGlobalConsequences
open Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction.NDωCPO
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSConcreteD1AAcceptance

/-! ## The separated branch and its exact obstruction -/

/-- The all-source solution-set theorem is an actual kernel theorem. -/
theorem separated_all_source_solution_set :
    SolutionSetCondition.{0} SolutionSet.carrierFunctor :=
  Global.carrier_solutionSetCondition

/-- The corresponding free/forgetful hom equivalence is CPO-enriched. -/
def separated_enriched_adjunction :
    CpoEnrichedFreeForgetAdjunction
        Global.carrier_solutionSetCondition :=
  enrichedAdjunction

/--
The canonical sequential Fubini of the separated free monad is not
commutative.  This obstruction motivates the selected D1-A branch; by itself
it does not prove that D1-A is the unique possible alternative construction.
-/
theorem separated_sequential_fubini_not_commutative
    (object : ωCPO) :
    ¬
      (ContinuousHom.comp
          (sequentialFubini object object)
          (Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.explicitSwap
            ((SolutionSet.ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).obj object)
            ((SolutionSet.ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).obj object)) =
        ContinuousHom.comp
          ((SolutionSet.ordinaryMonadOfSolutionSet
            Global.carrier_solutionSetCondition).map
            (Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.explicitSwap
              object object))
          (sequentialFubini object object)) :=
  Cantilune.Pi.FMSCpoNondeterministicGlobalConsequences.sequentialFubini_not_commutative
    object

/-! ## The ratified unseparated branch -/

/-- The two nullary effects are definitionally the same lower computation. -/
theorem d1a_nullary_effect_is_unseparated
    (object : ωCPO) :
    effectDivergence object = effectDeadlock object :=
  effectDivergence_eq_effectDeadlock object

/-- The concrete D1-A power/domain package, with no supplied theorem fields. -/
abbrev d1aCore : SourceAlignedUnseparatedCore :=
  concreteSourceAlignedUnseparatedCore

/-- Its domain equation is the constructed continuous-natural isomorphism. -/
abbrev d1aDomainIso :
    d1aCore.domainCompactness.fixed.agent ≅
      ActualAgentFunctor.obj d1aCore.domainCompactness.fixed.agent :=
  d1aCore.unfoldIso

/-- Its fold algebra is genuinely initial. -/
def d1aFoldInitial :
    CategoryTheory.Limits.IsInitial
      d1aCore.domainCompactness.fixed.algebra :=
  d1aCore.foldIsInitial

/-- Its unfold coalgebra is genuinely terminal. -/
def d1aUnfoldTerminal :
    CategoryTheory.Limits.IsTerminal
      d1aCore.domainCompactness.fixed.coalgebra :=
  d1aCore.unfoldIsTerminal

/-- Hiding is the recursively constructed Table-4 transformation. -/
abbrev d1aHiding : ShiftAgent ⟶ Agent :=
  agentRestriction

/-- The actual recursive hiding square commutes. -/
theorem d1a_hiding_unroll :
    restrictionCoalgebra.str ≫
        ActualAgentFunctor.map d1aHiding =
      d1aHiding ≫ agentUnfold :=
  agentRestriction_unroll

/-- The accepted finite/guarded operational theorem layer is concrete. -/
abbrev d1aOperationalAcceptance : ConcreteAcceptance :=
  concreteAcceptance

/-- The optional claim that one syntax defines every element of every CPO is false. -/
theorem all_omega_cpo_definability_no_go :
    ¬ FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable :=
  concreteAcceptance_all_domain_no_go

/-! ## One no-argument maximum-compatible package -/

/--
The fields are deliberately construction identities, not Boolean completion
flags.  A consumer can recover every universal property from the stored
objects and the theorems above.
-/
structure MaximumCompatibleFMS where
  separatedSolution :
    SolutionSetCondition.{0} SolutionSet.carrierFunctor
  separatedEnriched :
    CpoEnrichedFreeForgetAdjunction separatedSolution
  unseparatedCore : SourceAlignedUnseparatedCore
  unseparatedCore_eq :
    unseparatedCore = concreteSourceAlignedUnseparatedCore
  hidingMap : ShiftAgent ⟶ Agent
  hidingMap_eq : hidingMap = agentRestriction
  operational : ConcreteAcceptance
  operational_eq : operational = concreteAcceptance

/--
The fixed kernel-built ledger of the two maximum-compatible branch results.
Its fields must not be interpreted as operations of one combined model.
-/
def maximumCompatibleFMS : MaximumCompatibleFMS where
  separatedSolution := separated_all_source_solution_set
  separatedEnriched := separated_enriched_adjunction
  unseparatedCore := d1aCore
  unseparatedCore_eq := rfl
  hidingMap := d1aHiding
  hidingMap_eq := rfl
  operational := d1aOperationalAcceptance
  operational_eq := rfl

end Cantilune.Pi.FMSMaximumCompatibleClosure
