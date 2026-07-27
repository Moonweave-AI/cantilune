import Cantilune.Pi.OpenSMCContextualPartialTensor

namespace Cantilune.Tests.OpenSMCContextualPartialTensor

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCContextualPartialTensor
open CategoryTheory

#check tensorObject_assoc
#check no_self_tensor_certificate
#check structuralPar_interchange
#check PureContextualOpenProcess.tensor_identity
#check PureContextualOpenProcess.tensor_comp_interchange
#check PureContextualOpenProcess.associator_hom_inv
#check PureContextualOpenProcess.leftUnitor_hom_inv
#check PureContextualOpenProcess.braid_hom_inv
#check contextualTensor_interchange_fails

def environment : TypeEnv where
  sort _ := .channel
  payload _ := .data

def port0 : Port environment where
  name := 0
  sort := .channel
  sort_eq := rfl

def boundary : NamedInterface environment where
  ports := [port0]
  names_nodup := by simp [port0]

#synth Category (NamedInterface environment)

theorem boundary_nonempty : boundary.names.Nonempty := by
  simp [boundary, NamedInterface.names, port0]

theorem self_tensor_rejected :
    ¬ Nonempty (TensorCertificate boundary boundary) :=
  no_self_tensor_certificate boundary_nonempty

def empty := NamedInterface.empty environment
def emptyCertificate := emptyTensorCertificate environment

def first : PureContextualOpenProcess empty empty where
  body := Quotient.mk Late.Struct.setoid (.tau .zero)

def second : PureContextualOpenProcess empty empty where
  body := Quotient.mk Late.Struct.setoid (.send 0 1 .zero)

theorem pure_tensor_identity :
    PureContextualOpenProcess.tensor
        emptyCertificate emptyCertificate
        (PureContextualOpenProcess.identity empty)
        (PureContextualOpenProcess.identity empty) =
      PureContextualOpenProcess.identity
        (tensorObject empty empty emptyCertificate) :=
  PureContextualOpenProcess.tensor_identity emptyCertificate

theorem pure_tensor_interchange :
    PureContextualOpenProcess.tensor
        emptyCertificate emptyCertificate
        (PureContextualOpenProcess.comp first first)
        (PureContextualOpenProcess.comp second second) =
      PureContextualOpenProcess.comp
        (PureContextualOpenProcess.tensor
          emptyCertificate emptyCertificate first second)
        (PureContextualOpenProcess.tensor
          emptyCertificate emptyCertificate first second) :=
  PureContextualOpenProcess.tensor_comp_interchange
    emptyCertificate emptyCertificate emptyCertificate
    first first second second

theorem ordered_wiring_not_bifunctorial :
    let certificate := emptyTensorCertificate environment
    let first := wiringWitness environment [.fuse 0 1]
    let second := wiringWitness environment [.fuse 1 2]
    let third := wiringWitness environment [.restrict 3]
    let fourth := wiringWitness environment []
    contextualTensor certificate certificate
        (Cantilune.Pi.OpenSMCContextualBoundaryCategory.ContextualOpenProcess.comp
          first second)
        (Cantilune.Pi.OpenSMCContextualBoundaryCategory.ContextualOpenProcess.comp
          third fourth) ≠
      Cantilune.Pi.OpenSMCContextualBoundaryCategory.ContextualOpenProcess.comp
        (contextualTensor certificate certificate first third)
        (contextualTensor certificate certificate second fourth) :=
  contextualTensor_interchange_fails environment

end Cantilune.Tests.OpenSMCContextualPartialTensor
