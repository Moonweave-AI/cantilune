import Cantilune.Theorems.FourProjectionFamily
import Cantilune.Tests.ProjectionFamily
import Cantilune.Tests.CompleteProjection

namespace Cantilune.Tests.FourProjectionFamily

open Cantilune.Core
open Cantilune.Theorems
open Cantilune.Tests.ProjectionFamily

def identityTarget :
    TargetProjectionFamily
      (Type 0) (Type 0) executionFamily :=
  TargetProjectionFamily.identity (Type 0) executionFamily

def fourIdentity :
    FourProjectionFamilies
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0) where
  source := executionFamily
  dag := identityTarget
  petri := identityTarget
  pi := identityTarget
  morphism := identityTarget

example :=
  fourIdentity.operational_consistency_at
    Cantilune.Tests.CompleteProjection.signature

example :
    (fourIdentity.dag.operational
      Cantilune.Tests.CompleteProjection.signature).mapState () = () :=
  rfl

example :=
  fourIdentity.admission_state_coherent_all
    Cantilune.Tests.CompleteProjection.admission
    secondAdmission admissionsComposable ()

example :=
  fourIdentity.projected_event_replay_commutes_all
    (SignatureExtension.refl
      Cantilune.Tests.CompleteProjection.signature)
    nativeStep

end Cantilune.Tests.FourProjectionFamily
