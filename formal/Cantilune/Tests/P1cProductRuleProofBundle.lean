import Cantilune.Theorems.P1cProductRuleProofBundle

/-!
Kernel-level regressions for the non-identity P1c product-rule bundle.
The reference is one substantive reconnect rule, not a production-package
certificate.
-/

namespace Cantilune.Tests.P1cProductRuleProofBundle

open Cantilune.Theorems.P1cProductRuleProofBundle

#check encodeEvent_bijective
#check fixedOccurrence_completed_no_step
#check no_positive_labelling_on_fixed_occurrence
#check TargetStep.business_native
#check projection
#check projection_event_bijective
#check all_target_steps_reflect
#check all_four_source_events_native
#check bundle
#check Reference.reconnect_changes_graph
#check Reference.proofBundle
#check Reference.admitted
#check Reference.four_business_steps_native
#check Reference.business_probability_one
#check Reference.dag_business_replays

example :
    encodeEvent Cantilune.Pi.P1cAdmittedTrajectory.Event.business =
      ViewEvent.business :=
  rfl

example :
    Reference.occurrence.target.edges = {(0, 1)} ∧
      Reference.occurrence.target.edges ≠
        Reference.occurrence.source.edges :=
  Reference.reconnect_changes_graph

end Cantilune.Tests.P1cProductRuleProofBundle
