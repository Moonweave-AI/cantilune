import Cantilune.Pi.LateAlphaSupport
import Cantilune.Pi.OpenSMCNamedComposition

/-!
# Why bound-name alpha freshening does not repair named identity plugging

The exact-name `PlugCertificate` rejects identity composition at a nonempty
interface because the same middle names are simultaneously public and hidden.
A tempting repair is to choose alpha-equivalent process representatives whose
middle support has been freshened.

This module mechanizes that candidate, including its action on the process
alpha quotient, and proves the precise obstruction: standard pi alpha
equivalence renames *bound* names and therefore preserves free support.  It
cannot create a fresh, occurrence-sensitive copy of a public identity
boundary.  In particular, the current operational identity representative
`zero` cannot satisfy either left- or right-identity plugging at any nonempty
named boundary.

The result does not rule out a future repair.  It identifies the missing
primitive exactly: a polarised free-name alias/wire (with a native operational
semantics), rather than another use of bound-name alpha conversion.
-/

namespace Cantilune.Pi.OpenSMCAlphaFreshPlugObstruction

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCNamedComposition

/-- Raw processes modulo the standard bound-name alpha relation. -/
abbrev AlphaProcess := Quotient Late.Alpha.setoid

/--
Free support descends to the process alpha quotient.

This is the key invariant behind the obstruction: alpha conversion changes
binder spelling but not the public names exposed by a process.
-/
def alphaSupport : AlphaProcess → Finset Name :=
  Quotient.lift Raw.Proc.freeNames (by
    intro left right relation
    exact Late.Alpha.freeNames_eq relation)

@[simp]
theorem alphaSupport_mk (process : Raw.Proc) :
    alphaSupport (Quotient.mk Late.Alpha.setoid process) =
      process.freeNames :=
  rfl

/--
An alpha class realizes a requested support when one of its representatives
has exactly that support.
-/
def RealizesSupport
    (process : AlphaProcess) (support : Finset Name) : Prop :=
  ∃ representative,
    (Quotient.mk Late.Alpha.setoid representative : AlphaProcess) =
      process ∧
    representative.freeNames = support

/--
Representative choice is immaterial: realizable support is exactly the
well-defined quotient support.
-/
theorem realizesSupport_iff
    (process : AlphaProcess) (support : Finset Name) :
    RealizesSupport process support ↔ alphaSupport process = support := by
  constructor
  · rintro ⟨representative, representativeEq, supportEq⟩
    rw [← representativeEq]
    exact supportEq
  · refine Quotient.inductionOn process ?_
    intro representative supportEq
    exact ⟨representative, rfl, supportEq⟩

/--
The strongest plug candidate available from the current ingredients.

It chooses a same-sorted, same-arity fresh copy of the middle boundary,
requires that copy to satisfy the existing exact `PlugCertificate`, and asks
the actual left/right process alpha classes to realize the corresponding
supports.  Thus this is not merely an interface predicate: it checks process
representatives on the alpha quotient.
-/
structure AlphaFreshPlug
    {Γ : TypeEnv}
    (input middle output : NamedInterface Γ)
    (left right : AlphaProcess) where
  freshMiddle : NamedInterface Γ
  same_sorts : freshMiddle.sorts = middle.sorts
  same_arity : freshMiddle.names.card = middle.names.card
  exact_plug : PlugCertificate input freshMiddle output
  left_support :
    RealizesSupport left (input.names ∪ freshMiddle.names)
  right_support :
    RealizesSupport right (freshMiddle.names ∪ output.names)

namespace AlphaFreshPlug

/-- The chosen middle copy really is accepted by exact-name plugging. -/
theorem toPlugCertificate
    (certificate : AlphaFreshPlug input middle output left right) :
    PlugCertificate input certificate.freshMiddle output :=
  certificate.exact_plug

/-- Left support is independent of the selected alpha representative. -/
theorem left_support_eq
    (certificate : AlphaFreshPlug input middle output left right) :
    alphaSupport left =
      input.names ∪ certificate.freshMiddle.names :=
  (realizesSupport_iff _ _).mp certificate.left_support

/-- Right support is independent of the selected alpha representative. -/
theorem right_support_eq
    (certificate : AlphaFreshPlug input middle output left right) :
    alphaSupport right =
      certificate.freshMiddle.names ∪ output.names :=
  (realizesSupport_iff _ _).mp certificate.right_support

end AlphaFreshPlug

private theorem freshMiddle_nonempty
    {Γ : TypeEnv}
    {input middle output : NamedInterface Γ}
    {left right : AlphaProcess}
    (middleNonempty : middle.names.Nonempty)
    (certificate : AlphaFreshPlug input middle output left right) :
    certificate.freshMiddle.names.Nonempty := by
  apply Finset.card_pos.mp
  rw [certificate.same_arity]
  exact Finset.card_pos.mpr middleNonempty

/--
Even an abstract identity representative whose collapsed support is exactly
the boundary cannot be left-plugged by alpha-only freshening.

The fresh copy would have to be both part of the left process's support and
disjoint from the same public boundary.  Since alpha preserves free support,
that is impossible for a nonempty boundary.
-/
theorem no_left_identity_alphaFreshPlug_of_collapsed_support
    {Γ : TypeEnv}
    {boundary output : NamedInterface Γ}
    {identityProcess right : AlphaProcess}
    (boundaryNonempty : boundary.names.Nonempty)
    (identitySupport :
      alphaSupport identityProcess = boundary.names) :
    ¬ Nonempty (AlphaFreshPlug
      boundary boundary output identityProcess right) := by
  rintro ⟨certificate⟩
  have freshNonempty :=
    freshMiddle_nonempty boundaryNonempty certificate
  rcases freshNonempty with ⟨name, inFresh⟩
  have unionEq :
      boundary.names ∪ certificate.freshMiddle.names =
        boundary.names :=
    (certificate.left_support_eq).symm.trans identitySupport
  have inBoundary : name ∈ boundary.names := by
    have inUnion :
        name ∈ boundary.names ∪ certificate.freshMiddle.names :=
      Finset.mem_union_right _ inFresh
    rwa [unionEq] at inUnion
  have notExternal :=
    Finset.disjoint_left.mp
      certificate.exact_plug.hidden_external_disjoint inFresh
  exact notExternal
    (Finset.mem_union_left output.names inBoundary)

/-- Symmetric obstruction for a collapsed right-identity representative. -/
theorem no_right_identity_alphaFreshPlug_of_collapsed_support
    {Γ : TypeEnv}
    {input boundary : NamedInterface Γ}
    {left identityProcess : AlphaProcess}
    (boundaryNonempty : boundary.names.Nonempty)
    (identitySupport :
      alphaSupport identityProcess = boundary.names) :
    ¬ Nonempty (AlphaFreshPlug
      input boundary boundary left identityProcess) := by
  rintro ⟨certificate⟩
  have freshNonempty :=
    freshMiddle_nonempty boundaryNonempty certificate
  rcases freshNonempty with ⟨name, inFresh⟩
  have unionEq :
      certificate.freshMiddle.names ∪ boundary.names =
        boundary.names :=
    (certificate.right_support_eq).symm.trans identitySupport
  have inBoundary : name ∈ boundary.names := by
    have inUnion :
        name ∈ certificate.freshMiddle.names ∪ boundary.names :=
      Finset.mem_union_left _ inFresh
    rwa [unionEq] at inUnion
  have notExternal :=
    Finset.disjoint_left.mp
      certificate.exact_plug.hidden_external_disjoint inFresh
  exact notExternal
    (Finset.mem_union_right input.names inBoundary)

/-- The alpha class used by the existing operational route for identity. -/
def zeroAlphaProcess : AlphaProcess :=
  Quotient.mk Late.Alpha.setoid Raw.Proc.zero

@[simp]
theorem alphaSupport_zero :
    alphaSupport zeroAlphaProcess = ∅ :=
  rfl

/--
The current `zero` operational identity cannot be left-plugged at a nonempty
named boundary, even after arbitrary bound-name alpha conversion.
-/
theorem zero_identity_not_left_alphaFreshPlug
    {Γ : TypeEnv}
    {boundary output : NamedInterface Γ}
    {right : AlphaProcess}
    (boundaryNonempty : boundary.names.Nonempty) :
    ¬ Nonempty (AlphaFreshPlug
      boundary boundary output zeroAlphaProcess right) := by
  rintro ⟨certificate⟩
  rcases boundaryNonempty with ⟨name, inBoundary⟩
  have supportEq := certificate.left_support_eq
  have inUnion :
      name ∈ boundary.names ∪ certificate.freshMiddle.names :=
    Finset.mem_union_left _ inBoundary
  rw [alphaSupport_zero] at supportEq
  rw [← supportEq] at inUnion
  simp at inUnion

/-- Symmetric failure of the current `zero` operational right identity. -/
theorem zero_identity_not_right_alphaFreshPlug
    {Γ : TypeEnv}
    {input boundary : NamedInterface Γ}
    {left : AlphaProcess}
    (boundaryNonempty : boundary.names.Nonempty) :
    ¬ Nonempty (AlphaFreshPlug
      input boundary boundary left zeroAlphaProcess) := by
  rintro ⟨certificate⟩
  rcases boundaryNonempty with ⟨name, inBoundary⟩
  have supportEq := certificate.right_support_eq
  have inUnion :
      name ∈ certificate.freshMiddle.names ∪ boundary.names :=
    Finset.mem_union_right _ inBoundary
  rw [alphaSupport_zero] at supportEq
  rw [← supportEq] at inUnion
  simp at inUnion

end Cantilune.Pi.OpenSMCAlphaFreshPlugObstruction
