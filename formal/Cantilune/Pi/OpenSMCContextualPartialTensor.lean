import Cantilune.Pi.OpenSMCContextualBoundaryCategory

/-!
# The partial tensor boundary of contextual open processes

Named interfaces cannot be tensored totally by concatenation: two interfaces
may expose the same concrete name.  This module therefore keeps the existing
proof-carrying disjointness certificate and constructs the largest honest
tensor available without inventing fresh, sort-preserving names.

For bodies with no pending wiring program, structural parallel gives a
partial tensor satisfying identity and composition interchange.  Associator,
unitors, and symmetry are represented by empty contextual bodies, and their
inverse laws hold.

The tensor does not extend to arbitrary contextual wiring programs.  Both
composition and tensor concatenate programs, and those programs are
operationally ordered.  A concrete kernel theorem shows interchange failing.
Together with the non-injective mismatch-fusion counterexample in the parent
module, this blocks a total operational SMC claim.
-/

namespace Cantilune.Pi.OpenSMCContextualPartialTensor

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCNamedComposition
open Cantilune.Pi.OpenSMCContextualBoundaryCategory

/-! ## Proof-carrying object tensor -/

abbrev TensorCertificate {Γ : TypeEnv} :=
  @TensorBoundaryCertificate Γ

def tensorObject
    (left right : NamedInterface Γ)
    (certificate : TensorCertificate left right) :
    NamedInterface Γ :=
  NamedInterface.tensor left right certificate

def tensorEmptyLeft (boundary : NamedInterface Γ) :
    TensorCertificate (NamedInterface.empty Γ) boundary where
  names_disjoint := by simp

def tensorEmptyRight (boundary : NamedInterface Γ) :
    TensorCertificate boundary (NamedInterface.empty Γ) where
  names_disjoint := by simp

def tensorSwapCertificate
    (certificate : TensorCertificate left right) :
    TensorCertificate right left where
  names_disjoint := certificate.names_disjoint.symm

/--
All four certificates needed to form both bracketings of a three-object
tensor.  Carrying them explicitly avoids assuming an unavailable global fresh
name supply.
-/
structure AssociativeTensorCertificate
    (first second third : NamedInterface Γ) where
  first_second : TensorCertificate first second
  second_third : TensorCertificate second third
  left_third :
    TensorCertificate
      (tensorObject first second first_second) third
  first_right :
    TensorCertificate first
      (tensorObject second third second_third)

@[simp]
theorem tensorObject_ports
    (left right : NamedInterface Γ)
    (certificate : TensorCertificate left right) :
    (tensorObject left right certificate).ports =
      left.ports ++ right.ports :=
  rfl

private theorem namedInterface_eq_of_ports_eq
    {left right : NamedInterface Γ}
    (portsEq : left.ports = right.ports) :
    left = right := by
  cases left with
  | mk leftPorts leftNodup =>
      cases right with
      | mk rightPorts rightNodup =>
          simp only at portsEq
          subst rightPorts
          rfl

theorem tensorObject_assoc
    (certificate :
      AssociativeTensorCertificate first second third) :
    tensorObject
        (tensorObject first second certificate.first_second)
        third certificate.left_third =
      tensorObject first
        (tensorObject second third certificate.second_third)
        certificate.first_right := by
  apply namedInterface_eq_of_ports_eq
  simp [tensorObject, NamedInterface.tensor, List.append_assoc]

theorem tensorObject_left_unit
    (boundary : NamedInterface Γ) :
    tensorObject (NamedInterface.empty Γ) boundary
        (tensorEmptyLeft boundary) =
      boundary := by
  apply namedInterface_eq_of_ports_eq
  simp [tensorObject, NamedInterface.tensor, NamedInterface.empty]

theorem tensorObject_right_unit
    (boundary : NamedInterface Γ) :
    tensorObject boundary (NamedInterface.empty Γ)
        (tensorEmptyRight boundary) =
      boundary := by
  apply namedInterface_eq_of_ports_eq
  simp [tensorObject, NamedInterface.tensor, NamedInterface.empty]

/-- A nonempty named interface cannot be tensored with itself by concatenation. -/
theorem no_self_tensor_certificate
    (nonempty : boundary.names.Nonempty) :
    ¬ Nonempty (TensorCertificate boundary boundary) := by
  rintro ⟨certificate⟩
  rcases nonempty with ⟨name, member⟩
  exact
    (Finset.disjoint_left.mp certificate.names_disjoint member member)

/-! ## Structural interchange -/

theorem structuralPar_comm
    (left right : StructuralProcess) :
    structuralPar left right = structuralPar right left := by
  refine Quotient.inductionOn₂ left right ?_
  intro left right
  exact Quotient.sound Late.Struct.parComm

theorem structuralPar_interchange
    (first second third fourth : StructuralProcess) :
    structuralPar
        (structuralPar first second)
        (structuralPar third fourth) =
      structuralPar
        (structuralPar first third)
        (structuralPar second fourth) := by
  refine Quotient.inductionOn first ?_
  intro first
  refine Quotient.inductionOn second ?_
  intro second
  refine Quotient.inductionOn third ?_
  intro third
  refine Quotient.inductionOn fourth ?_
  intro fourth
  apply Quotient.sound
  exact Late.Struct.trans
    Late.Struct.parAssoc
    (Late.Struct.trans
      (Late.Struct.par
        (Late.Struct.refl first)
        (Late.Struct.trans
          (Late.Struct.symm Late.Struct.parAssoc)
          (Late.Struct.trans
            (Late.Struct.par Late.Struct.parComm
              (Late.Struct.refl fourth))
            Late.Struct.parAssoc)))
      (Late.Struct.symm Late.Struct.parAssoc))

/-! ## Pure contextual processes -/

/--
Contextual bodies with no pending wiring program.

This is a genuine category and embeds into `ContextualOpenProcess` by adding
the empty program.
-/
structure PureContextualOpenProcess
    {Γ : TypeEnv}
    (input output : NamedInterface Γ) where
  body : StructuralProcess

namespace PureContextualOpenProcess

def toContextual
    (process : PureContextualOpenProcess input output) :
    ContextualOpenProcess input output where
  body := process.body
  wiring := { program := [] }

def identity (boundary : NamedInterface Γ) :
    PureContextualOpenProcess boundary boundary where
  body := structuralZero

def comp
    (left : PureContextualOpenProcess input middle)
    (right : PureContextualOpenProcess middle output) :
    PureContextualOpenProcess input output where
  body := structuralPar left.body right.body

@[simp]
theorem comp_identity_left
    (process : PureContextualOpenProcess input output) :
    comp (identity input) process = process := by
  cases process
  simp [comp, identity]

@[simp]
theorem comp_identity_right
    (process : PureContextualOpenProcess input output) :
    comp process (identity output) = process := by
  cases process
  simp [comp, identity]

theorem comp_assoc
    (first : PureContextualOpenProcess a b)
    (second : PureContextualOpenProcess b c)
    (third : PureContextualOpenProcess c d) :
    comp (comp first second) third =
      comp first (comp second third) := by
  cases first
  cases second
  cases third
  simp [comp, structuralPar_assoc]

instance pureContextualCategory (Γ : TypeEnv) :
    CategoryTheory.Category (NamedInterface Γ) where
  Hom := PureContextualOpenProcess
  id := identity
  comp := comp
  id_comp := comp_identity_left
  comp_id := comp_identity_right
  assoc := comp_assoc

/-- Partial tensor on pure morphisms with disjoint input/output boundaries. -/
def tensor
    (inputCertificate : TensorCertificate leftInput rightInput)
    (outputCertificate : TensorCertificate leftOutput rightOutput)
    (left : PureContextualOpenProcess leftInput leftOutput)
    (right : PureContextualOpenProcess rightInput rightOutput) :
    PureContextualOpenProcess
      (tensorObject leftInput rightInput inputCertificate)
      (tensorObject leftOutput rightOutput outputCertificate) where
  body := structuralPar left.body right.body

@[simp]
theorem tensor_identity
    (certificate : TensorCertificate left right) :
    tensor certificate certificate
        (identity left) (identity right) =
      identity (tensorObject left right certificate) := by
  simp [tensor, identity]

/-- Bifunctor interchange on the pure, disjoint tensor scope. -/
theorem tensor_comp_interchange
    (inputCertificate : TensorCertificate a d)
    (middleCertificate : TensorCertificate b e)
    (outputCertificate : TensorCertificate c f)
    (left₁ : PureContextualOpenProcess a b)
    (left₂ : PureContextualOpenProcess b c)
    (right₁ : PureContextualOpenProcess d e)
    (right₂ : PureContextualOpenProcess e f) :
    tensor inputCertificate outputCertificate
        (comp left₁ left₂) (comp right₁ right₂) =
      comp
        (tensor inputCertificate middleCertificate left₁ right₁)
        (tensor middleCertificate outputCertificate left₂ right₂) := by
  cases left₁
  cases left₂
  cases right₁
  cases right₂
  simp [tensor, comp, structuralPar_interchange]

/-- Empty-body coherence arrow between any two named interfaces. -/
def coherence
    (source target : NamedInterface Γ) :
    PureContextualOpenProcess source target where
  body := structuralZero

def associator
    (certificate :
      AssociativeTensorCertificate first second third) :
    PureContextualOpenProcess
      (tensorObject
        (tensorObject first second certificate.first_second)
        third certificate.left_third)
      (tensorObject first
        (tensorObject second third certificate.second_third)
        certificate.first_right) :=
  coherence _ _

def associatorInv
    (certificate :
      AssociativeTensorCertificate first second third) :
    PureContextualOpenProcess
      (tensorObject first
        (tensorObject second third certificate.second_third)
        certificate.first_right)
      (tensorObject
        (tensorObject first second certificate.first_second)
        third certificate.left_third) :=
  coherence _ _

@[simp]
theorem associator_hom_inv
    (certificate :
      AssociativeTensorCertificate first second third) :
    comp (associator certificate) (associatorInv certificate) =
      identity
        (tensorObject
          (tensorObject first second certificate.first_second)
          third certificate.left_third) := by
  simp [associator, associatorInv, coherence, comp, identity]

def leftUnitor (boundary : NamedInterface Γ) :
    PureContextualOpenProcess
      (tensorObject (NamedInterface.empty Γ) boundary
        (tensorEmptyLeft boundary))
      boundary :=
  coherence _ _

def leftUnitorInv (boundary : NamedInterface Γ) :
    PureContextualOpenProcess boundary
      (tensorObject (NamedInterface.empty Γ) boundary
        (tensorEmptyLeft boundary)) :=
  coherence _ _

@[simp]
theorem leftUnitor_hom_inv (boundary : NamedInterface Γ) :
    comp (leftUnitor boundary) (leftUnitorInv boundary) =
      identity
        (tensorObject (NamedInterface.empty Γ) boundary
          (tensorEmptyLeft boundary)) := by
  simp [leftUnitor, leftUnitorInv, coherence, comp, identity]

def braid
    (certificate : TensorCertificate left right) :
    PureContextualOpenProcess
      (tensorObject left right certificate)
      (tensorObject right left
        (tensorSwapCertificate certificate)) :=
  coherence _ _

@[simp]
theorem braid_hom_inv
    (certificate : TensorCertificate left right) :
    comp (braid certificate)
        (braid (tensorSwapCertificate certificate)) =
      identity (tensorObject left right certificate) := by
  simp [braid, coherence, comp, identity]

end PureContextualOpenProcess

/-! ## Ordered wiring prevents total bifunctor interchange -/

/-- The same partial object tensor applied to arbitrary contextual morphisms. -/
def contextualTensor
    (inputCertificate : TensorCertificate leftInput rightInput)
    (outputCertificate : TensorCertificate leftOutput rightOutput)
    (left : ContextualOpenProcess leftInput leftOutput)
    (right : ContextualOpenProcess rightInput rightOutput) :
    ContextualOpenProcess
      (tensorObject leftInput rightInput inputCertificate)
      (tensorObject leftOutput rightOutput outputCertificate) where
  body := structuralPar left.body right.body
  wiring :=
    { program := left.wiring.program ++ right.wiring.program }

def emptyTensorCertificate (Γ : TypeEnv) :
    TensorCertificate
      (NamedInterface.empty Γ) (NamedInterface.empty Γ) :=
  tensorEmptyLeft (NamedInterface.empty Γ)

def wiringWitness
    (Γ : TypeEnv) (program : List WiringOp) :
    ContextualOpenProcess
      (NamedInterface.empty Γ) (NamedInterface.empty Γ) where
  body := structuralZero
  wiring := { program := program }

/--
Ordered wiring programs refute bifunctor interchange for arbitrary contextual
morphisms.  The two sides order `restrict 3` and `fuse 1 2` differently.
-/
theorem contextualTensor_interchange_fails (Γ : TypeEnv) :
    let certificate := emptyTensorCertificate Γ
    let first := wiringWitness Γ [.fuse 0 1]
    let second := wiringWitness Γ [.fuse 1 2]
    let third := wiringWitness Γ [.restrict 3]
    let fourth := wiringWitness Γ []
    contextualTensor certificate certificate
        (ContextualOpenProcess.comp first second)
        (ContextualOpenProcess.comp third fourth) ≠
      ContextualOpenProcess.comp
        (contextualTensor certificate certificate first third)
        (contextualTensor certificate certificate second fourth) := by
  simp [emptyTensorCertificate, wiringWitness, contextualTensor,
    ContextualOpenProcess.comp, BoundaryWiring.comp]

end Cantilune.Pi.OpenSMCContextualPartialTensor
