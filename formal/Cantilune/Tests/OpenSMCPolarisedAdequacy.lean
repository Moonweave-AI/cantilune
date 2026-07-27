import Cantilune.Pi.OpenSMCPolarisedAdequacy

/-! Kernel regressions for the two-layer polarised Open-pi adequacy boundary. -/

namespace Cantilune.Tests.OpenSMCPolarisedAdequacy

open Cantilune.Pi
open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.OpenSMCPolarisedAdequacy

#check StrongRepresentative.alphaNative
#check freshBoundary
#check freshTensorBoundary
#check wireInputRepresentative
#check wireOutputRepresentative
#check wire_derivative_is_output_source
#check wire_labels_distinct
#check plugLeftRepresentative
#check plugRightRepresentative
#check restrictionRepresentative
#check openBoundOutputRepresentative
#check presented_global_smc_coherent
#check normative_family_count
#check normative_alpha_native
#check no_positive_prefix_raw_structural_identity
#check maximal_compatible_identity

#print axioms presented_global_smc_coherent
#print axioms normative_alpha_native
#print axioms no_positive_prefix_raw_structural_identity
#print axioms maximal_compatible_identity

def positiveDataPort : PortType :=
  ⟨.data, .positive⟩

def singletonBoundary : Object :=
  ofPorts [positiveDataPort]

def singletonPosition : Position singletonBoundary :=
  ⟨0, by simp [singletonBoundary, ofPorts]⟩

def singletonRealization : Realization singletonBoundary where
  offset := 9

def endpoint : Name :=
  singletonRealization.nameAt singletonPosition

def producer : RecursiveProc :=
  .send endpoint 101 .zero

def receiver : RecursiveProc :=
  .recv endpoint 103 (.send 107 103 .zero)

theorem concrete_plug_is_one_strong_step :
    RecursiveLate.NativeStep
      (plug singletonRealization producer receiver)
      .tau
      (hideNames singletonRealization.names
        (.par .zero
          ((RecursiveProc.send 107 103 .zero)
            |>.substituteCaptureAvoiding 103 101))) := by
  exact
    (plugLeftRepresentative singletonRealization singletonPosition
      (RecursiveLate.NativeStep.prefixOutput)
      (RecursiveLate.NativeStep.prefixInput)
      (by simp [RecursiveProc.freeNames])).native

theorem concrete_wire_is_two_linked_strong_steps :
    RecursiveLate.NativeStep
        (wire positiveDataPort 20 24 29)
        (.input 20 29)
        (.par (.send 24 29 .zero)
          (wire positiveDataPort 20 24 29)) ∧
      RecursiveLate.NativeStep
        (.par (.send 24 29 .zero)
          (wire positiveDataPort 20 24 29))
        (.output 24 29)
        (.par .zero (wire positiveDataPort 20 24 29)) := by
  exact
    ⟨(wireInputRepresentative positiveDataPort 20 24 29).native,
      (wireOutputRepresentative positiveDataPort 20 24 29).native⟩

theorem concrete_open_is_one_bound_output :
    RecursiveLate.NativeStep
      (.new 31 (.send 37 31 .zero))
      (.boundOutput 37 31)
      .zero := by
  exact
    (openBoundOutputRepresentative 31 37 (by decide)
      (RecursiveLate.NativeStep.prefixOutput)).native

example :
    (freshBoundary {0, 2, 4} singletonBoundary).realization.names.Nodup :=
  (freshBoundary {0, 2, 4} singletonBoundary).occurrenceDistinct

example :
    Disjoint
      (freshTensorBoundary {0, 2, 4}
        singletonBoundary singletonBoundary).realization.names.toFinset
      {0, 2, 4} :=
  (freshTensorBoundary {0, 2, 4}
    singletonBoundary singletonBoundary).externallyFresh

end Cantilune.Tests.OpenSMCPolarisedAdequacy
