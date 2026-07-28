import Cantilune.Pi.ExternalFMS
import Cantilune.Pi.OpenSMCNominalAtomBoundary

/-!
# Proof-carrying named composition for the presented open-pi layer

The sort-only `OpenSMC` presentation has total algebraic composition, but it
does not record which concrete names are connected or hidden.  This module
adds a deliberately smaller proof-carrying layer:

* atoms retain the exact nominal-support certificate;
* restriction records the private binder, its freshness for the public
  boundary, and the support exposed before hiding it;
* plugging records the exact shared middle interface and proves that its names
  are fresh for the external boundary;
* parallel placement records disjoint support and therefore constructs
  duplicate-free tensor boundaries.

Every constructor forgets compositionally to the existing presented
`OpenSMC.Term`.  No native operational adequacy theorem is claimed.  In fact,
the final theorems isolate two precise obstructions in the current semantics:

1. exact-name plugging plus external freshness cannot support category identity
   composition at a nonempty interface;
2. the existing external operational route interprets a presented identity as
   raw `zero`, whose support cannot realize a nonempty named wire.

Resolving those obstructions requires an explicit alpha-fresh wiring/renaming
choice (and its native late-pi semantics); it cannot be derived from the
current sort-only presentation.
-/

namespace Cantilune.Pi.OpenSMCNamedComposition

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary

/-- Public support of a named input/output boundary pair. -/
def publicSupport {Γ : TypeEnv}
    (input output : NamedInterface Γ) : Finset Name :=
  input.names ∪ output.names

/--
Evidence that two named boundaries may be placed side by side without
duplicating a public name occurrence.
-/
structure TensorBoundaryCertificate {Γ : TypeEnv}
    (left right : NamedInterface Γ) : Prop where
  names_disjoint : Disjoint left.names right.names

namespace NamedInterface

/--
Concatenate two disjoint named boundaries.  The disjointness proof is the
resource-sensitive fact missing from sort-list concatenation alone.
-/
def tensor {Γ : TypeEnv}
    (left right : NamedInterface Γ)
    (certificate : TensorBoundaryCertificate left right) :
    NamedInterface Γ where
  ports := left.ports ++ right.ports
  names_nodup := by
    simp only [List.map_append]
    rw [List.nodup_append]
    refine ⟨left.names_nodup, right.names_nodup, ?_⟩
    intro leftName inLeft rightName inRight equal
    subst rightName
    have inLeft' : leftName ∈ left.names := by
      simpa [NamedInterface.names] using inLeft
    have inRight' : leftName ∈ right.names := by
      simpa [NamedInterface.names] using inRight
    exact
      (Finset.disjoint_left.mp certificate.names_disjoint)
        inLeft' inRight'

@[simp]
theorem tensor_names {Γ : TypeEnv}
    (left right : NamedInterface Γ)
    (certificate : TensorBoundaryCertificate left right) :
    (tensor left right certificate).names = left.names ∪ right.names := by
  simp [tensor, NamedInterface.names]

@[simp]
theorem tensor_sorts {Γ : TypeEnv}
    (left right : NamedInterface Γ)
    (certificate : TensorBoundaryCertificate left right) :
    (tensor left right certificate).sorts = left.sorts ++ right.sorts := by
  simp [tensor, NamedInterface.sorts]

end NamedInterface

/--
Certificate for exact-name boundary plugging.  The middle names are hidden,
so none may remain on the composite's external input/output boundary.
-/
structure PlugCertificate {Γ : TypeEnv}
    (input middle output : NamedInterface Γ) : Prop where
  hidden_external_disjoint :
    Disjoint middle.names (publicSupport input output)

namespace PlugCertificate

theorem hidden_input_disjoint {Γ : TypeEnv}
    {input middle output : NamedInterface Γ}
    (certificate : PlugCertificate input middle output) :
    Disjoint middle.names input.names :=
  certificate.hidden_external_disjoint.mono_right
    (Finset.subset_union_left)

theorem hidden_output_disjoint {Γ : TypeEnv}
    {input middle output : NamedInterface Γ}
    (certificate : PlugCertificate input middle output) :
    Disjoint middle.names output.names :=
  certificate.hidden_external_disjoint.mono_right
    (Finset.subset_union_right)

end PlugCertificate

/--
Parallel placement requires complete left/right public-support separation.
The two tensor-boundary certificates are derived rather than supplied as
independent, potentially inconsistent evidence.
-/
structure ParallelCertificate {Γ : TypeEnv}
    (leftInput leftOutput rightInput rightOutput : NamedInterface Γ) : Prop where
  public_disjoint :
    Disjoint
      (publicSupport leftInput leftOutput)
      (publicSupport rightInput rightOutput)

namespace ParallelCertificate

theorem inputTensor {Γ : TypeEnv}
    {leftInput leftOutput rightInput rightOutput : NamedInterface Γ}
    (certificate :
      ParallelCertificate leftInput leftOutput rightInput rightOutput) :
    TensorBoundaryCertificate leftInput rightInput where
  names_disjoint :=
    certificate.public_disjoint.mono
      Finset.subset_union_left Finset.subset_union_left

theorem outputTensor {Γ : TypeEnv}
    {leftInput leftOutput rightInput rightOutput : NamedInterface Γ}
    (certificate :
      ParallelCertificate leftInput leftOutput rightInput rightOutput) :
    TensorBoundaryCertificate leftOutput rightOutput where
  names_disjoint :=
    certificate.public_disjoint.mono
      Finset.subset_union_right Finset.subset_union_right

end ParallelCertificate

/--
Proof that one restriction hides exactly one private name from an otherwise
support-exact atom.
-/
structure RestrictionCertificate
    (Γ : TypeEnv)
    (input output : NamedInterface Γ)
    (binder : Name)
    (body : Proc) : Prop where
  typed : (Proc.new binder body).WellTyped Γ
  binder_fresh : binder ∉ publicSupport input output
  body_support :
    body.erase.freeNames = insert binder (publicSupport input output)
  input_output_disjoint :
    Disjoint input.names output.names

namespace RestrictionCertificate

/-- Hiding the certified binder leaves exactly the public boundary support. -/
theorem restricted_support_exact
    {Γ : TypeEnv}
    {input output : NamedInterface Γ}
    {binder : Name}
    {body : Proc}
    (certificate :
      RestrictionCertificate Γ input output binder body) :
    (Proc.new binder body).erase.freeNames =
      publicSupport input output := by
  simp [Proc.erase, Raw.Proc.freeNames, certificate.body_support,
    certificate.binder_fresh]

/-- Forget restriction evidence to the already checked atomic admission form. -/
theorem toAtomBoundaryCertificate
    {Γ : TypeEnv}
    {input output : NamedInterface Γ}
    {binder : Name}
    {body : Proc}
    (certificate :
      RestrictionCertificate Γ input output binder body) :
    AtomBoundaryCertificate Γ input output (Proc.new binder body) where
  typed := certificate.typed
  support_exact := certificate.restricted_support_exact
  input_output_disjoint := certificate.input_output_disjoint

end RestrictionCertificate

/--
Named, proof-carrying fragment of the open-process presentation.

`plugHide` is intentionally partial through `PlugCertificate`.  This makes
the current freshness discipline explicit and exposes the identity
obstruction below instead of hiding an unproved alpha-renaming operation.
-/
inductive Term (Γ : TypeEnv) :
    NamedInterface Γ → NamedInterface Γ → Type
  | identity (boundary : NamedInterface Γ) :
      Term Γ boundary boundary
  | atom
      {input output : NamedInterface Γ}
      {process : Proc}
      (certificate : AtomBoundaryCertificate Γ input output process) :
      Term Γ input output
  | restrictedAtom
      {input output : NamedInterface Γ}
      {binder : Name}
      {body : Proc}
      (certificate :
        RestrictionCertificate Γ input output binder body) :
      Term Γ input output
  | plugHide
      {input middle output : NamedInterface Γ}
      (certificate : PlugCertificate input middle output)
      (left : Term Γ input middle)
      (right : Term Γ middle output) :
      Term Γ input output
  | parallel
      {leftInput leftOutput rightInput rightOutput : NamedInterface Γ}
      (certificate :
        ParallelCertificate
          leftInput leftOutput rightInput rightOutput)
      (left : Term Γ leftInput leftOutput)
      (right : Term Γ rightInput rightOutput) :
      Term Γ
        (NamedInterface.tensor leftInput rightInput certificate.inputTensor)
        (NamedInterface.tensor leftOutput rightOutput certificate.outputTensor)

namespace Term

/-- Forget names and all proof certificates to the existing sort-only term. -/
def forget {Γ : TypeEnv} :
    {input output : NamedInterface Γ} →
      Term Γ input output →
      OpenSMC.Term Γ input.sorts output.sorts
  | _, _, .identity boundary =>
      .identity boundary.sorts
  | _, _, .atom certificate =>
      certificate.toTerm
  | _, _, .restrictedAtom certificate =>
      certificate.toAtomBoundaryCertificate.toTerm
  | _, _, .plugHide _ left right =>
      .plugHide left.forget right.forget
  | _, _, .parallel certificate left right => by
      simpa using
        (OpenSMC.Term.parallel left.forget right.forget)

@[simp]
theorem forget_identity {Γ : TypeEnv}
    (boundary : NamedInterface Γ) :
    (Term.identity boundary).forget =
      OpenSMC.Term.identity boundary.sorts :=
  rfl

@[simp]
theorem forget_atom {Γ : TypeEnv}
    {input output : NamedInterface Γ}
    {process : Proc}
    (certificate : AtomBoundaryCertificate Γ input output process) :
    (Term.atom certificate).forget = certificate.toTerm :=
  rfl

@[simp]
theorem forget_restrictedAtom {Γ : TypeEnv}
    {input output : NamedInterface Γ}
    {binder : Name}
    {body : Proc}
    (certificate :
      RestrictionCertificate Γ input output binder body) :
    (Term.restrictedAtom certificate).forget =
      certificate.toAtomBoundaryCertificate.toTerm :=
  rfl

@[simp]
theorem forget_plugHide {Γ : TypeEnv}
    {input middle output : NamedInterface Γ}
    (certificate : PlugCertificate input middle output)
    (left : Term Γ input middle)
    (right : Term Γ middle output) :
    (Term.plugHide certificate left right).forget =
      OpenSMC.Term.plugHide left.forget right.forget :=
  rfl

@[simp]
theorem forget_parallel {Γ : TypeEnv}
    {leftInput leftOutput rightInput rightOutput : NamedInterface Γ}
    (certificate :
      ParallelCertificate leftInput leftOutput rightInput rightOutput)
    (left : Term Γ leftInput leftOutput)
    (right : Term Γ rightInput rightOutput) :
    HEq (Term.parallel certificate left right).forget
      (OpenSMC.Term.parallel left.forget right.forget) := by
  simp only [forget]
  exact cast_heq _ _

end Term

/-! ## Exact obstructions to a total named category and native wiring claim -/

/--
With exact-name matching, a nonempty boundary cannot be both the source
boundary of an identity and fresh hidden support for a following morphism.
-/
theorem no_left_identity_plug_of_nonempty
    {Γ : TypeEnv}
    {boundary output : NamedInterface Γ}
    (nonempty : boundary.names.Nonempty) :
    ¬ PlugCertificate boundary boundary output := by
  intro certificate
  rcases nonempty with ⟨name, inBoundary⟩
  have notExternal :
      name ∉ publicSupport boundary output :=
    Finset.disjoint_left.mp
      certificate.hidden_external_disjoint inBoundary
  exact notExternal (Finset.mem_union_left _ inBoundary)

/--
The symmetric right-identity obstruction: a nonempty output cannot be hidden
and simultaneously remain the composite's public output.
-/
theorem no_right_identity_plug_of_nonempty
    {Γ : TypeEnv}
    {input boundary : NamedInterface Γ}
    (nonempty : boundary.names.Nonempty) :
    ¬ PlugCertificate input boundary boundary := by
  intro certificate
  rcases nonempty with ⟨name, inBoundary⟩
  have notExternal :
      name ∉ publicSupport input boundary :=
    Finset.disjoint_left.mp
      certificate.hidden_external_disjoint inBoundary
  exact notExternal (Finset.mem_union_right _ inBoundary)

/--
Forgetting a named identity and taking the current external operational route
always yields raw `zero`; no wiring process is supplied by `OpenSMC`.
-/
theorem forgotten_identity_operationalRoute_zero
    {model : ExternalFMS}
    (interpretation : ExternalFMS.OpenInterpretation model)
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ) :
    interpretation.operationalRoute
        (Term.identity boundary).forget =
      Raw.Proc.zero :=
  rfl

/--
Consequently the current operational route cannot be support-exact for a
nonempty named identity boundary.  This is a statement about the existing
route, not a claim that no future explicit wiring semantics can exist.
-/
theorem forgotten_identity_route_not_support_exact
    {model : ExternalFMS}
    (interpretation : ExternalFMS.OpenInterpretation model)
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ)
    (nonempty : boundary.names.Nonempty) :
    (interpretation.operationalRoute
        (Term.identity boundary).forget).freeNames ≠
      boundary.names := by
  rw [forgotten_identity_operationalRoute_zero]
  simp only [Raw.Proc.freeNames]
  intro supportEquality
  have boundaryEmpty : boundary.names = ∅ := supportEquality.symm
  rw [boundaryEmpty] at nonempty
  simp at nonempty

/-- Raw `zero` has no native strong-late transition realizing a wire action. -/
theorem forgotten_identity_route_no_native_step
    {model : ExternalFMS}
    (interpretation : ExternalFMS.OpenInterpretation model)
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ) :
    ¬ ∃ action target,
      Late.NativeStep
        (interpretation.operationalRoute
          (Term.identity boundary).forget)
        action target := by
  rw [forgotten_identity_operationalRoute_zero]
  rintro ⟨action, target, step⟩
  cases step

end Cantilune.Pi.OpenSMCNamedComposition
