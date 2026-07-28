import Cantilune.Pi.FMSCpoSupportedParallelRestriction

/-!
Kernel regression checks for the genuine supported parallel/restriction
layers and their explicitly proved boundary.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoSupportedParallelRestriction

open Cantilune.Pi
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSOperationalSyntaxBridge
open Cantilune.Pi.FMSCpoSupportedParallelRestriction

example (world : Nat) (channel value : Fin world) :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (.parallel
          (.output (.free channel) (.free value) .zero)
          (.input (.free channel) .zero)))
      .tau
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        ((.parallel .zero .zero) : SupportedProc world 0)) :=
  canonical_parallel_sync_native world channel value

example (world : Nat) (channel : Fin world) :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (.restrict
          (.output (.free channel) (.bound (Fin.last 0)) .zero) :
            SupportedProc world 0))
      (.boundOutput channel.val world)
      .zero :=
  canonical_restriction_extrusion_native world channel

example (world : Nat) (channel value : Fin world) :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (.parallel
          (.parallel
            (.output (.free channel) (.free value) .zero)
            .zero)
          .zero))
      (.output channel.val value.val)
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        ((.parallel
          (.parallel .zero .zero)
          .zero) : SupportedProc world 0)) :=
  nested_parallel_left_output_native world channel value

example : ¬ ConservativeOneStepNestedComplete :=
  no_conservative_one_step_nested_completeness

#check supportedParallelAgent_unfold
#check supportedRestrictionOneStepAgent_unfold
#check supportedRecursiveRestriction_coalgebra_commutes
#check canonical_parallel_output_input_layer
#check canonical_restriction_visible_output_layer

#print axioms supportedParallelAgent_unfold
#print axioms supportedRestrictionOneStepAgent_unfold
#print axioms supportedRecursiveRestriction_coalgebra_commutes
#print axioms canonical_parallel_sync_native
#print axioms canonical_restriction_visible_output_native
#print axioms no_conservative_one_step_nested_completeness

end Cantilune.Tests.FMSCpoSupportedParallelRestriction
