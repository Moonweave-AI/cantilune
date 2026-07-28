import Cantilune.Pi.FMSMaximumCompatibleClosure

namespace Cantilune.Tests.FMSMaximumCompatibleClosure

open Cantilune.Pi.FMSMaximumCompatibleClosure

example : Nonempty MaximumCompatibleFMS :=
  ⟨maximumCompatibleFMS⟩

example :
    maximumCompatibleFMS.unseparatedCore =
      Cantilune.Pi.FMSCpoUnseparatedSourceCore.concreteSourceAlignedUnseparatedCore :=
  maximumCompatibleFMS.unseparatedCore_eq

end Cantilune.Tests.FMSMaximumCompatibleClosure
