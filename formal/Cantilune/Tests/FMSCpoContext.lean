import Cantilune.Pi.FMSCpoContext

namespace Cantilune.Tests.FMSCpoContext

open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoContext

def sample : SupportedProc 2 0 :=
  .parallel
    (.output (.free 0) (.free 1) .zero)
    (.restrict (.tau .zero))

example :
    cpoSupportDenotation.app 2 sample =
      ({0, 1} : Set (Fin 2)) := by
  rw [cpoSupportDenotation_app]
  apply Set.ext
  intro value
  simp [sample, SupportedProc.freeSupport, ScopedName.freeSupport]

end Cantilune.Tests.FMSCpoContext
