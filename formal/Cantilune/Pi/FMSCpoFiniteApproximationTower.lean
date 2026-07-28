import Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous
import Cantilune.Pi.FMSCpoOmegaScottWorldMonad
import Mathlib.CategoryTheory.Limits.Shapes.IsTerminal

/-!
# A genuine finite approximation tower for the unseparated action-power functor

This module constructs the initial finite stages

`Approx 0 = 0` and `Approx (n + 1) = F (Approx n)`

for the locally continuous endofunctor

`F = actionFunctor ⋙ pointwiseOmegaScottPowerFunctor`.

The base is a genuine pointwise-empty world model.  The seed arrow is the
continuous `tau` injection followed by the pointwise principal lower-set
embedding.  Subsequent arrows are obtained by functorial iteration, as in the
standard initial chain.

This is only a finite approximation tower.  In fact, the first nonempty
lower-power stage has no morphism back to the empty stage, so these connecting
maps cannot form embedding-projection pairs.  No colimit, algebraic compactness,
recursive-domain solution, adequacy, or full abstraction is claimed.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteApproximationTower

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoNameAbstractionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad
open Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

universe u

/-! ## A genuine initial world model -/

/-- An explicitly empty carrier, used to avoid assuming a library empty omega-CPO. -/
inductive EmptyCarrier : Type

/-- Elimination from the explicitly empty carrier. -/
def emptyCarrierElim {motive : Sort u}
    (value : EmptyCarrier) : motive :=
  nomatch value

/--
The empty carrier is an omega-CPO.  Its apparent supremum operation is
vacuous: an omega-chain into an empty type would itself provide an element at
index zero.
-/
instance emptyCarrierOmegaCompletePartialOrder :
    OmegaCompletePartialOrder EmptyCarrier where
  le := fun _ _ => True
  le_refl := by
    intro value
    exact emptyCarrierElim value
  le_trans := by
    intro first
    exact emptyCarrierElim first
  le_antisymm := by
    intro first
    exact emptyCarrierElim first
  ωSup chain := chain 0
  le_ωSup := by
    intro chain index
    exact True.intro
  ωSup_le := by
    intro chain bound upper
    exact True.intro

/-- The explicitly empty omega-CPO object. -/
abbrev emptyCpo : ωCPO :=
  ωCPO.of EmptyCarrier

/-- There is a unique continuous map from the empty omega-CPO to any omega-CPO. -/
def emptyContinuousHom (target : ωCPO) :
    emptyCpo ⟶ target where
  toFun value := emptyCarrierElim value
  monotone' := by
    intro first
    exact emptyCarrierElim first
  map_ωSup' := by
    intro chain
    exact emptyCarrierElim (chain 0)

/-- The pointwise-empty finite-world model. -/
def emptyWorldModel :
    World ⥤ ωCPO where
  obj _ := emptyCpo
  map _ := emptyContinuousHom emptyCpo
  map_id world := by
    apply ContinuousHom.ext
    intro value
    exact emptyCarrierElim value
  map_comp first second := by
    apply ContinuousHom.ext
    intro value
    exact emptyCarrierElim value

/-- The unique world-natural transformation from the empty model. -/
def emptyWorldModelTo (target : World ⥤ ωCPO) :
    emptyWorldModel ⟶ target where
  app world := emptyContinuousHom (target.obj world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro value
    exact emptyCarrierElim value

/-- Every transformation out of the empty model is the explicit empty map. -/
theorem emptyWorldModelTo_unique
    (target : World ⥤ ωCPO)
    (transformation : emptyWorldModel ⟶ target) :
    transformation = emptyWorldModelTo target := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  exact emptyCarrierElim value

/-- The pointwise-empty model is genuinely initial in `World ⥤ ωCPO`. -/
def emptyWorldModelIsInitial :
    IsInitial emptyWorldModel :=
  IsInitial.ofUniqueHom
    emptyWorldModelTo emptyWorldModelTo_unique

/-! ## The continuous tau/principal seed -/

/-- Continuous right injection into the separated omega-CPO coproduct. -/
def sumInrContinuous
    {α β : Type}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    β →𝒄 (α ⊕ β) where
  toFun := Sum.inr
  monotone' := by
    intro first second ordered
    exact Sum.inr_le_inr_iff.2 ordered
  map_ωSup' := by
    intro chain
    change
      Sum.inr (ωSup chain) =
        ωSup
          (Cantilune.Pi.FMSCpoSeparatedSum.inrChain
            (α := α) chain)
    exact
      (Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain
        (α := α) chain).symm

@[simp]
theorem sumInrContinuous_apply
    {α β : Type}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (value : β) :
    (sumInrContinuous : β →𝒄 (α ⊕ β)) value =
      Sum.inr value :=
  rfl

/-- Input summand of the exact action representation. -/
abbrev InputPart
    (model : World ⥤ ωCPO) (world : World) :=
  NameTag world × NameAbstractionCarrier model world

/-- Free-output summand of the exact action representation. -/
abbrev FreeOutputPart
    (model : World ⥤ ωCPO) (world : World) :=
  (NameTag world × NameTag world) × model.obj world

/-- Bound-output summand of the exact action representation. -/
abbrev BoundOutputPart
    (model : World ⥤ ωCPO) (world : World) :=
  NameTag world × model.obj (world + 1)

/--
The exact `tau` constructor is a continuous map into the action object.  It is
the composite of the three continuous right coproduct injections.
-/
def tauComponent
    (model : World ⥤ ωCPO) (world : World) :
    model.obj world ⟶ (actionFunctor.obj model).obj world :=
  (sumInrContinuous
      (α := InputPart model world)
      (β :=
        FreeOutputPart model world ⊕
          (BoundOutputPart model world ⊕ model.obj world))).comp
    ((sumInrContinuous
        (α := FreeOutputPart model world)
        (β := BoundOutputPart model world ⊕ model.obj world)).comp
      (sumInrContinuous
        (α := BoundOutputPart model world)
        (β := model.obj world)))

@[simp]
theorem tauComponent_apply
    (model : World ⥤ ωCPO) (world : World)
    (continuation : model.obj world) :
    tauComponent model world continuation =
      Sum.inr (Sum.inr (Sum.inr continuation)) :=
  by
    change
      Sum.inr (Sum.inr (Sum.inr continuation)) =
        Sum.inr (Sum.inr (Sum.inr continuation))
    rfl

/-- `tau` is natural in finite-world injections. -/
def tauModelTransformation
    (model : World ⥤ ωCPO) :
    model ⟶ actionFunctor.obj model where
  app world := tauComponent model world
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro continuation
    change
      Sum.inr
          (Sum.inr
            (Sum.inr
              (model.map injection continuation))) =
        actionWorldMap model injection
          (Sum.inr (Sum.inr (Sum.inr continuation)))
    exact
      (actionWorldMap_tau
        model injection continuation).symm

/-- `tau` is also natural in the model argument. -/
def tauNaturalTransformation :
    𝟭 (World ⥤ ωCPO) ⟶ actionFunctor where
  app model := tauModelTransformation model
  naturality := by
    intro source target transformation
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro continuation
    change
      Sum.inr
          (Sum.inr
            (Sum.inr
              (transformation.app world continuation))) =
        actionModelMapComponent transformation world
          (Sum.inr (Sum.inr (Sum.inr continuation)))
    exact
      (actionModelMap_tau
        transformation world continuation).symm

/-- The actual endofunctor whose finite iteration is constructed below. -/
abbrev agentPowerFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  actionFunctor ⋙ pointwiseOmegaScottPowerFunctor

/-- The already-proved enriched local continuity applies to this exact functor. -/
theorem agentPowerFunctorLocallyContinuous :
    EndofunctorLocallyContinuous agentPowerFunctor :=
  actionThenOmegaScottPowerLocallyContinuous

/-- The pointwise principal embedding, exposed with the exact functor alias. -/
def principalNaturalTransformation :
    𝟭 (World ⥤ ωCPO) ⟶ pointwiseOmegaScottPowerFunctor :=
  omegaScottWorldMonad.η

/--
The canonical `tau`-then-principal transformation `Id => F`.  It supplies the
seed arrow from the initial object.
-/
def approximationStep :
    𝟭 (World ⥤ ωCPO) ⟶ agentPowerFunctor :=
  tauNaturalTransformation ≫
    Functor.whiskerLeft
      actionFunctor principalNaturalTransformation

@[simp]
theorem approximationStep_apply
    (model : World ⥤ ωCPO)
    (world : World)
    (continuation : model.obj world) :
    (approximationStep.app model).app world continuation =
      principalRaw
        (Sum.inr (Sum.inr (Sum.inr continuation))) :=
  by
    change
      principalRaw
          (Sum.inr (Sum.inr (Sum.inr continuation))) =
        principalRaw
          (Sum.inr (Sum.inr (Sum.inr continuation)))
    rfl

/-- Naturality of the canonical step in the model argument. -/
theorem approximationStep_naturality
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target) :
    transformation ≫ approximationStep.app target =
      approximationStep.app source ≫
        agentPowerFunctor.map transformation :=
  approximationStep.naturality transformation

/-! ## Finite iteration and its connecting chain -/

/-- Finite object approximants, starting from the genuine initial model. -/
def Approximation : Nat → (World ⥤ ωCPO)
  | 0 => emptyWorldModel
  | depth + 1 =>
      agentPowerFunctor.obj (Approximation depth)

@[simp]
theorem approximation_zero :
    Approximation 0 = emptyWorldModel :=
  rfl

@[simp]
theorem approximation_successor (depth : Nat) :
    Approximation (depth + 1) =
      agentPowerFunctor.obj (Approximation depth) :=
  rfl

/--
The standard initial-chain connectors.  The seed is `tau` followed by
principal; every later connector is its functorial image.
-/
def approximationConnection :
    (depth : Nat) →
      Approximation depth ⟶ Approximation (depth + 1)
  | 0 => approximationStep.app emptyWorldModel
  | depth + 1 =>
      agentPowerFunctor.map (approximationConnection depth)

@[simp]
theorem approximationConnection_zero :
    approximationConnection 0 =
      approximationStep.app emptyWorldModel :=
  rfl

@[simp]
theorem approximationConnection_successor
    (depth : Nat) :
    approximationConnection (depth + 1) =
      agentPowerFunctor.map
        (approximationConnection depth) :=
  rfl

/-- Every connector is natural in finite-world injections. -/
theorem approximationConnection_world_naturality
    (depth : Nat)
    {source target : World}
    (injection : source ⟶ target) :
    (Approximation depth).map injection ≫
        (approximationConnection depth).app target =
      (approximationConnection depth).app source ≫
        (Approximation (depth + 1)).map injection :=
  (approximationConnection depth).naturality injection

/-- Every world component of every connector is omega-continuous. -/
theorem approximationConnection_continuous
    (depth : Nat)
    (world : World)
    (chain : Chain ((Approximation depth).obj world)) :
    (approximationConnection depth).app world (ωSup chain) =
      ωSup
        (chain.map
          ((approximationConnection depth).app
            world).toOrderHom) :=
  ((approximationConnection depth).app world).map_ωSup' chain

/--
Finite composites along the connecting chain.  This packages exactly the
composition data available before constructing any categorical colimit.
-/
def approximationPath
    (start : Nat) :
    (length : Nat) →
      Approximation start ⟶
        Approximation (start + length)
  | 0 => 𝟙 _
  | length + 1 =>
      approximationPath start length ≫
        approximationConnection (start + length)

@[simp]
theorem approximationPath_zero (start : Nat) :
    approximationPath start 0 =
      𝟙 (Approximation start) :=
  rfl

@[simp]
theorem approximationPath_successor
    (start length : Nat) :
    approximationPath start (length + 1) =
      approximationPath start length ≫
        approximationConnection (start + length) :=
  rfl

/-- A finite path remains a world-natural transformation. -/
theorem approximationPath_world_naturality
    (start length : Nat)
    {source target : World}
    (injection : source ⟶ target) :
    (Approximation start).map injection ≫
        (approximationPath start length).app target =
      (approximationPath start length).app source ≫
        (Approximation (start + length)).map injection :=
  (approximationPath start length).naturality injection

/-- Each finite path component is omega-continuous. -/
theorem approximationPath_continuous
    (start length : Nat)
    (world : World)
    (chain : Chain ((Approximation start).obj world)) :
    (approximationPath start length).app world (ωSup chain) =
      ωSup
        (chain.map
          ((approximationPath start length).app
            world).toOrderHom) :=
  ((approximationPath start length).app world).map_ωSup' chain

/-! ## Mechanical obstruction to an embedding-projection chain -/

/-- The first lower-power stage is inhabited by its order bottom. -/
def firstStageWitness :
    (Approximation 1).obj 0 :=
  by
    change
      OmegaScottPower
        ((actionFunctor.obj emptyWorldModel).obj 0)
    exact ⟨∅, isClosed_empty⟩

/--
There is no world-natural transformation from the first stage back to the
empty stage: evaluating it at world zero on `firstStageWitness` would construct
an element of `EmptyCarrier`.
-/
theorem no_firstStage_to_empty :
    IsEmpty (Approximation 1 ⟶ Approximation 0) := by
  constructor
  intro backward
  exact
    emptyCarrierElim
      (backward.app 0 firstStageWitness)

/-- In particular, the seed connector has no retraction. -/
theorem no_seed_retraction :
    ¬ ∃ backward : Approximation 1 ⟶ Approximation 0,
        approximationConnection 0 ≫ backward =
          𝟙 (Approximation 0) := by
  rintro ⟨backward, retraction⟩
  exact no_firstStage_to_empty.false backward

/--
The first two stages are not isomorphic.  This is a concrete barrier to
silently upgrading the finite tower to a fixed-point construction.
-/
theorem no_initial_firstStage_iso :
    IsEmpty (Approximation 0 ≅ Approximation 1) := by
  constructor
  intro stageIso
  exact no_firstStage_to_empty.false stageIso.inv

end Cantilune.Pi.FMSCpoFiniteApproximationTower
