import Cantilune.Pi.FMSCpoFMSLetPackageNoGo

namespace Cantilune.Tests.FMSCpoFMSLetPackageNoGo

open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFMSLetPackageNoGo

#check UnitComputation
#check SourceLetLaws
#check SourceLetLaws.toSeparatedCommutativeLet
#check no_sourceLetLaws

#print axioms SourceLetLaws.toSeparatedCommutativeLet
#print axioms no_sourceLetLaws

end Cantilune.Tests.FMSCpoFMSLetPackageNoGo
