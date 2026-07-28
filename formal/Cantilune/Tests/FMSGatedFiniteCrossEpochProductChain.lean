import Cantilune.Theorems.FMSGatedFiniteCrossEpochProductChain

/-!
# FMS-gated finite-chain interface regression

These checks intentionally do not manufacture an FMS package or a production
family.  They verify the dependent finite composition and one-row adapter
interfaces only.
-/

namespace Cantilune.Tests.FMSGatedFiniteCrossEpochProductChain

open Cantilune.Theorems

#check FMSGatedFiniteChain
#check FMSGatedFiniteChain.AllRows
#check FMSGatedFiniteChain.allRows
#check FMSGatedFiniteChain.CompleteAgreement
#check FMSGatedFiniteChain.composeComplete
#check FMSGatedFiniteChain.CompleteAgreement.replay
#check FMSGatedFiniteChain.CompleteAgreement.strict
#check FMSGatedFiniteChain.CompleteAgreement.events
#check FMSGatedFiniteChain.CompleteAgreement.admissions
#check FMSGatedFiniteChain.singletonSourceEvents_ne_emptySourceEvents
#check FMSGatedFiniteChain.oneRow
#check FMSGatedFiniteChain.oneRow_allRows
#check FMSGatedFiniteChain.oneRow_complete

end Cantilune.Tests.FMSGatedFiniteCrossEpochProductChain
