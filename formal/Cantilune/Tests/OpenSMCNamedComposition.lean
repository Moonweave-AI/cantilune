import Cantilune.Pi.OpenSMCNamedComposition

namespace Cantilune.Tests.OpenSMCNamedComposition

open Cantilune.Pi
open Cantilune.Pi.OpenSMCBoundaryObstruction
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCNamedComposition

#check RestrictionCertificate.restricted_support_exact
#check RestrictionCertificate.toAtomBoundaryCertificate
#check Term.forget
#check Term.forget_plugHide
#check Term.forget_parallel
#check no_left_identity_plug_of_nonempty
#check no_right_identity_plug_of_nonempty
#check forgotten_identity_operationalRoute_zero
#check forgotten_identity_route_not_support_exact
#check forgotten_identity_route_no_native_step

/-- A second public data port, disjoint from the earlier `{0,1}` boundary. -/
def secondDataPort : Port environment where
  name := 2
  sort := .data
  sort_eq := by simp [environment]

def secondDataBoundary : NamedInterface environment where
  ports := [secondDataPort]
  names_nodup := by simp

@[simp]
theorem secondDataBoundary_names :
    secondDataBoundary.names = {2} := by
  rfl

/-- A support-exact right atom for a real named `plugHide` witness. -/
def comparisonProcess : Proc :=
  .matchEq 1 2 .zero

theorem comparisonProcessCertificate :
    AtomBoundaryCertificate
      environment namedOutput secondDataBoundary comparisonProcess where
  typed := by
    simp [comparisonProcess, environment, Proc.WellTyped]
  support_exact := by
    simp [comparisonProcess, Proc.erase, Raw.Proc.freeNames]
  input_output_disjoint := by
    simp

theorem comparisonPlugCertificate :
    PlugCertificate namedInput namedOutput secondDataBoundary where
  hidden_external_disjoint := by
    simp [publicSupport]

/--
The proof-carrying composition layer has a nontrivial inhabitant and forgets
to the corresponding sort-only presented composition.
-/
def comparisonComposition :
    Term environment namedInput secondDataBoundary :=
  .plugHide comparisonPlugCertificate
    (.atom namedProcessCertificate)
    (.atom comparisonProcessCertificate)

example :
    comparisonComposition.forget =
      OpenSMC.Term.plugHide
        namedProcessCertificate.toTerm
        comparisonProcessCertificate.toTerm :=
  rfl

/-- A body that exposes exactly the private channel `0` before restriction. -/
def restrictedBody : Proc :=
  namedProcess

theorem restrictedCertificate :
    RestrictionCertificate environment namedOutput
      (NamedInterface.empty environment) 0 restrictedBody where
  typed := by
    simp [restrictedBody, namedProcess, environment, Proc.WellTyped]
  binder_fresh := by
    simp [publicSupport]
  body_support := by
    ext name
    simp [restrictedBody, namedProcess, publicSupport, Proc.erase,
      Raw.Proc.freeNames]
  input_output_disjoint := by
    simp

example :
    (Proc.new 0 restrictedBody).erase.freeNames = namedOutput.names :=
  by simpa [publicSupport] using restrictedCertificate.restricted_support_exact

def restrictedTerm :
    Term environment namedOutput (NamedInterface.empty environment) :=
  .restrictedAtom restrictedCertificate

example :
    restrictedTerm.forget =
      restrictedCertificate.toAtomBoundaryCertificate.toTerm :=
  rfl

theorem identityParallelCertificate :
    ParallelCertificate
      namedInput namedInput namedOutput namedOutput where
  public_disjoint := by
    simp [publicSupport]

def disjointIdentityParallel :
    Term environment
      (NamedInterface.tensor namedInput namedOutput
        identityParallelCertificate.inputTensor)
      (NamedInterface.tensor namedInput namedOutput
        identityParallelCertificate.outputTensor) :=
  .parallel identityParallelCertificate
    (.identity namedInput)
    (.identity namedOutput)

example :
    HEq disjointIdentityParallel.forget
      (OpenSMC.Term.parallel (Γ := environment)
        (OpenSMC.Term.identity (Γ := environment) namedInput.sorts)
        (OpenSMC.Term.identity (Γ := environment) namedOutput.sorts)) :=
  Term.forget_parallel _ _ _

/--
The exact-name/fresh-hidden discipline demonstrably rejects both category
unit composites at the nonempty example interfaces.
-/
example :
    ¬ PlugCertificate namedInput namedInput namedOutput :=
  no_left_identity_plug_of_nonempty (by simp)

example :
    ¬ PlugCertificate namedInput namedOutput namedOutput :=
  no_right_identity_plug_of_nonempty (by simp)

end Cantilune.Tests.OpenSMCNamedComposition
