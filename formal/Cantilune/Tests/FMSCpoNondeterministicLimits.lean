import Cantilune.Pi.FMSCpoNondeterministicLimits

namespace Cantilune.Tests.FMSCpoNondeterministicLimits

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicLimits

#check NDωCPO.productObject
#check NDωCPO.productConeIsLimit
#check NDωCPO.equalizerObject
#check NDωCPO.equalizerForkIsLimit
#check NDωCPO.forgetProductConeIsLimit
#check NDωCPO.forgetEqualizerForkIsLimit

#synth HasProducts.{0} NDωCPO
#synth HasEqualizers NDωCPO
#synth HasLimits.{0} NDωCPO
#synth PreservesLimitsOfSize.{0, 0} NDωCPO.carrierFunctor

#print axioms NDωCPO.productConeIsLimit
#print axioms NDωCPO.equalizerForkIsLimit
#print axioms NDωCPO.forgetProductConeIsLimit
#print axioms NDωCPO.forgetEqualizerForkIsLimit

end Cantilune.Tests.FMSCpoNondeterministicLimits
