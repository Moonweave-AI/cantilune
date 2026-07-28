import Mathlib.Data.Finset.Basic
import Mathlib.Data.Finset.Lattice.Basic

/-!
# Finite-support separation algebras and separated tensor

This file develops an ordinary, set-level resource-separation layer:

* a relational partial commutative monoid whose composition exists exactly
  for disjoint finite supports;
* support monotonicity and a generic frame theorem for non-allocating local
  transitions;
* supported objects, support-preserving maps, and the separated tensor;
* explicit associator, braiding, and unitors, with pentagon, triangle, and
  hexagon coherence;
* a nonempty concrete model whose elements are finite resource sets.

This is **not** the Abramsky powerdomain, an enriched powerdomain monad, a
recursive domain-equation solution, hiding, adequacy, definability, or full
abstraction.  It supplies only the finite-support PCM/tensor infrastructure
needed to state later constructions without conflating disjoint parallel
resources with cartesian product.
-/

noncomputable section

namespace Cantilune.Pi.FMSFiniteSupportSeparation

/-! ## Relational partial commutative monoids -/

/--
A finite-support separation algebra.

`Compose left right result` is a partial operation presented relationally.
Functionality makes the result unique, while `compose_exists_iff_disjoint`
says that composition is defined exactly when the two finite supports are
disjoint.
-/
structure SeparationAlgebra
    (Resource : Type)
    [DecidableEq Resource] where
  Carrier : Type
  support : Carrier → Finset Resource
  empty : Carrier
  support_empty : support empty = ∅
  Compose : Carrier → Carrier → Carrier → Prop
  compose_functional :
    ∀ {left right first second},
      Compose left right first →
      Compose left right second →
      first = second
  compose_exists_iff_disjoint :
    ∀ left right,
      (∃ result, Compose left right result) ↔
        Disjoint (support left) (support right)
  compose_comm :
    ∀ {left right result},
      Compose left right result →
      Compose right left result
  compose_assoc :
    ∀ {first second third firstSecond result},
      Compose first second firstSecond →
      Compose firstSecond third result →
      ∃ secondThird,
        Compose second third secondThird ∧
          Compose first secondThird result
  empty_left :
    ∀ value, Compose empty value value
  support_compose :
    ∀ {left right result},
      Compose left right result →
      support result = support left ∪ support right

namespace SeparationAlgebra

variable
    {Resource : Type}
    [DecidableEq Resource]
    (algebra : SeparationAlgebra Resource)

/-- Composition is possible precisely for compatible finite supports. -/
def Compatible
    (left right : algebra.Carrier) : Prop :=
  Disjoint (algebra.support left) (algebra.support right)

theorem compose_exists_iff
    (left right : algebra.Carrier) :
    (∃ result, algebra.Compose left right result) ↔
      algebra.Compatible left right :=
  algebra.compose_exists_iff_disjoint left right

/-- Every valid composition certifies disjointness of its inputs. -/
theorem disjoint_of_compose
    {left right result : algebra.Carrier}
    (composition : algebra.Compose left right result) :
    Disjoint (algebra.support left) (algebra.support right) :=
  (algebra.compose_exists_iff_disjoint left right).mp
    ⟨result, composition⟩

/-- The empty element is also a right unit. -/
theorem empty_right
    (value : algebra.Carrier) :
    algebra.Compose value algebra.empty value :=
  algebra.compose_comm (algebra.empty_left value)

/-- Support of the left operand is included in support of the result. -/
theorem support_left_subset
    {left right result : algebra.Carrier}
    (composition : algebra.Compose left right result) :
    algebra.support left ⊆ algebra.support result := by
  rw [algebra.support_compose composition]
  exact Finset.subset_union_left

/-- Support of the right operand is included in support of the result. -/
theorem support_right_subset
    {left right result : algebra.Carrier}
    (composition : algebra.Compose left right result) :
    algebra.support right ⊆ algebra.support result := by
  rw [algebra.support_compose composition]
  exact Finset.subset_union_right

/-! ## Local transitions and the frame rule -/

/-- A transition never allocates new support. -/
def SupportMonotone
    (step : algebra.Carrier → algebra.Carrier → Prop) :
    Prop :=
  ∀ ⦃source target⦄,
    step source target →
      algebra.support target ⊆ algebra.support source

/--
Closure of a local transition under a disjoint frame.  Both source and
target must compose with the same frame.
-/
def FrameStep
    (step : algebra.Carrier → algebra.Carrier → Prop)
    (source target : algebra.Carrier) :
    Prop :=
  ∃ localSource localTarget frame,
    step localSource localTarget ∧
      algebra.Compose localSource frame source ∧
      algebra.Compose localTarget frame target

/-- Frame closure preserves support monotonicity. -/
theorem frameStep_supportMonotone
    {step : algebra.Carrier → algebra.Carrier → Prop}
    (monotone : algebra.SupportMonotone step) :
    algebra.SupportMonotone (algebra.FrameStep step) := by
  intro source target transition
  rcases transition with
    ⟨localSource, localTarget, frame,
      localStep, sourceComposition, targetComposition⟩
  rw [algebra.support_compose targetComposition,
    algebra.support_compose sourceComposition]
  exact
    Finset.union_subset_union
      (monotone localStep)
      (fun _ member => member)

/--
Generic frame law.

If a frame-closed, support-monotone step `source → target` is composed with
an additional disjoint resource, then the target can be composed with the
same resource and the enlarged states are again related by `FrameStep`.
-/
theorem frame_law
    {step : algebra.Carrier → algebra.Carrier → Prop}
    (monotone : algebra.SupportMonotone step)
    {source target extra framedSource : algebra.Carrier}
    (transition : algebra.FrameStep step source target)
    (sourceWithExtra :
      algebra.Compose source extra framedSource) :
    ∃ framedTarget,
      algebra.Compose target extra framedTarget ∧
        algebra.FrameStep step framedSource framedTarget := by
  rcases transition with
    ⟨localSource, localTarget, frame,
      localStep, localFrameSource, localFrameTarget⟩
  have sourceExtraDisjoint :
      Disjoint (algebra.support source) (algebra.support extra) :=
    algebra.disjoint_of_compose sourceWithExtra
  have sourceSupport :
      algebra.support source =
        algebra.support localSource ∪ algebra.support frame :=
    algebra.support_compose localFrameSource
  have targetSupport :
      algebra.support target =
        algebra.support localTarget ∪ algebra.support frame :=
    algebra.support_compose localFrameTarget
  have sourceParts :
      Disjoint
        (algebra.support localSource ∪ algebra.support frame)
        (algebra.support extra) := by
    rwa [← sourceSupport]
  have localExtra :
      Disjoint
        (algebra.support localSource)
        (algebra.support extra) :=
    (Finset.disjoint_union_left.mp sourceParts).1
  have frameExtra :
      Disjoint
        (algebra.support frame)
        (algebra.support extra) :=
    (Finset.disjoint_union_left.mp sourceParts).2
  have targetLocalExtra :
      Disjoint
        (algebra.support localTarget)
        (algebra.support extra) :=
    Disjoint.mono (monotone localStep)
      (fun _ member => member) localExtra
  have targetExtraDisjoint :
      Disjoint
        (algebra.support target)
        (algebra.support extra) := by
    rw [targetSupport, Finset.disjoint_union_left]
    exact ⟨targetLocalExtra, frameExtra⟩
  rcases
      (algebra.compose_exists_iff_disjoint target extra).mpr
        targetExtraDisjoint with
    ⟨framedTarget, targetWithExtra⟩
  rcases
      algebra.compose_assoc localFrameSource sourceWithExtra with
    ⟨frameExtraSource, frameWithExtraSource,
      localWithExtendedFrame⟩
  rcases
      algebra.compose_assoc localFrameTarget targetWithExtra with
    ⟨frameExtraTarget, frameWithExtraTarget,
      targetWithExtendedFrame⟩
  have sameExtendedFrame :
      frameExtraSource = frameExtraTarget :=
    algebra.compose_functional
      frameWithExtraSource frameWithExtraTarget
  subst frameExtraTarget
  exact
    ⟨framedTarget, targetWithExtra,
      localSource, localTarget, frameExtraSource,
      localStep, localWithExtendedFrame,
      targetWithExtendedFrame⟩

end SeparationAlgebra

/-! ## A concrete finite-support PCM -/

namespace FinsetPCM

variable (Resource : Type) [DecidableEq Resource]

/-- Partial union: the result is the union and inputs must be disjoint. -/
def Compose
    (left right result : Finset Resource) : Prop :=
  Disjoint left right ∧ result = left ∪ right

/-- Finite resource sets form a nontrivial separation algebra. -/
def algebra : SeparationAlgebra Resource where
  Carrier := Finset Resource
  support := id
  empty := ∅
  support_empty := rfl
  Compose := Compose Resource
  compose_functional := by
    intro left right first second firstComposition secondComposition
    exact firstComposition.2.trans secondComposition.2.symm
  compose_exists_iff_disjoint := by
    intro left right
    constructor
    · rintro ⟨result, separated, _⟩
      exact separated
    · intro separated
      exact ⟨left ∪ right, separated, rfl⟩
  compose_comm := by
    intro left right result composition
    exact
      ⟨composition.1.symm,
        composition.2.trans (Finset.union_comm left right)⟩
  compose_assoc := by
    intro first second third firstSecond result
      firstComposition resultComposition
    rcases firstComposition with ⟨firstSecondDisjoint, rfl⟩
    rcases resultComposition with ⟨unionThirdDisjoint, rfl⟩
    have firstThirdDisjoint :
        Disjoint first third :=
      (Finset.disjoint_union_left.mp unionThirdDisjoint).1
    have secondThirdDisjoint :
        Disjoint second third :=
      (Finset.disjoint_union_left.mp unionThirdDisjoint).2
    refine
      ⟨second ∪ third,
        ⟨secondThirdDisjoint, rfl⟩,
        ⟨?_, ?_⟩⟩
    · exact
        Finset.disjoint_union_right.mpr
          ⟨firstSecondDisjoint, firstThirdDisjoint⟩
    · exact Finset.union_assoc first second third
  empty_left := by
    intro value
    exact ⟨by simp, by simp⟩
  support_compose := by
    intro left right result composition
    exact composition.2

/-- A concrete nonempty element of the finite-support model. -/
def emptyElement :
    Finset Resource :=
  ∅

instance : Nonempty (algebra Resource).Carrier := by
  change Nonempty (Finset Resource)
  exact ⟨emptyElement Resource⟩

/-- Deletion is a support-monotone local transition. -/
def DeleteStep
    (source target : Finset Resource) :
    Prop :=
  target ⊆ source

theorem deleteStep_supportMonotone :
    (algebra Resource).SupportMonotone
      (DeleteStep Resource) :=
  by
    intro source target transition
    simpa [algebra, DeleteStep] using transition

/-- The generic frame theorem instantiated for finite-set deletion. -/
theorem delete_frame_law
    {source target extra framedSource :
      (algebra Resource).Carrier}
    (transition :
      (algebra Resource).FrameStep
        (DeleteStep Resource) source target)
    (sourceWithExtra :
      (algebra Resource).Compose
        source extra framedSource) :
    ∃ framedTarget,
      (algebra Resource).Compose
          target extra framedTarget ∧
        (algebra Resource).FrameStep
          (DeleteStep Resource)
          framedSource framedTarget :=
  (algebra Resource).frame_law
    (deleteStep_supportMonotone Resource)
    transition sourceWithExtra

end FinsetPCM

/-! ## Supported objects and the separated tensor -/

/-- A carrier equipped with finite support. -/
structure SupportedObject
    (Resource : Type)
    [DecidableEq Resource] where
  Carrier : Type
  support : Carrier → Finset Resource

namespace SupportedObject

variable
    {Resource : Type}
    [DecidableEq Resource]

/-- A map preserving finite support exactly. -/
@[ext]
structure Hom
    (source target : SupportedObject Resource) where
  toFun : source.Carrier → target.Carrier
  support_eq :
    ∀ value,
      target.support (toFun value) = source.support value

instance
    {source target : SupportedObject Resource} :
    CoeFun (Hom source target)
      (fun _ => source.Carrier → target.Carrier) :=
  ⟨Hom.toFun⟩

/-- Identity support-preserving map. -/
def Hom.id
    (object : SupportedObject Resource) :
    Hom object object where
  toFun := fun value => value
  support_eq := fun _ => rfl

/-- Composition of support-preserving maps. -/
def Hom.comp
    {first second third : SupportedObject Resource}
    (left : Hom first second)
    (right : Hom second third) :
    Hom first third where
  toFun := fun value => right (left value)
  support_eq := by
    intro value
    rw [right.support_eq, left.support_eq]

@[simp]
theorem Hom.id_apply
    (object : SupportedObject Resource)
    (value : object.Carrier) :
    Hom.id object value = value :=
  rfl

@[simp]
theorem Hom.comp_apply
    {first second third : SupportedObject Resource}
    (left : Hom first second)
    (right : Hom second third)
    (value : first.Carrier) :
    left.comp right value = right (left value) :=
  rfl

/-- Isomorphism in the category of supported sets. -/
structure Iso
    (source target : SupportedObject Resource) where
  hom : Hom source target
  inv : Hom target source
  hom_inv_id : hom.comp inv = Hom.id source
  inv_hom_id : inv.comp hom = Hom.id target

/-- Underlying supported object of a separation algebra. -/
def ofSeparationAlgebra
    (algebra : SeparationAlgebra Resource) :
    SupportedObject Resource where
  Carrier := algebra.Carrier
  support := algebra.support

end SupportedObject

/-!
Pairs whose finite supports are separated.  This is the carrier of the
separated tensor, rather than the unrestricted cartesian product.
-/
@[ext]
structure SeparatedTensor
    {Resource : Type}
    [DecidableEq Resource]
    (left right : SupportedObject Resource) where
  fst : left.Carrier
  snd : right.Carrier
  separated :
    Disjoint (left.support fst) (right.support snd)

namespace SeparatedTensor

variable
    {Resource : Type}
    [DecidableEq Resource]

/-- Separated tensor of supported objects. -/
def tensor
    (left right : SupportedObject Resource) :
    SupportedObject Resource where
  Carrier := SeparatedTensor left right
  support := fun value =>
    left.support value.fst ∪ right.support value.snd

/-- Tensor action on support-preserving maps. -/
def map
    {left left' right right' : SupportedObject Resource}
    (first : SupportedObject.Hom left left')
    (second : SupportedObject.Hom right right') :
    SupportedObject.Hom
      (tensor left right) (tensor left' right') where
  toFun := fun value =>
    { fst := first value.fst
      snd := second value.snd
      separated := by
        rw [first.support_eq, second.support_eq]
        exact value.separated }
  support_eq := by
    intro value
    simp only [tensor]
    rw [first.support_eq, second.support_eq]

/-- Tensor unit: one point with empty support. -/
def unit : SupportedObject Resource where
  Carrier := PUnit
  support := fun _ => ∅

/-- Braiding map for separated tensor. -/
def braidingHom
    (left right : SupportedObject Resource) :
    SupportedObject.Hom
      (tensor left right) (tensor right left) where
  toFun := fun value =>
    { fst := value.snd
      snd := value.fst
      separated := value.separated.symm }
  support_eq := by
    intro value
    exact Finset.union_comm _ _

/-- Separated tensor is symmetric. -/
def braiding
    (left right : SupportedObject Resource) :
    SupportedObject.Iso
      (tensor left right) (tensor right left) where
  hom := braidingHom left right
  inv := braidingHom right left
  hom_inv_id := by
    ext value
    rfl
  inv_hom_id := by
    ext value
    rfl

/-- Forward associator. -/
def associatorHom
    (first second third : SupportedObject Resource) :
    SupportedObject.Hom
      (tensor (tensor first second) third)
      (tensor first (tensor second third)) where
  toFun := fun value =>
    { fst := value.fst.fst
      snd :=
        { fst := value.fst.snd
          snd := value.snd
          separated :=
            (Finset.disjoint_union_left.mp
              value.separated).2 }
      separated :=
        Finset.disjoint_union_right.mpr
          ⟨value.fst.separated,
            (Finset.disjoint_union_left.mp
              value.separated).1⟩ }
  support_eq := by
    intro value
    exact
      (Finset.union_assoc
        (first.support value.fst.fst)
        (second.support value.fst.snd)
        (third.support value.snd)).symm

/-- Inverse associator. -/
def associatorInv
    (first second third : SupportedObject Resource) :
    SupportedObject.Hom
      (tensor first (tensor second third))
      (tensor (tensor first second) third) where
  toFun := fun value =>
    { fst :=
        { fst := value.fst
          snd := value.snd.fst
          separated :=
            (Finset.disjoint_union_right.mp
              value.separated).1 }
      snd := value.snd.snd
      separated :=
        Finset.disjoint_union_left.mpr
          ⟨(Finset.disjoint_union_right.mp
              value.separated).2,
            value.snd.separated⟩ }
  support_eq := by
    intro value
    exact
      Finset.union_assoc
        (first.support value.fst)
        (second.support value.snd.fst)
        (third.support value.snd.snd)

/-- Separated tensor is associative up to the explicit support-preserving iso. -/
def associator
    (first second third : SupportedObject Resource) :
    SupportedObject.Iso
      (tensor (tensor first second) third)
      (tensor first (tensor second third)) where
  hom := associatorHom first second third
  inv := associatorInv first second third
  hom_inv_id := by
    ext value
    rfl
  inv_hom_id := by
    ext value
    rfl

/-- Left unitor. -/
def leftUnitor
    (object : SupportedObject Resource) :
    SupportedObject.Iso
      (tensor unit object) object where
  hom :=
    { toFun := fun value => value.snd
      support_eq := by
        intro value
        simp [tensor, unit] }
  inv :=
    { toFun := fun value =>
        { fst := PUnit.unit
          snd := value
          separated := by simp [unit] }
      support_eq := by
        intro value
        simp [tensor, unit] }
  hom_inv_id := by
    ext value
    cases value.fst
    rfl
  inv_hom_id := by
    ext value
    rfl

/-- Right unitor. -/
def rightUnitor
    (object : SupportedObject Resource) :
    SupportedObject.Iso
      (tensor object unit) object where
  hom :=
    { toFun := fun value => value.fst
      support_eq := by
        intro value
        simp [tensor, unit] }
  inv :=
    { toFun := fun value =>
        { fst := value
          snd := PUnit.unit
          separated := by simp [unit] }
      support_eq := by
        intro value
        simp [tensor, unit] }
  hom_inv_id := by
    ext value
    cases value.snd
    rfl
  inv_hom_id := by
    ext value
    rfl

/-- The braiding is involutive. -/
theorem braiding_involutive
    (left right : SupportedObject Resource) :
    (braiding left right).hom.comp
        (braiding right left).hom =
      SupportedObject.Hom.id (tensor left right) :=
  (braiding left right).hom_inv_id

/-- Mac Lane's pentagon for the explicit separated associator. -/
theorem associator_pentagon
    (first second third fourth : SupportedObject Resource) :
    (associator (tensor first second) third fourth).hom.comp
        (associator first second (tensor third fourth)).hom =
      ((map
          (associator first second third).hom
          (SupportedObject.Hom.id fourth)).comp
        (associator first (tensor second third) fourth).hom).comp
          (map
            (SupportedObject.Hom.id first)
            (associator second third fourth).hom) := by
  ext value
  rfl

/-- Triangle coherence for associator and unitors. -/
theorem unitor_triangle
    (first second : SupportedObject Resource) :
    (associator first unit second).hom.comp
        (map
          (SupportedObject.Hom.id first)
          (leftUnitor second).hom) =
      map
        (rightUnitor first).hom
        (SupportedObject.Hom.id second) := by
  ext value
  cases value.fst.snd
  rfl

/-- Hexagon coherence for associator and braiding. -/
theorem braiding_hexagon
    (first second third : SupportedObject Resource) :
    ((associator first second third).hom.comp
        (braiding first (tensor second third)).hom).comp
          (associator second third first).hom =
      ((map
          (braiding first second).hom
          (SupportedObject.Hom.id third)).comp
        (associator second first third).hom).comp
          (map
            (SupportedObject.Hom.id second)
            (braiding first third).hom) := by
  ext value
  rfl

/-! ## Nonempty separated tensors from PCM units -/

/-- The two empty PCM elements always form a separated tensor point. -/
def emptyPair
    (left right : SeparationAlgebra Resource) :
    SeparatedTensor
      (SupportedObject.ofSeparationAlgebra left)
      (SupportedObject.ofSeparationAlgebra right) where
  fst := left.empty
  snd := right.empty
  separated := by
    change
      Disjoint
        (left.support left.empty)
        (right.support right.empty)
    rw [left.support_empty, right.support_empty]
    simp

instance
    (left right : SeparationAlgebra Resource) :
    Nonempty
      (SeparatedTensor
        (SupportedObject.ofSeparationAlgebra left)
        (SupportedObject.ofSeparationAlgebra right)) :=
  ⟨emptyPair left right⟩

end SeparatedTensor

end Cantilune.Pi.FMSFiniteSupportSeparation
