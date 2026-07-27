import Cantilune.Pi.OpenSMCCategory
import Cantilune.Pi.Protocols

namespace Cantilune.Tests.OpenSMCCategory

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.OpenSMC
open Cantilune.Pi.OpenSMCCategory

example :
    Nonempty (MonoidalCategory (Object Protocols.protocolEnv)) ∧
      Nonempty (SymmetricCategory (Object Protocols.protocolEnv)) :=
  open_pi_mathlib_smc Protocols.protocolEnv

def inputBoundary : Object Protocols.protocolEnv :=
  ⟨[.channel]⟩

def outputBoundary : Object Protocols.protocolEnv :=
  ⟨[.data]⟩

example :
    inputBoundary ⟶ outputBoundary :=
  Hom.atom Protocols.protocolEnv [.channel] [.data]
    Protocols.messageSender (by
      norm_num [Proc.WellTyped, Protocols.messageSender,
        Protocols.protocolEnv, Protocols.sessionChannel,
        Protocols.session, Protocols.payload, Protocols.publicName,
        Protocols.sessionBinder, Protocols.delegationBus,
        Protocols.delegated, Protocols.delegatedBinder])

end Cantilune.Tests.OpenSMCCategory
