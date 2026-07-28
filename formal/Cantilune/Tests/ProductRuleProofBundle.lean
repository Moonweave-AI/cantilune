import Cantilune.Theorems.ProductRuleProofBundle

/-!
Type-level regression checks for the proof-carrying fixed-epoch product-rule
admission gate.  The reference remains an identity-view witness and is not a
claim about any production package.
-/

namespace Cantilune.Tests.ProductRuleProofBundle

open Cantilune.Theorems.ProductRuleProofBundle

#check Candidate
#check SourceOccurrenceEvidence
#check ProjectionOccurrenceEvidence
#check ResourceQuiescenceEvidence
#check ProductRuleProofBundle
#check RequiredProofField
#check Submission.runGate
#check Submission.complete_admitted
#check Submission.incomplete_rejected
#check GateReference.bundle
#check GateReference.reference_admitted
#check GateReference.missing_rank_rejected

end Cantilune.Tests.ProductRuleProofBundle
