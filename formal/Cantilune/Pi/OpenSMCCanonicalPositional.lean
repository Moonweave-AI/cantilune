import Cantilune.Pi.OpenSMCCategory
import Cantilune.Pi.OpenSMCTotalNamedBoundary
import Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary

/-!
# Experimental canonical-position boundary for open pi

The concrete-name `NamedInterface` representation cannot have a total
occurrence-preserving tensor: tensoring a nonempty object with itself repeats
the same concrete name.  This module implements the representation change
suggested by that obstruction without changing the public RFC/ADR status.

An object stores only an ordered sort vector.  Its public ports are positions
in that vector; concrete natural-number names are chosen only when an
operational representative is required.  The concrete realization below is
injective, sort preserving, and can be shifted beyond an arbitrary finite
avoidance set.  Consequently tensoring an object with itself is total: its two
occurrences are different positions and receive different concrete names.

The morphism layer is the already kernel-checked presented open-process
quotient.  It therefore has a genuine mathlib symmetric monoidal category,
including nonempty identities, total composition, and total tensor.  This is
an *experimental algebraic representation*, not a proof that raw finite-control
pi processes modulo the currently implemented observational relation realize
all of those equations.

The final section proves genuine single `Late.NativeStep` propagation through
a finite block of fresh restrictions, plus free-communication and
bound-output-close lemmas for operands which already share a raw channel.
It does **not** rename operand ports onto the realized middle boundary, and
the communication channel is not required to be a middle port.  Thus these
are exact strong-step kernel lemmas, not plug/hide operational adequacy and
not weak `tau*` closures.
-/

namespace Cantilune.Pi.OpenSMCCanonicalPositional

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.OpenSMC
open Cantilune.Pi.OpenSMCCategory
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCTotalNamedBoundary
open Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary

/-! ## A concrete infinite sorted realization -/

/--
Encode a sort and a positional slot as a natural-number pi name.

Channel slots are even and data slots are odd.  The slot, rather than a
caller-owned concrete name, is the identity of a public occurrence.
-/
def canonicalName : NameSort → Nat → Name
  | .channel, slot => 2 * slot
  | .data, slot => 2 * slot + 1

/-- The fixed environment in which canonical positional names are realized. -/
def canonicalEnvironment : TypeEnv where
  sort name := if name % 2 = 0 then .channel else .data
  payload _ := .data

@[simp]
theorem canonicalEnvironment_sort_channel (slot : Nat) :
    canonicalEnvironment.sort (canonicalName .channel slot) = .channel := by
  simp [canonicalEnvironment, canonicalName]

@[simp]
theorem canonicalEnvironment_sort_data (slot : Nat) :
    canonicalEnvironment.sort (canonicalName .data slot) = .data := by
  simp [canonicalEnvironment, canonicalName, Nat.add_mod]

theorem canonicalName_sort
    (sort : NameSort) (slot : Nat) :
    canonicalEnvironment.sort (canonicalName sort slot) = sort := by
  cases sort <;> simp

/-- Equality of canonical names determines the positional slot. -/
theorem canonicalName_slot_injective
    {leftSort rightSort : NameSort}
    {leftSlot rightSlot : Nat}
    (equality :
      canonicalName leftSort leftSlot =
        canonicalName rightSort rightSlot) :
    leftSlot = rightSlot := by
  cases leftSort <;> cases rightSort
  · simp [canonicalName] at equality
    omega
  · have parity :=
      congrArg (fun name : Nat => name % 2) equality
    simp [canonicalName] at parity
  · have parity :=
      congrArg (fun name : Nat => name % 2) equality
    simp [canonicalName] at parity
  · simp [canonicalName] at equality
    omega

/-- Equality also determines the sort tag. -/
theorem canonicalName_sort_injective
    {leftSort rightSort : NameSort}
    {leftSlot rightSlot : Nat}
    (equality :
      canonicalName leftSort leftSlot =
        canonicalName rightSort rightSlot) :
    leftSort = rightSort := by
  cases leftSort <;> cases rightSort
  · rfl
  · have parity :=
      congrArg (fun name : Nat => name % 2) equality
    simp [canonicalName] at parity
  · have parity :=
      congrArg (fun name : Nat => name % 2) equality
    simp [canonicalName] at parity
  · rfl

/-- The paired sort/slot encoding is globally injective. -/
theorem canonicalName_injective :
    Function.Injective
      (fun pair : NameSort × Nat =>
        canonicalName pair.1 pair.2) := by
  intro left right equality
  apply Prod.ext
  · exact canonicalName_sort_injective equality
  · exact canonicalName_slot_injective equality

/-! ## Positional objects and concrete realizations -/

/--
Objects are exactly the sort vectors of the presented open-process SMC.
The port identity at a boundary is `Fin boundary.length`; no concrete name is
stored in the object.
-/
abbrev Object :=
  OpenSMCCategory.Object canonicalEnvironment

/-- Positional ports of an object. -/
abbrev Position (object : Object) :=
  Fin object.boundary.length

/-- The canonical concrete name of a port, shifted by a caller-selected slot. -/
def positionName
    (offset : Nat) (object : Object) (position : Position object) : Name :=
  canonicalName (object.boundary.get position) (offset + position)

theorem positionName_injective
    (offset : Nat) (object : Object) :
    Function.Injective (positionName offset object) := by
  intro left right equality
  apply Fin.ext
  have slotEquality :=
    canonicalName_slot_injective equality
  omega

/-- Realize every positional port as a distinct, correctly sorted pi name. -/
def realizeAt (offset : Nat) (object : Object) :
    NamedInterface canonicalEnvironment where
  ports :=
    List.ofFn (fun position : Position object =>
      { name := positionName offset object position
        sort := object.boundary.get position
        sort_eq :=
          canonicalName_sort
            (object.boundary.get position)
            (offset + position) })
  names_nodup := by
    rw [List.map_ofFn, List.nodup_ofFn]
    exact positionName_injective offset object

@[simp]
theorem realizeAt_ports_length
    (offset : Nat) (object : Object) :
    (realizeAt offset object).ports.length =
      object.boundary.length := by
  simp [realizeAt]

@[simp]
theorem realizeAt_sorts
    (offset : Nat) (object : Object) :
    (realizeAt offset object).sorts =
      object.boundary := by
  simp only [NamedInterface.sorts, realizeAt, List.map_ofFn]
  exact List.ofFn_get object.boundary

/-- Largest forbidden name, with zero as the empty-set default. -/
def avoidanceCeiling (avoid : Finset Name) : Nat :=
  avoid.sup id

/-- Start a fresh realization strictly beyond every forbidden name. -/
def freshOffset (avoid : Finset Name) : Nat :=
  avoidanceCeiling avoid + 1

theorem member_le_avoidanceCeiling
    {avoid : Finset Name} {name : Name}
    (member : name ∈ avoid) :
    name ≤ avoidanceCeiling avoid := by
  exact Finset.le_sup (f := id) member

theorem slot_le_canonicalName
    (sort : NameSort) (slot : Nat) :
    slot ≤ canonicalName sort slot := by
  cases sort <;> simp [canonicalName] <;> omega

theorem avoidanceCeiling_lt_positionName
    (avoid : Finset Name)
    (object : Object)
    (position : Position object) :
    avoidanceCeiling avoid <
      positionName (freshOffset avoid) object position := by
  have first :
      avoidanceCeiling avoid <
        freshOffset avoid := by
    simp [freshOffset]
  have second :
      freshOffset avoid ≤
        freshOffset avoid + position := by
    omega
  have third :
      freshOffset avoid + position ≤
        positionName (freshOffset avoid) object position := by
    exact slot_le_canonicalName _ _
  omega

theorem mem_realizeAt_names_iff
    (offset : Nat) (object : Object) (name : Name) :
    name ∈ (realizeAt offset object).names ↔
      ∃ position : Position object,
        positionName offset object position = name := by
  simp [NamedInterface.names, realizeAt]

/--
The shifted realization is disjoint from every finite avoidance set.

This constructs the infinite sorted fresh-name supply that an arbitrary
`TypeEnv` does not provide.
-/
theorem realizeAt_fresh
    (avoid : Finset Name) (object : Object) :
    Disjoint
      (realizeAt (freshOffset avoid) object).names
      avoid := by
  rw [Finset.disjoint_left]
  intro name inRealized inAvoid
  have below :=
    member_le_avoidanceCeiling inAvoid
  obtain ⟨position, nameEq⟩ :=
    (mem_realizeAt_names_iff _ _ _).mp inRealized
  have above :=
    avoidanceCeiling_lt_positionName avoid object position
  rw [nameEq] at above
  exact (not_lt_of_ge below) above

/-- A canonical fresh concrete realization of any positional object. -/
def freshRealization
    (avoid : Finset Name) (object : Object) :
    NamedInterface canonicalEnvironment :=
  realizeAt (freshOffset avoid) object

@[simp]
theorem freshRealization_sorts
    (avoid : Finset Name) (object : Object) :
    (freshRealization avoid object).sorts =
      object.boundary :=
  realizeAt_sorts _ _

theorem freshRealization_disjoint
    (avoid : Finset Name) (object : Object) :
    Disjoint (freshRealization avoid object).names avoid :=
  realizeAt_fresh avoid object

/-! ## Representative-independent boundary transport -/

/--
Transport a concrete name between two realizations of the same positional
object.  Names outside the source realization are fixed.
-/
noncomputable def transportName
    (sourceOffset targetOffset : Nat)
    (object : Object) (name : Name) : Name :=
  if witness :
      ∃ position : Position object,
        positionName sourceOffset object position = name
  then
    positionName targetOffset object
      (Classical.choose witness)
  else name

@[simp]
theorem transportName_position
    (sourceOffset targetOffset : Nat)
    (object : Object) (position : Position object) :
    transportName sourceOffset targetOffset object
        (positionName sourceOffset object position) =
      positionName targetOffset object position := by
  rw [transportName]
  split
  · rename_i witness
    have chosen :=
      Classical.choose_spec witness
    have positionEq :
        Classical.choose witness = position := by
      apply positionName_injective sourceOffset object
      exact chosen
    rw [positionEq]
  · rename_i noWitness
    exact False.elim
      (noWitness ⟨position, rfl⟩)

/--
Changing the concrete offset is a genuine sort-preserving
`BoundaryRenaming`; the observable positional boundary is unchanged.
-/
noncomputable def realizationRenaming
    (sourceOffset targetOffset : Nat)
    (object : Object) :
    BoundaryRenaming
      (realizeAt sourceOffset object)
      (realizeAt targetOffset object) where
  nameMap :=
    transportName sourceOffset targetOffset object
  sorts_eq := by
    rw [realizeAt_sorts, realizeAt_sorts]
  names_eq := by
    ext name
    constructor
    · intro targetMember
      obtain ⟨position, targetEq⟩ :=
        (mem_realizeAt_names_iff _ _ _).mp targetMember
      apply Finset.mem_image.mpr
      refine
        ⟨positionName sourceOffset object position,
          (mem_realizeAt_names_iff _ _ _).mpr
            ⟨position, rfl⟩, ?_⟩
      exact transportName_position _ _ _ _
        |>.trans targetEq
    · intro imageMember
      obtain ⟨sourceName, sourceMember, mappedEq⟩ :=
        Finset.mem_image.mp imageMember
      obtain ⟨position, sourceEq⟩ :=
        (mem_realizeAt_names_iff _ _ _).mp sourceMember
      subst sourceName
      apply (mem_realizeAt_names_iff _ _ _).mpr
      refine ⟨position, ?_⟩
      exact (transportName_position _ _ _ _).symm.trans mappedEq
  injective_on := by
    intro left leftMember right rightMember mappedEq
    obtain ⟨leftPosition, leftEq⟩ :=
      (mem_realizeAt_names_iff _ _ _).mp leftMember
    obtain ⟨rightPosition, rightEq⟩ :=
      (mem_realizeAt_names_iff _ _ _).mp rightMember
    subst left
    subst right
    rw [transportName_position, transportName_position] at mappedEq
    have positionEq :=
      positionName_injective targetOffset object mappedEq
    rw [positionEq]
  sort_preserving_on := by
    intro name member
    obtain ⟨position, nameEq⟩ :=
      (mem_realizeAt_names_iff _ _ _).mp member
    subst name
    rw [transportName_position]
    simp [positionName, canonicalName_sort]

theorem realizationRenaming_roundtrip_on_support
    (sourceOffset targetOffset : Nat)
    (object : Object)
    {name : Name}
    (member : name ∈ (realizeAt sourceOffset object).names) :
    transportName targetOffset sourceOffset object
        (transportName sourceOffset targetOffset object name) =
      name := by
  obtain ⟨position, nameEq⟩ :=
    (mem_realizeAt_names_iff _ _ _).mp member
  subst name
  simp

/-! ## A total sorted fresh supply for the canonical environment -/

abbrev NamedPosition
    (source : NamedInterface canonicalEnvironment) :=
  Fin source.ports.length

def sourcePositionName
    (source : NamedInterface canonicalEnvironment)
    (position : NamedPosition source) : Name :=
  (source.ports.get position).name

theorem sourcePositionName_injective
    (source : NamedInterface canonicalEnvironment) :
    Function.Injective (sourcePositionName source) := by
  rw [← List.nodup_ofFn]
  have mapped :
      List.ofFn (sourcePositionName source) =
        source.ports.map Port.name := by
    calc
      List.ofFn (sourcePositionName source) =
          List.map Port.name
            (List.ofFn source.ports.get) := by
        rw [List.map_ofFn]
        rfl
      _ = source.ports.map Port.name := by
        rw [List.ofFn_get]
  rw [mapped]
  exact source.names_nodup

def suppliedPositionName
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment)
    (position : NamedPosition source) : Name :=
  canonicalName
    (source.ports.get position).sort
    (freshOffset avoid + position)

theorem suppliedPositionName_injective
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment) :
    Function.Injective (suppliedPositionName avoid source) := by
  intro left right equality
  apply Fin.ext
  have slots :=
    canonicalName_slot_injective equality
  omega

def suppliedTarget
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment) :
    NamedInterface canonicalEnvironment where
  ports :=
    List.ofFn (fun position : NamedPosition source =>
      { name := suppliedPositionName avoid source position
        sort := (source.ports.get position).sort
        sort_eq :=
          canonicalName_sort
            (source.ports.get position).sort
            (freshOffset avoid + position) })
  names_nodup := by
    rw [List.map_ofFn, List.nodup_ofFn]
    exact suppliedPositionName_injective avoid source

@[simp]
theorem suppliedTarget_sorts
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment) :
    (suppliedTarget avoid source).sorts = source.sorts := by
  simp only [NamedInterface.sorts, suppliedTarget, List.map_ofFn]
  change
    List.ofFn
        (fun position : NamedPosition source =>
          (source.ports.get position).sort) =
      source.ports.map Port.forgetSort
  calc
    List.ofFn
        (fun position : NamedPosition source =>
          (source.ports.get position).sort) =
        List.map Port.forgetSort
          (List.ofFn source.ports.get) := by
      rw [List.map_ofFn]
      rfl
    _ = source.ports.map Port.forgetSort := by
      rw [List.ofFn_get]

theorem mem_source_names_iff
    (source : NamedInterface canonicalEnvironment)
    (name : Name) :
    name ∈ source.names ↔
      ∃ position : NamedPosition source,
        sourcePositionName source position = name := by
  constructor
  · intro member
    have listMember :
        name ∈ source.ports.map Port.name := by
      simpa [NamedInterface.names] using member
    obtain ⟨port, portMember, portName⟩ :=
      List.mem_map.mp listMember
    obtain ⟨position, positionEq⟩ :=
      List.mem_iff_get.mp portMember
    refine ⟨position, ?_⟩
    rw [sourcePositionName, positionEq, portName]
  · rintro ⟨position, positionEq⟩
    have portMember :
        source.ports.get position ∈ source.ports :=
      List.get_mem source.ports position
    have nameMember :
        name ∈ source.ports.map Port.name := by
      apply List.mem_map.mpr
      refine
        ⟨source.ports.get position, portMember, ?_⟩
      exact positionEq
    simpa [NamedInterface.names] using nameMember

theorem mem_suppliedTarget_names_iff
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment)
    (name : Name) :
    name ∈ (suppliedTarget avoid source).names ↔
      ∃ position : NamedPosition source,
        suppliedPositionName avoid source position = name := by
  simp [NamedInterface.names, suppliedTarget]

theorem suppliedTarget_fresh
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment) :
    Disjoint (suppliedTarget avoid source).names avoid := by
  rw [Finset.disjoint_left]
  intro name inTarget inAvoid
  obtain ⟨position, nameEq⟩ :=
    (mem_suppliedTarget_names_iff _ _ _).mp inTarget
  have below :=
    member_le_avoidanceCeiling inAvoid
  have first :
      avoidanceCeiling avoid < freshOffset avoid := by
    simp [freshOffset]
  have second :
      freshOffset avoid ≤
        freshOffset avoid + position := by
    omega
  have third :
      freshOffset avoid + position ≤
        suppliedPositionName avoid source position := by
    exact slot_le_canonicalName _ _
  rw [nameEq] at third
  have aboveSlot :=
    lt_of_lt_of_le first second
  have aboveName :=
    lt_of_lt_of_le aboveSlot third
  exact (not_lt_of_ge below) aboveName

noncomputable def suppliedNameMap
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment)
    (name : Name) : Name :=
  if witness :
      ∃ position : NamedPosition source,
        sourcePositionName source position = name
  then
    suppliedPositionName avoid source
      (Classical.choose witness)
  else name

@[simp]
theorem suppliedNameMap_position
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment)
    (position : NamedPosition source) :
    suppliedNameMap avoid source
        (sourcePositionName source position) =
      suppliedPositionName avoid source position := by
  rw [suppliedNameMap]
  split
  · rename_i witness
    have chosen :=
      Classical.choose_spec witness
    have positionEq :
        Classical.choose witness = position := by
      apply sourcePositionName_injective source
      exact chosen
    rw [positionEq]
  · rename_i noWitness
    exact False.elim
      (noWitness ⟨position, rfl⟩)

/--
Every finite named boundary in the canonical environment can be refreshed
outside every finite avoidance set, with a sort-preserving finite-support
renaming certificate.
-/
noncomputable def suppliedBoundaryRenaming
    (avoid : Finset Name)
    (source : NamedInterface canonicalEnvironment) :
    BoundaryRenaming source (suppliedTarget avoid source) where
  nameMap := suppliedNameMap avoid source
  sorts_eq := suppliedTarget_sorts avoid source
  names_eq := by
    ext name
    constructor
    · intro targetMember
      obtain ⟨position, targetEq⟩ :=
        (mem_suppliedTarget_names_iff _ _ _).mp targetMember
      apply Finset.mem_image.mpr
      refine
        ⟨sourcePositionName source position,
          (mem_source_names_iff _ _).mpr
            ⟨position, rfl⟩, ?_⟩
      exact (suppliedNameMap_position _ _ _).trans targetEq
    · intro imageMember
      obtain ⟨sourceName, sourceMember, mappedEq⟩ :=
        Finset.mem_image.mp imageMember
      obtain ⟨position, sourceEq⟩ :=
        (mem_source_names_iff _ _).mp sourceMember
      subst sourceName
      apply (mem_suppliedTarget_names_iff _ _ _).mpr
      refine ⟨position, ?_⟩
      exact (suppliedNameMap_position _ _ _).symm.trans mappedEq
  injective_on := by
    intro left leftMember right rightMember mappedEq
    obtain ⟨leftPosition, leftEq⟩ :=
      (mem_source_names_iff _ _).mp leftMember
    obtain ⟨rightPosition, rightEq⟩ :=
      (mem_source_names_iff _ _).mp rightMember
    subst left
    subst right
    rw [suppliedNameMap_position,
      suppliedNameMap_position] at mappedEq
    have positionEq :=
      suppliedPositionName_injective avoid source mappedEq
    rw [positionEq]
  sort_preserving_on := by
    intro name member
    obtain ⟨position, nameEq⟩ :=
      (mem_source_names_iff _ _).mp member
    subst name
    rw [suppliedNameMap_position]
    have sourceSort :=
      (source.ports.get position).sort_eq
    have targetSort :=
      canonicalName_sort
        (source.ports.get position).sort
        (freshOffset avoid + position)
    exact targetSort.trans sourceSort.symm

/--
The canonical environment actually inhabits the sorted fresh-supply
interface that was previously only an explicit premise.
-/
noncomputable def canonicalSortedFreshBoundarySupply :
    SortedFreshBoundarySupply canonicalEnvironment where
  freshen avoid source :=
    { target := suppliedTarget avoid source
      boundaryMap := suppliedBoundaryRenaming avoid source
      fresh := suppliedTarget_fresh avoid source }

/--
A total concrete named tensor in the canonical environment.  The right
occurrence is refreshed away from the left support before concatenation.
-/
noncomputable def totalNamedTensor
    (left right : NamedInterface canonicalEnvironment) :
    NamedInterface canonicalEnvironment :=
  canonicalSortedFreshBoundarySupply.tensorObject left right

@[simp]
theorem totalNamedTensor_sorts
    (left right : NamedInterface canonicalEnvironment) :
    (totalNamedTensor left right).sorts =
      left.sorts ++ right.sorts :=
  SortedFreshBoundarySupply.tensorObject_sorts
    canonicalSortedFreshBoundarySupply left right

theorem totalNamedTensor_rightOccurrence_fresh
    (left right : NamedInterface canonicalEnvironment) :
    Disjoint left.names
      (canonicalSortedFreshBoundarySupply.freshRight left right).names :=
  SortedFreshBoundarySupply.freshRight_disjoint
    canonicalSortedFreshBoundarySupply left right

/-! ## Total symmetric monoidal core -/

/-- The algebraic hom set of positional open processes. -/
abbrev Hom (source target : Object) :=
  source ⟶ target

/-- Total positional tensor on objects. -/
def tensorObject (left right : Object) : Object :=
  MonoidalCategoryStruct.tensorObj left right

/-- Total positional identity, including at nonempty boundaries. -/
def identity (object : Object) : Hom object object :=
  𝟙 object

/-- Total boundary plug/hide composition. -/
def plugHide
    {source middle target : Object}
    (left : Hom source middle)
    (right : Hom middle target) :
    Hom source target :=
  CategoryStruct.comp left right

/-- Total tensor on positional morphisms. -/
def parallel
    {leftIn leftOut rightIn rightOut : Object}
    (left : Hom leftIn leftOut)
    (right : Hom rightIn rightOut) :
    Hom (tensorObject leftIn rightIn)
      (tensorObject leftOut rightOut) :=
  MonoidalCategoryStruct.tensorHom left right

@[simp]
theorem tensorObject_boundary
    (left right : Object) :
    (tensorObject left right).boundary =
      left.boundary ++ right.boundary :=
  by
    change
      (⟨left.boundary ++ right.boundary⟩ : Object).boundary =
        left.boundary ++ right.boundary
    rfl

@[simp]
theorem plugHide_identity_left
    {source target : Object}
    (process : Hom source target) :
    plugHide (identity source) process = process := by
  change (𝟙 source) ≫ process = process
  exact Category.id_comp process

@[simp]
theorem plugHide_identity_right
    {source target : Object}
    (process : Hom source target) :
    plugHide process (identity target) = process := by
  change process ≫ (𝟙 target) = process
  exact Category.comp_id process

theorem plugHide_assoc
    {a b c d : Object}
    (first : Hom a b) (second : Hom b c) (third : Hom c d) :
    plugHide (plugHide first second) third =
      plugHide first (plugHide second third) := by
  change (first ≫ second) ≫ third =
    first ≫ (second ≫ third)
  exact Category.assoc first second third

@[simp]
theorem parallel_identity
    (left right : Object) :
    parallel (identity left) (identity right) =
      identity (tensorObject left right) := by
  change
    OpenSMC.Hom.parallel
        (OpenSMC.Hom.identity canonicalEnvironment left.boundary)
        (OpenSMC.Hom.identity canonicalEnvironment right.boundary) =
      OpenSMC.Hom.identity canonicalEnvironment
        (left.boundary ++ right.boundary)
  exact OpenSMC.Hom.tensor_id
    canonicalEnvironment left.boundary right.boundary

theorem parallel_plugHide_interchange
    {a b c d e f : Object}
    (left₁ : Hom a b) (left₂ : Hom b c)
    (right₁ : Hom d e) (right₂ : Hom e f) :
    plugHide
        (parallel left₁ right₁)
        (parallel left₂ right₂) =
      parallel
        (plugHide left₁ left₂)
        (plugHide right₁ right₂) := by
  exact
    MonoidalCategory.tensorHom_comp_tensorHom
      left₁ right₁ left₂ right₂

/--
The positional representation inherits the complete mathlib symmetric
monoidal structure of the presented quotient.
-/
theorem canonical_positional_mathlib_smc :
    Nonempty (MonoidalCategory Object) ∧
      Nonempty (SymmetricCategory Object) :=
  OpenSMCCategory.open_pi_mathlib_smc canonicalEnvironment

/-- A genuinely nonempty positional object. -/
def singletonChannel : Object :=
  ⟨[.channel]⟩

@[simp]
theorem singletonChannel_nonempty :
    singletonChannel.boundary ≠ [] := by
  simp [singletonChannel]

/-- Its categorical identity exists without repeating a concrete name. -/
theorem singletonChannel_identity_nonempty :
    Nonempty (Hom singletonChannel singletonChannel) :=
  ⟨identity singletonChannel⟩

/--
A proposed realization of a reusable positional identity by one fixed raw
finite-control process.

`reusable` is only the minimal necessary execution-budget condition: every
requested number of operational uses must support a native run at least that
long.  No forwarding labels or category equation are smuggled into it.
-/
structure FixedNativeIdentityRealizer (object : Object) where
  process : Raw.Proc
  boundary_nonempty : object.boundary ≠ []
  reusable : HasArbitrarilyLongNativeRuns process

/--
The new positional object representation repairs total object tensor and
algebraic identities, but it cannot satisfy the explicitly assumed
`HasArbitrarilyLongNativeRuns` condition with one fixed finite-control raw
process.  This is a necessary-condition obstruction only: the theorem does
not derive that condition from categorical identity, and does not exclude
zero-step structural wires, a budget-indexed family, replication/recursion,
or a separate wiring semantics.
-/
theorem no_fixedNativeIdentityRealizer
    (object : Object) :
    ¬ Nonempty (FixedNativeIdentityRealizer object) := by
  rintro ⟨realizer⟩
  exact
    no_unbounded_native_forwarder realizer.process
      realizer.reusable

/--
Self tensor is total and contains two distinct positions, unlike the old
concrete-name object representation.
-/
@[simp]
theorem singletonChannel_self_tensor_boundary :
    (tensorObject singletonChannel singletonChannel).boundary =
      [.channel, .channel] := by
  rw [tensorObject_boundary]
  rfl

theorem singletonChannel_self_tensor_realization_nodup
    (offset : Nat) :
    ((realizeAt offset
      (tensorObject singletonChannel singletonChannel)).ports.map
        Port.name).Nodup :=
  (realizeAt offset
    (tensorObject singletonChannel singletonChannel)).names_nodup

/-! ## Exact native operational kernel -/

/-- Hide all positional names of a boundary around a raw process. -/
def hideBoundary
    (offset : Nat) (boundary : Object)
    (process : Raw.Proc) : Raw.Proc :=
  hideMany
    ((realizeAt offset boundary).ports.map Port.name)
    process

/--
Parallel composition followed by hiding a realized positional boundary.

No endpoint renaming is performed here.  A caller seeking actual plug
adequacy must separately prove that both operands use the realized middle
ports with the required polarities.
-/
def plugProcess
    (offset : Nat) (middle : Object)
    (left right : Raw.Proc) : Raw.Proc :=
  hideBoundary offset middle (.par left right)

/--
Choose the hidden positional middle strictly fresh for every name occurring
in either operand.
-/
def freshPlugOffset (left right : Raw.Proc) : Nat :=
  freshOffset (left.allNames ∪ right.allNames)

/--
Parallel-plus-hide with a capture-safe automatically fresh restriction block.
Because the block is disjoint from both raw operands, this definition alone
does not connect either operand to a middle port.
-/
def freshPlugProcess
    (middle : Object) (left right : Raw.Proc) : Raw.Proc :=
  plugProcess (freshPlugOffset left right) middle left right

theorem freshPlug_middle_disjoint
    (middle : Object) (left right : Raw.Proc) :
    Disjoint
      (realizeAt (freshPlugOffset left right) middle).names
      (left.allNames ∪ right.allNames) := by
  exact realizeAt_fresh _ _

/--
A native step propagates through positional restriction in one strong step.
-/
theorem hideBoundary_native
    (offset : Nat) (boundary : Object)
    (step : Late.NativeStep source action target)
    (fresh :
      ∀ binder,
        binder ∈
          (realizeAt offset boundary).ports.map Port.name →
        binder ∉ action.names) :
    Late.NativeStep
      (hideBoundary offset boundary source)
      action
      (hideBoundary offset boundary target) :=
  hideMany_native _ step fresh

/-- Tau propagation needs no freshness premise. -/
theorem hideBoundary_native_tau
    (offset : Nat) (boundary : Object)
    (step : Late.NativeStep source .tau target) :
    Late.NativeStep
      (hideBoundary offset boundary source)
      .tau
      (hideBoundary offset boundary target) :=
  hideMany_native_tau _ step

/--
If the raw operands already communicate on `channel`, that communication
propagates through the selected positional restrictions in one native tau
step.  No premise identifies `channel` with a realized middle port.
-/
theorem plugProcess_syncLeft_native
    (offset : Nat) (middle : Object)
    (outputStep :
      Late.NativeStep left (.output channel value) left')
    (inputStep :
      Late.NativeStep right (.input channel binder) right')
    (binderFresh : binder ∉ left'.freeNames) :
    Late.NativeStep
      (plugProcess offset middle left right)
      .tau
      (hideBoundary offset middle
        (.par left'
          (right'.substituteCaptureAvoiding binder value))) :=
  plugHide_syncLeft_native _ outputStep inputStep binderFresh

/--
Adding an automatically fresh (therefore initially unused) positional
restriction block retains the same exact native one-step communication
derivation.  This is restriction propagation, not endpoint-plug adequacy.
-/
theorem freshPlugProcess_syncLeft_native
    (middle : Object)
    (outputStep :
      Late.NativeStep left (.output channel value) left')
    (inputStep :
      Late.NativeStep right (.input channel binder) right')
    (binderFresh : binder ∉ left'.freeNames) :
    Late.NativeStep
      (freshPlugProcess middle left right)
      .tau
      (hideBoundary (freshPlugOffset left right) middle
        (.par left'
          (right'.substituteCaptureAvoiding binder value))) :=
  plugProcess_syncLeft_native _ _ outputStep inputStep binderFresh

/-- Right/left mirror of exact free communication. -/
theorem plugProcess_syncRight_native
    (offset : Nat) (middle : Object)
    (inputStep :
      Late.NativeStep left (.input channel binder) left')
    (outputStep :
      Late.NativeStep right (.output channel value) right')
    (binderFresh : binder ∉ right'.freeNames) :
    Late.NativeStep
      (plugProcess offset middle left right)
      .tau
      (hideBoundary offset middle
        (.par
          (left'.substituteCaptureAvoiding binder value)
          right')) :=
  plugHide_syncRight_native _ inputStep outputStep binderFresh

/--
Bound output/input close and positional hiding are one native tau step.
-/
theorem plugProcess_closeLeft_native
    (offset : Nat) (middle : Object)
    (outputStep :
      Late.NativeStep left
        (.boundOutput channel freshName) left')
    (inputStep :
      Late.NativeStep right (.input channel binder) right')
    (freshForReceiver : freshName ∉ right.freeNames)
    (binderFresh : binder ∉ left'.freeNames) :
    Late.NativeStep
      (plugProcess offset middle left right)
      .tau
      (hideBoundary offset middle
        (.new freshName
          (.par left'
            (right'.substituteCaptureAvoiding binder freshName)))) :=
  plugHide_closeLeft_native _ outputStep inputStep
    freshForReceiver binderFresh

/-- Right/left mirror of exact bound-output close. -/
theorem plugProcess_closeRight_native
    (offset : Nat) (middle : Object)
    (inputStep :
      Late.NativeStep left (.input channel binder) left')
    (outputStep :
      Late.NativeStep right
        (.boundOutput channel freshName) right')
    (freshForReceiver : freshName ∉ left.freeNames)
    (binderFresh : binder ∉ right'.freeNames) :
    Late.NativeStep
      (plugProcess offset middle left right)
      .tau
      (hideBoundary offset middle
        (.new freshName
          (.par
            (left'.substituteCaptureAvoiding binder freshName)
            right'))) :=
  plugHide_closeRight_native _ inputStep outputStep
    freshForReceiver binderFresh

end Cantilune.Pi.OpenSMCCanonicalPositional
