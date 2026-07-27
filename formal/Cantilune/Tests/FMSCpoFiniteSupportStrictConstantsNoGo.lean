import Cantilune.Pi.FMSCpoFiniteSupportStrictConstantsNoGo

/-!
# Empty-support separated strict-constants regression

These checks instantiate the theorem on a concrete equality-ordered
omega-CPO with two distinct, empty-supported constants.  They test the exact
conditional no-go surface and do not assert that an impossible pairing
exists.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoFiniteSupportStrictConstantsNoGo

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated
open Cantilune.Pi.FMSCpoFiniteSupportStrictConstantsNoGo

/-- Two distinct computations, both carrying empty finite support. -/
def twoEmptyComputations :
    SupportedOmegaCpo (Fin 1) where
  Carrier := EqualityOrder Bool
  omega := inferInstance
  support := fun _ => ∅
  support_mono := by
    intro first second ordered
    exact Finset.Subset.rfl
  support_omegaSup_bounded := by
    intro chain
    exact ⟨0, Finset.Subset.rfl⟩

def twoEmptyConstants :
    EmptySupportConstants twoEmptyComputations where
  divergence := false
  deadlock := true
  divergence_support := rfl
  deadlock_support := rfl

theorem concrete_constants_distinct :
    twoEmptyConstants.divergence ≠
      twoEmptyConstants.deadlock := by
  change false ≠ true
  decide

theorem concrete_mixed_point_is_separated :
    Disjoint
      (twoEmptyComputations.support
        twoEmptyConstants.divergence)
      (twoEmptyComputations.support
        twoEmptyConstants.deadlock) := by
  simp [twoEmptyComputations, twoEmptyConstants]

theorem concrete_braiding_exchanges_mixed_point :
    braidingContinuous
        twoEmptyComputations twoEmptyComputations
        (twoEmptyConstants.leftDivergence
          twoEmptyConstants.deadlock) =
      twoEmptyConstants.leftDeadlock
        twoEmptyConstants.divergence :=
  twoEmptyConstants.braiding_leftDivergence_deadlock

example
    (candidate :
      SymmetricFirstStrictPairing
        twoEmptyComputations
        twoEmptyComputations
        twoEmptyConstants
        twoEmptyConstants) :
    False :=
  no_symmetric_first_strict_pairing_of_distinct_constants
    concrete_constants_distinct candidate

-- The cartesian theorem remains visible as the unseparated analogue.
#check
  Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.no_commutative_first_strict_pairing

#check ResourceLevel.empty_supported_constants_compose
#check symmetric_first_strict_pairing_collapses
#check symmetric_first_strict_pairing_collapses_reverse
#check no_symmetric_first_strict_pairing_of_distinct_constants

#print axioms ResourceLevel.empty_supported_constants_compose
#print axioms symmetric_first_strict_pairing_collapses
#print axioms symmetric_first_strict_pairing_collapses_reverse
#print axioms no_symmetric_first_strict_pairing_of_distinct_constants

end Cantilune.Tests.FMSCpoFiniteSupportStrictConstantsNoGo
