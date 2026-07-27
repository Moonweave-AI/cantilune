import Cantilune.Pi.FMSFinitePower
import Cantilune.Pi.FMSCpoWorld
import Mathlib.Order.Category.OmegaCompletePartialOrder

/-!
# Finite nondeterminism on discrete omega-CPOs

Finite powersets do not form an omega-CPO under inclusion when the carrier is
infinite: an increasing chain of finite sets may have infinite union.  This
module therefore states and proves the strongest unconditional CPO result
available for `Finset`: the free-semilattice monad on the full subcategory of
discrete omega-CPOs, together with a full and faithful realization in
mathlib's actual `ωCPO` category and explicit symmetric Fubini coherence.

This is the equality-ordered Set fragment used in the finite FMS model.  It is
not Abramsky's powerdomain on all omega-CPOs.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSCpoFinitePower

open CategoryTheory
open Cantilune.Pi.FMSFinitePower

/-- Equality order, kept as a type synonym to avoid changing an existing order. -/
def EqualityOrder (α : Type u) := α

namespace EqualityOrder

instance {α : Type u} : LE (EqualityOrder α) :=
  ⟨Eq⟩

instance {α : Type u} : PartialOrder (EqualityOrder α) where
  le_refl _ := rfl
  le_trans := by
    intro first second third firstSecond secondThird
    exact Eq.trans firstSecond secondThird
  le_antisymm := by
    intro first second firstSecond _secondFirst
    exact firstSecond

instance {α : Type u} :
    OmegaCompletePartialOrder (EqualityOrder α) where
  ωSup chain := chain 0
  le_ωSup chain index := by
    change chain index = chain 0
    exact (chain.monotone (Nat.zero_le index)).symm
  ωSup_le chain value upper := upper 0

/-- Every function between equality-ordered omega-CPOs is continuous. -/
def continuous (function : α → β) :
    EqualityOrder α →𝒄 EqualityOrder β where
  toFun := function
  monotone' := by
    intro left right equal
    subst right
    rfl
  map_ωSup' chain := by
    change function (chain 0) = function (chain 0)
    rfl

/-- Every function from equality order into an arbitrary omega-CPO is continuous. -/
def continuousTo [OmegaCompletePartialOrder β] (function : α → β) :
    EqualityOrder α →𝒄 β where
  toFun := function
  monotone' := by
    intro left right equal
    subst right
    exact le_rfl
  map_ωSup' chain := by
    let mapHom : EqualityOrder α →o β :=
      { toFun := function
        monotone' := by
          intro left right equal
          subst right
          exact le_rfl }
    let mapped : OmegaCompletePartialOrder.Chain β :=
      chain.map mapHom
    change function (chain 0) = OmegaCompletePartialOrder.ωSup mapped
    apply le_antisymm
    · exact OmegaCompletePartialOrder.le_ωSup mapped 0
    · apply OmegaCompletePartialOrder.ωSup_le
      intro index
      have equal := chain.monotone (Nat.zero_le index)
      change chain 0 = chain index at equal
      change function (chain index) ≤ function (chain 0)
      rw [← equal]

@[simp]
theorem continuous_apply (function : α → β) (value : α) :
    continuous function value = function value :=
  rfl

end EqualityOrder

/-- Objects of the full subcategory of equality-ordered omega-CPOs. -/
structure DiscreteCPO where
  carrier : Type u

instance : CoeSort DiscreteCPO (Type u) :=
  ⟨DiscreteCPO.carrier⟩

instance discreteCategory : LargeCategory DiscreteCPO where
  Hom source target := source → target
  id _ := id
  comp first second := second ∘ first
  id_comp _ := rfl
  comp_id _ := rfl
  assoc _ _ _ := rfl

/-- Realize a discrete object and every function as an actual continuous map. -/
def realize : DiscreteCPO ⥤ ωCPO where
  obj object := ωCPO.of (EqualityOrder object)
  map morphism := EqualityOrder.continuous morphism
  map_id _ := rfl
  map_comp _ _ := rfl

/-- Equality-order realization directly from `Type`. -/
def equalityCpoFunctor : Type u ⥤ ωCPO where
  obj type := ωCPO.of (EqualityOrder type)
  map function := EqualityOrder.continuous function
  map_id _ := rfl
  map_comp _ _ := rfl

instance : realize.Faithful where
  map_injective proof := by
    funext value
    exact congrArg (fun morphism => morphism value) proof

instance : realize.Full where
  map_surjective morphism :=
    ⟨fun value => morphism value, rfl⟩

/-- Finite-powerset endofunctor on discrete omega-CPOs. -/
def finitePowerFunctor : DiscreteCPO ⥤ DiscreteCPO where
  obj object := ⟨Finset object⟩
  map morphism := Finset.image morphism
  map_id object := by
    change Finset.image id = id
    funext values
    simp
  map_comp first second := by
    change
      Finset.image (second ∘ first) =
        Finset.image second ∘ Finset.image first
    funext values
    simp [Finset.image_image]

/-- Pointwise singleton. -/
def finitePowerUnit : 𝟭 DiscreteCPO ⟶ finitePowerFunctor where
  app object := fun value : object => ({value} : Finset object)
  naturality := by
    intro source target morphism
    change
      (fun value : source => ({morphism value} : Finset target)) =
        fun value => Finset.image morphism ({value} : Finset source)
    funext value
    simp

/-- Flatten a finite set of finite sets by union. -/
def finitePowerMultiplication :
    finitePowerFunctor ⋙ finitePowerFunctor ⟶ finitePowerFunctor where
  app object := fun values : Finset (Finset object) => flatten values
  naturality := by
    intro source target morphism
    dsimp [finitePowerFunctor, CategoryStruct.comp, discreteCategory]
    funext sets
    simp only [Function.comp_apply]
    apply Finset.ext
    intro value
    simp [flatten, joinM, Finset.bind_def]
    aesop

/--
The genuine finite-powerset monad on the category of discrete omega-CPOs.
Every component is realized by an actual continuous map in `ωCPO`.
-/
def finitePowerMonad : CategoryTheory.Monad DiscreteCPO where
  toFunctor := finitePowerFunctor
  η := finitePowerUnit
  μ := finitePowerMultiplication
  assoc object := by
    dsimp [finitePowerFunctor, finitePowerMultiplication,
      CategoryStruct.comp, discreteCategory]
    funext families
    simp only [Function.comp_apply]
    apply Finset.ext
    intro value
    simp [flatten, joinM, Finset.bind_def]
    aesop
  left_unit object := by
    change
      (fun values : Finset object =>
        flatten ({values} : Finset (Finset object))) =
      id
    funext values
    simp [flatten, joinM, Finset.bind_def]
  right_unit object := by
    dsimp [finitePowerFunctor, finitePowerMultiplication, finitePowerUnit,
      CategoryStruct.comp, CategoryStruct.id, discreteCategory]
    funext values
    simp only [Function.comp_apply]
    apply Finset.ext
    intro value
    simp [flatten, joinM, Finset.bind_def]

@[simp]
theorem unit_apply (object : DiscreteCPO) (value : object) :
    finitePowerMonad.η.app object value = ({value} : Finset object) :=
  by rfl

@[simp]
theorem multiplication_apply (object : DiscreteCPO)
    (values : Finset (Finset object)) :
    finitePowerMonad.μ.app object values = flatten values :=
  rfl

/-- The continuous realization of finite choice. -/
def choiceContinuous (object : DiscreteCPO) :
    EqualityOrder (Finset object × Finset object) →𝒄
      EqualityOrder (Finset object) :=
  EqualityOrder.continuous fun pair => pair.1 ∪ pair.2

/-- Symmetric Fubini map: choose one value independently from each side. -/
def fubini (left : Finset α) (right : Finset β) :
    Finset (α × β) :=
  left.product right

/-- The Fubini map is an actual continuous morphism on discrete CPOs. -/
def fubiniContinuous (left right : DiscreteCPO) :
    EqualityOrder (Finset left × Finset right) →𝒄
      EqualityOrder (Finset (left × right)) :=
  EqualityOrder.continuous fun pair => fubini pair.1 pair.2

@[simp]
theorem mem_fubini {pair : α × β}
    {left : Finset α} {right : Finset β} :
    pair ∈ fubini left right ↔ pair.1 ∈ left ∧ pair.2 ∈ right := by
  simp [fubini]

theorem fubini_natural
    (leftMap : α → γ) (rightMap : β → δ)
    (left : Finset α) (right : Finset β) :
    Finset.image
        (fun pair => (leftMap pair.1, rightMap pair.2))
        (fubini left right) =
      fubini (left.image leftMap) (right.image rightMap) := by
  ext pair
  simp [fubini]
  aesop

@[simp]
theorem fubini_unit (left : α) (right : β) :
    fubini ({left} : Finset α) ({right} : Finset β) =
      ({(left, right)} : Finset (α × β)) := by
  ext pair
  simp [fubini, Prod.ext_iff]

theorem fubini_symmetry (left : Finset α) (right : Finset β) :
    Finset.image (fun pair : α × β => (pair.2, pair.1))
        (fubini left right) =
      fubini right left := by
  ext pair
  simp [fubini]
  aesop

theorem fubini_associativity
    (first : Finset α) (second : Finset β) (third : Finset γ) :
    Finset.image
        (fun pair : (α × β) × γ => (pair.1.1, pair.1.2, pair.2))
        (fubini (fubini first second) third) =
      fubini first (fubini second third) := by
  ext value
  simp [fubini]
  aesop

/--
Fubini is compatible with monad multiplication: flattening either finite
family before pairing equals flattening all pairwise products afterwards.
-/
theorem fubini_multiplication
    (left : Finset (Finset α)) (right : Finset (Finset β)) :
    fubini (flatten left) (flatten right) =
      flatten
        (fubini left right |>.image
          (fun pair => fubini pair.1 pair.2)) := by
  ext pair
  simp [fubini, flatten, joinM, Finset.bind_def]
  aesop

/-! ## Pointwise finite power and finite-world shift -/

/--
Postcomposition lifts the discrete finite-power functor pointwise to any
functor category.  In particular this is the finite/equality-ordered fragment
of nondeterminism on `DiscreteCPO^I`.
-/
def pointwiseDiscretePowerFunctor {I : Type v} [Category I] :
    (I ⥤ DiscreteCPO) ⥤ (I ⥤ DiscreteCPO) where
  obj model := model ⋙ finitePowerFunctor
  map transformation :=
    Functor.whiskerRight transformation finitePowerFunctor
  map_id model := by
    exact NatTrans.ext (funext fun object =>
      finitePowerFunctor.map_id (model.obj object))
  map_comp first second := by
    exact NatTrans.ext (funext fun object =>
      finitePowerFunctor.map_comp
        (first.app object) (second.app object))

/-- Pointwise singleton on `DiscreteCPO^I`. -/
def pointwiseDiscreteUnit {I : Type v} [Category I] :
    𝟭 (I ⥤ DiscreteCPO) ⟶ pointwiseDiscretePowerFunctor (I := I) where
  app model := Functor.whiskerLeft model finitePowerUnit
  naturality := by
    intro source target transformation
    exact NatTrans.ext (funext fun object =>
      finitePowerUnit.naturality (transformation.app object))

/-- Pointwise finite union on `DiscreteCPO^I`. -/
def pointwiseDiscreteMultiplication {I : Type v} [Category I] :
    pointwiseDiscretePowerFunctor (I := I) ⋙
        pointwiseDiscretePowerFunctor (I := I) ⟶
      pointwiseDiscretePowerFunctor (I := I) where
  app model := Functor.whiskerLeft model finitePowerMultiplication
  naturality := by
    intro source target transformation
    exact NatTrans.ext (funext fun object =>
      finitePowerMultiplication.naturality (transformation.app object))

/--
The genuine pointwise finite-powerset monad on equality-ordered CPO-valued
functors.  This is still a theorem about the discrete full subcategory, not
an Abramsky powerdomain on all of `ωCPO`.
-/
def pointwiseDiscretePowerMonad {I : Type v} [Category I] :
    CategoryTheory.Monad (I ⥤ DiscreteCPO) where
  toFunctor := pointwiseDiscretePowerFunctor
  η := pointwiseDiscreteUnit (I := I)
  μ := pointwiseDiscreteMultiplication (I := I)
  assoc model := by
    exact NatTrans.ext (funext fun object =>
      finitePowerMonad.assoc (model.obj object))
  left_unit model := by
    exact NatTrans.ext (funext fun object =>
      finitePowerMonad.left_unit (model.obj object))
  right_unit model := by
    exact NatTrans.ext (funext fun object =>
      finitePowerMonad.right_unit (model.obj object))

/-- Finite-world allocation shift on discrete CPO-valued models. -/
def discreteShift :
    (FMSModel.World ⥤ DiscreteCPO) ⥤
      (FMSModel.World ⥤ DiscreteCPO) where
  obj model := FMSCpoWorld.successorWorld ⋙ model
  map transformation :=
    Functor.whiskerLeft FMSCpoWorld.successorWorld transformation
  map_id model := by
    ext world
    rfl
  map_comp first second := by
    ext world
    rfl

/-- Allocation along `up : n ⟶ n+1` in the discrete fragment. -/
def discreteAllocate (model : FMSModel.World ⥤ DiscreteCPO) :
    model ⟶ discreteShift.obj model where
  app world := model.map (FMSCpoWorld.worldUp.app world)
  naturality := by
    intro source target injection
    change
      model.map injection ≫ model.map (FMSCpoWorld.worldUp.app target) =
        model.map (FMSCpoWorld.worldUp.app source) ≫
          model.map (FMSCpoWorld.successorWorld.map injection)
    rw [← model.map_comp, ← model.map_comp]
    exact congrArg model.map (FMSCpoWorld.worldUp.naturality injection)

/--
Shift and pointwise finite power commute strictly: one is precomposition in
the world and the other is postcomposition in the value category.
-/
def shiftFinitePowerIso :
    discreteShift ⋙
        pointwiseDiscretePowerFunctor (I := FMSModel.World) ≅
      pointwiseDiscretePowerFunctor (I := FMSModel.World) ⋙
        discreteShift :=
  Iso.refl _

@[simp]
theorem shift_power_unit
    (model : FMSModel.World ⥤ DiscreteCPO)
    (world : FMSModel.World) (value : model.obj (world + 1)) :
    (((pointwiseDiscretePowerMonad (I := FMSModel.World)).η.app
        (discreteShift.obj model)).app world) value =
      (discreteShift.map
        ((pointwiseDiscretePowerMonad
          (I := FMSModel.World)).η.app model)).app world value :=
  rfl

@[simp]
theorem shift_power_multiplication
    (model : FMSModel.World ⥤ DiscreteCPO)
    (world : FMSModel.World)
    (values : Finset (Finset (model.obj (world + 1)))) :
    (((pointwiseDiscretePowerMonad (I := FMSModel.World)).μ.app
        (discreteShift.obj model)).app world) values =
      (discreteShift.map
        ((pointwiseDiscretePowerMonad
          (I := FMSModel.World)).μ.app model)).app world values :=
  rfl

/-- Realize every discrete world model as an actual `ωCPO` world model. -/
def pointwiseRealize :
    (FMSModel.World ⥤ DiscreteCPO) ⥤
      (FMSModel.World ⥤ ωCPO) where
  obj model := model ⋙ realize
  map transformation := Functor.whiskerRight transformation realize
  map_id model := by
    exact NatTrans.ext (funext fun world =>
      realize.map_id (model.obj world))
  map_comp first second := by
    exact NatTrans.ext (funext fun world =>
      realize.map_comp (first.app world) (second.app world))

/-- Discrete realization also commutes strictly with the world shift. -/
def realizeShiftIso :
    discreteShift ⋙ pointwiseRealize ≅
      pointwiseRealize ⋙ FMSCpoWorld.shift :=
  Iso.refl _

@[simp]
theorem realize_allocate
    (model : FMSModel.World ⥤ DiscreteCPO)
    (world : FMSModel.World) (value : model.obj world) :
    (pointwiseRealize.map (discreteAllocate model)).app world value =
      (FMSCpoWorld.allocate (pointwiseRealize.obj model)).app world value :=
  rfl

end Cantilune.Pi.FMSCpoFinitePower
