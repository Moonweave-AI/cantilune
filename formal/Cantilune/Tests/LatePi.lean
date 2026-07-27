import Cantilune.Pi.LateAlphaSupport

/-! Regression examples for the finite-control standard late pi layer. -/

namespace Cantilune.Tests.LatePi

open Cantilune.Pi
open Cantilune.Pi.Late

def captureExample : Raw.Proc :=
  .recv 7 4 (.send 8 3 .zero)

example :
    captureExample.captureRisk 3 4 = true := by
  native_decide

example :
    captureExample.substituteCaptureAvoiding 3 4 =
      .recv 7 9 (.send 8 4 .zero) := by
  native_decide

example :
    (captureExample.freshName 3 4) ∉ captureExample.allNames :=
  Raw.Proc.freshName_not_mem_allNames _ _ _

example :
    Late.Alpha
      (.new 3 (.send 8 3 .zero))
      (.new 9 (.send 8 9 .zero)) := by
  apply Late.Alpha.newBinder
  native_decide

example :
    Late.Alpha
      (.recv 7 3 (.send 8 3 .zero))
      (.recv 7 9 (.send 8 9 .zero)) := by
  apply Late.Alpha.recvBinder
  native_decide

example (left right : Raw.Proc) :
    Late.Struct (.par left right) (.par right left) :=
  Late.Struct.parComm

example (left right : Raw.Proc) (fresh : 5 ∉ left.freeNames) :
    Late.Struct
      (.new 5 (.par left right))
      (.par left (.new 5 right)) :=
  Late.Struct.scopeExtrude fresh

def sender : Raw.Proc := .send 1 2 .zero
def receiver : Raw.Proc := .recv 1 3 (.send 4 3 .zero)

example :
    Late.NativeStep
      (.par sender receiver)
      .tau
      (.par .zero (.send 4 2 .zero)) := by
  apply Late.NativeStep.syncLeft
    Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
  simp [Raw.Proc.freeNames]

example :
    Late.NativeStep
      (.new 2 (.send 1 2 .zero))
      (.boundOutput 1 2)
      .zero := by
  exact Late.NativeStep.open (by decide) Late.NativeStep.prefixOutput

example :
    Late.NativeStep
      (.matchNe 3 4 (.tau .zero))
      .tau
      .zero := by
  exact
    Late.NativeStep.mismatchGuard (by decide) Late.NativeStep.prefixTau

example :
    Late.Step
      (.par (.tau .zero) .zero)
      .tau
      .zero := by
  exact Late.Step.congr
    Late.Struct.parZero
    Late.NativeStep.prefixTau
    (Late.Struct.refl .zero)

example :
    Late.Step
      (.par .zero (.tau .zero))
      .tau
      (.par .zero .zero) := by
  apply Late.Step.structural_closure
    Late.Struct.parComm
    (Late.Step.congr Late.Struct.parZero Late.NativeStep.prefixTau
      (Late.Struct.refl .zero))
    (Late.Struct.symm Late.Struct.parZero)

example
    {process next : Proc} {action : Action}
    (step : Cantilune.Pi.Step process action next) :
    Raw.Step process.erase action.erase next.erase :=
  Late.typed_kernel_erasure_operational step

example {source target : Raw.Proc} {action : Raw.Action}
    (step : Late.Step source action target) :
    target.prefixCount < source.prefixCount :=
  step.target_prefixCount_lt

example {source target : Raw.Proc} {action : Raw.Action}
    (empty : source.prefixCount = 0) :
    ¬ Late.Step source action target :=
  Late.Step.not_of_prefixCount_zero empty

example {source target : Raw.Proc} {action : Raw.Action}
    (closed : source.freeNames = ∅)
    (step : Late.Step source action target) :
    action = .tau :=
  step.action_eq_tau_of_source_freeNames_empty closed

example (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).prefixCount =
      process.prefixCount :=
  Raw.Proc.prefixCount_substituteCaptureAvoiding process needle replacement

end Cantilune.Tests.LatePi
