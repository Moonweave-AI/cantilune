import Cantilune.Pi.OpenSMCBoundaryObstruction

/-!
The presented sort-only boundary cannot be advertised as nominal support.
-/

namespace Cantilune.Tests.OpenSMCBoundaryObstruction

open Cantilune.Pi.OpenSMCBoundaryObstruction

example :
    ¬ ∃ support :
        Cantilune.Pi.OpenSMC.Interface →
          Cantilune.Pi.OpenSMC.Interface →
          Finset Cantilune.Pi.Name,
      ∀ (input output : Cantilune.Pi.OpenSMC.Interface)
        (process : Cantilune.Pi.Proc)
        (_typed : process.WellTyped environment),
        process.erase.freeNames = support input output :=
  no_sort_only_boundary_support

#check obstruction_is_nonempty

end Cantilune.Tests.OpenSMCBoundaryObstruction
