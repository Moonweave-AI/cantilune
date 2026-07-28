import Cantilune.Pi.FMSCpoFiniteStrictFreeBoundary

namespace Cantilune.Tests.FMSCpoFiniteStrictFreeBoundary

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoFiniteStrictFreeBoundary.FiniteStrictBoundary

#check strictFiniteObject
#check singletonGenerator
#check strictFiniteUniversalCandidate
#check no_constantDivergence_extension
#check strictFiniteUniversalCandidate_not_initial
#check strictFiniteUniversalCandidate_not_initial_of_nonempty
#check no_strictFinite_freeLift
#check no_strictFinite_freeLift_of_nonempty
#check emptyEqualitySource_solutionSet
#check emptyEqualitySourceUniversalArrow_isInitial

example :
    IsInitial (strictFiniteUniversalCandidate PUnit) → False :=
  strictFiniteUniversalCandidate_not_initial PUnit

example :
    IsInitial (strictFiniteUniversalCandidate Bool) → False :=
  strictFiniteUniversalCandidate_not_initial Bool

noncomputable def test_empty_initial :
    IsInitial emptyEqualitySourceUniversalArrow :=
  emptyEqualitySourceUniversalArrow_isInitial

#print axioms no_constantDivergence_extension
#print axioms strictFiniteUniversalCandidate_not_initial
#print axioms strictFiniteUniversalCandidate_not_initial_of_nonempty
#print axioms no_strictFinite_freeLift
#print axioms no_strictFinite_freeLift_of_nonempty
#print axioms emptyEqualitySourceUniversalArrow_isInitial

end Cantilune.Tests.FMSCpoFiniteStrictFreeBoundary
