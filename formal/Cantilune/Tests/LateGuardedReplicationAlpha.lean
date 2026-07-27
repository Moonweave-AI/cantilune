import Cantilune.Pi.LateGuardedReplicationAlpha

namespace Cantilune.Tests.LateGuardedReplicationAlpha

open Cantilune.Pi

private def swapOneTwo : Equiv.Perm Name :=
  Equiv.swap 1 2

private def server : RecursiveProc :=
  .repRecv 7 1 (.send 1 9 .zero)

example :
    RecursiveAlpha server
      (.repRecv 7 2 (.send 2 9 .zero)) := by
  apply RecursiveAlpha.repRecvBinder
  decide

example :
    RecursivePermutation.process swapOneTwo server =
      .repRecv 7 2 (.send 2 9 .zero) := by
  native_decide

example :
    RecursiveLate.NativeStep
      (.new 5 (.send 3 5 .zero))
      (.boundOutput 3 5)
      .zero := by
  exact RecursiveLate.NativeStep.open
    (by decide)
    RecursiveLate.NativeStep.prefixOutput

example :
    RecursiveLate.NativeStep
      (RecursivePermutation.process swapOneTwo
        (.new 5 (.send 3 5 .zero)))
      (RecursivePermutation.action swapOneTwo
        (.boundOutput 3 5))
      (RecursivePermutation.process swapOneTwo .zero) := by
  apply RecursiveLate.native_permute swapOneTwo
    (RecursiveLate.NativeStep.open
      (by decide)
      RecursiveLate.NativeStep.prefixOutput)
  apply RecursiveLate.PermutationStable.open (distinct := by decide)
  exact RecursiveLate.PermutationStable.prefixOutput

example :
    ∃ (permutation : Equiv.Perm Name)
      (processValue : RecursiveProc) (needle replacement : Name),
      RecursivePermutation.process permutation
          (processValue.substituteCaptureAvoiding needle replacement) ≠
        (RecursivePermutation.process permutation processValue
          |>.substituteCaptureAvoiding
            (permutation needle) (permutation replacement)) :=
  RecursivePermutation.substituteCaptureAvoiding_not_fully_equivariant

#print axioms Cantilune.Pi.RecursiveAlpha.equivalence
#print axioms Cantilune.Pi.RecursiveLate.native_permute
#print axioms
  Cantilune.Pi.RecursivePermutation.substituteCaptureAvoiding_not_fully_equivariant

end Cantilune.Tests.LateGuardedReplicationAlpha
