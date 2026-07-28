import Cantilune.Pi.P1bStructuralLateBridge

namespace Cantilune.Tests.P1bStructuralLateBridge

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1bStructuralLateBridge

example :
    Late.structuralLateLTS.ObservableStep
      (mapState .requesting)
      (mapEvent .establishSession)
      (mapState .established) :=
  standard_late_sound
    ⟨Cantilune.Pi.Certificates.RequestAccept.Step.establishSession, trivial⟩

example :
    Late.structuralLateLTS.success (mapState .complete) ↔
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS.success .complete :=
  standard_late_success_iff .complete

example {action : Raw.Action} {target : Raw.Proc}
    (step : Late.Step (mapState .established) action target) :
    action = .tau ∧ Late.Struct target (mapState .complete) :=
  established_structural_residual step

#check Raw.Proc.freeNames_substRaw_erase_replacement
#check Raw.Proc.freeSubjects_substRaw_erase_replacement
#check Raw.Proc.communicationPrefixCount_substRaw
#check Late.Alpha.freeNames_eq
#check Late.Alpha.freeSubjects_eq
#check Late.Struct.freeNames_eq
#check Late.Struct.freeSubjects_eq
#check Late.Struct.structurallyZero_iff_prefixCount_zero
#check Late.Struct.choice_idempotence_not_structural
#check Late.NativeStep.target_prefixCount_add_two_le_of_tau_all_communication
#check Late.Step.target_prefixCount_add_two_le_of_tau_all_communication
#check Late.Step.target_prefixCount_zero_of_two_communication_tau
#check
  Cantilune.Pi.P1bRequestingNormalForm.Late.NativeStep.two_communication_prefix_tau_pair_form
#check requesting_action_tau_and_target_prefixCount_le_two
#check established_structural_residual
#check established_reflect
#check residualCounterexample_struct
#check residualCounterexample_alpha_native
#check residualCounterexample_no_original_native
#check StandardLateReflection
#check certificateOfReflection

end Cantilune.Tests.P1bStructuralLateBridge
