import Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet
import Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini

/-!
# Unconditional consequences of the all-source solution set

The global solution-set theorem removes the last hypothesis from the
existing enriched-adjunction construction.  It also turns the canonical
sequential-Fubini obstruction into an unconditional theorem about the
ordinary free monad selected by the adjoint functor theorem.

This is a positive enriched universal-property result together with a
precise negative coherence result:

* all free/forgetful hom equivalences are omega-continuous in both
  directions and natural in both variables;
* the canonical left-to-right sequential pairing is not symmetric;
* indeed no symmetric pairing can be strict for both divergence and
  deadlock in its first argument.

The last two theorems do not rule out Abramsky's actual powerdomain
construction, whose tensorial/Fubini structure must use the appropriate
category and laws.  They rule out this particular doubly-strict symmetric
shortcut.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicGlobalConsequences

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet
open Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction.NDωCPO
open Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini
open Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet

/-- The unconditional CPO-enriched free/forgetful adjunction. -/
def enrichedAdjunction :
    CpoEnrichedFreeForgetAdjunction
      Global.carrier_solutionSetCondition :=
  cpoEnrichedFreeForgetAdjunction
    Global.carrier_solutionSetCondition

/-- The canonical sequential pairing for the now-unconditional free monad. -/
def sequentialFubini
    (left right : ωCPO) :
    ContinuousHom
      (((ordinaryMonadOfSolutionSet
          Global.carrier_solutionSetCondition).obj left).carrier ×
        ((ordinaryMonadOfSolutionSet
          Global.carrier_solutionSetCondition).obj right).carrier)
      ((ordinaryMonadOfSolutionSet
          Global.carrier_solutionSetCondition).obj
        (explicitProduct left right)).carrier :=
  Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.sequentialFubini
    Global.carrier_solutionSetCondition left right

/-- The canonical sequential pairing is unconditionally noncommutative. -/
theorem sequentialFubini_not_commutative
    (object : ωCPO) :
    ¬
      (ContinuousHom.comp
          (sequentialFubini object object)
          (explicitSwap
            ((ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).obj object)
            ((ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).obj object)) =
        ContinuousHom.comp
          ((ordinaryMonadOfSolutionSet
            Global.carrier_solutionSetCondition).map
            (explicitSwap object object))
          (sequentialFubini object object)) :=
  Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.sequentialFubini_not_commutative
    Global.carrier_solutionSetCondition object

/--
No symmetric pairing on the unconditional free monad can preserve both
divergence and deadlock strictly in its first argument.
-/
theorem no_commutative_first_strict_pairing
    (object : ωCPO)
    (pairing :
      ContinuousHom
        (((ordinaryMonadOfSolutionSet
          Global.carrier_solutionSetCondition).obj object).carrier ×
          ((ordinaryMonadOfSolutionSet
            Global.carrier_solutionSetCondition).obj object).carrier)
        ((ordinaryMonadOfSolutionSet
          Global.carrier_solutionSetCondition).obj
          (explicitProduct object object)).carrier)
    (leftDivergence :
      ∀ rightValue,
        pairing
            (ordinaryDivergence
                Global.carrier_solutionSetCondition object,
              rightValue) =
          ordinaryDivergence
            Global.carrier_solutionSetCondition
            (explicitProduct object object))
    (leftDeadlock :
      ∀ rightValue,
        pairing
            (ordinaryDeadlock
                Global.carrier_solutionSetCondition object,
              rightValue) =
          ordinaryDeadlock
            Global.carrier_solutionSetCondition
            (explicitProduct object object))
    (commutes :
      ContinuousHom.comp pairing
          (explicitSwap
            ((ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).obj object)
            ((ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).obj object)) =
        ContinuousHom.comp
          ((ordinaryMonadOfSolutionSet
            Global.carrier_solutionSetCondition).map
            (explicitSwap object object))
          pairing) :
    False :=
  Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.no_commutative_first_strict_pairing
    Global.carrier_solutionSetCondition object pairing
    leftDivergence leftDeadlock commutes

end Cantilune.Pi.FMSCpoNondeterministicGlobalConsequences
