import Cantilune.Pi.LateGuardedReplicationAlphaFreshChoice

namespace Cantilune.Tests.LateGuardedReplicationAlphaFreshChoice

open Cantilune.Pi

#check RecursivePermutation.process_eq_self_of_allNames_fixed
#check RecursivePermutation.process_swap_fresh_alpha_substRaw
#check RecursivePermutation.process_swap_renameBound
#check RecursivePermutation.substituteCaptureAvoidingAux_permute_alpha
#check RecursivePermutation.substituteCaptureAvoiding_permute_alpha
#check RecursiveAlpha.substRaw_fresh_congr
#check RecursiveAlpha.freeNames_eq
#check RecursivePermutation.substituteAux_freshChoice_to_common
#check RecursiveLate.embedded_native_permute_up_to_alpha
#check RecursiveLate.native_permute_up_to_alpha
#check RecursiveAlphaOperational.alphaNativeStep_permute_all
#print axioms RecursivePermutation.substituteCaptureAvoiding_permute_alpha
#print axioms RecursiveLate.native_permute_up_to_alpha

private def captureBody : RecursiveProc :=
  .new 1 (.send 0 1 .zero)

theorem numeric_freshening_is_permutation_equivariant_up_to_alpha :
    RecursiveAlpha
      (RecursivePermutation.process (Equiv.swap 0 10)
        (captureBody.substituteCaptureAvoiding 0 1))
      (RecursiveProc.substituteCaptureAvoiding
        (RecursivePermutation.process (Equiv.swap 0 10) captureBody)
        ((Equiv.swap 0 10) 0) ((Equiv.swap 0 10) 1)) := by
  exact
    RecursivePermutation.substituteCaptureAvoiding_permute_alpha
      (Equiv.swap 0 10) captureBody 0 1

end Cantilune.Tests.LateGuardedReplicationAlphaFreshChoice
