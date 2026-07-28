import Cantilune.Pi.OpenSMCBoundaryObstruction

/-!
# Nominal support certificates for open-pi atoms

`OpenSMC.Interface` records only sorts, so the existing `Term.atom`
constructor cannot by itself relate a process's free names to its boundary.
This module adds the missing proof-carrying admission layer for atoms.

A `NamedInterface` contains distinct, typed name occurrences.  An
`AtomBoundaryCertificate` requires the erased process support to be exactly
the union of the input and output supports.  The certificate can be forgotten
to the existing presented SMC atom, while the empty-boundary rejection below
shows that the support premise is substantive.

This is the atomic boundary layer only.  A complete semantic open-pi SMC must
still prove that plug/hide composition, restriction, and native late-pi
transitions preserve this discipline.
-/

namespace Cantilune.Pi.OpenSMCNominalAtomBoundary

open Cantilune.Pi

/-- One named and sorted boundary port in a fixed type environment. -/
structure Port (Γ : TypeEnv) where
  name : Name
  sort : NameSort
  sort_eq : Γ.sort name = sort

namespace Port

/-- Forget the name while retaining the sort used by the presented SMC. -/
def forgetSort {Γ : TypeEnv} (port : Port Γ) : NameSort :=
  port.sort

end Port

/-- A finite ordered boundary with no duplicate name occurrence. -/
structure NamedInterface (Γ : TypeEnv) where
  ports : List (Port Γ)
  names_nodup : (ports.map Port.name).Nodup

namespace NamedInterface

/-- The nominal support carried by a named interface. -/
def names {Γ : TypeEnv} (boundary : NamedInterface Γ) : Finset Name :=
  (boundary.ports.map Port.name).toFinset

/-- The sort-only boundary consumed by the existing presented SMC. -/
def sorts {Γ : TypeEnv} (boundary : NamedInterface Γ) :
    OpenSMC.Interface :=
  boundary.ports.map Port.forgetSort

/-- The empty named boundary. -/
def empty (Γ : TypeEnv) : NamedInterface Γ where
  ports := []
  names_nodup := by simp

@[simp]
theorem names_empty (Γ : TypeEnv) :
    (empty Γ).names = ∅ := by
  rfl

@[simp]
theorem sorts_empty (Γ : TypeEnv) :
    (empty Γ).sorts = [] := by
  rfl

end NamedInterface

/--
Admission evidence tying one typed atom to its complete nominal boundary.

Input and output names are disjoint so that one public occurrence has one
polarity at this atomic layer.  Shared names must instead be represented by
explicit wiring in the later composition layer.
-/
structure AtomBoundaryCertificate
    (Γ : TypeEnv)
    (input output : NamedInterface Γ)
    (process : Proc) : Prop where
  typed : process.WellTyped Γ
  support_exact :
    process.erase.freeNames = input.names ∪ output.names
  input_output_disjoint :
    Disjoint input.names output.names

namespace AtomBoundaryCertificate

/-- Forget a support certificate to an atom of the existing presented SMC. -/
def toTerm
    {Γ : TypeEnv}
    {input output : NamedInterface Γ}
    {process : Proc}
    (certificate : AtomBoundaryCertificate Γ input output process) :
    OpenSMC.Term Γ input.sorts output.sorts :=
  .atom input.sorts output.sorts process certificate.typed

/-- The boundary data uniquely recovers the free support of an admitted atom. -/
theorem freeNames_eq_boundary
    {Γ : TypeEnv}
    {input output : NamedInterface Γ}
    {process : Proc}
    (certificate : AtomBoundaryCertificate Γ input output process) :
    process.erase.freeNames = input.names ∪ output.names :=
  certificate.support_exact

/-- An atom admitted at two empty interfaces is genuinely closed. -/
theorem empty_boundary_closed
    {Γ : TypeEnv}
    {process : Proc}
    (certificate :
      AtomBoundaryCertificate Γ
        (NamedInterface.empty Γ) (NamedInterface.empty Γ) process) :
    process.erase.freeNames = ∅ := by
  simpa using certificate.support_exact

end AtomBoundaryCertificate

/-! ## A nonempty certificate and the empty-boundary rejection -/

open Cantilune.Pi.OpenSMCBoundaryObstruction

/-- The public channel used by `namedProcess`. -/
def channelPort : Port environment where
  name := 0
  sort := .channel
  sort_eq := by simp [environment]

/-- The public data name sent by `namedProcess`. -/
def dataPort : Port environment where
  name := 1
  sort := .data
  sort_eq := by simp [environment]

def namedInput : NamedInterface environment where
  ports := [channelPort]
  names_nodup := by simp

def namedOutput : NamedInterface environment where
  ports := [dataPort]
  names_nodup := by simp

@[simp]
theorem namedInput_names :
    namedInput.names = {0} := by
  rfl

@[simp]
theorem namedOutput_names :
    namedOutput.names = {1} := by
  rfl

/-- The earlier obstruction process is admitted at its actual named support. -/
theorem namedProcessCertificate :
    AtomBoundaryCertificate
      environment namedInput namedOutput namedProcess where
  typed := namedProcess_wellTyped
  support_exact := by
    simp [namedProcess, Proc.erase, Raw.Proc.freeNames]
  input_output_disjoint := by
    simp

/-- The nominal atom layer is nonempty and forgets to a presented SMC atom. -/
theorem nominal_atom_nonempty :
    Nonempty
      (OpenSMC.Term environment namedInput.sorts namedOutput.sorts) :=
  ⟨namedProcessCertificate.toTerm⟩

/--
The same non-closed process cannot be admitted at empty named interfaces.
This is the exact case that the sort-only atom constructor previously allowed.
-/
theorem namedProcess_not_empty_boundary :
    ¬ Nonempty
      (AtomBoundaryCertificate environment
        (NamedInterface.empty environment)
        (NamedInterface.empty environment)
        namedProcess) := by
  rintro ⟨certificate⟩
  have closed := certificate.empty_boundary_closed
  have channelFree :
      0 ∈ namedProcess.erase.freeNames := by
    simp [namedProcess, Proc.erase, Raw.Proc.freeNames]
  rw [closed] at channelFree
  simp at channelFree

end Cantilune.Pi.OpenSMCNominalAtomBoundary
