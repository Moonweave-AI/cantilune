import Cantilune.Theorems.CompleteFourProjection
import Cantilune.Tests.CompleteProjection

/-!
# Complete four-projection composition regression

The same finite identity certificate is used four times to verify the shared
source/admission interface. This test does not identify the real DAG, Petri,
π, or morphism semantics with one another.
-/

namespace Cantilune.Tests.CompleteFourProjection

open Cantilune.Tests.CompleteProjection
open Cantilune.Theorems

def certificates :
    FourCompleteProjectionCertificates
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      lts lts lts lts lts admission where
  dag := identityComplete
  petri := identityComplete
  pi := identityComplete
  morphism := identityComplete

def identity_four_projection_consistency :
    FourProjectionConsistency
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      lts lts lts lts lts admission :=
  buildFourProjectionConsistency certificates

example :
    Nonempty
      (FourProjectionConsistency
        (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
        lts lts lts lts lts admission) :=
  four_projection_consistency certificates

example :
    identity_four_projection_consistency.dag.operational.mapState
        beforeState =
      beforeState :=
  rfl

example :
    identity_four_projection_consistency.petri.admission.sourceAfterVersion =
      (show lts.signatureVersion afterState = admission.toVersion from rfl) :=
  rfl

example :
    identity_four_projection_consistency.pi.resources.targetResourcesValid
        afterState :=
  by
    change afterState.val ≤ 1
    decide

example :
    identity_four_projection_consistency.morphism.static.functor.obj Unit =
      Unit :=
  rfl

end Cantilune.Tests.CompleteFourProjection
