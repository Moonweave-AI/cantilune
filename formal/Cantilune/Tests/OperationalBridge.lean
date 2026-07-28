import Cantilune.Pi.OperationalBridge
import Cantilune.Pi.Protocols

/-!
# Typed-kernel / standard-late bridge regression

The older executable relation remains intentionally permissive.  The
normative `Step.StandardNativeStep` relation packages the required nominal
certificate at construction time and therefore has an unconditional erasure
theorem.
-/

namespace Cantilune.Tests.OperationalBridge

open Cantilune.Pi
open Cantilune.Pi.Protocols

theorem mismatchCompatible :
    Step.StandardCompatible mismatch_decision_one_step :=
  Step.StandardCompatible.mismatchGuard (by decide)
    Step.StandardCompatible.prefixTau

theorem reconnectCompatible :
    Step.StandardCompatible reconnect_one_step := by
  exact Step.StandardCompatible.syncLeft delegation_substitution
    Step.StandardCompatible.prefixOutput
    Step.StandardCompatible.prefixInput
    (by decide)

theorem quiescentDeleteCompatible :
    Step.StandardCompatible quiescent_delete_one_step := by
  exact Step.StandardCompatible.syncLeft (by decide)
    Step.StandardCompatible.prefixOutput
    Step.StandardCompatible.prefixInput
    (by decide)

theorem mismatchLegal :
    Step.StandardNativeStep mismatchDecision .tau .zero :=
  Step.StandardNativeStep.ofCompatible mismatchCompatible

theorem reconnectLegal :
    Step.StandardNativeStep reconnectOffering .tau reconnectResult :=
  Step.StandardNativeStep.ofCompatible reconnectCompatible

theorem quiescentDeleteLegal :
    Step.StandardNativeStep
      quiescentDeleteOffering .tau quiescentDeleteResult :=
  Step.StandardNativeStep.ofCompatible quiescentDeleteCompatible

example :
    Late.NativeStep mismatchDecision.erase .tau .zero :=
  Step.erase_to_lateNative mismatchCompatible

example :
    Late.Step mismatchDecision.erase .tau .zero :=
  Step.erase_to_late mismatchCompatible

example :
    Late.NativeStep reconnectOffering.erase .tau reconnectResult.erase :=
  Step.erase_to_lateNative reconnectCompatible

example :
    Late.NativeStep
      quiescentDeleteOffering.erase .tau quiescentDeleteResult.erase :=
  Step.erase_to_lateNative quiescentDeleteCompatible

example :
    Late.NativeStep mismatchDecision.erase .tau .zero :=
  Step.standard_typed_pi_erasure_operational mismatchLegal

example :
    Late.NativeStep reconnectOffering.erase .tau reconnectResult.erase :=
  Step.StandardNativeStep.erase_operational reconnectLegal

example :
    Late.Step
      quiescentDeleteOffering.erase .tau quiescentDeleteResult.erase :=
  Step.StandardNativeStep.erase_structural quiescentDeleteLegal

end Cantilune.Tests.OperationalBridge
