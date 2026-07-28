import Cantilune.Pi.OpenSMCAlphaFreshPlugObstruction

/-!
# Alpha-only fresh plugging obstruction regression

The concrete boundary contains one channel name.  Both the general collapsed
identity theorem and the existing `zero` operational identity theorem reject
alpha-only left/right plugging.
-/

namespace Cantilune.Tests.OpenSMCAlphaFreshPlugObstruction

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCAlphaFreshPlugObstruction

#check alphaSupport
#check realizesSupport_iff
#check AlphaFreshPlug
#check no_left_identity_alphaFreshPlug_of_collapsed_support
#check no_right_identity_alphaFreshPlug_of_collapsed_support
#check zero_identity_not_left_alphaFreshPlug
#check zero_identity_not_right_alphaFreshPlug

def environment : TypeEnv where
  sort _ := .channel
  payload _ := .data

def port0 : Port environment where
  name := 0
  sort := .channel
  sort_eq := rfl

def boundary : NamedInterface environment where
  ports := [port0]
  names_nodup := by simp [port0]

theorem boundary_names :
    boundary.names = {0} := by
  simp [boundary, NamedInterface.names, port0]

theorem boundary_nonempty :
    boundary.names.Nonempty := by
  rw [boundary_names]
  simp

def collapsedIdentityProcess : AlphaProcess :=
  Quotient.mk Late.Alpha.setoid (.send 0 0 .zero)

theorem collapsedIdentityProcess_support :
    alphaSupport collapsedIdentityProcess = boundary.names := by
  simp [collapsedIdentityProcess, alphaSupport, Raw.Proc.freeNames,
    boundary_names]

theorem collapsed_left_identity_rejected
    (right : AlphaProcess) :
    ¬ Nonempty (AlphaFreshPlug
      boundary boundary (NamedInterface.empty environment)
      collapsedIdentityProcess right) :=
  no_left_identity_alphaFreshPlug_of_collapsed_support
    boundary_nonempty collapsedIdentityProcess_support

theorem collapsed_right_identity_rejected
    (left : AlphaProcess) :
    ¬ Nonempty (AlphaFreshPlug
      (NamedInterface.empty environment) boundary boundary
      left collapsedIdentityProcess) :=
  no_right_identity_alphaFreshPlug_of_collapsed_support
    boundary_nonempty collapsedIdentityProcess_support

theorem operational_left_identity_rejected
    (right : AlphaProcess) :
    ¬ Nonempty (AlphaFreshPlug
      boundary boundary (NamedInterface.empty environment)
      zeroAlphaProcess right) :=
  zero_identity_not_left_alphaFreshPlug boundary_nonempty

theorem operational_right_identity_rejected
    (left : AlphaProcess) :
    ¬ Nonempty (AlphaFreshPlug
      (NamedInterface.empty environment) boundary boundary
      left zeroAlphaProcess) :=
  zero_identity_not_right_alphaFreshPlug boundary_nonempty

end Cantilune.Tests.OpenSMCAlphaFreshPlugObstruction
