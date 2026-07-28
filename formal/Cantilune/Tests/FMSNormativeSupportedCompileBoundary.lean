import Cantilune.Pi.FMSNormativeSupportedCompileBoundary

namespace Cantilune.Tests.FMSNormativeSupportedCompileBoundary

open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.FMSOperationalSyntaxBridge
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.FMSNormativeSupportedCompileBoundary

example :
    SupportedProc.reifyAtWorld canonicalLateInput ≠
      readyProcess .lateInput :=
  canonicalLateInput_not_literal

example :
    Late.Alpha
      (SupportedProc.reifyAtWorld canonicalLateInput)
      (readyProcess .lateInput) :=
  canonicalLateInput_alpha

example :
    SupportedProc.reifyAtWorld canonicalBoundOutput ≠
      readyProcess .boundOutput :=
  canonicalBoundOutput_not_literal

example :
    Late.Alpha
      (SupportedProc.reifyAtWorld canonicalBoundOutput)
      (readyProcess .boundOutput) :=
  canonicalBoundOutput_alpha

#print axioms literal_family_count
#print axioms alpha_family_count
#print axioms canonicalLateInput_not_literal
#print axioms lateInput_not_in_canonical_reify_range
#print axioms canonicalLateInput_alpha
#print axioms canonicalLateInput_derivative_alpha
#print axioms canonicalBoundOutput_not_literal
#print axioms boundOutput_not_in_canonical_reify_range
#print axioms canonicalBoundOutput_alpha
#print axioms canonicalBoundOutput_derivative_alpha

end Cantilune.Tests.FMSNormativeSupportedCompileBoundary
