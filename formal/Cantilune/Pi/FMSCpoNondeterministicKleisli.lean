import Cantilune.Pi.FMSCpoNondeterministicSolutionSet

/-!
# Kleisli coherence forced by the ordinary free NDωCPO adjunction

Once a genuine global solution set has produced the ordinary free/forgetful
adjunction, its universal property already forces the Kleisli extension to
be the unique strict semilattice extension.  This file proves that fact and
constructs the existing `KleisliPowerdomainCoherence` record.

The result remains conditional on the actual global
`SolutionSetCondition`.  A Fubini witness is needed only because the current
`CpoPowerdomainPackage` bundles Fubini data; none of the proofs below use it.
No enriched continuity, Fubini associativity, recursive domain solution, or
full-abstraction theorem is asserted.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicKleisli

open CategoryTheory
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet

/-- The monadic Kleisli extension of a generator. -/
def ordinaryKleisliExtension
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    (ordinaryMonadOfSolutionSet solution).obj source ⟶
      (ordinaryMonadOfSolutionSet solution).obj target :=
  (ordinaryMonadOfSolutionSet solution).map generator ≫
    (ordinaryMonadOfSolutionSet solution).μ.app target

/-- The Kleisli extension restricts to its generator along the unit. -/
theorem ordinaryKleisliExtension_unit
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    (ordinaryMonadOfSolutionSet solution).η.app source ≫
        ordinaryKleisliExtension solution generator =
      generator := by
  change
    (ordinaryMonadOfSolutionSet solution).η.app source ≫
        (ordinaryMonadOfSolutionSet solution).map generator ≫
          (ordinaryMonadOfSolutionSet solution).μ.app target =
      generator
  rw [← Category.assoc,
    ← (ordinaryMonadOfSolutionSet solution).η.naturality generator,
    Category.assoc,
    (ordinaryMonadOfSolutionSet solution).left_unit]
  simp

/-- The Kleisli extension preserves the distinguished divergence. -/
theorem ordinaryKleisliExtension_divergence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    ordinaryKleisliExtension solution generator
        (ordinaryDivergence solution source) =
      ordinaryDivergence solution target := by
  change
    (ordinaryMonadOfSolutionSet solution).μ.app target
        ((ordinaryMonadOfSolutionSet solution).map generator
          (ordinaryDivergence solution source)) =
      ordinaryDivergence solution target
  rw [ordinaryMap_divergence, ordinaryMultiplication_divergence]

/-- The Kleisli extension preserves deadlock. -/
theorem ordinaryKleisliExtension_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    ordinaryKleisliExtension solution generator
        (ordinaryDeadlock solution source) =
      ordinaryDeadlock solution target := by
  change
    (ordinaryMonadOfSolutionSet solution).μ.app target
        ((ordinaryMonadOfSolutionSet solution).map generator
          (ordinaryDeadlock solution source)) =
      ordinaryDeadlock solution target
  rw [ordinaryMap_deadlock, ordinaryMultiplication_deadlock]

/-- The Kleisli extension preserves binary nondeterministic choice. -/
theorem ordinaryKleisliExtension_choice
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target)
    (left right : (ordinaryMonadOfSolutionSet solution).obj source) :
    ordinaryKleisliExtension solution generator
        (ordinaryChoice solution source (left, right)) =
      ordinaryChoice solution target
        (ordinaryKleisliExtension solution generator left,
          ordinaryKleisliExtension solution generator right) := by
  change
    (ordinaryMonadOfSolutionSet solution).μ.app target
        ((ordinaryMonadOfSolutionSet solution).map generator
          (ordinaryChoice solution source (left, right))) =
      ordinaryChoice solution target
        ((ordinaryMonadOfSolutionSet solution).μ.app target
            ((ordinaryMonadOfSolutionSet solution).map generator left),
          (ordinaryMonadOfSolutionSet solution).μ.app target
            ((ordinaryMonadOfSolutionSet solution).map generator right))
  rw [ordinaryMap_choice, ordinaryMultiplication_choice]

/--
The ordinary free extension into a free algebra is exactly monadic Kleisli
extension.  This is derived from the universal property, not stored as a new
assumption.
-/
theorem ordinaryFreeLift_free
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source target : ωCPO)
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    ordinaryFreeLift solution source
        ((freeFunctorOfSolutionSet solution).obj target).computation
        generator =
      ordinaryKleisliExtension solution generator := by
  symm
  apply ordinaryFreeLift_unique solution source
  · exact ordinaryKleisliExtension_unit solution generator
  · exact ordinaryKleisliExtension_divergence solution generator
  · exact ordinaryKleisliExtension_deadlock solution generator
  · exact ordinaryKleisliExtension_choice solution generator

/--
Every solution-set powerdomain package satisfies the currently enumerated
Kleisli coherence laws.  The Fubini witness is carried solely to select the
package value required by the record's type.
-/
theorem ordinaryKleisliPowerdomainCoherence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (fubini : OrdinaryFubiniWitness solution) :
    KleisliPowerdomainCoherence
      (powerdomainPackageOfSolutionSet solution fubini) where
  freeLift_free := ordinaryFreeLift_free solution
  multiplication_empty := ordinaryMultiplication_deadlock solution
  multiplication_choice := ordinaryMultiplication_choice solution

end Cantilune.Pi.FMSCpoNondeterministicKleisli
