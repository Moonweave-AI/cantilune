import Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet

/-!
Kernel-audit smoke tests for the all-source solution-set theorem.
-/

open CategoryTheory
open Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet

#check Global.Index
#check Global.carrier_solutionSetCondition
#check Global.carrier_isRightAdjoint
#check Global.freeFunctor
#check Global.freeAdjunction
#check Global.ordinaryMonad

#print axioms GeneratedPresentation.factorization
#print axioms Global.source_solutionSet
#print axioms Global.carrier_solutionSetCondition
#print axioms Global.carrier_isRightAdjoint
#print axioms Global.freeAdjunction
