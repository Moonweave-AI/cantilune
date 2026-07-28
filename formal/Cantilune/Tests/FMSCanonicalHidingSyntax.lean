import Cantilune.Pi.FMSCanonicalHidingSyntax

/-!
# Canonical FMS hiding syntax regressions
-/

namespace Cantilune.Tests.FMSCanonicalHidingSyntax

open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCanonicalHidingSyntax

#check ScopedName.abstractLast
#check ScopedName.abstractLast_bound
#check SupportedProc.abstractLastWith
#check SupportedProc.restrictLast
#check SupportedProc.abstractLastWith_renameFree
#check SupportedProc.restrictLast_renameFree
#check SupportedProc.freeSupport_restrictLast

example :
    SupportedProc.restrictLast
        (.output
          (.free (Fin.last 1))
          (.free (Fin.last 1))
          .zero :
          SupportedProc 2 0) =
      (.restrict
        (.output
          (.bound (Fin.last 0))
          (.bound (Fin.last 0))
          .zero) :
        SupportedProc 1 0) := by
  rfl

end Cantilune.Tests.FMSCanonicalHidingSyntax
