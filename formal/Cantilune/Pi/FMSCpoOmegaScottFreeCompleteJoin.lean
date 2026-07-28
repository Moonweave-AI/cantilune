import Cantilune.Pi.FMSCpoOmegaScottPower
import Mathlib.Order.Hom.CompleteLattice

/-!
# Free complete-join extension of the unseparated omega-Scott lower power

For a continuous generator `g : α →𝒄 T` into a complete lattice, this module
constructs

`lift(S) = sSup (g '' carrier S)`.

The target is deliberately stronger than a binary join-semilattice: morphisms
used by the uniqueness theorem preserve arbitrary suprema.  This strength is
what makes every closed lower set recoverable as the arbitrary supremum of its
principal lower sets.  Binary choice plus omega-continuity alone is not used
to preserve arbitrary topological closure.

This is the honest free property of the existing unseparated lower/Hoare
construction in the complete-join target category.  It does not separate
divergence from deadlock, construct the Abramsky powerdomain, inhabit
`CpoPowerdomainPackage`, solve a recursive domain equation, or establish full
abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottFreeCompleteJoin

open CategoryTheory
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSCpoOmegaScottPower

universe u

variable
    {α T : Type u}
    [OmegaCompletePartialOrder α]
    [CompleteLattice T]

/-! ## The complete-join extension -/

/-- Evaluate a generator on an omega-Scott type-synonym value. -/
def generatorValue
    (generator : α →𝒄 T)
    (value : WithOmegaScott α) :
    T :=
  generator (WithOmegaScott.ofOmegaScott value)

/-- Image of a set of source values under the generator. -/
def generatorImage
    (generator : α →𝒄 T)
    (values : Set (WithOmegaScott α)) :
    Set T :=
  generatorValue generator '' values

/-- Arbitrary-join extension from an arbitrary source set. -/
def liftSubset
    (generator : α →𝒄 T)
    (values : Set (WithOmegaScott α)) :
    T :=
  sSup (generatorImage generator values)

/-- Arbitrary-join extension from an omega-Scott closed lower computation. -/
def liftRaw
    (generator : α →𝒄 T)
    (values : OmegaScottPower α) :
    T :=
  liftSubset generator (carrier values)

/--
The closed lower preimage of a target principal ideal.  It is the right
adjoint used to prove arbitrary-join preservation.
-/
def generatorLowerPreimage
    (generator : α →𝒄 T)
    (bound : T) :
    OmegaScottPower α :=
  ⟨omegaScottLift generator ⁻¹'
      Iic (WithOmegaScott.toOmegaScott bound),
    (isClosed_Iic
      (WithOmegaScott.toOmegaScott bound)).preimage
        (continuousHom_omegaScott_continuous generator)⟩

@[simp]
theorem mem_generatorLowerPreimage_iff
    (generator : α →𝒄 T)
    (bound : T)
    (value : WithOmegaScott α) :
    value ∈ carrier (generatorLowerPreimage generator bound) ↔
      generatorValue generator value ≤ bound :=
  Iff.rfl

/-- The extension is left adjoint to closed principal-ideal preimage. -/
theorem liftRaw_le_iff
    (generator : α →𝒄 T)
    (values : OmegaScottPower α)
    (bound : T) :
    liftRaw generator values ≤ bound ↔
      values ≤ generatorLowerPreimage generator bound := by
  constructor
  · intro liftedLe value valueMember
    change generatorValue generator value ≤ bound
    exact
      le_trans
        (le_sSup
          (show
            generatorValue generator value ∈
              generatorImage generator (carrier values)
            from ⟨value, valueMember, rfl⟩))
        liftedLe
  · intro preimageLe
    apply sSup_le
    intro target targetMember
    rcases targetMember with ⟨value, valueMember, rfl⟩
    exact preimageLe valueMember

/-- The explicit Galois connection behind the free extension. -/
theorem liftGaloisConnection
    (generator : α →𝒄 T) :
    GaloisConnection
      (liftRaw generator)
      (generatorLowerPreimage generator) :=
  fun values bound =>
    liftRaw_le_iff generator values bound

/--
Taking omega-Scott closure before extending does not change the target value.
The nontrivial inequality uses the closed principal-ideal preimage of the
supremum of the original image.
-/
theorem liftSubset_closure
    (generator : α →𝒄 T)
    (values : Set (WithOmegaScott α)) :
    liftSubset generator
        (carrier
          (TopologicalSpace.Closeds.closure values :
            OmegaScottPower α)) =
      liftSubset generator values := by
  apply le_antisymm
  · apply sSup_le
    intro target targetMember
    rcases targetMember with
      ⟨value, valueMember, rfl⟩
    let bound := liftSubset generator values
    have baseSubset :
        values ≤
          carrier
            (generatorLowerPreimage generator bound) := by
      intro source sourceMember
      change generatorValue generator source ≤ bound
      exact
        le_sSup
          (show
            generatorValue generator source ∈
              generatorImage generator values
            from ⟨source, sourceMember, rfl⟩)
    have closureSubset :
        (TopologicalSpace.Closeds.closure values :
            OmegaScottPower α) ≤
          generatorLowerPreimage generator bound :=
      (TopologicalSpace.Closeds.closure_le).2 baseSubset
    exact closureSubset valueMember
  · apply sSup_le_sSup
    exact
      image_mono
        (show
          values ≤
            carrier
              (TopologicalSpace.Closeds.closure values :
                OmegaScottPower α)
          from subset_closure)

/-! ## Unit, empty, choice, and arbitrary joins -/

/-- The extension sends a principal lower set to its generating value. -/
theorem liftRaw_principal
    (generator : α →𝒄 T)
    (value : α) :
    liftRaw generator (principalRaw value) =
      generator value := by
  apply le_antisymm
  · apply sSup_le
    intro target targetMember
    rcases targetMember with
      ⟨source, sourceMember, rfl⟩
    exact generator.monotone sourceMember
  · apply le_sSup
    exact
      ⟨WithOmegaScott.toOmegaScott value,
        le_rfl, rfl⟩

/-- The extension preserves every set-indexed supremum. -/
theorem liftRaw_sSup
    (generator : α →𝒄 T)
    (family : Set (OmegaScottPower α)) :
    liftRaw generator (sSup family) =
      sSup (liftRaw generator '' family) :=
  (liftGaloisConnection generator).l_sSup.trans
    sSup_image.symm

/-- The extension as an arbitrary-supremum-preserving morphism. -/
def liftSSupHom
    (generator : α →𝒄 T) :
    sSupHom (OmegaScottPower α) T where
  toFun := liftRaw generator
  map_sSup' := liftRaw_sSup generator

/-- Empty computation maps to target bottom. -/
@[simp]
theorem liftRaw_bot
    (generator : α →𝒄 T) :
    liftRaw generator (⊥ : OmegaScottPower α) =
      (⊥ : T) :=
  map_bot (liftSSupHom generator)

/-- Finite nondeterministic choice maps to target binary join. -/
@[simp]
theorem liftRaw_sup
    (generator : α →𝒄 T)
    (left right : OmegaScottPower α) :
    liftRaw generator (left ⊔ right) =
      liftRaw generator left ⊔
        liftRaw generator right :=
  map_sup (liftSSupHom generator) left right

/--
The complete-lattice omega-CPO instance computes chain suprema by the lattice
supremum of the chain range.
-/
theorem completeLattice_omegaSup_eq_sSup_range
    (chain : Chain T) :
    ωSup chain = sSup (Set.range chain) :=
  rfl

/-- The arbitrary-join extension is omega-continuous. -/
def liftContinuous
    (generator : α →𝒄 T) :
    omegaScottPowerCpo α ⟶ ωCPO.of T where
  toFun := liftRaw generator
  monotone' :=
    (liftGaloisConnection generator).monotone_l
  map_ωSup' := by
    intro chain
    change
      liftRaw generator (⨆ index, chain index) =
        ⨆ index, liftRaw generator (chain index)
    exact (liftGaloisConnection generator).l_iSup

/-! ## Principal decomposition and uniqueness -/

/-- Principal lower sets generated by the members of one computation. -/
def principalFamily
    (values : OmegaScottPower α) :
    Set (OmegaScottPower α) :=
  (fun value : WithOmegaScott α =>
    principalRaw (WithOmegaScott.ofOmegaScott value)) ''
      carrier values

/--
Every closed lower computation is the arbitrary supremum of the principal
lower sets of its members.
-/
theorem sSup_principalFamily
    (values : OmegaScottPower α) :
    sSup (principalFamily values) = values := by
  apply le_antisymm
  · apply sSup_le
    intro principalValue principalMember
    rcases principalMember with
      ⟨value, valueMember, rfl⟩
    intro lower lowerMember
    exact isLowerSet values lowerMember valueMember
  · intro value valueMember
    have principalLe :
        principalRaw
            (WithOmegaScott.ofOmegaScott value) ≤
          sSup (principalFamily values) :=
      le_sSup
        (show
          principalRaw
              (WithOmegaScott.ofOmegaScott value) ∈
            principalFamily values
          from ⟨value, valueMember, rfl⟩)
    exact principalLe le_rfl

/--
Arbitrary-supremum-preserving maps out of the power object are determined by
their values on principal lower sets.
-/
theorem sSupHom_ext_principal
    (left right : sSupHom (OmegaScottPower α) T)
    (onPrincipal :
      ∀ value : α,
        left (principalRaw value) =
          right (principalRaw value)) :
    left = right := by
  apply sSupHom.ext
  intro values
  calc
    left values =
        left (sSup (principalFamily values)) := by
          rw [sSup_principalFamily]
    _ = sSup (left '' principalFamily values) :=
      map_sSup left (principalFamily values)
    _ = sSup (right '' principalFamily values) := by
      apply congrArg sSup
      ext target
      constructor
      · rintro
          ⟨principalValue,
            ⟨value, valueMember, rfl⟩, rfl⟩
        exact
          ⟨principalRaw
              (WithOmegaScott.ofOmegaScott value),
            ⟨value, valueMember, rfl⟩,
            (onPrincipal
              (WithOmegaScott.ofOmegaScott value)).symm⟩
      · rintro
          ⟨principalValue,
            ⟨value, valueMember, rfl⟩, rfl⟩
        exact
          ⟨principalRaw
              (WithOmegaScott.ofOmegaScott value),
            ⟨value, valueMember, rfl⟩,
            onPrincipal
              (WithOmegaScott.ofOmegaScott value)⟩
    _ = right (sSup (principalFamily values)) :=
      (map_sSup right (principalFamily values)).symm
    _ = right values := by
      rw [sSup_principalFamily]

/--
Universal uniqueness in the honest complete-join target category.

The `sSupHom` premise is load-bearing: it records arbitrary closed-join
preservation explicitly.
-/
theorem liftSSupHom_unique
    (generator : α →𝒄 T)
    (extension : sSupHom (OmegaScottPower α) T)
    (extendsGenerator :
      ∀ value : α,
        extension (principalRaw value) =
          generator value) :
    extension = liftSSupHom generator := by
  apply sSupHom_ext_principal
  intro value
  rw [extendsGenerator value]
  exact (liftRaw_principal generator value).symm

end Cantilune.Pi.FMSCpoOmegaScottFreeCompleteJoin
