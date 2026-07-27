import Cantilune.Pi.OpenSMCPolarisedHomBridge

namespace Cantilune.Tests.OpenSMCPolarisedHomBridge

open Cantilune.Pi
open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.OpenSMCPolarisedHomBridge

noncomputable section

/-- The singleton presented identity is linked to its real two-step wire. -/
example :
    WireIdentityProtocol
      ⟨.data, .positive⟩ 0 4 1 :=
  wireIdentityProtocol ⟨.data, .positive⟩ 0 4 1
    (by norm_num [WireNamesFresh])

/-- Canonical positional identities allocate disjoint nominal blocks. -/
example (offset : Nat) (port : PortType) (ports : List PortType) :
    Disjoint
      (identityWireNames offset port)
      (identityAllocatedNamesFrom (offset + 1) ports) :=
  identityWireNames_disjoint_tail offset port ports

/-- Tensor closure is a constructor of the Hom-indexed relation. -/
example
    {a b c d : Object}
    {left : Hom a b} {right : Hom c d}
    {leftProcess rightProcess : RecursiveProc}
    (leftRealizes : HomRealizes left leftProcess)
    (rightRealizes : HomRealizes right rightProcess) :
    HomRealizes (parallel left right)
      (.par leftProcess rightProcess) :=
  HomRealizes.parallel leftRealizes rightRealizes

/-- The concrete typed atoms share one endpoint and genuinely compose. -/
example :
    StrongHomRealization
      (comp Reference.outputHom Reference.inputHom) :=
  Reference.composite

/-- The same Hom-indexed composition has concrete D1-A trace evidence. -/
example :
    FMSConcreteD1AAcceptance.RepresentativeTraceCommutation
      Reference.composite.representative :=
  Reference.compositeFMS

/-- Final bridge acceptance is an actual no-argument inhabitant. -/
example : HomOperationalBridgeAcceptance :=
  homOperationalBridgeAcceptance

/-- Every finite typed/polarised boundary has a total wire realization. -/
example (object : Object) :
    Nonempty
      (Σ process : RecursiveProc,
        HomRealizes (identity object) process) :=
  every_identity_has_operational_realization object

#print axioms
  Cantilune.Pi.OpenSMCPolarisedHomBridge.wire_identity_two_native_steps
#print axioms
  Cantilune.Pi.OpenSMCPolarisedHomBridge.every_identity_has_operational_realization
#print axioms
  Cantilune.Pi.OpenSMCPolarisedHomBridge.Reference.composite
#print axioms
  Cantilune.Pi.OpenSMCPolarisedHomBridge.homOperationalBridgeAcceptance

end

end Cantilune.Tests.OpenSMCPolarisedHomBridge
