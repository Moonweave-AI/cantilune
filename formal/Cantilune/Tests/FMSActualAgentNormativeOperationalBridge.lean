import Cantilune.Pi.FMSActualAgentNormativeOperationalBridge

namespace Cantilune.Tests.FMSActualAgentNormativeOperationalBridge

open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge

example (event : SourceEvent) :
    PointedStrongCorrespondence event :=
  compiledCanonicalPointed event

example (event : SourceEvent) :
    CompiledActualAgentCommutation event :=
  compiledActualAgentCommutation event

example (event : SourceEvent) :
    Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra.totalSupportedDenote.app
        Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeBaseWorld
        (compiledFirstTarget event) =
      Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeTargetAgent
        event :=
  total_compiled_target_eq_normative event

example (event : SourceEvent) :
    TotalCompiledNormativeCommutation event :=
  totalCompiledNormativeCommutation event

example :
    Fintype.card SourceEvent = 15 :=
  compiled_normative_event_count

#print axioms compiled_first_native
#print axioms compiled_first_native_exact
#print axioms compiled_binder_derivative_alpha
#print axioms compiledCanonicalPointed
#print axioms total_compiled_source_eq_normative
#print axioms total_compiled_target_eq_normative
#print axioms totalCompiledNormativeCommutation

end Cantilune.Tests.FMSActualAgentNormativeOperationalBridge
