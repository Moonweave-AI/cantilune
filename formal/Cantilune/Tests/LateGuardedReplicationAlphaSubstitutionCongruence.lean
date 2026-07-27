import Cantilune.Pi.LateGuardedReplicationAlphaSubstitutionCongruenceClosure

namespace Cantilune.Tests.LateGuardedReplicationAlphaSubstitutionCongruence

open Cantilune.Pi

#check RecursiveProc.substituteCaptureAvoidingAux_eq_substRaw_of_no_capture
#check RecursiveAlpha.syntaxDepth_eq
#check RecursiveAlpha.substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
#check RecursiveAlpha.substituteCaptureAvoidingAux_new_to_common
#check RecursiveAlpha.substituteCaptureAvoidingAux_recv_to_common
#check RecursiveAlpha.substituteCaptureAvoidingAux_repRecv_to_common
#check RecursiveAlpha.substituteCaptureAvoidingAux_congr_of_depth
#check RecursiveAlpha.substituteCaptureAvoidingAux_congr
#check RecursiveAlpha.substituteCaptureAvoiding_congr
#check RecursiveAlpha.substitutionCongruent
#check RecursiveLate.embedded_native_permute_up_to_alpha_unconditional
#check RecursiveLate.native_permute_up_to_alpha_unconditional
#check RecursiveAlphaOperational.alphaNativeStep_permute_all_unconditional

#print axioms
  RecursiveProc.substituteCaptureAvoidingAux_eq_substRaw_of_no_capture
#print axioms RecursiveAlpha.syntaxDepth_eq
#print axioms
  RecursiveAlpha.substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
#print axioms RecursiveAlpha.substituteCaptureAvoidingAux_new_to_common
#print axioms RecursiveAlpha.substitutionCongruent
#print axioms RecursiveLate.native_permute_up_to_alpha_unconditional
#print axioms
  RecursiveAlphaOperational.alphaNativeStep_permute_all_unconditional

private def body : RecursiveProc :=
  .send 0 1 (.new 2 (.send 0 2 .zero))

theorem absent_substitution_changes_only_binder_spelling :
    RecursiveAlpha
      (body.substituteCaptureAvoidingAux 8 7 2)
      body := by
  exact
    RecursiveAlpha.substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
      8 body 7 2 (by native_decide)

private def alphaLeft : RecursiveProc :=
  .new 1 (.send 0 1 .zero)

private def alphaRight : RecursiveProc :=
  .new 7 ((.send 0 1 .zero : RecursiveProc).renameBound 1 7)

theorem total_substitution_respects_one_alpha_conversion :
    RecursiveAlpha
      (alphaLeft.substituteCaptureAvoiding 0 1)
      (alphaRight.substituteCaptureAvoiding 0 1) := by
  apply RecursiveAlpha.substituteCaptureAvoiding_congr
  exact RecursiveAlpha.newBinder (by native_decide)

end Cantilune.Tests.LateGuardedReplicationAlphaSubstitutionCongruence
