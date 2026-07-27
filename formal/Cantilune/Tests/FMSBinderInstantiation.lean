import Cantilune.Pi.FMSBinderInstantiation

/-!
# FMS binder instantiation regressions
-/

namespace Cantilune.Tests.FMSBinderInstantiation

open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSBinderInstantiation

#check ScopedName.instantiateLast
#check ScopedName.instantiateLast_last
#check ScopedName.instantiateLast_castSucc
#check ScopedName.abstractLast_substituteBinder_renameFree
#check SupportedProc.substituteBinderWith
#check SupportedProc.instantiateOuter
#check SupportedProc.freshenOuter
#check SupportedProc.abstractLastWith_substituteBinderWith_renameFree
#check SupportedProc.restrictLast_freshenOuter
#check SupportedProc.instantiateOuter_bound_name
#check SupportedProc.freshenOuter_bound_name

example (body : SupportedProc world 1) :
    Cantilune.Pi.FMSCanonicalHidingSyntax.SupportedProc.restrictLast
        (SupportedProc.freshenOuter body) =
      (.restrict body : SupportedProc world 0) :=
  SupportedProc.restrictLast_freshenOuter body

end Cantilune.Tests.FMSBinderInstantiation
