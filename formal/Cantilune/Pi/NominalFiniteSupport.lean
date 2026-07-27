import Cantilune.Pi.FMSCpoInputTransport

/-!
# Nominal finite-support foundations over finite-injection worlds

This module isolates the finite nominal facts needed by later open-pi and FMS
constructions:

* finite injections act on finite supports by direct image;
* finite permutations are invertible instances of that action;
* allocation transports an old support into `n + 1` and leaves the last name
  fresh;
* extending an injection with either of two fresh target names gives arrows
  related by a target permutation fixing every old name; and
* the finite-support action agrees with the existing `Set^I` support object
  and its allocation/hiding maps.

These are nominal-support and alpha-isomorphism facts only.  They do not
construct an FMS powerdomain, solve a recursive domain equation, or prove
full abstraction.
-/

namespace Cantilune.Pi.NominalFiniteSupport

open CategoryTheory
open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoInputTransport
open Cantilune.Pi.FMSCpoWorld

/-- A finite support in world `world`. -/
abbrev Support (world : World) := Finset (Fin world)

/-- Covariant direct-image action of a finite-world injection on support. -/
def mapSupport
    {source target : World}
    (injection : Injection source target)
    (support : Support source) :
    Support target :=
  support.image injection

@[simp]
theorem mem_mapSupport
    {source target : World}
    (injection : Injection source target)
    (support : Support source)
    (name : Fin target) :
    name ∈ mapSupport injection support ↔
      ∃ old ∈ support, injection old = name := by
  simp [mapSupport]

@[simp]
theorem mapSupport_identity
    (world : World) (support : Support world) :
    mapSupport (Injection.identity world) support = support := by
  ext name
  simp [mapSupport]

@[simp]
theorem mapSupport_comp
    {first second third : World}
    (left : Injection first second)
    (right : Injection second third)
    (support : Support first) :
    mapSupport (left.comp right) support =
      mapSupport right (mapSupport left support) := by
  ext name
  simp [mapSupport]

/-- Injective transport preserves the exact size of a finite support. -/
theorem card_mapSupport
    {source target : World}
    (injection : Injection source target)
    (support : Support source) :
    (mapSupport injection support).card = support.card := by
  exact Finset.card_image_of_injective support injection.injective

/-- Direct image along a world injection is itself injective on supports. -/
theorem mapSupport_injective
    {source target : World}
    (injection : Injection source target) :
    Function.Injective (mapSupport injection) := by
  intro left right equality
  exact Finset.image_injective injection.injective equality

/--
An injective world renaming preserves and reflects separation of finite
supports.

Reflection is the load-bearing part: two renamed resources can coincide only
when their source resources already coincided, because every world arrow is
injective.  This connects nominal renaming to the defining carrier predicate
of the separated tensor.
-/
@[simp]
theorem disjoint_mapSupport_iff
    {source target : World}
    (injection : Injection source target)
    (left right : Support source) :
    Disjoint
        (mapSupport injection left)
        (mapSupport injection right) ↔
      Disjoint left right := by
  constructor
  · intro separated
    rw [Finset.disjoint_left] at separated ⊢
    intro name leftMember rightMember
    exact separated
      ((mem_mapSupport injection left (injection name)).2
        ⟨name, leftMember, rfl⟩)
      ((mem_mapSupport injection right (injection name)).2
        ⟨name, rightMember, rfl⟩)
  · intro separated
    rw [Finset.disjoint_left] at separated ⊢
    intro name leftMember rightMember
    rcases
        (mem_mapSupport injection left name).1 leftMember with
      ⟨leftName, leftOld, leftEquation⟩
    rcases
        (mem_mapSupport injection right name).1 rightMember with
      ⟨rightName, rightOld, rightEquation⟩
    have namesEqual : leftName = rightName :=
      injection.injective
        (leftEquation.trans rightEquation.symm)
    subst rightName
    exact separated leftOld rightOld

/-- Direct image along an injection preserves finite support union exactly. -/
@[simp]
theorem mapSupport_union
    {source target : World}
    (injection : Injection source target)
    (left right : Support source) :
    mapSupport injection (left ∪ right) =
      mapSupport injection left ∪ mapSupport injection right := by
  simp [mapSupport, Finset.image_union]

/-- A finite name permutation at one world. -/
abbrev Permutation (world : World) := Equiv.Perm (Fin world)

/-- Forget a permutation to a finite-world injection. -/
def permutationInjection
    {world : World} (permutation : Permutation world) :
    Injection world world where
  toFun := permutation
  injective := permutation.injective

/-- Permutation action on a finite support. -/
def permuteSupport
    {world : World}
    (permutation : Permutation world)
    (support : Support world) :
    Support world :=
  mapSupport (permutationInjection permutation) support

@[simp]
theorem mem_permuteSupport
    {world : World}
    (permutation : Permutation world)
    (support : Support world)
    (name : Fin world) :
    name ∈ permuteSupport permutation support ↔
      permutation.symm name ∈ support := by
  constructor
  · intro member
    rcases (mem_mapSupport
      (permutationInjection permutation) support name).1 member with
      ⟨old, oldMember, endpoint⟩
    have oldEq : old = permutation.symm name := by
      apply permutation.injective
      change permutation old = name at endpoint
      simpa using endpoint
    simpa [oldEq] using oldMember
  · intro member
    apply (mem_mapSupport
      (permutationInjection permutation) support name).2
    exact ⟨permutation.symm name, member, permutation.apply_symm_apply name⟩

@[simp]
theorem permuteSupport_identity
    {world : World} (support : Support world) :
    permuteSupport (Equiv.refl (Fin world)) support = support := by
  ext name
  simp [permuteSupport, permutationInjection, mapSupport]

/-- Acting by a permutation and then its inverse recovers the support. -/
@[simp]
theorem permuteSupport_symm
    {world : World}
    (permutation : Permutation world)
    (support : Support world) :
    permuteSupport permutation.symm
        (permuteSupport permutation support) =
      support := by
  ext name
  simp

/-- Alpha-renaming by a finite permutation preserves and reflects separation. -/
@[simp]
theorem disjoint_permuteSupport_iff
    {world : World}
    (permutation : Permutation world)
    (left right : Support world) :
    Disjoint
        (permuteSupport permutation left)
        (permuteSupport permutation right) ↔
      Disjoint left right :=
  disjoint_mapSupport_iff
    (permutationInjection permutation) left right

/-- Standard allocation of an old finite support into `world + 1`. -/
def allocateSupport
    (world : World) (support : Support world) :
    Support (world + 1) :=
  mapSupport (up world) support

/-- The distinguished last coordinate is fresh for allocated old support. -/
theorem last_not_mem_allocateSupport
    (world : World) (support : Support world) :
    Fin.last world ∉ allocateSupport world support := by
  intro member
  rcases (mem_mapSupport (up world) support (Fin.last world)).1 member with
    ⟨old, _oldMember, endpoint⟩
  exact Fin.castSucc_ne_last old endpoint

/-- Allocation preserves the exact finite support cardinality. -/
@[simp]
theorem card_allocateSupport
    (world : World) (support : Support world) :
    (allocateSupport world support).card = support.card :=
  card_mapSupport (up world) support

/-- Canonical fresh-world allocation preserves and reflects support separation. -/
@[simp]
theorem disjoint_allocateSupport_iff
    (world : World)
    (left right : Support world) :
    Disjoint
        (allocateSupport world left)
        (allocateSupport world right) ↔
      Disjoint left right :=
  disjoint_mapSupport_iff (up world) left right

/-- Allocation followed by support hiding recovers the old finite support. -/
theorem dropFresh_allocateSupport
    (world : World) (support : Support world) :
    dropFresh world
        ((allocateSupport world support : Support (world + 1)) :
          Set (Fin (world + 1))) =
      (support : Set (Fin world)) := by
  ext name
  change
    Fin.castSucc name ∈ allocateSupport world support ↔
      name ∈ support
  unfold allocateSupport
  rw [mem_mapSupport]
  change
    (∃ old ∈ support,
      Fin.castSucc old = Fin.castSucc name) ↔
      name ∈ support
  constructor
  · rintro ⟨old, oldMember, endpoint⟩
    have oldEq : old = name :=
      Fin.castSucc_injective world endpoint
    simpa [oldEq] using oldMember
  · intro member
    exact ⟨name, member, rfl⟩

/-- Swap two possible fresh target names as a finite-world injection. -/
def freshSwap
    {target : World} (first second : Fin target) :
    Injection target target :=
  permutationInjection (Equiv.swap first second)

@[simp]
theorem freshSwap_first
    {target : World} (first second : Fin target) :
    freshSwap first second first = second := by
  simp [freshSwap, permutationInjection]

@[simp]
theorem freshSwap_second
    {target : World} (first second : Fin target) :
    freshSwap first second second = first := by
  simp [freshSwap, permutationInjection]

/--
The fresh-name swap fixes every old image point when both choices lie outside
the injection image.
-/
theorem freshSwap_old
    {source target : World}
    (injection : Injection source target)
    (first second : Fin target)
    (firstFresh : ¬ ∃ old, injection old = first)
    (secondFresh : ¬ ∃ old, injection old = second)
    (old : Fin source) :
    freshSwap first second (injection old) = injection old := by
  apply Equiv.swap_apply_of_ne_of_ne
  · intro equality
    exact firstFresh ⟨old, equality⟩
  · intro equality
    exact secondFresh ⟨old, equality⟩

/-- The fresh-name swap is its own inverse as an injection. -/
theorem freshSwap_involutive
    {target : World} (first second : Fin target) :
    (freshSwap first second).comp (freshSwap first second) =
      Injection.identity target := by
  apply Injection.ext
  intro name
  simp [freshSwap, permutationInjection]

/--
Changing the selected fresh name is postcomposition by a permutation which
fixes the complete old image.
-/
theorem extendByName_fresh_choice
    {source target : World}
    (injection : Injection source target)
    (first second : Fin target)
    (firstFresh : ¬ ∃ old, injection old = first)
    (secondFresh : ¬ ∃ old, injection old = second) :
    (extendByName injection first firstFresh).comp
        (freshSwap first second) =
      extendByName injection second secondFresh := by
  apply Injection.ext
  intro name
  cases name using Fin.lastCases with
  | cast old =>
      change
        freshSwap first second
            (homToFun (extendByName injection first firstFresh)
              (Fin.castSucc old)) =
          homToFun (extendByName injection second secondFresh)
            (Fin.castSucc old)
      rw [extendByName_castSucc, extendByName_castSucc]
      exact freshSwap_old
        injection first second firstFresh secondFresh old
  | last =>
      change
        freshSwap first second
            (homToFun (extendByName injection first firstFresh)
              (Fin.last source)) =
          homToFun (extendByName injection second secondFresh)
            (Fin.last source)
      rw [extendByName_last, extendByName_last]
      exact freshSwap_first first second

/--
Proof-carrying alpha isomorphism between two fresh-allocation choices.

The permutation is involutive, fixes every old name, maps the first fresh
choice to the second, and relates the two extended injections.
-/
structure FreshChoiceAlpha
    {source target : World}
    (injection : Injection source target)
    (first second : Fin target)
    (firstFresh : ¬ ∃ old, injection old = first)
    (secondFresh : ¬ ∃ old, injection old = second) where
  permutation : Permutation target
  fixes_old :
    ∀ old, permutation (injection old) = injection old
  maps_fresh : permutation first = second
  involutive : ∀ name, permutation (permutation name) = name
  extensions_related :
    (extendByName injection first firstFresh).comp
        (permutationInjection permutation) =
      extendByName injection second secondFresh

/-- Any two legal fresh choices have a canonical swap alpha-isomorphism. -/
def freshChoiceAlpha
    {source target : World}
    (injection : Injection source target)
    (first second : Fin target)
    (firstFresh : ¬ ∃ old, injection old = first)
    (secondFresh : ¬ ∃ old, injection old = second) :
    FreshChoiceAlpha injection first second firstFresh secondFresh where
  permutation := Equiv.swap first second
  fixes_old := by
    intro old
    exact freshSwap_old
      injection first second firstFresh secondFresh old
  maps_fresh := by simp
  involutive := by
    intro name
    simp
  extensions_related :=
    extendByName_fresh_choice
      injection first second firstFresh secondFresh

/-! ## Compatibility with the existing `I`/allocation/hiding support model -/

/-- Finite supports form a genuine covariant functor on the existing `I`. -/
def finiteSupportModel : World ⥤ Type where
  obj world := Support world
  map injection :=
    TypeCat.ofHom
      (fun support => support.image (homToFun injection))
  map_id world := by
    ext support name
    simp
  map_comp left right := by
    ext support name
    simp [Finset.image_image]

/-- Coercion of finite support into the existing `Set^I` support object. -/
def finiteSupportToSetAgent :
    finiteSupportModel ⟶ setAgent where
  app world :=
    TypeCat.ofHom (fun support : Support world =>
      (support : Set (Fin world)))
  naturality := by
    intro source target injection
    ext support name
    simp [finiteSupportModel, setAgent]

/-- Finite allocation agrees exactly with the existing `Set^I` allocation. -/
theorem allocateSupport_agrees_setAgent
    (world : World) (support : Support world) :
    ((allocateSupport world support : Support (world + 1)) :
        Set (Fin (world + 1))) =
      FMSModel.allocate world (support : Set (Fin world)) := by
  ext name
  simp [allocateSupport, mapSupport, FMSModel.allocate,
    homToFun, asInjection, up]

/--
The existing `δ`-style support hiding is a left inverse to finite allocation.
-/
theorem supportHiding_allocate
    (world : World) (support : Support world) :
    FMSCpoWorld.supportHiding.app world
        ((allocateSupport world support : Support (world + 1)) :
          Set (Fin (world + 1))) =
      (support : Set (Fin world)) := by
  change
    dropFresh world
        ((allocateSupport world support : Support (world + 1)) :
          Set (Fin (world + 1))) =
      (support : Set (Fin world))
  exact dropFresh_allocateSupport world support

end Cantilune.Pi.NominalFiniteSupport
