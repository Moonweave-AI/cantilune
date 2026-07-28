import Cantilune.Pi.OpenSMCTotalNamedBoundary

/-!
# Total named-boundary no-go and native plug/hide regression
-/

namespace Cantilune.Tests.OpenSMCTotalNamedBoundary

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCTotalNamedBoundary

#check TotalOccurrenceTensor
#check no_totalOccurrenceTensor_of_nonempty
#check TotalExactNamePlug
#check no_totalExactNamePlug_of_nonempty
#check BoundaryRenaming
#check FreshenedBoundary
#check SortedFreshBoundarySupply
#check SortedFreshBoundarySupply.tensorObject_sorts
#check no_sortChanging_selfBoundaryRenaming
#check no_sortedFreshBoundarySupply_singletonChannel
#check hideMany_native
#check hideMany_native_tau
#check plugHide_syncLeft_native
#check plugHide_syncRight_native
#check plugHide_closeLeft_native
#check plugHide_closeRight_native

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

theorem boundary_nonempty : boundary.names.Nonempty := by
  simp [boundary, NamedInterface.names, port0]

theorem occurrence_tensor_is_impossible :
    ¬ Nonempty (TotalOccurrenceTensor environment) :=
  no_totalOccurrenceTensor_of_nonempty boundary boundary_nonempty

theorem exact_plug_is_not_total :
    ¬ Nonempty (TotalExactNamePlug environment) :=
  no_totalExactNamePlug_of_nonempty boundary boundary_nonempty

theorem sort_changing_name_swap_is_rejected :
    ¬ ∃ mapping :
        BoundaryRenaming mixedSortBoundary mixedSortBoundary,
      mapping.nameMap = swapZeroOne :=
  no_sortChanging_selfBoundaryRenaming

def producer : Raw.Proc :=
  .send 0 7 .zero

def consumer : Raw.Proc :=
  .recv 0 2 (.send 1 2 .zero)

/--
A concrete exact native synchronization under two restrictions.  This checks
that the positive result is not merely a polymorphic, uninstantiated API.
-/
theorem concrete_plug_hide_native :
    Late.NativeStep
      (hideMany [0, 3] (.par producer consumer))
      .tau
      (hideMany [0, 3]
        (.par .zero
          (Raw.Proc.substituteCaptureAvoiding
            (.send 1 2 .zero) 2 7))) := by
  apply plugHide_syncLeft_native
  · exact Late.NativeStep.prefixOutput
  · exact Late.NativeStep.prefixInput
  · simp [Raw.Proc.freeNames]

end Cantilune.Tests.OpenSMCTotalNamedBoundary
