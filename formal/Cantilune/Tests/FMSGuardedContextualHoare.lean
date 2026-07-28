import Cantilune.Pi.FMSGuardedContextualHoare

namespace Cantilune.Tests.FMSGuardedContextualHoare

open Cantilune.Pi
open Cantilune.Pi.FMSGuardedContextualHoare

#check Context.fill_comp
#check guarded_contextual_hoare_full_abstraction
#check context_congruence
#check guarded_contextual_source_interpretation
#check guarded_contextual_definability

def parallelObserver : Context :=
  .new 11
    (.parLeft .hole
      (.recv 7 13 (.send 17 13 .zero)))

example (process : RecursiveProc) :
    (parallelObserver.comp (.tau .hole)).fill process =
      parallelObserver.fill (.tau process) :=
  Context.fill_comp _ _ _

example {left right : RecursiveProc}
    (equivalent : ContextuallyEquivalent left right) :
    ContextuallyEquivalent
      (parallelObserver.fill left)
      (parallelObserver.fill right) :=
  context_congruence equivalent parallelObserver

#print axioms Context.fill_comp
#print axioms guarded_contextual_hoare_full_abstraction
#print axioms context_congruence
#print axioms guarded_contextual_source_interpretation
#print axioms guarded_contextual_definability

end Cantilune.Tests.FMSGuardedContextualHoare
