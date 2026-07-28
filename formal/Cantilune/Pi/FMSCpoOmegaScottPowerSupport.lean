import Cantilune.Pi.FMSCpoFiniteSupportTensor
import Cantilune.Pi.FMSCpoOmegaScottStrength

/-!
# Finite-support lift of the omega-Scott lower power construction

For a finite resource type, the support of a closed computation is the union
of the supports of all of its outcomes.  Finiteness of the ambient resource
type turns that union into a `Finset`; closed support bounds and finite
stabilisation then make the omega-Scott power construction an actual
`SupportedOmegaCpo`.

The lift is exact for return, exact-support maps, finite choice, and
multiplication.  Cartesian Fubini has an exact support formula, but is not an
exact-support morphism in general: pairing with an empty computation erases
the support of the other branch.  The final theorem characterises precisely
when no support is erased.

This remains a theorem about the existing lower/Hoare omega-Scott power.  It
does not identify that construction with the pointed Abramsky powerdomain or
solve the FMS recursive domain equation.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottPowerSupport

open CategoryTheory
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

/-- Union of the finite supports of all outcomes of a closed computation. -/
def powerSupport
    (object : SupportedOmegaCpo.{u, v} Resource)
    (values : OmegaScottPower object.Carrier) :
    Finset Resource := by
  classical
  exact
    Finset.univ.filter fun resource =>
      ∃ value : object.Carrier,
        WithOmegaScott.toOmegaScott value ∈ carrier values ∧
          resource ∈ object.support value

@[simp]
theorem mem_powerSupport_iff
    (object : SupportedOmegaCpo.{u, v} Resource)
    (values : OmegaScottPower object.Carrier)
    (resource : Resource) :
    resource ∈ powerSupport object values ↔
      ∃ value : object.Carrier,
        WithOmegaScott.toOmegaScott value ∈ carrier values ∧
          resource ∈ object.support value := by
  simp [powerSupport]

/-- The closed lower set of values whose support is bounded by `bound`. -/
def supportBound
    (object : SupportedOmegaCpo.{u, v} Resource)
    (bound : Finset Resource) :
    OmegaScottPower object.Carrier :=
  ⟨
    { value |
      object.support (WithOmegaScott.ofOmegaScott value) ⊆ bound },
    by
      apply isClosed_iff_isLowerSet_and_chainSupClosed.mpr
      constructor
      · intro upper lower ordered upperBound
        exact
          (object.support_mono ordered).trans upperBound
      · rintro _ ⟨chain, rfl⟩ members _ _ limit isLimit
        have limitEq : limit = ωSup chain :=
          OmegaCompletePartialOrder.ωSup_eq_of_isLUB isLimit
        subst limit
        rcases object.support_omegaSup_bounded chain with
          ⟨index, supportLe⟩
        exact supportLe.trans (members ⟨index, rfl⟩)
  ⟩

@[simp]
theorem mem_supportBound_iff
    (object : SupportedOmegaCpo.{u, v} Resource)
    (bound : Finset Resource)
    (value : object.Carrier) :
    WithOmegaScott.toOmegaScott value ∈ carrier (supportBound object bound) ↔
      object.support value ⊆ bound :=
  Iff.rfl

/--
Bounding the union support is equivalent to inclusion in the corresponding
closed support locus.
-/
theorem powerSupport_subset_iff
    (object : SupportedOmegaCpo.{u, v} Resource)
    (values : OmegaScottPower object.Carrier)
    (bound : Finset Resource) :
    powerSupport object values ⊆ bound ↔
      values ≤ supportBound object bound := by
  constructor
  · intro supportLe value valueMember resource resourceMember
    exact
      supportLe
        ((mem_powerSupport_iff object values resource).2
          ⟨WithOmegaScott.ofOmegaScott value, valueMember,
            resourceMember⟩)
  · intro valuesLe resource resourceMember
    rcases
        (mem_powerSupport_iff object values resource).1
          resourceMember with
      ⟨value, valueMember, supportMember⟩
    exact valuesLe valueMember supportMember

/-- Computation support is monotone with closed-set inclusion. -/
theorem powerSupport_mono
    (object : SupportedOmegaCpo.{u, v} Resource) :
    Monotone (powerSupport object) := by
  intro left right ordered
  exact
    (powerSupport_subset_iff object left
      (powerSupport object right)).2
      (ordered.trans
        ((powerSupport_subset_iff object right
          (powerSupport object right)).1 Finset.Subset.rfl))

/-- A finite set of resources appears together at one stage of a monotone chain. -/
theorem finite_subset_monotone_stage
    (resources : Finset Resource)
    (stages : Nat → Finset Resource)
    (monotoneStages : Monotone stages)
    (eventuallyMember :
      ∀ resource ∈ resources,
        ∃ index, resource ∈ stages index) :
    ∃ index, resources ⊆ stages index := by
  classical
  induction resources using Finset.induction_on with
  | empty =>
      exact ⟨0, Finset.empty_subset _⟩
  | @insert resource resources fresh induction =>
      rcases eventuallyMember resource (Finset.mem_insert_self _ _) with
        ⟨resourceIndex, resourceMember⟩
      have tailEventually :
          ∀ member ∈ resources,
            ∃ index, member ∈ stages index := by
        intro member memberInTail
        exact
          eventuallyMember member
            (Finset.mem_insert_of_mem memberInTail)
      rcases induction tailEventually with ⟨tailIndex, tailSubset⟩
      refine ⟨max resourceIndex tailIndex, ?_⟩
      intro member memberInInsert
      rw [Finset.mem_insert] at memberInInsert
      rcases memberInInsert with rfl | memberInTail
      · exact
          (monotoneStages
            (Nat.le_max_left resourceIndex tailIndex))
            resourceMember
      · exact
          (monotoneStages
            (Nat.le_max_right resourceIndex tailIndex))
            (tailSubset memberInTail)

/-- Resources occurring at some stage of a chain of computations. -/
def chainSupport
    (object : SupportedOmegaCpo.{u, v} Resource)
    (chain : Chain (OmegaScottPower object.Carrier)) :
    Finset Resource := by
  classical
  exact
    Finset.univ.filter fun resource =>
      ∃ index, resource ∈ powerSupport object (chain index)

@[simp]
theorem mem_chainSupport_iff
    (object : SupportedOmegaCpo.{u, v} Resource)
    (chain : Chain (OmegaScottPower object.Carrier))
    (resource : Resource) :
    resource ∈ chainSupport object chain ↔
      ∃ index, resource ∈ powerSupport object (chain index) := by
  simp [chainSupport]

/-- Omega-suprema introduce no resource absent from every finite stage. -/
theorem powerSupport_omegaSup_subset_chainSupport
    (object : SupportedOmegaCpo.{u, v} Resource)
    (chain : Chain (OmegaScottPower object.Carrier)) :
    powerSupport object (ωSup chain) ⊆ chainSupport object chain := by
  apply
    (powerSupport_subset_iff object (ωSup chain)
      (chainSupport object chain)).2
  apply ωSup_le
  intro index
  apply
    (powerSupport_subset_iff object (chain index)
      (chainSupport object chain)).1
  intro resource resourceMember
  exact
    (mem_chainSupport_iff object chain resource).2
      ⟨index, resourceMember⟩

/-- The omega-Scott power construction lifted to finite exact support. -/
def powerObject
    (object : SupportedOmegaCpo.{u, v} Resource) :
    SupportedOmegaCpo.{u, v} Resource where
  Carrier := OmegaScottPower object.Carrier
  omega := inferInstance
  support := powerSupport object
  support_mono := powerSupport_mono object
  support_omegaSup_bounded := by
    intro chain
    have monotoneStages :
        Monotone (fun index => powerSupport object (chain index)) := by
      intro first second ordered
      exact powerSupport_mono object (chain.monotone ordered)
    have eventual :
        ∀ resource ∈ chainSupport object chain,
          ∃ index, resource ∈ powerSupport object (chain index) := by
      intro resource member
      exact (mem_chainSupport_iff object chain resource).1 member
    rcases
        finite_subset_monotone_stage
          (chainSupport object chain)
          (fun index => powerSupport object (chain index))
          monotoneStages eventual with
      ⟨index, chainSupportLe⟩
    exact
      ⟨index,
        (powerSupport_omegaSup_subset_chainSupport object chain).trans
          chainSupportLe⟩

/-! ## Exact support laws for the monad operations -/

/-- Principal return preserves support exactly. -/
@[simp]
theorem powerSupport_principalRaw
    (object : SupportedOmegaCpo.{u, v} Resource)
    (value : object.Carrier) :
    powerSupport object (principalRaw value) =
      object.support value := by
  apply Finset.Subset.antisymm
  · intro resource resourceMember
    rcases
        (mem_powerSupport_iff object (principalRaw value) resource).1
          resourceMember with
      ⟨outcome, outcomeLe, supportMember⟩
    exact object.support_mono outcomeLe supportMember
  · intro resource resourceMember
    exact
      (mem_powerSupport_iff object (principalRaw value) resource).2
        ⟨value, le_rfl, resourceMember⟩

/-- Principal return as an exact-support continuous map. -/
def principalSupported
    (object : SupportedOmegaCpo.{u, v} Resource) :
    SupportedOmegaCpo.Hom object (powerObject object) where
  toContinuousHom := principal
  support_eq := powerSupport_principalRaw object

/-- Binary finite choice has union support exactly. -/
@[simp]
theorem powerSupport_choice
    (object : SupportedOmegaCpo.{u, v} Resource)
    (left right : OmegaScottPower object.Carrier) :
    powerSupport object (choice (left, right)) =
      powerSupport object left ∪ powerSupport object right := by
  apply Finset.Subset.antisymm
  · apply
      (powerSupport_subset_iff object (choice (left, right))
        (powerSupport object left ∪ powerSupport object right)).2
    change
      left ⊔ right ≤
        supportBound object
          (powerSupport object left ∪ powerSupport object right)
    apply sup_le
    · apply
        (powerSupport_subset_iff object left
          (powerSupport object left ∪ powerSupport object right)).1
      exact Finset.subset_union_left
    · apply
        (powerSupport_subset_iff object right
          (powerSupport object left ∪ powerSupport object right)).1
      exact Finset.subset_union_right
  · exact
      Finset.union_subset
        (powerSupport_mono object le_sup_left)
        (powerSupport_mono object le_sup_right)

/-!
The cartesian input object for choice.  This is intentionally distinct from
the separated tensor: choice consumes alternatives, not simultaneously held
linear resources.
-/
def cartesianProduct
    (left right : SupportedOmegaCpo.{u, v} Resource) :
    SupportedOmegaCpo.{u, v} Resource where
  Carrier := left.Carrier × right.Carrier
  omega := inferInstance
  support := fun value =>
    left.support value.1 ∪ right.support value.2
  support_mono := by
    intro first second ordered
    exact
      Finset.union_subset_union
        (left.support_mono ordered.1)
        (right.support_mono ordered.2)
  support_omegaSup_bounded := by
    intro chain
    let leftChain : Chain left.Carrier :=
      chain.map OrderHom.fst
    let rightChain : Chain right.Carrier :=
      chain.map OrderHom.snd
    rcases left.support_omegaSup_bounded leftChain with
      ⟨leftIndex, leftBound⟩
    rcases right.support_omegaSup_bounded rightChain with
      ⟨rightIndex, rightBound⟩
    refine ⟨max leftIndex rightIndex, ?_⟩
    exact
      Finset.union_subset_union
        (leftBound.trans
          (left.support_mono
            (leftChain.monotone
              (Nat.le_max_left leftIndex rightIndex))))
        (rightBound.trans
          (right.support_mono
            (rightChain.monotone
              (Nat.le_max_right leftIndex rightIndex))))

/-- Choice is an exact-support continuous map from its cartesian input. -/
def choiceSupported
    (object : SupportedOmegaCpo.{u, v} Resource) :
    SupportedOmegaCpo.Hom
      (cartesianProduct (powerObject object) (powerObject object))
      (powerObject object) where
  toContinuousHom := choice
  support_eq := by
    intro values
    exact powerSupport_choice object values.1 values.2

/-- Direct image along an exact-support map preserves computation support. -/
@[simp]
theorem powerSupport_mapRaw
    (source target : SupportedOmegaCpo.{u, v} Resource)
    (function : SupportedOmegaCpo.Hom source target)
    (values : OmegaScottPower source.Carrier) :
    powerSupport target
        (mapRaw function.toContinuousHom values) =
      powerSupport source values := by
  apply Finset.Subset.antisymm
  · apply
      (powerSupport_subset_iff target
        (mapRaw function.toContinuousHom values)
        (powerSupport source values)).2
    apply
      (mapRaw_le_iff function.toContinuousHom values
        (supportBound target (powerSupport source values))).2
    intro value valueMember
    change
      target.support
          (function.toContinuousHom
            (WithOmegaScott.ofOmegaScott value)) ⊆
        powerSupport source values
    rw [function.support_eq]
    intro resource supportMember
    exact
      (mem_powerSupport_iff source values resource).2
        ⟨WithOmegaScott.ofOmegaScott value, valueMember,
          supportMember⟩
  · intro resource resourceMember
    rcases
        (mem_powerSupport_iff source values resource).1
          resourceMember with
      ⟨value, valueMember, supportMember⟩
    apply
      (mem_powerSupport_iff target
        (mapRaw function.toContinuousHom values) resource).2
    refine ⟨function value, ?_, ?_⟩
    · exact
        subset_closure
          ⟨WithOmegaScott.toOmegaScott value, valueMember, rfl⟩
    · rw [function.support_eq]
      exact supportMember

/-- Functorial direct image lifted to exact-support morphisms. -/
def mapSupported
    {source target : SupportedOmegaCpo.{u, v} Resource}
    (function : SupportedOmegaCpo.Hom source target) :
    SupportedOmegaCpo.Hom
      (powerObject source) (powerObject target) where
  toContinuousHom := map function.toContinuousHom
  support_eq := powerSupport_mapRaw source target function

/-- Monad multiplication preserves the union of all nested supports exactly. -/
@[simp]
theorem powerSupport_flattenRaw
    (object : SupportedOmegaCpo.{u, v} Resource)
    (family :
      OmegaScottPower (OmegaScottPower object.Carrier)) :
    powerSupport object (flattenRaw family) =
      powerSupport (powerObject object) family := by
  apply Finset.Subset.antisymm
  · apply
      (powerSupport_subset_iff object (flattenRaw family)
        (powerSupport (powerObject object) family)).2
    apply
      (flattenRaw_le_iff family
        (supportBound object
          (powerSupport (powerObject object) family))).2
    intro values valuesMember
    change
      WithOmegaScott.ofOmegaScott values ≤
        supportBound object
          (powerSupport (powerObject object) family)
    apply
      (powerSupport_subset_iff object
        (WithOmegaScott.ofOmegaScott values)
        (powerSupport (powerObject object) family)).1
    intro resource supportMember
    exact
      (mem_powerSupport_iff (powerObject object) family resource).2
        ⟨WithOmegaScott.ofOmegaScott values, valuesMember,
          supportMember⟩
  · intro resource resourceMember
    rcases
        (mem_powerSupport_iff
          (powerObject object) family resource).1
          resourceMember with
      ⟨values, valuesMember, innerSupportMember⟩
    rcases
        (mem_powerSupport_iff object values resource).1
          innerSupportMember with
      ⟨value, valueMember, supportMember⟩
    apply
      (mem_powerSupport_iff object
        (flattenRaw family) resource).2
    refine ⟨value, ?_, supportMember⟩
    have familyLe :
        family ≤ principalRaw (flattenRaw family) :=
      (flattenRaw_le_iff family (flattenRaw family)).1 le_rfl
    exact (familyLe valuesMember) valueMember

/-- Monad multiplication lifted to an exact-support continuous map. -/
def flattenSupported
    (object : SupportedOmegaCpo.{u, v} Resource) :
    SupportedOmegaCpo.Hom
      (powerObject (powerObject object))
      (powerObject object) where
  toContinuousHom := flatten
  support_eq := powerSupport_flattenRaw object

/-! ## Exact cartesian Fubini support and its empty-branch boundary -/

/-- A lower computation has at least one outcome. -/
def HasOutcome
    {α : Type v}
    [OmegaCompletePartialOrder α]
    (values : OmegaScottPower α) :
    Prop :=
  ∃ value : α,
    WithOmegaScott.toOmegaScott value ∈ carrier values

/-- A computation without outcomes has empty union support. -/
theorem powerSupport_eq_empty_of_not_hasOutcome
    (object : SupportedOmegaCpo.{u, v} Resource)
    (values : OmegaScottPower object.Carrier)
    (empty : ¬ HasOutcome values) :
    powerSupport object values = ∅ := by
  ext resource
  constructor
  · intro resourceMember
    rcases
        (mem_powerSupport_iff object values resource).1
          resourceMember with
      ⟨value, valueMember, _⟩
    exact (empty ⟨value, valueMember⟩).elim
  · intro resourceMember
    simp at resourceMember

/--
Pointwise support formula for cartesian Fubini.

A resource from one branch survives exactly when the other branch has an
outcome with which it can be paired.
-/
@[simp]
theorem mem_powerSupport_fubiniRaw_iff
    (left right : SupportedOmegaCpo.{u, v} Resource)
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier)
    (resource : Resource) :
    resource ∈
        powerSupport (cartesianProduct left right)
          (fubiniRaw leftValues rightValues) ↔
      (resource ∈ powerSupport left leftValues ∧
          HasOutcome rightValues) ∨
        (HasOutcome leftValues ∧
          resource ∈ powerSupport right rightValues) := by
  constructor
  · intro member
    rcases
        (mem_powerSupport_iff
          (cartesianProduct left right)
          (fubiniRaw leftValues rightValues)
          resource).1 member with
      ⟨value, valueMember, supportMember⟩
    change
      resource ∈
        left.support value.1 ∪ right.support value.2
      at supportMember
    rw [Finset.mem_union] at supportMember
    rcases supportMember with leftMember | rightMember
    · left
      exact
        ⟨(mem_powerSupport_iff left leftValues resource).2
            ⟨value.1, valueMember.1, leftMember⟩,
          ⟨value.2, valueMember.2⟩⟩
    · right
      exact
        ⟨⟨value.1, valueMember.1⟩,
          (mem_powerSupport_iff right rightValues resource).2
            ⟨value.2, valueMember.2, rightMember⟩⟩
  · intro member
    rcases member with
      ⟨leftMember, ⟨rightValue, rightValueMember⟩⟩ |
      ⟨⟨leftValue, leftValueMember⟩, rightMember⟩
    · rcases
          (mem_powerSupport_iff left leftValues resource).1
            leftMember with
        ⟨leftValue, leftValueMember, supportMember⟩
      exact
        (mem_powerSupport_iff
          (cartesianProduct left right)
          (fubiniRaw leftValues rightValues)
          resource).2
          ⟨(leftValue, rightValue),
            ⟨leftValueMember, rightValueMember⟩,
            Finset.mem_union_left _ supportMember⟩
    · rcases
          (mem_powerSupport_iff right rightValues resource).1
            rightMember with
        ⟨rightValue, rightValueMember, supportMember⟩
      exact
        (mem_powerSupport_iff
          (cartesianProduct left right)
          (fubiniRaw leftValues rightValues)
          resource).2
          ⟨(leftValue, rightValue),
            ⟨leftValueMember, rightValueMember⟩,
            Finset.mem_union_right _ supportMember⟩

/-- Retain a finite support exactly when a proposition holds. -/
def guardedSupport
    (condition : Prop)
    (support : Finset Resource) :
    Finset Resource := by
  classical
  exact if condition then support else ∅

/-- Cartesian Fubini has an outcome exactly when both branches do. -/
@[simp]
theorem hasOutcome_fubiniRaw_iff
    {α β : Type v}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (leftValues : OmegaScottPower α)
    (rightValues : OmegaScottPower β) :
    HasOutcome (fubiniRaw leftValues rightValues) ↔
      HasOutcome leftValues ∧ HasOutcome rightValues := by
  constructor
  · rintro ⟨value, valueMember⟩
    exact
      ⟨⟨value.1, valueMember.1⟩,
        ⟨value.2, valueMember.2⟩⟩
  · rintro
      ⟨⟨leftValue, leftMember⟩,
        ⟨rightValue, rightMember⟩⟩
    exact
      ⟨(leftValue, rightValue), ⟨leftMember, rightMember⟩⟩

/-- Exact finite-set formula for cartesian Fubini support. -/
theorem powerSupport_fubiniRaw
    (left right : SupportedOmegaCpo.{u, v} Resource)
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier) :
    powerSupport (cartesianProduct left right)
        (fubiniRaw leftValues rightValues) =
      guardedSupport (HasOutcome rightValues)
          (powerSupport left leftValues) ∪
        guardedSupport (HasOutcome leftValues)
          (powerSupport right rightValues) := by
  classical
  by_cases leftNonempty : HasOutcome leftValues
  · by_cases rightNonempty : HasOutcome rightValues
    · ext resource
      rw [mem_powerSupport_fubiniRaw_iff]
      simp only [guardedSupport, leftNonempty, rightNonempty,
        if_true, Finset.mem_union, and_true, true_and]
    · have fubiniEmpty :
          powerSupport (cartesianProduct left right)
              (fubiniRaw leftValues rightValues) = ∅ := by
        apply powerSupport_eq_empty_of_not_hasOutcome
        intro outcome
        exact
          rightNonempty
            ((hasOutcome_fubiniRaw_iff
              leftValues rightValues).1 outcome).2
      have rightSupportEmpty :
          powerSupport right rightValues = ∅ :=
        powerSupport_eq_empty_of_not_hasOutcome
          right rightValues rightNonempty
      rw [fubiniEmpty, rightSupportEmpty]
      simp [guardedSupport, leftNonempty, rightNonempty]
  · have leftSupportEmpty :
        powerSupport left leftValues = ∅ :=
      powerSupport_eq_empty_of_not_hasOutcome
        left leftValues leftNonempty
    have fubiniEmpty :
        powerSupport (cartesianProduct left right)
            (fubiniRaw leftValues rightValues) = ∅ := by
      apply powerSupport_eq_empty_of_not_hasOutcome
      intro outcome
      exact
        leftNonempty
          ((hasOutcome_fubiniRaw_iff
            leftValues rightValues).1 outcome).1
    by_cases rightNonempty : HasOutcome rightValues
    · rw [fubiniEmpty, leftSupportEmpty]
      simp [guardedSupport, leftNonempty, rightNonempty]
    · have rightSupportEmpty :
          powerSupport right rightValues = ∅ :=
        powerSupport_eq_empty_of_not_hasOutcome
          right rightValues rightNonempty
      rw [fubiniEmpty, leftSupportEmpty, rightSupportEmpty]
      simp [guardedSupport, leftNonempty, rightNonempty]

/-- Nonempty computations make Fubini support exactly the branch union. -/
theorem powerSupport_fubiniRaw_of_hasOutcome
    (left right : SupportedOmegaCpo.{u, v} Resource)
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier)
    (leftNonempty : HasOutcome leftValues)
    (rightNonempty : HasOutcome rightValues) :
    powerSupport (cartesianProduct left right)
        (fubiniRaw leftValues rightValues) =
      powerSupport left leftValues ∪
        powerSupport right rightValues := by
  rw [powerSupport_fubiniRaw]
  simp [guardedSupport, leftNonempty, rightNonempty]

/--
Complete exactness criterion for Fubini.

If a branch is empty, exactness requires the other branch to carry no
resource.  In particular, the unrestricted Fubini operation cannot be a
morphism in the current category of maps preserving support by equality.
-/
theorem powerSupport_fubiniRaw_exact_iff
    (left right : SupportedOmegaCpo.{u, v} Resource)
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier) :
    powerSupport (cartesianProduct left right)
          (fubiniRaw leftValues rightValues) =
        powerSupport left leftValues ∪
          powerSupport right rightValues ↔
      (HasOutcome rightValues ∨
          powerSupport left leftValues = ∅) ∧
        (HasOutcome leftValues ∨
          powerSupport right rightValues = ∅) := by
  classical
  rw [powerSupport_fubiniRaw]
  by_cases leftNonempty : HasOutcome leftValues
  · by_cases rightNonempty : HasOutcome rightValues
    · simp [guardedSupport, leftNonempty, rightNonempty]
    · have rightSupportEmpty :
          powerSupport right rightValues = ∅ :=
        powerSupport_eq_empty_of_not_hasOutcome
          right rightValues rightNonempty
      simp [guardedSupport, leftNonempty, rightNonempty,
        rightSupportEmpty, eq_comm]
  · have leftSupportEmpty :
        powerSupport left leftValues = ∅ :=
      powerSupport_eq_empty_of_not_hasOutcome
        left leftValues leftNonempty
    by_cases rightNonempty : HasOutcome rightValues
    · simp [guardedSupport, leftNonempty, rightNonempty,
        leftSupportEmpty, eq_comm]
    · have rightSupportEmpty :
          powerSupport right rightValues = ∅ :=
        powerSupport_eq_empty_of_not_hasOutcome
          right rightValues rightNonempty
      simp [guardedSupport, leftNonempty, rightNonempty,
        leftSupportEmpty, rightSupportEmpty]

end Cantilune.Pi.FMSCpoOmegaScottPowerSupport
