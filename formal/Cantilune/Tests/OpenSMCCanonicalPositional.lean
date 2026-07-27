import Cantilune.Pi.OpenSMCCanonicalPositional

/-!
# Regression checks for the experimental canonical-position Open-pi layer
-/

namespace Cantilune.Tests.OpenSMCCanonicalPositional

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.OpenSMCCanonicalPositional

#check canonicalName_injective
#check positionName_injective
#check realizeAt_sorts
#check realizeAt_fresh
#check realizationRenaming
#check realizationRenaming_roundtrip_on_support
#check canonicalSortedFreshBoundarySupply
#check totalNamedTensor
#check totalNamedTensor_sorts
#check canonical_positional_mathlib_smc
#check singletonChannel_identity_nonempty
#check no_fixedNativeIdentityRealizer
#check singletonChannel_self_tensor_realization_nodup
#check plugHide_identity_left
#check plugHide_assoc
#check parallel_plugHide_interchange
#check hideBoundary_native
#check plugProcess_syncLeft_native
#check freshPlugProcess_syncLeft_native
#check plugProcess_closeLeft_native

theorem concrete_fresh_channel_realization :
    Disjoint
      (freshRealization {0, 1, 2, 3} singletonChannel).names
      ({0, 1, 2, 3} : Finset Name) :=
  freshRealization_disjoint _ _

def producer : Raw.Proc :=
  .send 8 11 .zero

def consumer : Raw.Proc :=
  .recv 8 12 (.send 9 12 .zero)

/--
Exact one-step communication while an unrelated canonical nonempty boundary
is restricted.  The communicating raw channel is `8`, whereas the realized
middle port at offset `20` is `40`; this intentionally tests propagation
only and is not a plug-adequacy witness.
-/
theorem concrete_nonempty_positional_plug :
    Late.NativeStep
      (plugProcess 20 singletonChannel producer consumer)
      .tau
      (hideBoundary 20 singletonChannel
        (.par .zero
          ((Raw.Proc.send 9 12 .zero).substituteCaptureAvoiding
            12 11))) := by
  apply plugProcess_syncLeft_native
  · exact Late.NativeStep.prefixOutput
  · exact Late.NativeStep.prefixInput
  · simp [Raw.Proc.freeNames]

/--
The experimental representation is a real SMC instance, not a record whose
fields merely restate equations.
-/
example : SymmetricCategory Object := inferInstance

end Cantilune.Tests.OpenSMCCanonicalPositional
