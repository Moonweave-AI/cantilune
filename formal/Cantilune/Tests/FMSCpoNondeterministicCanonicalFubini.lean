import Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini

/-!
Regression surface for the canonical enriched-adjunction Fubini candidate
and its strict-constants commutativity obstruction.
-/

open CategoryTheory
open Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini

#check pairUnitCurried
#check leftStrengthCurried
#check leftStrength
#check fubiniGenerators
#check sequentialFubiniCurried
#check sequentialFubini
#check sequentialFubini_unit_pointwise
#check sequentialFubini_left_divergence
#check sequentialFubini_left_deadlock
#check sequentialFubini_left_choice
#check sequentialFubini_not_commutative
#check no_commutative_first_strict_pairing

#print axioms sequentialFubini_unit_pointwise
#print axioms sequentialFubini_not_commutative
#print axioms no_commutative_first_strict_pairing
