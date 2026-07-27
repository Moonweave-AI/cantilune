import Cantilune.Pi.OpenSMCContextualBoundaryCategory

/-!
# Contextual boundary category regression

The nonempty boundary identity has an empty executable body.  Both category
identities and associativity hold on structural process classes and external
wiring programs.  Native output fusion and the mismatch-fusion obstruction
exercise the operational boundary.
-/

namespace Cantilune.Tests.OpenSMCContextualBoundaryCategory

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCContextualBoundaryCategory
open CategoryTheory

#check BoundaryWiring.comp_assoc
#check ContextualOpenProcess.comp_identity_left
#check ContextualOpenProcess.comp_identity_right
#check ContextualOpenProcess.comp_assoc
#check fuse_output_prefix_native
#check restrict_native
#check mismatch_after_fusion_no_native_tau
#check alpha_parallel_zero_not_identity

def environment : TypeEnv where
  sort _ := .channel
  payload _ := .data

def port0 : Port environment where
  name := 0
  sort := .channel
  sort_eq := rfl

def nonemptyBoundary : NamedInterface environment where
  ports := [port0]
  names_nodup := by simp [port0]

#synth Category (NamedInterface environment)

def process :
    ContextualOpenProcess nonemptyBoundary nonemptyBoundary where
  body := Quotient.mk Late.Struct.setoid (.tau .zero)
  wiring :=
    { program := [.fuse 1 2, .restrict 3] }

theorem nonempty_left_identity :
    ContextualOpenProcess.comp
      (ContextualOpenProcess.identity nonemptyBoundary)
      process =
    process :=
  ContextualOpenProcess.comp_identity_left process

theorem nonempty_right_identity :
    ContextualOpenProcess.comp
      process
      (ContextualOpenProcess.identity nonemptyBoundary) =
    process :=
  ContextualOpenProcess.comp_identity_right process

theorem identity_has_no_relay :
    (ContextualOpenProcess.identity nonemptyBoundary).body =
      structuralZero :=
  rfl

theorem category_left_identity :
    (𝟙 nonemptyBoundary) ≫ process = process := by
  simp

theorem category_right_identity :
    process ≫ (𝟙 nonemptyBoundary) = process := by
  simp

theorem concrete_output_fusion_native :
    Late.NativeStep
      ((Raw.Proc.send 0 1 .zero).substituteCaptureAvoiding 1 2)
      (.output 0 2)
      .zero := by
  simpa [Raw.Proc.substituteCaptureAvoiding, Raw.Proc.captureRisk,
    Raw.Proc.substRaw] using
    fuse_output_prefix_native 0 1 1 2 .zero

theorem concrete_mismatch_fusion_fails :
    ¬ ∃ target,
      Late.NativeStep
        (Raw.Proc.substituteCaptureAvoiding
          (Raw.Proc.matchNe 0 1 (.tau .zero)) 1 0)
        .tau target :=
  mismatch_after_fusion_no_native_tau

end Cantilune.Tests.OpenSMCContextualBoundaryCategory
