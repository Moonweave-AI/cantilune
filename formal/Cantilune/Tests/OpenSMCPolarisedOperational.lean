import Cantilune.Pi.OpenSMCPolarisedOperational

/-! Kernel regressions for polarised positional Open-pi operations. -/

namespace Cantilune.Tests.OpenSMCPolarisedOperational

open Cantilune.Pi
open Cantilune.Pi.OpenSMCPolarisedOperational

#check comp_assoc
#check parallel_comp_interchange
#check associator_natural
#check leftUnitor_hom_inv
#check leftUnitor_natural
#check rightUnitor_hom_inv
#check rightUnitor_natural
#check braid_natural
#check pentagon
#check triangle
#check hexagon
#check freshRealization_disjoint
#check wire_native_input
#check wire_native_output
#check wire_not_atomic_relay
#check plug_syncLeft_native
#check parallel_native_left

def channelIn : PortType :=
  ⟨.data, .positive⟩

def channelOut : PortType :=
  ⟨.channel, .negative⟩

def boundary : Object :=
  ofPorts [channelIn, channelOut]

example : tensorObject boundary boundary =
    ofPorts [channelIn, channelOut, channelIn, channelOut] := by
  rfl

example :
    environment.payload (endpointName .data 7) = .data := by
  simp

example :
    environment.payload (endpointName .channel 7) = .channel := by
  simp

theorem concrete_wire_input :
    RecursiveLate.NativeStep
      (wire channelIn 20 24 29)
      (.input 20 29)
      (.par (.send 24 29 .zero) (wire channelIn 20 24 29)) := by
  simpa [channelIn, wireEndpoints] using
    (show
      RecursiveLate.NativeStep
        (wire channelIn 20 24 29)
        (.input (wireEndpoints channelIn 20 24).1 29)
        (.par
          (.send (wireEndpoints channelIn 20 24).2 29 .zero)
          (wire channelIn 20 24 29)) from
    wire_native_input channelIn 20 24 29
    )

theorem concrete_wire_output :
    RecursiveLate.NativeStep
      (.par (.send 24 29 .zero) (wire channelIn 20 24 29))
      (.output 24 29)
      (.par .zero (wire channelIn 20 24 29)) := by
  simpa [channelIn, wireEndpoints] using
    (show
      RecursiveLate.NativeStep
        (.par
          (.send (wireEndpoints channelIn 20 24).2 29 .zero)
          (wire channelIn 20 24 29))
        (.output (wireEndpoints channelIn 20 24).2 29)
        (.par .zero (wire channelIn 20 24 29)) from
    wire_native_output channelIn 20 24 29
    )

def middle : Object :=
  ofPorts [channelIn]

def middleRealization : Realization middle where
  offset := 5

def middlePosition : Position middle :=
  ⟨0, by simp [middle, ofPorts]⟩

def producer : RecursiveProc :=
  .send (middleRealization.nameAt middlePosition) 41 .zero

def consumer : RecursiveProc :=
  .recv (middleRealization.nameAt middlePosition) 43
    (.send 80 43 .zero)

theorem concrete_endpoint_plug :
    RecursiveLate.NativeStep
      (plug middleRealization producer consumer)
      .tau
      (hideNames middleRealization.names
        (.par .zero
          ((RecursiveProc.send 80 43 .zero)
            |>.substituteCaptureAvoiding 43 41))) := by
  apply plug_syncLeft_native middleRealization middlePosition
  · exact RecursiveLate.NativeStep.prefixOutput
  · exact RecursiveLate.NativeStep.prefixInput
  · simp [RecursiveProc.freeNames]

end Cantilune.Tests.OpenSMCPolarisedOperational
