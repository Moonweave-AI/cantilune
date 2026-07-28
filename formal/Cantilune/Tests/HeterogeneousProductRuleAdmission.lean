import Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference

/-!
Type-level regression checks for the heterogeneous product-rule certificate.
No execution package, target admission, probability kernel, or policy witness
is fabricated by this test.  This isolated test is pending a targeted
pinned-toolchain build.
-/

namespace Cantilune.Tests.HeterogeneousProductRuleAdmission

open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference

#check ProjectionFamilyOver
#check ProjectionFamilyOver.toProjectionFamily
#check FourCoherentFamilyAdmission
#check FourCoherentFamilyAdmission.toFourTargetAdmissionBundle
#check FourCoherentFamilyAdmission.fixedFourProjection
#check FixedEpochPolicyCompatibility
#check FixedEpochPolicyCompatibility.resources_iff
#check FourFixedEpochOccurrence
#check FourFixedEpochOccurrence.mappedSteps
#check FourFixedEpochOccurrence.petriNative
#check FourFixedEpochOccurrence.endpointResources
#check ProbabilitySchedulingObligations
#check AdmissionBoundaryObligations
#check Certificate
#check Certificate.admissionBundle
#check Certificate.fixedProjections
#check Certificate.occurrence_mapped_steps
#check Reference.certificate
#check Reference.certificate_nonempty
#check Reference.admitted_rule_has_four_native_steps
#check Reference.stochastic_business_progress
#check Reference.old_has_no_business_step
#check Reference.old_business_unavailable
#check Reference.new_business_available
#check Reference.replay_rejects_wrong_rule
#check Reference.replay_rejects_wrong_source

end Cantilune.Tests.HeterogeneousProductRuleAdmission
