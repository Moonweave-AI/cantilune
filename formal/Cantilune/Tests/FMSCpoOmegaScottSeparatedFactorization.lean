import Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization

/-!
# Separated omega-Scott factorization regression

These checks cover the exact compatibility seam between the existing
support-separated tensor and the existing lower omega-Scott Fubini map.
They intentionally make no Abramsky-powerdomain or full-abstraction claim.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottSeparatedFactorization

open Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization
open Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization.Supported

#check forgetContinuous
#check separatedLocus
#check restrictSeparated
#check mapRaw_forget_restrictSeparated
#check mapRaw_forget_restrictSeparated_iff
#check CrossSeparated
#check fubiniRaw_le_separatedLocus_iff
#check fubiniRaw_factors_through_separated_iff

#print axioms
  Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization.Supported.mapRaw_forget_restrictSeparated_iff
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization.Supported.fubiniRaw_factors_through_separated_iff

end Cantilune.Tests.FMSCpoOmegaScottSeparatedFactorization
