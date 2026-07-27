import Cantilune.Pi.FMSCpoNondeterministicEnrichment

namespace Cantilune.Tests.FMSCpoNondeterministicEnrichment

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicEnrichment

#synth ∀ source target : NDωCPO,
  OmegaCompletePartialOrder (source ⟶ target)

#check NDωCPO.homOmegaSup
#check NDωCPO.omegaSup_hom
#check NDωCPO.omegaSup_apply
#check NDωCPO.forgetHomContinuous
#check NDωCPO.forgetHomContinuous_apply
#check NDωCPO.compositionOrderHom
#check NDωCPO.compositionContinuous
#check NDωCPO.compositionContinuous_apply

#print axioms NDωCPO.homOmegaSup
#print axioms NDωCPO.omegaSup_hom
#print axioms NDωCPO.omegaSup_apply
#print axioms NDωCPO.forgetHomContinuous
#print axioms NDωCPO.forgetHomContinuous_apply
#print axioms NDωCPO.compositionContinuous
#print axioms NDωCPO.compositionContinuous_apply

end Cantilune.Tests.FMSCpoNondeterministicEnrichment
