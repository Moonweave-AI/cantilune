import Cantilune.Pi.NominalCpo

/-!
Kernel checks for the world-indexed nominal omega-CPO support layer.
-/

namespace Cantilune.Tests.NominalCpo

open Cantilune.Pi.NominalCpo

#check rename_identity
#check rename_comp
#check rename_freshChoiceAlpha
#check rename_freshChoiceAlpha_apply
#check Certificate.support_rename
#check Certificate.support_permute
#check Certificate.IsLeastSupport
#check Certificate.HasLeastSupports
#check Certificate.last_fresh_after_allocate
#check cpoAgentCertificate
#check cpoAgent_permute
#check cpoAgent_rename
#check cpoAgent_hiding_allocation_retraction
#check cpoAgent_hiding_allocation_natural

#print axioms Certificate.support_permute
#print axioms Certificate.last_fresh_after_allocate
#print axioms rename_freshChoiceAlpha
#print axioms rename_freshChoiceAlpha_apply
#print axioms cpoAgentCertificate
#print axioms cpoAgent_hiding_allocation_natural

end Cantilune.Tests.NominalCpo
