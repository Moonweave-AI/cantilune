import Cantilune.Theorems.CrossEpochProductFamily

/-!
Kernel-level interface checks for composition of a genuine heterogeneous
signature admission with one fixed-signature product rule.

These checks establish the generic composition theorem.  They do not assert
that any of the eight planned production packages supplies an inhabitant.
-/

namespace Cantilune.Tests.CrossEpochProductFamily

open Cantilune.Theorems
open Cantilune.Theorems.ViewCrossEpochTrace
open Cantilune.Theorems.CrossEpochProductFamily

#check ViewCrossEpochTrace
#check ViewCrossEpochTrace.ofCertificates
#check ViewCrossEpochTrace.beforeEpoch
#check ViewCrossEpochTrace.afterEpoch
#check ViewCrossEpochTrace.adjacentAdmission
#check ViewCrossEpochTrace.epochChain
#check ViewCrossEpochTrace.epochChain_replay_agreement
#check ViewCrossEpochTrace.epochChain_execution_epoch_strict
#check CrossEpochProductFamily
#check CrossEpochProductFamily.source_native_chain
#check CrossEpochProductFamily.source_replay_chain
#check CrossEpochProductFamily.dagTrace
#check CrossEpochProductFamily.petriTrace
#check CrossEpochProductFamily.piTrace
#check CrossEpochProductFamily.morphismTrace
#check CrossEpochProductFamily.FourViewTrace
#check CrossEpochProductFamily.four_projection_paths_and_replay
#check CrossEpochProductFamily.FourEpochChainAgreement
#check CrossEpochProductFamily.four_dependent_epoch_chains_complete
#check CrossEpochProductFamily.target_versions_strict

end Cantilune.Tests.CrossEpochProductFamily
