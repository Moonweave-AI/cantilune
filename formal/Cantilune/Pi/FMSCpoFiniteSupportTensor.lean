import Cantilune.Pi.FMSFiniteSupportSeparation
import Cantilune.Pi.NominalCpo
import Cantilune.Pi.FMSCpoFinitePower

/-!
# Finite-support separated tensor of omega-CPOs

This file lifts the set-level separated tensor to a genuine omega-CPO layer.
The essential closure premise is made explicit: the finite support of the
supremum of every omega-chain must already be bounded by the support at one
finite stage.  Together with monotonicity of support, this says that support
stabilises along every omega-chain.  It is exactly what is needed to show that
pointwise suprema of chains of disjoint pairs remain disjoint.

The resulting objects and continuous, exactly support-preserving maps form a
category.  The separated tensor has continuous map, braiding, associator and
unitors, and the usual coherence equations are proved extensionally.

This construction is deliberately only a support-separated omega-CPO
category.  It is not a powerdomain, a monad, a recursive-domain solution, an
FMS agent model, hiding, adequacy, definability, or full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteSupportTensor

open CategoryTheory
open OmegaCompletePartialOrder

universe u v

/--
An omega-CPO with finite support.

`support_omegaSup_bounded` is an explicit compactness/stabilisation premise;
it is not inferred from finiteness of each individual support.
-/
structure SupportedOmegaCpo
    (Resource : Type u)
    [DecidableEq Resource] where
  Carrier : Type v
  [omega : OmegaCompletePartialOrder Carrier]
  support : Carrier → Finset Resource
  support_mono : Monotone support
  support_omegaSup_bounded :
    ∀ chain : Chain Carrier,
      ∃ index,
        support (ωSup chain) ⊆ support (chain index)

attribute [instance] SupportedOmegaCpo.omega

namespace SupportedOmegaCpo

variable
    {Resource : Type u}
    [DecidableEq Resource]

/-- A continuous map preserving finite support exactly. -/
@[ext]
structure Hom
    (source target : SupportedOmegaCpo Resource) where
  toContinuousHom : source.Carrier →𝒄 target.Carrier
  support_eq :
    ∀ value,
      target.support (toContinuousHom value) =
        source.support value

instance
    {source target : SupportedOmegaCpo Resource} :
    CoeFun (Hom source target)
      (fun _ => source.Carrier → target.Carrier) :=
  ⟨fun morphism => morphism.toContinuousHom⟩

/-- Identity continuous support-preserving map. -/
def Hom.id
    (object : SupportedOmegaCpo Resource) :
    Hom object object where
  toContinuousHom := ContinuousHom.id
  support_eq := fun _ => rfl

/-- Composition of continuous support-preserving maps. -/
def Hom.comp
    {first second third : SupportedOmegaCpo Resource}
    (left : Hom first second)
    (right : Hom second third) :
    Hom first third where
  toContinuousHom :=
    ContinuousHom.comp
      right.toContinuousHom left.toContinuousHom
  support_eq := by
    intro value
    change
      third.support
          (right.toContinuousHom
            (left.toContinuousHom value)) =
        first.support value
    rw [right.support_eq, left.support_eq]

@[simp]
theorem Hom.id_apply
    (object : SupportedOmegaCpo Resource)
    (value : object.Carrier) :
    Hom.id object value = value :=
  rfl

@[simp]
theorem Hom.comp_apply
    {first second third : SupportedOmegaCpo Resource}
    (left : Hom first second)
    (right : Hom second third)
    (value : first.Carrier) :
    left.comp right value = right (left value) :=
  rfl

/-- Supported omega-CPOs and continuous exact-support maps form a category. -/
instance : Category (SupportedOmegaCpo Resource) where
  Hom := Hom
  id := Hom.id
  comp := Hom.comp
  id_comp := by
    intro first second morphism
    ext value
    rfl
  comp_id := by
    intro first second morphism
    ext value
    rfl
  assoc := by
    intro first second third fourth left middle right
    ext value
    rfl

end SupportedOmegaCpo

/-! ## The separated carrier and its omega-CPO -/

namespace Separated

variable
    {Resource : Type u}
    [DecidableEq Resource]

/--
The disjoint-pair carrier.  This is the ordered counterpart of the set-level
`FMSFiniteSupportSeparation.SeparatedTensor`.
-/
@[ext]
structure Carrier
    (left right : SupportedOmegaCpo Resource) where
  fst : left.Carrier
  snd : right.Carrier
  separated :
    Disjoint (left.support fst) (right.support snd)

/-- The pointwise partial order on separated pairs. -/
instance carrierPartialOrder
    (left right : SupportedOmegaCpo Resource) :
    PartialOrder (Carrier left right) :=
  PartialOrder.lift
    (fun value => (value.fst, value.snd))
    (by
      intro first second equality
      apply Carrier.ext
      · exact congrArg Prod.fst equality
      · exact congrArg Prod.snd equality)

/-- First projection as an order homomorphism. -/
def fstOrderHom
    (left right : SupportedOmegaCpo Resource) :
    Carrier left right →o left.Carrier where
  toFun := fun value => value.fst
  monotone' := by
    intro first second ordered
    exact ordered.1

/-- Second projection as an order homomorphism. -/
def sndOrderHom
    (left right : SupportedOmegaCpo Resource) :
    Carrier left right →o right.Carrier where
  toFun := fun value => value.snd
  monotone' := by
    intro first second ordered
    exact ordered.2

/-- First component of a chain of separated pairs. -/
def fstChain
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right)) :
    Chain left.Carrier :=
  chain.map (fstOrderHom left right)

/-- Second component of a chain of separated pairs. -/
def sndChain
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right)) :
    Chain right.Carrier :=
  chain.map (sndOrderHom left right)

@[simp]
theorem fstChain_apply
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right))
    (index : Nat) :
    fstChain chain index = (chain index).fst :=
  rfl

@[simp]
theorem sndChain_apply
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right))
    (index : Nat) :
    sndChain chain index = (chain index).snd :=
  rfl

/--
Explicit support compactness proves closure of the disjoint carrier under
componentwise omega-suprema.
-/
theorem omegaSup_separated
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right)) :
    Disjoint
      (left.support (ωSup (fstChain chain)))
      (right.support (ωSup (sndChain chain))) := by
  rcases
      left.support_omegaSup_bounded (fstChain chain) with
    ⟨leftIndex, leftBound⟩
  rcases
      right.support_omegaSup_bounded (sndChain chain) with
    ⟨rightIndex, rightBound⟩
  let common := max leftIndex rightIndex
  have leftAtCommon :
      left.support ((fstChain chain) leftIndex) ⊆
        left.support ((fstChain chain) common) :=
    left.support_mono
      ((fstChain chain).monotone
        (Nat.le_max_left _ _))
  have rightAtCommon :
      right.support ((sndChain chain) rightIndex) ⊆
        right.support ((sndChain chain) common) :=
    right.support_mono
      ((sndChain chain).monotone
        (Nat.le_max_right _ _))
  exact
    Disjoint.mono
      (leftBound.trans leftAtCommon)
      (rightBound.trans rightAtCommon)
      (chain common).separated

/-- Componentwise omega-supremum of a chain of separated pairs. -/
def carrierOmegaSup
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right)) :
    Carrier left right where
  fst := ωSup (fstChain chain)
  snd := ωSup (sndChain chain)
  separated := omegaSup_separated chain

/-- The separated carrier is a genuine omega-CPO. -/
noncomputable instance carrierOmegaCompletePartialOrder
    (left right : SupportedOmegaCpo Resource) :
    OmegaCompletePartialOrder (Carrier left right) where
  ωSup := carrierOmegaSup
  le_ωSup := by
    intro chain index
    constructor
    · exact le_ωSup (fstChain chain) index
    · exact le_ωSup (sndChain chain) index
  ωSup_le := by
    intro chain upper isUpper
    constructor
    · apply ωSup_le
      intro index
      exact (isUpper index).1
    · apply ωSup_le
      intro index
      exact (isUpper index).2

@[simp]
theorem carrier_omegaSup_fst
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right)) :
    (ωSup chain).fst = ωSup (fstChain chain) :=
  rfl

@[simp]
theorem carrier_omegaSup_snd
    {left right : SupportedOmegaCpo Resource}
    (chain : Chain (Carrier left right)) :
    (ωSup chain).snd = ωSup (sndChain chain) :=
  rfl

/-- The support-separated tensor object. -/
def tensor
    (left right : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo Resource where
  Carrier := Carrier left right
  omega := carrierOmegaCompletePartialOrder left right
  support := fun value =>
    left.support value.fst ∪ right.support value.snd
  support_mono := by
    intro first second ordered
    exact
      Finset.union_subset_union
        (left.support_mono ordered.1)
        (right.support_mono ordered.2)
  support_omegaSup_bounded := by
    intro chain
    rcases
        left.support_omegaSup_bounded (fstChain chain) with
      ⟨leftIndex, leftBound⟩
    rcases
        right.support_omegaSup_bounded (sndChain chain) with
      ⟨rightIndex, rightBound⟩
    refine ⟨max leftIndex rightIndex, ?_⟩
    exact
      Finset.union_subset_union
        (leftBound.trans
          (left.support_mono
            ((fstChain chain).monotone
              (Nat.le_max_left _ _))))
        (rightBound.trans
          (right.support_mono
            ((sndChain chain).monotone
              (Nat.le_max_right _ _))))

/-! ## Continuous tensor maps -/

/-- Pointwise action of a pair of supported continuous maps as an order hom. -/
def mapOrderHom
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right') :
    Carrier left right →o Carrier left' right' where
  toFun := fun value =>
    { fst := first value.fst
      snd := second value.snd
      separated := by
        rw [first.support_eq, second.support_eq]
        exact value.separated }
  monotone' := by
    intro lower upper ordered
    exact
      ⟨first.toContinuousHom.monotone ordered.1,
        second.toContinuousHom.monotone ordered.2⟩

@[simp]
theorem mapOrderHom_fst
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right')
    (value : Carrier left right) :
    (mapOrderHom first second value).fst =
      first value.fst :=
  rfl

@[simp]
theorem mapOrderHom_snd
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right')
    (value : Carrier left right) :
    (mapOrderHom first second value).snd =
      second value.snd :=
  rfl

/-- The pointwise action on separated pairs is omega-continuous. -/
def mapContinuous
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right') :
    Carrier left right →𝒄 Carrier left' right' where
  toOrderHom := mapOrderHom first second
  map_ωSup' := by
    intro chain
    apply Carrier.ext
    · change
        first.toContinuousHom (ωSup (fstChain chain)) =
          ωSup
            (fstChain
              (chain.map (mapOrderHom first second)))
      rw [first.toContinuousHom.continuous]
      congr 1
    · change
        second.toContinuousHom (ωSup (sndChain chain)) =
          ωSup
            (sndChain
              (chain.map (mapOrderHom first second)))
      rw [second.toContinuousHom.continuous]
      congr 1

/-- Tensor action on continuous exact-support maps. -/
def map
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right') :
    SupportedOmegaCpo.Hom
      (tensor left right) (tensor left' right') where
  toContinuousHom := mapContinuous first second
  support_eq := by
    intro value
    change
      left'.support (first value.fst) ∪
          right'.support (second value.snd) =
        left.support value.fst ∪
          right.support value.snd
    rw [first.support_eq, second.support_eq]

@[simp]
theorem map_fst
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right')
    (value : (tensor left right).Carrier) :
    (map first second value).fst = first value.fst :=
  rfl

@[simp]
theorem map_snd
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right')
    (value : (tensor left right).Carrier) :
    (map first second value).snd = second value.snd :=
  rfl

/-- Tensor preserves identity maps. -/
theorem map_id
    (left right : SupportedOmegaCpo Resource) :
    map
        (SupportedOmegaCpo.Hom.id left)
        (SupportedOmegaCpo.Hom.id right) =
      SupportedOmegaCpo.Hom.id (tensor left right) := by
  ext value
  apply Carrier.ext <;> rfl

/-- Tensor preserves composition in both variables. -/
theorem map_comp
    {left middleLeft right finalLeft :
      SupportedOmegaCpo Resource}
    {left' middleRight right' finalRight :
      SupportedOmegaCpo Resource}
    (firstLeft : SupportedOmegaCpo.Hom left middleLeft)
    (secondLeft : SupportedOmegaCpo.Hom middleLeft right)
    (thirdLeft : SupportedOmegaCpo.Hom right finalLeft)
    (firstRight : SupportedOmegaCpo.Hom left' middleRight)
    (secondRight : SupportedOmegaCpo.Hom middleRight right')
    (thirdRight : SupportedOmegaCpo.Hom right' finalRight) :
    (map firstLeft firstRight).comp
        ((map secondLeft secondRight).comp
          (map thirdLeft thirdRight)) =
      map
        (firstLeft.comp (secondLeft.comp thirdLeft))
        (firstRight.comp (secondRight.comp thirdRight)) := by
  ext value
  apply Carrier.ext <;> rfl

/-! ## Unit and symmetry -/

/-- Tensor unit: the equality-ordered singleton with empty support. -/
def unit :
    SupportedOmegaCpo Resource where
  Carrier :=
    Cantilune.Pi.FMSCpoFinitePower.EqualityOrder PUnit
  omega := inferInstance
  support := fun _ => ∅
  support_mono := by
    intro first second ordered
    exact Finset.Subset.rfl
  support_omegaSup_bounded := by
    intro chain
    exact ⟨0, Finset.Subset.rfl⟩

/-- Swap of a separated pair as an order homomorphism. -/
def braidingOrderHom
    (left right : SupportedOmegaCpo Resource) :
    Carrier left right →o Carrier right left where
  toFun := fun value =>
    { fst := value.snd
      snd := value.fst
      separated := value.separated.symm }
  monotone' := by
    intro first second ordered
    exact ⟨ordered.2, ordered.1⟩

/-- Braiding is omega-continuous. -/
def braidingContinuous
    (left right : SupportedOmegaCpo Resource) :
    Carrier left right →𝒄 Carrier right left where
  toOrderHom := braidingOrderHom left right
  map_ωSup' := by
    intro chain
    apply Carrier.ext <;> rfl

/-- Braiding as a continuous exact-support map. -/
def braidingHom
    (left right : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom
      (tensor left right) (tensor right left) where
  toContinuousHom := braidingContinuous left right
  support_eq := by
    intro value
    exact Finset.union_comm _ _

/-- Separated tensor is symmetric by an actual categorical isomorphism. -/
def braiding
    (left right : SupportedOmegaCpo Resource) :
    tensor left right ≅ tensor right left where
  hom := braidingHom left right
  inv := braidingHom right left
  hom_inv_id := by
    change
      (braidingHom left right).comp
          (braidingHom right left) =
        SupportedOmegaCpo.Hom.id (tensor left right)
    ext value
    apply Carrier.ext <;> rfl
  inv_hom_id := by
    change
      (braidingHom right left).comp
          (braidingHom left right) =
        SupportedOmegaCpo.Hom.id (tensor right left)
    ext value
    apply Carrier.ext <;> rfl

/-- Naturality of the separated braiding. -/
theorem braiding_naturality
    {left left' right right' : SupportedOmegaCpo Resource}
    (first : SupportedOmegaCpo.Hom left left')
    (second : SupportedOmegaCpo.Hom right right') :
    (map first second).comp
        (braidingHom left' right') =
      (braidingHom left right).comp
        (map second first) := by
  ext value
  apply Carrier.ext <;> rfl

/-- The braiding is involutive before passing to any quotient. -/
theorem braiding_involutive
    (left right : SupportedOmegaCpo Resource) :
    (braidingHom left right).comp
        (braidingHom right left) =
      SupportedOmegaCpo.Hom.id (tensor left right) := by
  ext value
  apply Carrier.ext <;> rfl

/-! ## Associator and unitors -/

/-- Forward reassociation of a separated triple. -/
def associatorOrderHom
    (first second third : SupportedOmegaCpo Resource) :
    Carrier (tensor first second) third →o
      Carrier first (tensor second third) where
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
  monotone' := by
    intro lower upper ordered
    exact
      ⟨ordered.1.1,
        ⟨ordered.1.2, ordered.2⟩⟩

/-- Forward reassociation is omega-continuous. -/
def associatorContinuous
    (first second third : SupportedOmegaCpo Resource) :
    Carrier (tensor first second) third →𝒄
      Carrier first (tensor second third) where
  toOrderHom := associatorOrderHom first second third
  map_ωSup' := by
    intro chain
    apply Carrier.ext
    · rfl
    · apply Carrier.ext <;> rfl

/-- Forward associator as an exact-support continuous map. -/
def associatorHom
    (first second third : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom
      (tensor (tensor first second) third)
      (tensor first (tensor second third)) where
  toContinuousHom :=
    associatorContinuous first second third
  support_eq := by
    intro value
    exact
      (Finset.union_assoc
        (first.support value.fst.fst)
        (second.support value.fst.snd)
        (third.support value.snd)).symm

/-- Inverse reassociation of a separated triple. -/
def associatorInvOrderHom
    (first second third : SupportedOmegaCpo Resource) :
    Carrier first (tensor second third) →o
      Carrier (tensor first second) third where
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
  monotone' := by
    intro lower upper ordered
    exact
      ⟨⟨ordered.1, ordered.2.1⟩,
        ordered.2.2⟩

/-- Inverse reassociation is omega-continuous. -/
def associatorInvContinuous
    (first second third : SupportedOmegaCpo Resource) :
    Carrier first (tensor second third) →𝒄
      Carrier (tensor first second) third where
  toOrderHom := associatorInvOrderHom first second third
  map_ωSup' := by
    intro chain
    apply Carrier.ext
    · apply Carrier.ext <;> rfl
    · rfl

/-- Inverse associator as an exact-support continuous map. -/
def associatorInv
    (first second third : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom
      (tensor first (tensor second third))
      (tensor (tensor first second) third) where
  toContinuousHom :=
    associatorInvContinuous first second third
  support_eq := by
    intro value
    exact
      Finset.union_assoc
        (first.support value.fst)
        (second.support value.snd.fst)
        (third.support value.snd.snd)

/-- Separated tensor is associative by a continuous support-preserving iso. -/
def associator
    (first second third : SupportedOmegaCpo Resource) :
    tensor (tensor first second) third ≅
      tensor first (tensor second third) where
  hom := associatorHom first second third
  inv := associatorInv first second third
  hom_inv_id := by
    change
      (associatorHom first second third).comp
          (associatorInv first second third) =
        SupportedOmegaCpo.Hom.id
          (tensor (tensor first second) third)
    ext value
    apply Carrier.ext
    · apply Carrier.ext <;> rfl
    · rfl
  inv_hom_id := by
    change
      (associatorInv first second third).comp
          (associatorHom first second third) =
        SupportedOmegaCpo.Hom.id
          (tensor first (tensor second third))
    ext value
    apply Carrier.ext
    · rfl
    · apply Carrier.ext <;> rfl

/-- Naturality of the continuous separated associator. -/
theorem associator_naturality
    {first first' second second' third third' :
      SupportedOmegaCpo Resource}
    (firstMap : SupportedOmegaCpo.Hom first first')
    (secondMap : SupportedOmegaCpo.Hom second second')
    (thirdMap : SupportedOmegaCpo.Hom third third') :
    (map (map firstMap secondMap) thirdMap).comp
        (associatorHom first' second' third') =
      (associatorHom first second third).comp
        (map firstMap (map secondMap thirdMap)) := by
  ext value
  apply Carrier.ext
  · rfl
  · apply Carrier.ext <;> rfl

/-- Continuous projection from `unit ⊗ object`. -/
def leftUnitorHom
    (object : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom (tensor unit object) object where
  toContinuousHom := by
    refine
      { toOrderHom := sndOrderHom unit object
        map_ωSup' := ?_ }
    intro chain
    rfl
  support_eq := by
    intro value
    change
      object.support value.snd =
        ∅ ∪ object.support value.snd
    simp

/-- Continuous insertion into `unit ⊗ object`. -/
def leftUnitorInv
    (object : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom object (tensor unit object) where
  toContinuousHom := by
    refine
      { toOrderHom :=
          { toFun := fun value =>
              { fst := PUnit.unit
                snd := value
                separated := by simp [unit] }
            monotone' := ?_ }
        map_ωSup' := ?_ }
    · intro first second ordered
      exact ⟨rfl, ordered⟩
    · intro chain
      apply Carrier.ext
      · rfl
      · rfl
  support_eq := by
    intro value
    change
      ∅ ∪ object.support value =
        object.support value
    simp

/-- Left unitor as a continuous support-preserving isomorphism. -/
def leftUnitor
    (object : SupportedOmegaCpo Resource) :
    tensor unit object ≅ object where
  hom := leftUnitorHom object
  inv := leftUnitorInv object
  hom_inv_id := by
    change
      (leftUnitorHom object).comp
          (leftUnitorInv object) =
        SupportedOmegaCpo.Hom.id (tensor unit object)
    ext value
    apply Carrier.ext
    · cases value.fst
      rfl
    · rfl
  inv_hom_id := by
    change
      (leftUnitorInv object).comp
          (leftUnitorHom object) =
        SupportedOmegaCpo.Hom.id object
    ext value
    rfl

/-- Continuous projection from `object ⊗ unit`. -/
def rightUnitorHom
    (object : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom (tensor object unit) object where
  toContinuousHom := by
    refine
      { toOrderHom := fstOrderHom object unit
        map_ωSup' := ?_ }
    intro chain
    rfl
  support_eq := by
    intro value
    change
      object.support value.fst =
        object.support value.fst ∪ ∅
    simp

/-- Continuous insertion into `object ⊗ unit`. -/
def rightUnitorInv
    (object : SupportedOmegaCpo Resource) :
    SupportedOmegaCpo.Hom object (tensor object unit) where
  toContinuousHom := by
    refine
      { toOrderHom :=
          { toFun := fun value =>
              { fst := value
                snd := PUnit.unit
                separated := by simp [unit] }
            monotone' := ?_ }
        map_ωSup' := ?_ }
    · intro first second ordered
      exact ⟨ordered, rfl⟩
    · intro chain
      apply Carrier.ext
      · rfl
      · rfl
  support_eq := by
    intro value
    change
      object.support value ∪ ∅ =
        object.support value
    simp

/-- Right unitor as a continuous support-preserving isomorphism. -/
def rightUnitor
    (object : SupportedOmegaCpo Resource) :
    tensor object unit ≅ object where
  hom := rightUnitorHom object
  inv := rightUnitorInv object
  hom_inv_id := by
    change
      (rightUnitorHom object).comp
          (rightUnitorInv object) =
        SupportedOmegaCpo.Hom.id (tensor object unit)
    ext value
    apply Carrier.ext
    · rfl
    · cases value.snd
      rfl
  inv_hom_id := by
    change
      (rightUnitorInv object).comp
          (rightUnitorHom object) =
        SupportedOmegaCpo.Hom.id object
    ext value
    rfl

/-! ## Naturality and coherence -/

/-- Naturality of the left unitor. -/
theorem leftUnitor_naturality
    {first second : SupportedOmegaCpo Resource}
    (morphism : SupportedOmegaCpo.Hom first second) :
    (map
        (SupportedOmegaCpo.Hom.id unit)
        morphism).comp
          (leftUnitorHom second) =
      (leftUnitorHom first).comp morphism := by
  ext value
  rfl

/-- Naturality of the right unitor. -/
theorem rightUnitor_naturality
    {first second : SupportedOmegaCpo Resource}
    (morphism : SupportedOmegaCpo.Hom first second) :
    (map
        morphism
        (SupportedOmegaCpo.Hom.id unit)).comp
          (rightUnitorHom second) =
      (rightUnitorHom first).comp morphism := by
  ext value
  rfl

/-- Mac Lane's pentagon for the continuous separated associator. -/
theorem associator_pentagon
    (first second third fourth : SupportedOmegaCpo Resource) :
    (associatorHom (tensor first second) third fourth).comp
        (associatorHom first second (tensor third fourth)) =
      ((map
          (associatorHom first second third)
          (SupportedOmegaCpo.Hom.id fourth)).comp
        (associatorHom first (tensor second third) fourth)).comp
          (map
            (SupportedOmegaCpo.Hom.id first)
            (associatorHom second third fourth)) := by
  ext value
  apply Carrier.ext
  · rfl
  · apply Carrier.ext
    · rfl
    · apply Carrier.ext <;> rfl

/-- Triangle coherence for the continuous associator and unitors. -/
theorem unitor_triangle
    (first second : SupportedOmegaCpo Resource) :
    (associatorHom first unit second).comp
        (map
          (SupportedOmegaCpo.Hom.id first)
          (leftUnitorHom second)) =
      map
        (rightUnitorHom first)
        (SupportedOmegaCpo.Hom.id second) := by
  ext value
  apply Carrier.ext
  · rfl
  · rfl

/-- Hexagon coherence for the continuous associator and braiding. -/
theorem braiding_hexagon
    (first second third : SupportedOmegaCpo Resource) :
    ((associatorHom first second third).comp
        (braidingHom first (tensor second third))).comp
          (associatorHom second third first) =
      ((map
          (braidingHom first second)
          (SupportedOmegaCpo.Hom.id third)).comp
        (associatorHom second first third)).comp
          (map
            (SupportedOmegaCpo.Hom.id second)
            (braidingHom first third)) := by
  ext value
  apply Carrier.ext
  · rfl
  · apply Carrier.ext <;> rfl

end Separated

end Cantilune.Pi.FMSCpoFiniteSupportTensor
