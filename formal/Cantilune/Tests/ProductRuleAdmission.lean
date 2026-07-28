import Cantilune.Theorems.ProductRuleAdmission

/-!
Type-level regression checks for the generic product-rule admission interface.
No concrete product package is fabricated here.
-/

namespace Cantilune.Tests.ProductRuleAdmission

open Cantilune.Theorems.ProductRuleAdmission

#check RuleRankEvidence
#check ExternalSchedulingEvidence
#check ExternalSchedulingEvidence.selectedRuleNative
#check ExternalSchedulingEvidence.selectedRuleReplay
#check ExternalSchedulingEvidence.selectedRuleNoninternal
#check RuleSchedulingEvidence
#check Certificate
#check Certificate.fourProjections
#check Certificate.StaticAdmissionLayers
#check Certificate.staticAdmissionLayers
#check Certificate.SharedSourceAdmission
#check Certificate.sharedSourceAdmission
#check Certificate.AdmissionStepConditions
#check Certificate.admissionSteps
#check Certificate.SourceReplayCondition
#check Certificate.sourceReplay
#check Certificate.TargetReplayConditions
#check Certificate.targetReplays
#check Certificate.paths
#check Certificate.terminals
#check Certificate.EndpointResourceConditions
#check Certificate.endpointResources
#check Certificate.EndpointSessionConditions
#check Certificate.endpointSessions
#check Certificate.EndpointDeletionConditions
#check Certificate.endpointDeletions
#check Certificate.SchedulingConditions
#check Certificate.schedulingConditions
#check Certificate.ProbabilityConditions
#check Certificate.probabilityConditions
#check Certificate.Consequences
#check Certificate.rule_consequences

end Cantilune.Tests.ProductRuleAdmission
