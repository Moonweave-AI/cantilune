import Cantilune.Theorems.P1aProjectionScopeClosure
import Cantilune.Theorems.SubstantiveReconnectConformance

/-! Regression checks for the exact P1a scope split. -/

noncomputable section

namespace Cantilune.Tests.P1aProjectionScopeClosure

open Cantilune.Theorems.P1aProjectionScopeClosure

#check productOperational
#check complete_product_p1a_projection_scope
#check FixedSignatureReferenceP1aScope
#check fixedBusinessReference
#check fixed_business_reference_nonempty

example :
    Fintype.card
        Cantilune.Pi.P1cBusinessReplayMatrix.BusinessEvent = 14 :=
  fixedBusinessReference.eventCount

example :
    CompleteProductP1aProjectionScope
      Cantilune.Theorems.SubstantiveReconnectConformance.core :=
  complete_product_p1a_projection_scope
    Cantilune.Theorems.SubstantiveReconnectConformance.core

example :
    PathCoverage
      (complete_product_p1a_projection_scope
        Cantilune.Theorems.SubstantiveReconnectConformance.core).operational :=
  (complete_product_p1a_projection_scope
    Cantilune.Theorems.SubstantiveReconnectConformance.core).paths

end Cantilune.Tests.P1aProjectionScopeClosure
