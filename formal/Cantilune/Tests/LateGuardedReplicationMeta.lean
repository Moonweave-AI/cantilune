import Cantilune.Pi.LateGuardedReplicationMeta

namespace Cantilune.Tests.LateGuardedReplicationMeta

open Cantilune.Pi

example :
    RecursiveLate.NativeStep
        (RecursiveProc.ofRaw (.tau .zero))
        .tau
        (RecursiveProc.ofRaw .zero) ↔
      Late.NativeStep (.tau .zero) .tau .zero :=
  RecursiveLate.ofRaw_native_iff

example :
    (RecursiveProc.repRecv 2 9
      (.send 9 4 .zero)).captureRisk 4 17 = false := by
  apply RecursiveProc.captureRisk_eq_false_of_replacement_fresh
  simp [RecursiveProc.allNames]

example :
    (RecursiveProc.repRecv 2 9
      (.send 9 4 .zero)).captureRisk
        4
        ((RecursiveProc.repRecv 2 9
          (.send 9 4 .zero)).freshName 4 17) =
      false :=
  RecursiveProc.captureRisk_freshName_eq_false _ _ _

#print axioms Cantilune.Pi.RecursiveLate.native_source_conservative
#print axioms Cantilune.Pi.RecursiveLate.ofRaw_native_iff
#print axioms
  Cantilune.Pi.RecursiveProc.captureRisk_eq_false_of_replacement_fresh

end Cantilune.Tests.LateGuardedReplicationMeta
