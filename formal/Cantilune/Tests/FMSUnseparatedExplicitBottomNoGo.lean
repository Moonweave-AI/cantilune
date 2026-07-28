import Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo

/-! Kernel regression checks for the explicit-bottom D1-A boundary. -/

namespace Cantilune.Tests.FMSUnseparatedExplicitBottomNoGo

open Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo

#check denote_deadlock_eq_divergence
#check deadlock_not_operationallyEquivalent_divergence
#check not_fullAbstract
#check fullAbstraction_requires_hidden_auxiliary_bottom

#print axioms denote_deadlock_eq_divergence
#print axioms not_fullAbstract

end Cantilune.Tests.FMSUnseparatedExplicitBottomNoGo
