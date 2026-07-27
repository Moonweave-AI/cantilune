import Cantilune.Pi.OpenSMCTotalNamedBoundary

/-!
# Composable boundary renaming, and its exact wire boundary

`OpenSMCTotalNamedBoundary.BoundaryRenaming` already records the smallest
sort-preserving public-name transport currently justified by the named
boundary experiments.  This module proves that this existing candidate has
identity and sequential composition, and that sequential freshening remains
fresh for an enlarged finite avoidance set.

These are metadata-level results only.  In particular, no raw process is
renamed, no identity process is manufactured, and no category or symmetric
monoidal instance is installed.  The final results make that boundary
explicit: the current support projection forgets input/output polarity, and
the atom certificate cannot represent a nonempty same-name wire because it
requires its input and output supports to be disjoint.
-/

namespace Cantilune.Pi.OpenSMCBoundaryRenamingCalculus

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCNamedComposition
open Cantilune.Pi.OpenSMCTotalNamedBoundary

namespace BoundaryRenaming

/-- Every named boundary has a sort-preserving identity renaming. -/
def identity {Γ : TypeEnv} (boundary : NamedInterface Γ) :
    BoundaryRenaming boundary boundary where
  nameMap := id
  sorts_eq := rfl
  names_eq := by
    simp
  injective_on := by
    intro left _ right _ equality
    exact equality
  sort_preserving_on := by
    intro name _
    rfl

/-- A source name is carried into the target support. -/
theorem nameMap_mem
    {Γ : TypeEnv}
    {source target : NamedInterface Γ}
    (mapping : BoundaryRenaming source target)
    {name : Name}
    (member : name ∈ source.names) :
    mapping.nameMap name ∈ target.names := by
  rw [mapping.names_eq]
  exact Finset.mem_image.mpr ⟨name, member, rfl⟩

/--
Sequential composition of existing boundary-renaming certificates.

The second map is injective where it is needed because the first map lands
in the intermediate boundary support.
-/
def comp
    {Γ : TypeEnv}
    {source middle target : NamedInterface Γ}
    (first : BoundaryRenaming source middle)
    (second : BoundaryRenaming middle target) :
    BoundaryRenaming source target where
  nameMap := second.nameMap ∘ first.nameMap
  sorts_eq := second.sorts_eq.trans first.sorts_eq
  names_eq := by
    calc
      target.names =
          middle.names.image second.nameMap :=
        second.names_eq
      _ =
          (source.names.image first.nameMap).image second.nameMap := by
        rw [first.names_eq]
      _ =
          source.names.image (second.nameMap ∘ first.nameMap) := by
        rw [Finset.image_image]
  injective_on := by
    intro left leftMember right rightMember equality
    apply first.injective_on leftMember rightMember
    exact second.injective_on
      (nameMap_mem first leftMember)
      (nameMap_mem first rightMember)
      equality
  sort_preserving_on := by
    intro name member
    exact
      (second.sort_preserving_on
        (first.nameMap name) (nameMap_mem first member)).trans
      (first.sort_preserving_on name member)

@[simp]
theorem identity_nameMap
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ)
    (name : Name) :
    (identity boundary).nameMap name = name :=
  rfl

@[simp]
theorem comp_nameMap
    {Γ : TypeEnv}
    {source middle target : NamedInterface Γ}
    (first : BoundaryRenaming source middle)
    (second : BoundaryRenaming middle target)
    (name : Name) :
    (comp first second).nameMap name =
      second.nameMap (first.nameMap name) :=
  rfl

/--
Two certificates are equal when their total name maps are equal.

This intentionally does not claim that agreement merely on source support is
structure equality; maps outside that support are unconstrained by the
current record.
-/
@[ext]
theorem ext
    {Γ : TypeEnv}
    {source target : NamedInterface Γ}
    {left right : BoundaryRenaming source target}
    (nameMap_eq : left.nameMap = right.nameMap) :
    left = right := by
  cases left
  cases right
  cases nameMap_eq
  rfl

@[simp]
theorem identity_comp
    {Γ : TypeEnv}
    {source target : NamedInterface Γ}
    (mapping : BoundaryRenaming source target) :
    comp (identity source) mapping = mapping := by
  apply ext
  funext name
  rfl

@[simp]
theorem comp_identity
    {Γ : TypeEnv}
    {source target : NamedInterface Γ}
    (mapping : BoundaryRenaming source target) :
    comp mapping (identity target) = mapping := by
  apply ext
  funext name
  rfl

theorem comp_assoc
    {Γ : TypeEnv}
    {source middle₁ middle₂ target : NamedInterface Γ}
    (first : BoundaryRenaming source middle₁)
    (second : BoundaryRenaming middle₁ middle₂)
    (third : BoundaryRenaming middle₂ target) :
    comp (comp first second) third =
      comp first (comp second third) := by
  apply ext
  funext name
  rfl

/--
Observational agreement of two renamings on the only names constrained by
the record: the source boundary support.
-/
def AgreesOnSource
    {Γ : TypeEnv}
    {source target : NamedInterface Γ}
    (left right : BoundaryRenaming source target) : Prop :=
  Set.EqOn left.nameMap right.nameMap (source.names : Set Name)

theorem agreesOnSource_equivalence
    {Γ : TypeEnv}
    (source target : NamedInterface Γ) :
    Equivalence
      (@AgreesOnSource Γ source target) :=
  ⟨by
      intro mapping name _
      rfl,
    by
      intro left right relation name member
      exact (relation member).symm,
    by
      intro first second third firstSecond secondThird name member
      exact (firstSecond member).trans (secondThird member)⟩

/-- Composition respects source-support agreement in both arguments. -/
theorem comp_congr
    {Γ : TypeEnv}
    {source middle target : NamedInterface Γ}
    {first first' : BoundaryRenaming source middle}
    {second second' : BoundaryRenaming middle target}
    (first_agrees : AgreesOnSource first first')
    (second_agrees : AgreesOnSource second second') :
    AgreesOnSource
      (comp first second) (comp first' second') := by
  intro name member
  have firstEq : first.nameMap name = first'.nameMap name :=
    first_agrees member
  calc
    second.nameMap (first.nameMap name) =
        second.nameMap (first'.nameMap name) :=
      congrArg second.nameMap firstEq
    _ = second'.nameMap (first'.nameMap name) :=
      second_agrees (nameMap_mem first' member)

end BoundaryRenaming

namespace FreshenedBoundary

/--
Sequential freshening composes its boundary maps and retains the freshness
guarantee of the final choice.
-/
def comp
    {Γ : TypeEnv}
    {source : NamedInterface Γ}
    {firstAvoid secondAvoid : Finset Name}
    (first : FreshenedBoundary source firstAvoid)
    (second : FreshenedBoundary first.target secondAvoid) :
    FreshenedBoundary source secondAvoid where
  target := second.target
  boundaryMap :=
    BoundaryRenaming.comp first.boundaryMap second.boundaryMap
  fresh := second.fresh

/-- A freshening certificate remains valid for a smaller avoidance set. -/
def weaken
    {Γ : TypeEnv}
    {source : NamedInterface Γ}
    {smallAvoid largeAvoid : Finset Name}
    (freshened : FreshenedBoundary source largeAvoid)
    (subset : smallAvoid ⊆ largeAvoid) :
    FreshenedBoundary source smallAvoid where
  target := freshened.target
  boundaryMap := freshened.boundaryMap
  fresh := freshened.fresh.mono_right subset

/--
Identity renaming is a freshening exactly when the unchanged target is
already disjoint from the avoidance set.
-/
def identity
    {Γ : TypeEnv}
    (source : NamedInterface Γ)
    (avoid : Finset Name)
    (fresh : Disjoint source.names avoid) :
    FreshenedBoundary source avoid where
  target := source
  boundaryMap := BoundaryRenaming.identity source
  fresh := fresh

theorem exists_sameTarget_iff_disjoint
    {Γ : TypeEnv}
    (source : NamedInterface Γ)
    (avoid : Finset Name) :
    (∃ freshened : FreshenedBoundary source avoid,
        freshened.target = source) ↔
      Disjoint source.names avoid := by
  constructor
  · rintro ⟨freshened, targetEq⟩
    simpa [targetEq] using freshened.fresh
  · intro fresh
    exact ⟨identity source avoid fresh, rfl⟩

end FreshenedBoundary

namespace SortedFreshBoundarySupply

/--
Refresh an already freshened boundary outside both its previous avoidance
set and one additional finite set.
-/
def refresh
    {Γ : TypeEnv}
    {source : NamedInterface Γ}
    {alreadyAvoid : Finset Name}
    (supply : SortedFreshBoundarySupply Γ)
    (first : FreshenedBoundary source alreadyAvoid)
    (extraAvoid : Finset Name) :
    FreshenedBoundary source (alreadyAvoid ∪ extraAvoid) :=
  FreshenedBoundary.comp first
    (supply.freshen (alreadyAvoid ∪ extraAvoid) first.target)

theorem refresh_sorts
    {Γ : TypeEnv}
    {source : NamedInterface Γ}
    {alreadyAvoid : Finset Name}
    (supply : SortedFreshBoundarySupply Γ)
    (first : FreshenedBoundary source alreadyAvoid)
    (extraAvoid : Finset Name) :
    (refresh supply first extraAvoid).target.sorts =
      source.sorts :=
  (refresh supply first extraAvoid).boundaryMap.sorts_eq

theorem refresh_fresh_for_previous
    {Γ : TypeEnv}
    {source : NamedInterface Γ}
    {alreadyAvoid : Finset Name}
    (supply : SortedFreshBoundarySupply Γ)
    (first : FreshenedBoundary source alreadyAvoid)
    (extraAvoid : Finset Name) :
    Disjoint
      (refresh supply first extraAvoid).target.names
      alreadyAvoid :=
  (refresh supply first extraAvoid).fresh.mono_right
    Finset.subset_union_left

theorem refresh_fresh_for_extra
    {Γ : TypeEnv}
    {source : NamedInterface Γ}
    {alreadyAvoid : Finset Name}
    (supply : SortedFreshBoundarySupply Γ)
    (first : FreshenedBoundary source alreadyAvoid)
    (extraAvoid : Finset Name) :
    Disjoint
      (refresh supply first extraAvoid).target.names
      extraAvoid :=
  (refresh supply first extraAvoid).fresh.mono_right
    Finset.subset_union_right

end SortedFreshBoundarySupply

/-! ## The exact current wire/polarity boundary -/

/--
The existing public-support projection is insensitive to swapping input and
output polarity.
-/
theorem publicSupport_swap
    {Γ : TypeEnv}
    (input output : NamedInterface Γ) :
    publicSupport input output =
      publicSupport output input := by
  simp [publicSupport, Finset.union_comm]

/--
Using the same concrete boundary at both polarities collapses to one support
set; it does not retain two linear occurrences.
-/
@[simp]
theorem publicSupport_self
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ) :
    publicSupport boundary boundary = boundary.names := by
  simp [publicSupport]

/--
The current atom admission layer cannot realize a nonempty same-name wire.

This is only a theorem about `AtomBoundaryCertificate`'s disjoint-polarity
premise.  It does not rule out a future explicit alias/wire syntax selected
through RFC/FCP.
-/
theorem no_sameName_atom_wire_of_nonempty
    {Γ : TypeEnv}
    {boundary : NamedInterface Γ}
    {process : Proc}
    (nonempty : boundary.names.Nonempty) :
    ¬ AtomBoundaryCertificate Γ boundary boundary process := by
  intro certificate
  rcases nonempty with ⟨name, member⟩
  exact
    (Finset.disjoint_left.mp
      certificate.input_output_disjoint)
      member member

end Cantilune.Pi.OpenSMCBoundaryRenamingCalculus
